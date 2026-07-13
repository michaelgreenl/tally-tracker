import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        env: {
            JWT_SECRET: 'vitest-only-jwt-secret',
            POSTGRES_URL: 'postgresql://vitest:vitest@127.0.0.1:1/tally_tracker_test',
        },
    },
});
