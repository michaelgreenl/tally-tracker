# TASK-0006: Consolidate Husky + commitlint to root

## Goal
Run git hooks from repo root only, calling root scripts, with a single commitlint config.

## Current state
* `client/.husky/*` and `server/.husky/*`
* `client/commitlint.config.ts` and `server/commitlint.config.ts`
* Both packages have `"prepare": "husky"`

## Scope
* Create root `.husky/` directory with:
    * `pre-commit`
    * `commit-msg`
* Move/merge commitlint config to root: `commitlint.config.ts`
* Update `prepare`/husky installation so hooks are installed from root.

## Explicit non-goals
* Do not change the lint/test commands themselves (only where they’re invoked from).
* Do not introduce new hook steps beyond what exists today.
* Keep any `SKIP_E2E` behavior if you currently rely on it (document the chosen behavior).

## Files allowed
* `.husky/**` (new at root)
* `commitlint.config.ts` (new at root)
* root `package.json` (scripts/prepare)
* `client/.husky/**`, `server/.husky/**` (remove after root works)
* `client/package.json`, `server/package.json` (remove `prepare` if moving to root)
* `client/commitlint.config.ts`, `server/commitlint.config.ts` (remove after root works)

## Acceptance checks
* From root, run:
    * `npm run type-check` (root script must exist)
    * `npm run test:unit` (root script must exist)
* Verify hook behavior:
    * A commit triggers root hooks
    * `commit-msg` invokes commitlint successfully

## Rollback plan
Restore package-local `.husky/` directories and per-package commitlint configs.
