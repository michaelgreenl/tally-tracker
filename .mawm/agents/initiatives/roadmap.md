# Tally Tracker - Initiative Roadmap

## Source of Truth Rules

- This roadmap must match the current codebase, the current strategy, and every linked active spec.
- When roadmap direction changes, update every affected active doc in the same pass.
- Remove or rewrite superseded statements instead of adding contradictory notes elsewhere in the active set.
- NEVER refer to historical references in archived or completed initiative docs unless explicitly requested.

## State Model

- `queued/` contains not-yet-started initiatives, draft plans, or ideas that still need decisions. It is planning input, not the active source of truth.
- `active/` contains approved initiatives with a current `spec.md` and active execution path. These docs must stay aligned with this roadmap and the current codebase.

## Horizon Definitions

- `Now` - approved initiative work that is ready for execution planning in the current delivery window.
- `Next` - queued ideas that may move forward after current active work lands or new product decisions are made.
- `Later` - future monetization or UX bets that are intentionally deferred.

## Initiative Ledger

| Initiative                   | State    | Horizon | Why it matters                                                                                       | Depends on | Working doc                                                          |
| ---------------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------- |
| `Guest counter constraints` | `active` | `Now`   | Prevents guest counter sprawl, preserves the existing add flow, and introduces a clear upgrade path. | `none`     | `.mawm/agents/initiatives/active/guest-counter-constraints/spec.md` |

## Now

### Guest counter constraints

- State: `active`
- Goal: Cap guest-owned eligible counters at three, keep the add flow available, and route over-limit guests toward an upgrade placeholder.
- Exit signal: Guest users can create up to three eligible counters, the fourth eligible create attempt is blocked with a modal, and the modal can navigate to the upgrade placeholder page.
- Review trigger: Re-plan before execution if guest users gain shared-counter join/create capability, if authenticated users also need a cap, or if real billing/upgrade functionality becomes part of the same delivery window.
- Working doc: `.mawm/agents/initiatives/active/guest-counter-constraints/spec.md`
- Notes: This is a client-side initiative against the current local guest flow; shared counters must not count toward the cap.

## Next

- No additional queued initiatives are committed for this horizon yet.

## Later

- No later-horizon initiatives are tracked in the active roadmap yet.
