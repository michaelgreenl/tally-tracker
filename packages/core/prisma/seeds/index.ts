import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { seedUsers } from './users.seeds.ts';
import { seedCounters } from './counters.seeds.ts';

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) throw new Error('POSTGRES_URL missing in core/.env');

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

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
