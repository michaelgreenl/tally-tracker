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
            phone: '+15550000000',
            password: password,
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
        },
    });

    await prisma.user.upsert({
        where: { phone: '+15559999999' },
        update: {
            tier: 'BASIC',
        },
        create: {
            phone: '+15559999999',
            password: password,
        },
    });
};
