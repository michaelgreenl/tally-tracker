import { defineConfig, env } from '@prisma/config';
import 'dotenv/config';

import type { PrismaConfig } from 'prisma';

const POSTGRES_URL = process.env.POSTGRES_URL || 'http://localhost:3000';

export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: {
        seed: 'tsx prisma/seed.ts',
    },
    datasource: {
        url: POSTGRES_URL,
    },
}) satisfies PrismaConfig;
