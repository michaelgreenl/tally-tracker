import { defineConfig } from 'vitest/config';
import { assertIntegrationDatabaseSafety } from './tests/integration/test-database.js';

assertIntegrationDatabaseSafety();

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        env: {
            JWT_SECRET: 'vitest-integration-only-jwt-secret',
        },
        include: ['tests/integration/**/*.test.ts'],
        setupFiles: ['./tests/integration/setup.ts'],
        fileParallelism: false,
    },
});
