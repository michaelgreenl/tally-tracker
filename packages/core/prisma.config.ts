import { defineConfig, env } from '@prisma/config';

import type { PrismaConfig } from 'prisma';

export default defineConfig({
    schema: 'prisma/schema',
    migrations: {
        seed: 'tsx prisma/seeds/index.ts',
    },
}) satisfies PrismaConfig;
