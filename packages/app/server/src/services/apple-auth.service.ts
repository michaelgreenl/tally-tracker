import { CompactEncrypt, compactDecrypt, createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';

const issuer = 'https://appleid.apple.com';
const appleKeys = createRemoteJWKSet(new URL(`${issuer}/auth/keys`));
const verifiedEmail = z.union([z.literal(true), z.literal('true')]);
const identityClaims = z.object({
    sub: z.string().min(1).max(255),
    nonce: z.string().min(1),
    iat: z.number(),
    email: z.string().trim().toLowerCase().email().max(254).optional(),
    email_verified: verifiedEmail.optional(),
});

export class AppleAuthError extends Error {
    constructor(public status: number) {
        super(status === 401 ? 'Apple sign-in failed. Try again.' : 'Apple sign-in is unavailable. Try again later.');
    }
}

function appleSignInConfigured() {
    return [
        'APPLE_CLIENT_ID',
        'APPLE_TEAM_ID',
        'APPLE_KEY_ID',
        'APPLE_PRIVATE_KEY',
        'APPLE_TOKEN_ENCRYPTION_KEY',
    ].every((name) => Boolean(process.env[name]));
}

async function appleRequest(path: 'token' | 'revoke', parameters: Record<string, string>) {
    if (!appleSignInConfigured()) throw new AppleAuthError(503);
    const clientId = process.env.APPLE_CLIENT_ID!;
    try {
        const key = await importPKCS8(process.env.APPLE_PRIVATE_KEY!.replace(/\\n/g, '\n'), 'ES256');
        const secret = await new SignJWT({})
            .setProtectedHeader({ alg: 'ES256', kid: process.env.APPLE_KEY_ID! })
            .setIssuer(process.env.APPLE_TEAM_ID!)
            .setSubject(clientId)
            .setAudience(issuer)
            .setIssuedAt()
            .setExpirationTime('5m')
            .sign(key);
        const response = await fetch(`${issuer}/auth/${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ ...parameters, client_id: clientId, client_secret: secret }),
            signal: AbortSignal.timeout(3000),
            redirect: 'error',
        });
        if (!response.ok) {
            const body = z.object({ error: z.string() }).safeParse(await response.json().catch(() => null));
            throw new AppleAuthError(
                path === 'token' && body.success && body.data.error === 'invalid_grant' ? 401 : 503,
            );
        }
        return response;
    } catch (error) {
        if (error instanceof AppleAuthError) throw error;
        // Do not propagate provider responses or private-key errors into logs or the UI.
        throw new AppleAuthError(503);
    }
}

function encryptionKey() {
    const value = process.env.APPLE_TOKEN_ENCRYPTION_KEY ?? '';
    if (!/^[a-f\d]{64}$/i.test(value)) throw new AppleAuthError(503);
    return Buffer.from(value, 'hex');
}

export async function exchangeAppleCode(authorizationCode: string, nonce: string) {
    const key = encryptionKey();
    const response = await appleRequest('token', { code: authorizationCode, grant_type: 'authorization_code' });
    const tokens = z
        .object({ id_token: z.string().min(1), refresh_token: z.string().min(1).max(8192) })
        .safeParse(await response.json().catch(() => null));
    if (!tokens.success) throw new AppleAuthError(503);

    let identity: z.infer<typeof identityClaims>;
    try {
        const { payload } = await jwtVerify(tokens.data.id_token, appleKeys, {
            issuer,
            audience: process.env.APPLE_CLIENT_ID!,
            algorithms: ['RS256'],
            requiredClaims: ['sub', 'iat', 'exp', 'nonce'],
            maxTokenAge: '5m',
            clockTolerance: 30,
        });
        identity = identityClaims.parse(payload);
        if (identity.nonce !== nonce) throw new Error('Nonce mismatch');
    } catch {
        throw new AppleAuthError(401);
    }
    const refreshToken = await new CompactEncrypt(
        new TextEncoder().encode(JSON.stringify({ subject: identity.sub, token: tokens.data.refresh_token })),
    )
        .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
        .encrypt(key);
    return {
        subject: identity.sub,
        email: identity.email,
        emailVerified: Boolean(identity.email && identity.email_verified),
        authenticatedAt: new Date(identity.iat * 1000),
        refreshToken,
    };
}

export type AppleIdentity = Awaited<ReturnType<typeof exchangeAppleCode>>;

export async function revokeAppleToken(subject: string, encryptedToken: string) {
    const { plaintext } = await compactDecrypt(encryptedToken, encryptionKey(), {
        keyManagementAlgorithms: ['dir'],
        contentEncryptionAlgorithms: ['A256GCM'],
    });
    const saved = z
        .object({ subject: z.literal(subject), token: z.string().min(1) })
        .parse(JSON.parse(new TextDecoder().decode(plaintext)));
    await appleRequest('revoke', { token: saved.token, token_type_hint: 'refresh_token' });
}

export async function verifyAppleNotification(token: string) {
    if (!process.env.APPLE_CLIENT_ID) throw new AppleAuthError(503);
    try {
        const { payload } = await jwtVerify(token, appleKeys, {
            issuer,
            audience: process.env.APPLE_CLIENT_ID,
            algorithms: ['RS256'],
            requiredClaims: ['iat', 'jti', 'events'],
            clockTolerance: 30,
        });
        const event = z
            .object({
                type: z.string(),
                sub: z.string().min(1).max(255),
                event_time: z
                    .number()
                    .int()
                    .nonnegative()
                    .max(Math.floor(Date.now() / 1000) + 30),
            })
            .parse(typeof payload.events === 'string' ? JSON.parse(payload.events) : payload.events);
        return { ...event, id: z.string().min(1).max(255).parse(payload.jti) };
    } catch {
        throw new AppleAuthError(401);
    }
}
