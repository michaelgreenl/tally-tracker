# TASK-0004: Migrate server to use shared/types

## Goal
Update the server to import shared types from the new workspace package instead of `server/src/types/shared`.

## Scope
* Update server imports/re-exports to use the shared types package.
* Ensure imports are `import type` where appropriate.
* Optionally remove `server/src/types/shared/**` once the server no longer references it.

## Explicit non-goals
* Do not touch client code.
* Do not change Prisma schemas, migrations, or runtime behavior.
* Do not remove `server/scripts/sync-types.sh` in this task unless explicitly required; prefer a separate cleanup task later.

## Files allowed
* `server/src/**`
* `server/package.json` (only if you need to add a dependency on the workspace package)
* `server/tsconfig.json` (only if needed for TS resolution)
* `shared/types/**` (only if you discover missing exports needed by server)

## Acceptance checks
From repo root:
* `npm -w server run type-check`
* `npm -w server run test:spec`

Optional (if quick):
* `npm -w server run build`

## Rollback plan
Revert import changes and restore usage of `server/src/types/shared`.
