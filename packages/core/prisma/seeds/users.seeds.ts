import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';

// Seed accounts skip the username step. The key matches the server's case-insensitive username key.
const withUsername = (username: string) => ({
    username,
    usernameKey: createHash('sha256').update(username.toLowerCase()).digest('hex'),
});

export const seedUsers = async (prisma: PrismaClient) => {
    const password = await bcrypt.hash('password123', 10);
    const emailVerifiedAt = new Date();

    await prisma.user.upsert({
        where: { email: 'admin@example.com' },
        update: {
            ...withUsername('admin'),
            tier: 'PREMIUM',
            emailVerifiedAt,
        },
        create: {
            email: 'admin@example.com',
            ...withUsername('admin'),
            password: password,
            tier: 'PREMIUM',
            emailVerifiedAt,
        },
    });

    await prisma.user.upsert({
        where: { email: 'alice@example.com' },
        update: {
            ...withUsername('alice'),
            tier: 'PREMIUM',
            emailVerifiedAt,
        },
        create: {
            email: 'alice@example.com',
            ...withUsername('alice'),
            password: password,
            tier: 'PREMIUM',
            emailVerifiedAt,
        },
    });

    await prisma.user.upsert({
        where: { email: 'joe@example.com' },
        update: {
            ...withUsername('joe'),
            tier: 'BASIC',
            emailVerifiedAt,
        },
        create: {
            email: 'joe@example.com',
            ...withUsername('joe'),
            password: password,
            tier: 'BASIC',
            emailVerifiedAt,
        },
    });
};
