# TASK-0007: Create shared/constants package

## Goal
Create a shared constants package at `shared/constants` to host repo-wide constants such as `status-codes`.

## Current state
* Client: `client/src/constants/status-codes.ts`
* Server: `server/src/constants/status-codes.ts`

## Scope
* Create `shared/constants/` as a workspace package.
* Add `status-codes` module there (initially by copying one canonical source).

## Explicit non-goals
* Do not update client/server imports in this task.
* Do not delete the existing client/server constants yet.
* Do not refactor constant values or names.

## Files allowed
* `shared/constants/**` (new)
* Root `package.json` (only if needed to include `shared/*` in workspaces)

## Acceptance checks
From repo root:
* `npm -w client run type-check`
* `npm -w client run test:unit`
* `npm -w server run type-check`
* `npm -w server run test:spec`

## Rollback plan
Delete `shared/constants` and revert workspace references.
