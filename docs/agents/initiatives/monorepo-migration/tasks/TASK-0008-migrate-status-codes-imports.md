# TASK-0008: Migrate client + server to shared/constants status-codes

## Goal
Replace usage of `client/src/constants/status-codes.ts` and `server/src/constants/status-codes.ts`
with imports from `shared/constants`.

## Scope
* Update imports in client and server to reference the shared constants package.
* Ensure no runtime/bundler issues:
    * If the constants are used at runtime (they likely are), the shared/constants package must ship JS (or be consumable by both Vite and Node).
* After successful migration, remove the duplicated per-package files.

## Explicit non-goals
* Do not change constant values or semantics.
* Do not do drive-by refactors in call sites.

## Files allowed
* `client/src/**` (import updates only)
* `server/src/**` (import updates only)
* `shared/constants/**` (exports/build adjustments if needed)
* `client/src/constants/status-codes.ts` (delete after migration)
* `server/src/constants/status-codes.ts` (delete after migration)
* `client/package.json` / `server/package.json` (dependency on shared package if required)

## Acceptance checks
From repo root:
* `npm -w client run type-check`
* `npm -w client run test:unit`
* `npm -w server run type-check`
* `npm -w server run test:spec`

Optional (recommended if quick):
* `npm -w client run build`
* `npm -w server run build`

## Rollback plan
Revert import changes and restore the original per-package constants files.
