import { exportJWK, exportPKCS8, generateKeyPair, jwtVerify, SignJWT } from 'jose';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { exchangeAppleCode, revokeAppleToken, verifyAppleNotification } from '../../src/services/apple-auth.service.js';
import type { JWTPayload } from 'jose';

const audience = 'com.tallytracker.app';
const nonce = '126a59c2-18b8-4d47-97ed-cda5afec5167';
let appleKey: Awaited<ReturnType<typeof generateKeyPair>>;
let forgedKey: Awaited<ReturnType<typeof generateKeyPair>>;
let clientKey: Awaited<ReturnType<typeof generateKeyPair>>;
let publicKey: object;
let claims: JWTPayload;
let signingKey: CryptoKey;
let failProvider = false;
const usedCodes = new Set<string>();
const revoked: string[] = [];

async function token(payload: JWTPayload) {
    return new SignJWT(payload).setProtectedHeader({ alg: 'RS256', kid: 'apple-key' }).sign(signingKey);
}

beforeAll(async () => {
    appleKey = await generateKeyPair('RS256');
    forgedKey = await generateKeyPair('RS256');
    clientKey = await generateKeyPair('ES256', { extractable: true });
    publicKey = { ...(await exportJWK(appleKey.publicKey)), kid: 'apple-key', alg: 'RS256' };
    vi.stubEnv('APPLE_CLIENT_ID', audience);
    vi.stubEnv('APPLE_TEAM_ID', 'TEAM123456');
    vi.stubEnv('APPLE_KEY_ID', 'KEY1234567');
    vi.stubEnv('APPLE_PRIVATE_KEY', await exportPKCS8(clientKey.privateKey));
    vi.stubEnv('APPLE_TOKEN_ENCRYPTION_KEY', 'ab'.repeat(32));
    vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string, options?: Parameters<typeof fetch>[1]) => {
            if (url === 'https://appleid.apple.com/auth/keys') return Response.json({ keys: [publicKey] });
            if (failProvider) return Response.json({ error: 'server_error' }, { status: 500 });
            const body = new URLSearchParams(String(options?.body));
            // Validate the actual outgoing client credential, not a mock of the signing helper.
            expect(body.get('client_id')).toBe(audience);
            await jwtVerify(body.get('client_secret')!, clientKey.publicKey, {
                issuer: 'TEAM123456',
                subject: audience,
                audience: 'https://appleid.apple.com',
                algorithms: ['ES256'],
            });
            if (url === 'https://appleid.apple.com/auth/revoke') {
                expect(body.get('token_type_hint')).toBe('refresh_token');
                revoked.push(body.get('token')!);
                return new Response(null, { status: 200 });
            }
            expect(url).toBe('https://appleid.apple.com/auth/token');
            expect(body.get('grant_type')).toBe('authorization_code');
            const code = body.get('code')!;
            if (usedCodes.has(code)) return Response.json({ error: 'invalid_grant' }, { status: 400 });
            usedCodes.add(code);
            return Response.json({ id_token: await token(claims), refresh_token: 'private-apple-refresh-token' });
        }),
    );
});

beforeEach(() => {
    signingKey = appleKey.privateKey;
    usedCodes.clear();
    revoked.length = 0;
    failProvider = false;
    const now = Math.floor(Date.now() / 1000);
    claims = {
        sub: 'apple-subject',
        email: 'Person@privaterelay.appleid.com',
        email_verified: 'true',
        nonce,
        iss: 'https://appleid.apple.com',
        aud: audience,
        iat: now,
        exp: now + 300,
    };
});
afterAll(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

it('exchanges a one-use code, verifies its token, and keeps revocation credentials encrypted', async () => {
    const identity = await exchangeAppleCode('single-use-code', nonce);
    expect(identity).toMatchObject({
        subject: 'apple-subject',
        email: 'person@privaterelay.appleid.com',
        emailVerified: true,
    });
    expect(identity.refreshToken).not.toContain('private-apple-refresh-token');
    await revokeAppleToken(identity.subject, identity.refreshToken);
    expect(revoked).toEqual(['private-apple-refresh-token']);
    await expect(exchangeAppleCode('single-use-code', nonce)).rejects.toMatchObject({ status: 401 });
});

it.each([
    { aud: 'another.app' },
    { iss: 'https://attacker.example' },
    { nonce: 'another-attempt' },
    { exp: 1 },
    { exp: undefined },
    { iat: Math.floor(Date.now() / 1000) + 120 },
    { sub: '' },
    { email_verified: 'false' },
    { email: 'not-an-email' },
])('rejects invalid Apple token claims: %j', async (invalid) => {
    claims = { ...claims, ...invalid };
    await expect(exchangeAppleCode('code', nonce)).rejects.toMatchObject({ status: 401 });
});

it('rejects a forged signature with an otherwise valid token', async () => {
    signingKey = forgedKey.privateKey;
    await expect(exchangeAppleCode('code', nonce)).rejects.toMatchObject({ status: 401 });
});

it('supports repeat authorization without profile fields', async () => {
    delete claims.email;
    delete claims.email_verified;
    expect(await exchangeAppleCode('code', nonce)).toMatchObject({ subject: 'apple-subject', emailVerified: false });
});

it('cannot move an encrypted revocation token to another Apple identity', async () => {
    const identity = await exchangeAppleCode('code', nonce);
    await expect(revokeAppleToken('other-subject', identity.refreshToken)).rejects.toThrow();
    expect(revoked).toEqual([]);
});

it('treats an Apple outage as unavailable, not invalid account credentials', async () => {
    failProvider = true;
    await expect(exchangeAppleCode('code', nonce)).rejects.toMatchObject({ status: 503 });
});

it.each(['not-json', JSON.stringify({ id_token: 'missing-refresh-token' })])(
    'rejects malformed token responses without storing credentials',
    async (body) => {
        vi.mocked(fetch).mockResolvedValueOnce(new Response(body, { status: 200 }));
        await expect(exchangeAppleCode('code', nonce)).rejects.toMatchObject({ status: 503 });
    },
);

it('authenticates notification signatures and audience before accepting revocation events', async () => {
    const events = { type: 'consent-revoked', sub: 'apple-subject', event_time: Math.floor(Date.now() / 1000) };
    const notification = { iss: claims.iss, aud: audience, iat: claims.iat, jti: 'event-id', events };
    expect(await verifyAppleNotification(await token(notification))).toEqual(events);
    expect(await verifyAppleNotification(await token({ ...notification, events: JSON.stringify(events) }))).toEqual(
        events,
    );
    await expect(verifyAppleNotification(await token({ ...notification, aud: 'another.app' }))).rejects.toMatchObject({
        status: 401,
    });
    signingKey = forgedKey.privateKey;
    await expect(verifyAppleNotification(await token(notification))).rejects.toMatchObject({ status: 401 });
});
