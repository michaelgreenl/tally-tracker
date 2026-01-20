import { PrismaClient } from '@prisma/client';

export const seedCounters = async (prisma: PrismaClient) => {
    const admin = await prisma.user.findUnique({ where: { email: 'admin@example.com' } });

    if (admin) {
        await prisma.counter.createMany({
            data: [
                {
                    title: 'Push Ups',
                    count: 50,
                    color: '#FF5733',
                    userId: admin.id,
                },
                {
                    title: 'Water Glasses',
                    count: 4,
                    color: '#33C1FF',
                    userId: admin.id,
                },
            ],
        });
    }

    const alice = await prisma.user.findUnique({ where: { email: 'alice@example.com' } });
    if (alice) {
        await prisma.counter.createMany({
            data: [
                {
                    title: 'Books Read',
                    count: 12,
                    color: '#DAF7A6',
                    userId: alice.id,
                },
                {
                    title: 'Miles Ran',
                    count: 105,
                    color: null,
                    userId: alice.id,
                },
            ],
        });
    }

    const unknown = await prisma.user.findUnique({ where: { phone: '+15559999999' } });
    if (unknown) {
        await prisma.counter.createMany({
            data: [
                {
                    title: "Weekly Workout's",
                    count: 4,
                    color: '#CAFFF1',
                    userId: unknown.id,
                },
                {
                    title: 'Cigerettes',
                    count: 6,
                    color: null,
                    userId: unknown.id,
                },
            ],
        });
    }
};
