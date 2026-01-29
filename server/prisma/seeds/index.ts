import prisma from '../../src/db/prisma.ts';
import { seedUsers } from './users.seeds.ts';
import { seedCounters } from './counters.seeds.ts';

async function main() {
    await seedUsers(prisma);
    await seedCounters(prisma);
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
