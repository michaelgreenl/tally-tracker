# TASK-0005: Move E2E + integration tests to root ./tests/

## Goal
Create a root-level `tests/` directory with:
* `tests/e2e/` (Cypress) migrated out of `client/tests/e2e/`
* `tests/integration/` migrated out of `server/src/tests/integration/` (and associated fixtures if needed)

The test suites must still pass and must still be runnable with clear commands.

## Desired structure
* `tests/`
    * `e2e/`
        * `specs/`
        * `support/`
        * `fixtures/`
    * `integration/`
        * `specs/`
        * `fixtures/`

## Current state
* Client e2e:
    * tests: `client/tests/e2e/**`
    * config: `client/cypress.config.ts`
    * script: `npm -w client run test:e2e`
* Server integration:
    * specs: `server/src/tests/integration/*.spec.ts`
    * fixtures: `server/src/tests/fixtures/*.fixture.ts`
    * server tests run via Vitest (`npm -w server run test:spec`)

## Scope
* Relocate test files into `./tests/**` as described above.
* Update Cypress config and paths so e2e still runs.
* Update server Vitest config / test globs / imports so integration specs still run from their new location.
* Ensure commands exist to run:
    * unit tests per package (unchanged)
    * root e2e tests
    * root integration tests

## Explicit non-goals
* Do not refactor test logic beyond path/import fixes.
* Do not change product behavior.
* Do not unify tooling configs (prettier/eslint) as part of this task.

## Files allowed
* `tests/**` (new)
* Client:
    * `client/tests/e2e/**` (move/delete)
    * `client/cypress.config.ts` (update to point at `tests/e2e` OR replace with a thin wrapper)
    * `client/package.json` (scripts may delegate to root e2e location)
* Server:
    * `server/src/tests/**` (move/delete integration + fixtures as needed)
    * `server/vitest.config.ts` (update include/exclude/globs and/or roots)
    * `server/package.json` (scripts may delegate to new integration location)
* Root `package.json` (only if adding top-level convenience scripts)

## Acceptance checks
From repo root:
* Unit baselines:
    * `npm -w client run type-check`
    * `npm -w client run test:unit`
    * `npm -w server run type-check`
    * `npm -w server run test:spec`

E2E:
* `npm -w client run test:e2e`
* Provide and document a smoke subset run:
    * `npm -w client run test:e2e:spec -- "<path-to-one-spec>"` (or equivalent)

Integration (server):
* `npm -w server run test:spec` must still execute the integration specs now located under `tests/integration/**`

## Notes / recommended implementation approach
* Prefer leaving Cypress “owned” by the client package (dependencies stay in `client/`) while merely relocating the spec files to root `tests/e2e/`.
* Prefer leaving integration tests “owned” by the server package (dependencies stay in `server/`) while relocating integration specs/fixtures to root `tests/integration/`.
* Keep imports stable by updating only paths and Vitest/Cypress config globs.

## Rollback plan
Move tests back to their original locations and revert config/script changes.
