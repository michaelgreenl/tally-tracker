import { PrismaClient } from '@prisma/client';

export const seedCounters = async (prisma: PrismaClient) => {
    const upsertCounters = async (user, counters) => {
        if (!user) return;
        for (const c of counters) {
            const existing = await prisma.counter.findFirst({ where: { userId: user.id, title: c.title } });
            if (existing) {
                await prisma.counter.update({ where: { id: existing.id }, data: c });
            } else {
                await prisma.counter.create({ data: { ...c, userId: user.id } });
            }
        }
    };

    const admin = await prisma.user.findUnique({ where: { email: 'admin@example.com' } });
    const adminCounters = [
        {
            title: 'Push Ups',
            count: 50,
            color: '#FF5733',
            userId: admin.id,
            type: 'PERSONAL',
        },
        {
            title: 'Water Glasses',
            count: 4,
            color: '#33C1FF',
            userId: admin.id,
            type: 'PERSONAL',
        },
    ];

    const alice = await prisma.user.findUnique({ where: { email: 'alice@example.com' } });
    const aliceCounters = [
        {
            title: 'Books Read',
            count: 12,
            color: '#DAF7A6',
            userId: alice.id,
            type: 'PERSONAL',
        },
        {
            title: 'Miles Ran',
            count: 105,
            color: null,
            userId: alice.id,
            type: 'PERSONAL',
        },
    ];

    const unknown = await prisma.user.findUnique({ where: { phone: '+15559999999' } });
    const unknownCounters = [
        {
            title: "Weekly Workout's",
            count: 4,
            color: '#CAFFF1',
            userId: unknown.id,
            type: 'PERSONAL',
        },
        {
            title: 'Cigerettes',
            count: 6,
            color: null,
            userId: unknown.id,
            type: 'PERSONAL',
        },
    ];

    const users = [admin, alice, unknown];
    const counters = [adminCounters, aliceCounters, unknownCounters];

    for (const [index, user] of users.entries()) {
        await upsertCounters(user, counters[index]);
    }
};
