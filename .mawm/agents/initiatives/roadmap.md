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

| Initiative                    | State  | Horizon | Why it matters                                                                                           | Depends on                                | Working doc                                                                               |
| ----------------------------- | ------ | ------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| Basic Tier Account Constraints | active | Now     | Makes free-authenticated sharing limits enforceable beyond client UI and protects shared-counter capacity. | Current auth, user tier, and sharing flow | `.mawm/agents/initiatives/active/basic-tier-account-constraints/spec.md` |

## Now

- Basic Tier Account Constraints (`active`): enforce BASIC/free-authenticated account constraints for shared counters while keeping unlimited personal counter creation. The work starts with server-authoritative limits, then adds client-side join feedback for the one-joined-shared-counter rule. Working doc: `.mawm/agents/initiatives/active/basic-tier-account-constraints/spec.md`.
  - Dependencies: current authenticated counter routes, persisted `User.tier`, existing `CounterShare` status model, and the existing client sharing UI.
  - Exit signals: BASIC users cannot create shared counters server-side; BASIC users can only hold one accepted joined shared counter; PREMIUM behavior is unchanged; client join UX surfaces the limit without replacing server enforcement.
  - Review triggers: revisit if tier names change, shared-counter ownership semantics change, invite links gain expiration, or premium purchase/upgrade flows are introduced.

## Next

- No additional queued initiatives are committed for this horizon yet.

## Later

- No later-horizon initiatives are tracked in the active roadmap yet.
