# TASK-0001: Root npm workspaces + root scripts

## Goal
Add root npm workspace orchestration so common checks can run from repo root without changing behavior.

## Scope
* Add/update root-level `package.json` to define npm workspaces.
* Add root scripts that delegate to existing package scripts.

## Explicit non-goals
* Do not move any existing files yet.
* Do not change client/server scripts besides what’s necessary for workspace compatibility.
* Do not unify formatting/lint rules.

## Files allowed
* `./package.json` (new or update)
* `./package-lock.json` (may be generated/updated if you choose a single-lockfile approach)
* `./opencode.json` (only if needed for instructions; avoid if already correct)

## Notes on lockfiles 
* Remove/stop using `client/package-lock.json` and `server/package-lock.json` in favor of root `package-lock.json`.

## Acceptance checks
From repo root:
* `npm -w client run type-check`
* `npm -w client run test:unit`
* `npm -w server run type-check`
* `npm -w server run test:spec`

If you add root scripts, also run:
* `npm run type-check` (root)
* `npm run test:unit` (root) — name can differ, but must exist and work

## Rollback plan
Revert root `package.json` workspace changes and restore prior install workflow.
