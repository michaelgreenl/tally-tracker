import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

export const seedUsers = async (prisma: PrismaClient) => {
    const password = await bcrypt.hash('password123', 10);

    await prisma.user.upsert({
        where: { email: 'admin@example.com' },
        update: {},
        create: {
            email: 'admin@example.com',
            phone: '+15550000000',
            password: password,
            tier: 'BASIC',
        },
    });

    await prisma.user.upsert({
        where: { email: 'alice@example.com' },
        update: {},
        create: {
            email: 'alice@example.com',
            password: password,
            tier: 'BASIC',
        },
    });

    await prisma.user.upsert({
        where: { phone: '+15559999999' },
        update: {},
        create: {
            phone: '+15559999999',
            password: password,
            tier: 'BASIC',
        },
    });
};
