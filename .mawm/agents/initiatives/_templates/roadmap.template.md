> This template is for a project's `roadmap.md` file:
> `.mawm/agents/initiatives/roadmap.md`

> Planner notes
>
> - This file is for long-range initiative direction planning. Do not turn it into a run plan or task list.
> - Treat this roadmap and every linked active spec as one current-state source of truth. When strategy changes, update them together and delete stale text instead of layering corrections.
> - Every active initiative listed here should point at its current working doc in `active/`.
> - Update this file when initiative state, sequencing, or strategy changes.

<!-- Delete sections that do not apply. Replace placeholders with project-specific language before finalizing. Remove or rewrite superseded active text instead of stacking contradictory notes. -->

# <Project Name> - Initiative Roadmap

## Source of Truth Rules

- This roadmap must match the current codebase, the current strategy, and every linked active spec.
- When roadmap direction changes, update every affected active doc in the same pass.
- Remove or rewrite superseded statements instead of adding contradictory notes elsewhere in the active set.
- NEVER refer to historical references (archived/, complete/ directories), unless explicitly requested.

## Direction

### North Star

<1 short paragraph describing the project state this roadmap is trying to create>

### Strategic Outcomes

- <outcome the roadmap should produce>
- <outcome the roadmap should produce>
- <outcome the roadmap should produce>

## State Model

- `queued/` contains not-yet-started initiatives, draft plans, or ideas that still need decisions. It is planning input, not the active source of truth.
- `active/` contains approved initiatives with a current `spec.md` and active execution path. These docs must stay aligned with this roadmap and the current codebase.

## Horizon Definitions

- `Now` - <current focus window; only initiatives that are active or ready to activate>
- `Next` - <initiatives expected to start after current blockers or dependencies clear>
- `Later` - <long-range direction, future bets, or intentionally deferred work>

## Initiative Ledger

| Initiative          | State    | Horizon | Why it matters                                 | Depends on             | Working doc                                                                |
| ------------------- | -------- | ------- | ---------------------------------------------- | ---------------------- | -------------------------------------------------------------------------- |
| `<initiative name>` | `active` | `Now`   | <why this matters now>                         | `<dependency or none>` | `.mawm/agents/initiatives/active/<initiative-slug>/spec.md`                |
| `<initiative name>` | `queued` | `Next`  | <why this matters next>                        | `<dependency or none>` | `.mawm/agents/initiatives/queued/<initiative-slug>/plan-drafts/<draft>.md` |
| `<initiative name>` | `queued` | `Later` | <future opportunity or reason to keep visible> | `<dependency or none>` | `<optional draft path or note>`                                            |

## Now

### <initiative or theme>

- State: `active`
- Goal: <directional goal for the current window>
- Exit signal: <observable condition that lets this leave the current horizon>
- Working doc: `.mawm/agents/initiatives/active/<initiative-slug>/spec.md`
- Notes: <key dependency, risk, or scope boundary>

## Next

### <initiative or theme>

- State: `queued`
- Goal: <what this initiative should unlock once started>
- Working doc: `.mawm/agents/initiatives/queued/<initiative-slug>/plan-drafts/<draft>.md`

### <initiative or theme>

- State: `queued`
- Goal: <what this initiative should unlock once started>
- Working doc: `.mawm/agents/initiatives/queued/<initiative-slug>/plan-drafts/<draft>.md`

## Later

### <initiative or theme>

- State: `future` or `parked`
- Opportunity: <future value this initiative could unlock>
- Why later: <why it is not a near-term commitment>
- Not before: <dependency, maturity gate, or strategic precondition>
- Working doc: `<optional draft path, note, or research placeholder>`
- Notes: <largest uncertainty, risk, or missing decision>

### <initiative or theme>

- State: `future` or `parked`
- Opportunity: <future value this initiative could unlock>
- Why later: <why it is intentionally deferred>
- Not before: <dependency, maturity gate, or strategic precondition>
- Working doc: `<optional draft path, note, or research placeholder>`
- Notes: <largest uncertainty, risk, or missing decision>

## Review Triggers

- <time cadence such as monthly, per release, or per milestone>
- <strategy change, architecture reset, or staffing change that should force a roadmap update>
