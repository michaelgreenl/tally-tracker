# TASK-0002: Create shared types workspace package at shared/types

## Goal
Create a single canonical shared types package at `shared/types` without changing client/server consumers yet.

## Scope
* Add `shared/types/` as a workspace package.
* Populate it with the shared types currently duplicated in:
    * `client/src/types/shared/*`
    * `server/src/types/shared/*`

## Explicit non-goals
* Do not update imports in client or server in this task.
* Do not delete the existing `client/src/types/shared` or `server/src/types/shared` directories yet.
* Do not change runtime behavior.

## Files allowed
* `shared/types/**` (new)
* Root `package.json` (only if needed to include `shared/*` in workspaces)

## Packaging guidance (important)
Prefer a **types-only** package to avoid bundling issues:
* Provide `index.d.ts` as the entry point.
* Ensure consumers will use `import type` when migrated.

If `generated/index.ts` exists today, consider emitting a declaration-style entry in the new package (e.g., `generated/index.d.ts`) rather than requiring runtime TS in dependencies.

## Acceptance checks
* `npm -w client run type-check`
* `npm -w server run type-check`
* `npm -w client run test:unit`
* `npm -w server run test:spec`

(These should still pass because consumers aren’t migrated yet.)

## Rollback plan
Delete `shared/types` and revert workspace references.
