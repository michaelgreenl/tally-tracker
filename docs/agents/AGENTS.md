# Project Agent Rules (Tally Tracker)

## IMPORTANT SECURITY CONSTRAINT: NEVER READ/WRITE .env FILES OR VARIABLES OR SECRETS
* **NEVER** read, output, modify, or attempt to access `.env` files or environment variables.
* If an issue arises that appears related to environment configuration, do not attempt to inspect or modify environment settings. Instead, report the symptoms to the user and request explicit guidance.
* Do not log or echo environment variable names or values in any response or output.

## Default behavior
* Small, reversible changes only.
* Do not reformat unrelated files.
* Do not rename/move files unless explicitly required by the task.
* Prefer patch-style edits, not rewrites.

## Proof / Verification
* Never claim tests were run unless command output is provided.
* Always propose runnable commands for:
    * typecheck
    * unit tests
    * integration/e2e (if present)
* If you add tests, also provide at least one acceptance check that is not a brand-new unit test.

## Migration safety
* If doing structural work (monorepo, deps, scripts), split into PR-sized steps.
* If a change spans client+server, do it in two PRs unless it’s purely config.

## Output discipline
* When asked to write plans/docs, write them into the repo under `docs/agents/` (never at root).
* Keep outputs short and skimmable (headings + bullet points).
* Initiative-specific work must live under `docs/agents/initiatives/active/<initiative-name>/`.

## Formatting / linting
* Do not run Prettier on the whole repo.
* If formatting is needed, format only touched files.

## Large changes (general invariants)
These apply to any structural or high-blast-radius change (monorepo, migrations, dependency upgrades, moving folders, etc.).

* Structural changes must be split into PR-sized steps.
* Don’t combine “move files” and “refactor logic” in the same PR unless the task explicitly requires it.
* Move one concern at a time (e.g., types OR e2e OR scripts OR hooks).
* Prefer “introduce new structure first” over “rewrite everything to fit the new structure.”

## Work style & safety
* Prefer small, reversible diffs over broad rewrites.
* Avoid drive-by cleanups: no unrelated renames, no reorganizing folders, no “while we’re here” improvements.
* Don’t claim tests were run unless command output is provided.

