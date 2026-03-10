# High-Level Plan Revisions — User Rejection at step_0_4

## Source

User feedback at HITL gate (Plan Direction Approval)

## Key Revision Required

**The counter limit must be enforced based on ALL counters (shared + owned), not just owned counters.**

### What needs to change

The current high-level plan (high-level-0001) explicitly states in multiple places that only **owned** counters count toward the limit:

1. **Milestone 2 — Risks/Considerations** states: _"Owned counters only: The count should use `prisma.counter.count({ where: { userId } })` — i.e., counters the user owns, not shared counters. Shared counters (via CounterShare) do not count against the limit."_ — **This is incorrect per the user's direction.**

2. **Milestone 3 — Risks/Considerations** states: _"Counter count source: `counterStore.counters` includes both owned and shared counters. The client-side check should ideally mirror the server (owned only)."_ — **This assumption is wrong.** The client-side check using `counterStore.counters.length` (which includes shared counters) is actually the **correct** behavior.

### Corrected behavior

- **Server-side:** The counter count query must include BOTH counters the user owns AND counters shared with the user (via `CounterShare`). The total of owned + shared counters must be < 5 for a new counter to be created.
- **Client-side:** `counterStore.counters.length` already includes both owned and shared counters, so the existing reactive comparison is correct. The plan should acknowledge this as intentionally correct rather than a compromise.
- **The limit applies to the user's total accessible counters** — if a non-premium user owns 3 counters and has 2 shared with them, they are at the limit (5) and cannot create a new one.

### Impact on milestones

- **Milestone 2 (Server-Side Guard):** The counter count query needs to be revised to count owned counters + shared counters (via `CounterShare` join or separate count).
- **Milestone 3 (Client Modal):** The existing `counterStore.counters.length` check is actually correct as-is since it includes shared counters.
- **Milestone 4 (Integration):** Test cases need to cover scenarios where shared counters contribute to hitting the limit.
