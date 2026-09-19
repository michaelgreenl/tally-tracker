import { createRemoteJWKSet, jwtVerify } from 'jose';
import { z } from 'zod';

const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const claims = z.object({
    sub: z.string().min(1).max(255),
    email: z.string().trim().toLowerCase().email().max(254),
    email_verified: z.literal(true),
    hd: z.string().min(1).optional(),
});

export async function verifyGoogleToken(idToken: string) {
    const audience = process.env.GOOGLE_WEB_CLIENT_ID;
    if (!audience) throw new Error('Google sign-in is not configured');
    const { payload } = await jwtVerify(idToken, googleKeys, {
        audience,
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        algorithms: ['RS256'],
        requiredClaims: ['sub', 'email', 'email_verified', 'iat', 'exp'],
        maxTokenAge: '1h',
        clockTolerance: 30,
    });
    const verified = claims.parse(payload);
    return {
        subject: verified.sub,
        email: verified.email,
        // Google is not authoritative for third-party addresses outside Workspace.
        emailVerified: verified.email.endsWith('@gmail.com') || Boolean(verified.hd),
    };
}

export type GoogleIdentity = Awaited<ReturnType<typeof verifyGoogleToken>>;
