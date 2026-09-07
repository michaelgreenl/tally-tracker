import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

export const seedUsers = async (prisma: PrismaClient) => {
    const password = await bcrypt.hash('password123', 10);
    const emailVerifiedAt = new Date();

    await prisma.user.upsert({
        where: { email: 'admin@example.com' },
        update: {
            tier: 'PREMIUM',
            emailVerifiedAt,
        },
        create: {
            email: 'admin@example.com',
            password: password,
            tier: 'PREMIUM',
            emailVerifiedAt,
        },
    });

    await prisma.user.upsert({
        where: { email: 'alice@example.com' },
        update: {
            tier: 'PREMIUM',
            emailVerifiedAt,
        },
        create: {
            email: 'alice@example.com',
            password: password,
            tier: 'PREMIUM',
            emailVerifiedAt,
        },
    });

    await prisma.user.upsert({
        where: { email: 'joe@example.com' },
        update: {
            tier: 'BASIC',
            emailVerifiedAt,
        },
        create: {
            email: 'joe@example.com',
            password: password,
            tier: 'BASIC',
            emailVerifiedAt,
        },
    });
};
