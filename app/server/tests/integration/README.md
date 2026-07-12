# PostgreSQL integration tests

This lane runs real Express routes, repositories, transactions, and committed Prisma migrations against the dedicated `tally_tracker_test` database. It does not use Vitest mocks.

From the repository root, run:

```bash
bun run test:db:start
bun --filter=@tally/core run generate:client
bun run test:db:migrate
bun run test:integration
bun run test:db:stop
```

Run the stop command even if a prior step fails. The test database uses the distinct `tally-tracker-test` Compose project and `postgres-test` service on `127.0.0.1:5433`; its data directory is tmpfs and does not reuse the development volume.

Before collecting tests or importing Prisma and the app, `vitest.integration.config.ts` requires `NODE_ENV=test`, `TALLY_TEST_DB_RESET=1`, a PostgreSQL URL on `localhost` or `127.0.0.1`, the exact database path `/tally_tracker_test`, and no query parameters or URL fragment. Setup clears only application tables before each test and leaves `_prisma_migrations` intact.
