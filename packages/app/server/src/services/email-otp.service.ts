import { createHmac, randomInt } from 'node:crypto';

import * as emailOtpRepository from '../db/repositories/email-otp.repository.js';
import { sendEmailOtp } from './email.service.js';

import type { EmailOtpPurpose, User } from '@prisma/client';

const OTP_TTL_MS = 10 * 60 * 1000;

const getSecret = () => {
    const secret = process.env.EMAIL_OTP_SECRET;
    if (secret) return secret;

    if (process.env.NODE_ENV !== 'production') return process.env.JWT_SECRET || 'local-email-otp-secret';
    throw new Error('EMAIL_OTP_SECRET is required in production.');
};

export const digestEmailOtp = (userId: string, purpose: EmailOtpPurpose, code: string) =>
    createHmac('sha256', getSecret()).update(`${userId}:${purpose}:${code}`).digest('hex');

export async function issueEmailOtp(user: User, purpose: EmailOtpPurpose) {
    const code = randomInt(1_000_000).toString().padStart(6, '0');
    const digest = digestEmailOtp(user.id, purpose, code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await emailOtpRepository.issue(user.id, purpose, digest, expiresAt);
    await sendEmailOtp(user.email, code, purpose);
}
