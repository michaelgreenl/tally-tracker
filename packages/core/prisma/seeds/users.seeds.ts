import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

export const seedUsers = async (prisma: PrismaClient) => {
    const password = await bcrypt.hash('password123', 10);

    await prisma.user.upsert({
        where: { email: 'admin@example.com' },
        update: {
            tier: 'PREMIUM',
        },
        create: {
            email: 'admin@example.com',
            password: password,
            tier: 'PREMIUM',
        },
    });

    await prisma.user.upsert({
        where: { email: 'alice@example.com' },
        update: {
            tier: 'PREMIUM',
        },
        create: {
            email: 'alice@example.com',
            password: password,
            tier: 'PREMIUM',
        },
    });

    await prisma.user.upsert({
        where: { email: 'joe@example.com' },
        update: {
            tier: 'BASIC',
        },
        create: {
            email: 'joe@example.com',
            password: password,
            tier: 'BASIC',
        },
    });
};
