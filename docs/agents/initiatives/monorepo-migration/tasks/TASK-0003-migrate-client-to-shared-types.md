# TASK-0003: Migrate client to use shared/types

## Goal
Update the client to import shared types from the new workspace package instead of `client/src/types/shared`.

## Scope
* Update client imports/re-exports to use the shared types package.
* Ensure imports are `import type` where appropriate to avoid runtime bundling.
* Optionally remove `client/src/types/shared/**` once the client no longer references it.

## Explicit non-goals
* Do not touch server code.
* Do not refactor application logic beyond import/path changes.
* Do not reformat unrelated files.

## Files allowed
* `client/src/**`
* `client/package.json` (only if you need to add a dependency on the workspace package)
* `client/tsconfig*.json` (only if needed for TS resolution)
* `shared/types/**` (only if you discover missing exports needed by client)

## Acceptance checks
From repo root:
* `npm -w client run type-check`
* `npm -w client run test:unit`

Optional (if quick):
* `npm -w client run build`

## Rollback plan
Revert the import changes and restore usage of `client/src/types/shared`.
