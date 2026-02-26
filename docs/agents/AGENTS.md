# Project Agent Rules (Tally Tracker)

## Repo layout

- client/ = Vue 3 + Ionic + Vite
- server/ = Express + Prisma + Socket.io

## Output discipline

- All plans/task docs live in `docs/agents/`.
- Initiative-specific work must live under `docs/agents/initiatives/<initiative-name>/`.

## Required commands (must not regress)

Run these when relevant to changes made.

- Client:
    - `npm -w client run type-check`
    - `npm -w client run test:unit`
- Server:
    - `npm -w server run type-check`
    - `npm -w server run test` (this includes unit and integration tests, or all \*.spec.ts files)
- E2E (currently):
    - `npm -w client run test:e2e`

## Formatting / linting

- Do not run Prettier on the whole repo.
- If formatting is needed, format only touched files.
- Keep existing per-package configs (`client/.prettierrc.js`, `server/.prettierrc.js`) until a dedicated “unify formatting” task exists.

## Large changes (general invariants)

These apply to any structural or high-blast-radius change (monorepo, migrations, dependency upgrades, moving folders, etc.).

- Structural changes must be split into PR-sized steps.
- Don’t combine “move files” and “refactor logic” in the same PR unless the task explicitly requires it.
- Move one concern at a time (e.g., types OR e2e OR scripts OR hooks).
- Prefer “introduce new structure first” over “rewrite everything to fit the new structure.”

## Work style & safety

- Prefer small, reversible diffs over broad rewrites.
- Avoid drive-by cleanups: no unrelated renames, no reorganizing folders, no “while we’re here” improvements.
- Don’t claim tests were run unless command output is provided.

## Style Guide

### General Principles

- Keep things in one function unless composable or reusable
- Avoid `try`/`catch` where possible
- Avoid using the `any` type
- Prefer single word variable names where possible
- Rely on type inference when possible; avoid explicit type annotations or interfaces unless necessary for exports or clarity
- Prefer functional array methods (`flatMap`, `filter`, `map`) over for loops; use type guards on filter to maintain type inference downstream

### Naming

Prefer single word names for variables and functions. Only use multiple words if necessary.

```ts
// Good
const foo = 1;
function journal(dir: string) {}

// Bad
const fooBar = 1;
function prepareJournal(dir: string) {}
```

Reduce total variable count by inlining when a value is only used once.

```ts
// Good
const journal = await Bun.file(path.join(dir, 'journal.json')).json();

// Bad
const journalPath = path.join(dir, 'journal.json');
const journal = await Bun.file(journalPath).json();
```

### Destructuring

Avoid unnecessary destructuring. Use dot notation to preserve context.

```ts
// Good
obj.a;
obj.b;

// Bad
const { a, b } = obj;
```

### Variables

Prefer `const` over `let`. Use ternaries or early returns instead of reassignment.

```ts
// Good
const foo = condition ? 1 : 2;

// Bad
let foo;
if (condition) foo = 1;
else foo = 2;
```

### Control Flow

Avoid `else` statements. Prefer early returns.

```ts
// Good
function foo() {
    if (condition) return 1;
    return 2;
}

// Bad
function foo() {
    if (condition) return 1;
    else return 2;
}
```

# Testing

- Avoid mocks as much as possible
- Test actual implementation, do not duplicate logic into tests
- Tests cannot run from repo root (guard: do-not-run-tests-from-root); run from package dirs like packages/opencode.
