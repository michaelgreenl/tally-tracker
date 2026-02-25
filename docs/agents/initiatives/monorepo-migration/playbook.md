# Initiative: Monorepo Migration (Client + Server)

## Goal
Convert the repo into an npm-workspaces monorepo with:
* Root-level workspace orchestration (type-check/tests)
* Single shared types source at `shared/types`
* E2E/integration runnable from repo root (while still supporting package-local runs)
* Husky + commitlint consolidated at the repo root

## Non-goals (for this initiative)
* Unifying ESLint/Prettier configs across client/server
* Broad refactors in application logic
* Changing runtime behavior (API semantics, auth flow, sync engine behavior)

## High-level sequencing (PR-sized)
1. Root npm workspaces + root scripts (no behavior changes)
2. Introduce `shared/types` workspace package (no consumer changes yet)
3. Migrate client to consume `shared/types`
4. Migrate server to consume `shared/types`
5. Move e2e + integration tests to root `tests/` (`tests/e2e`, `tests/integration`)
6. Move Husky + commitlint to root (last)
7. Introduce `shared/constants` workspace package (no consumer changes yet)
8. Migrate client + server to `shared/constants` (status-codes), remove duplicates

## Safety rules (initiative-specific)
* One concern per PR (workspaces OR types OR e2e OR husky).
* Prefer “copy first, switch consumers, then delete old” to avoid breakage.
* Any PR that moves tests/config must include explicit commands to run and expected outcomes.

## Acceptance baseline (per PR)
At minimum, each PR must keep these green (as applicable):
* `npm -w client run type-check`
* `npm -w client run test:unit`
* `npm -w server run type-check`
* `npm -w server run test`

E2E PRs must additionally provide a working e2e command and a smoke subset run.

## Artifact locations
* Task specs: `docs/agents/initiatives/monorepo-migration/tasks/`
* Notes/logs: `docs/agents/initiatives/monorepo-migration/logs/`

## “Done” definition
* Root `package.json` defines workspaces and root scripts.
* Shared types are referenced from both client and server without duplication.
* E2E runs from a root command and from a dedicated workspace directory.
* Husky hooks run from root and reference root scripts only.
