import type { EmailOtpPurpose } from '@prisma/client';

const emailCopy: Record<EmailOtpPurpose, { subject: string; action: string }> = {
    EMAIL_VERIFICATION: {
        subject: 'Verify your Tally Tracker email',
        action: 'verify your email',
    },
    PASSWORD_RESET: {
        subject: 'Reset your Tally Tracker password',
        action: 'reset your password',
    },
};

export async function sendEmailOtp(email: string, code: string, purpose: EmailOtpPurpose) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;

    if (!apiKey || !from) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('RESEND_API_KEY and EMAIL_FROM are required in production.');
        }

        console.info(`[email:${purpose}] ${email}: ${code}`);
        return;
    }

    const copy = emailCopy[purpose];
    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from,
            to: [email],
            subject: copy.subject,
            text: `Use ${code} to ${copy.action}. This code expires in 10 minutes.`,
        }),
    });

    if (!response.ok) {
        throw new Error(`Resend rejected email delivery with status ${response.status}.`);
    }
}
