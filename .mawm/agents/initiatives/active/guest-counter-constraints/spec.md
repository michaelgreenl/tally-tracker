# Guest Counter Constraints - Initiative Spec Sheet

## Source of Truth Rules

- When initiative direction changes, update every affected active doc in the same pass.
- Any run specs created under `runs/active/` must match the run summaries in this spec.
- Remove or rewrite superseded text instead of appending contradictory follow-up notes.

## Target State

- Guest sessions can create and keep using up to three eligible counters without changing the authenticated counter experience.
- The `Add counter` entry point remains available after the third eligible counter exists; clicking it when a guest session is at the cap opens the guest-limit modal directly without showing the create form.
- The blocked path uses a reusable modal that explains the cap and links to a new upgrade placeholder route/page.
- Shared counters do not count toward the guest cap, and this initiative does not add real upgrade billing, server-side enforcement, or tier changes.

## Initiative-wide Contracts

- For this initiative, an eligible counter is any counter visible in the current guest session whose `type` is not `SHARED`.
- The cap applies only while `authStore.isAuthenticated` is false.
- The cap threshold is three eligible counters; if a guest already has three or more eligible counters in local state, additional eligible create submissions are blocked until the eligible count drops below three.
- Shared counters never count toward the guest cap.
- The `Add counter` entry point remains visible after the third eligible counter exists; enforcement happens at the entry point — when a guest session has three or more eligible counters, clicking `Add counter` opens the guest-limit modal directly and the create form does not open.
- Because the create form does not open when a guest is at the cap, no create is attempted. The store-level `createCounter()` guard remains as defense-in-depth to ensure no code path can bypass the cap.
- Authenticated users, premium sharing controls, guest-to-account consolidation, and sync contracts remain unchanged in this initiative.
- The upgrade route/page is informational only and must not imply functional billing or tier changes.

## Branch and PR Plan

- Target repo: `tally-tracker`
- Base branch: `main`
- Initiative branch: `initiative/guest-counter-constraints`
- Branch creation rule: create the initiative branch from `main` only when implementation is ready to begin.
- Run commit rule: each clean completed run becomes one commit.
- PR rule: open a PR from the initiative branch to `main` after all runs and initiative gates are complete.

## Execution Plan

### Run 1: Codify guest counter cap policy (`coding`)

- [x] complete
- Run spec path: `.mawm/agents/initiatives/active/guest-counter-constraints/runs/active/codify-guest-counter-cap-policy/spec.md` (created by the assigned workflow when this run starts)
- Task: Add the guest-only three-counter policy to the client store so over-limit guest creates fail before any local mutation or persistence.
- Current state: `counterStore.ts` keeps one mixed `counters` array and `createCounter()` always pushes a new guest counter into local state before any remote work. There is no explicit eligible-counter rule, and no unit coverage for a guest limit or shared-counter exclusion.
- Outcome: Guest over-limit create attempts return a normal store failure before local state changes, and the eligible-counter rule is centralized for later UI work.
- Scope: counter store logic, any small helper or derived state needed to count eligible guest counters, and client unit tests covering the guest cap behavior; no modal, route, or create-form UX changes yet.
- Contracts: The cap applies only while `authStore.isAuthenticated` is false; eligible counters exclude `type === 'SHARED'`; the first three eligible guest creates succeed; the next eligible guest create fails without mutating `counterStore.counters` or local persistence; authenticated create behavior remains unchanged; blocked creates continue to use the existing `StoreResponse` fail contract rather than thrown errors.
- Smoke verification: `headless` - client unit tests prove three successful eligible guest creates, a blocked fourth eligible create, and exclusion of shared counters from the cap.

### Run 2: Surface the guest-limit modal (`coding`)

- [ ] complete
- Run spec path: `.mawm/agents/initiatives/active/guest-counter-constraints/runs/active/surface-guest-limit-modal/spec.md` (created by the assigned workflow when this run starts)
- Task: Add a reusable modal component and wire the `Add counter` entry point so it opens the modal directly when a guest session is at the cap, without opening the create form.
- Current state: After Run 1, the store exports `eligibleCount` and enforces the cap at `createCounter()` as defense-in-depth. The `Add counter` button in `HomeView.vue` still always opens the create form regardless of eligible count. The client has no reusable modal component.
- Outcome: When a guest at the cap clicks `Add counter`, the guest-limit modal opens immediately and the create form does not open. Guests under the cap and authenticated users continue to see the create form as before.
- Scope: reusable client modal component, `HomeView.vue` entry-point guard that checks `eligibleCount` before opening the form, max-counters modal copy, and Cypress at-cap coverage; `CounterForm.vue` does not need changes in this run; no upgrade route/page or navigation yet.
- Contracts: The `Add counter` entry point remains visible always; when a guest at the cap clicks it the modal opens and the form does not; dismissing the modal leaves the home state unchanged with no new counter; authenticated and under-cap guest flows open the form unchanged; the limit message uses reusable modal UI rather than a one-off alert.
- Smoke verification: `headless` - Cypress guest flow creates three eligible counters, clicks `Add counter`, and confirms the guest-limit modal opens without the create form appearing and without a fourth counter being added.

### Run 3: Add upgrade placeholder navigation (`coding`)

- [ ] complete
- Run spec path: `.mawm/agents/initiatives/active/guest-counter-constraints/runs/active/add-upgrade-placeholder-navigation/spec.md` (created by the assigned workflow when this run starts)
- Task: Add a guest-accessible upgrade placeholder route/page and connect the max-counters modal CTA to it, then finish end-to-end coverage for the blocked-create navigation path.
- Current state: After Run 2, guests see the max-counters modal on blocked create, but the router still has no `/upgrade` destination and the modal has nowhere real to send an upgrade CTA.
- Outcome: The blocked-create modal links to a non-functional upgrade placeholder page that guests can visit and leave, with final Cypress coverage for the navigation path.
- Scope: router entry, new upgrade view, modal CTA wiring, placeholder copy, and Cypress coverage for navigating from the blocked create modal to `/upgrade` and back; no billing flow, tier mutation, or server API work.
- Contracts: `/upgrade` is guest-accessible; the page clearly states that upgrade/billing is not yet implemented; navigating from the modal to `/upgrade` does not create a counter or change auth state; returning to home preserves the existing counters and guest limit behavior; no backend or account-tier behavior is introduced.
- Smoke verification: `headless` - Cypress follows the modal CTA to `/upgrade`, confirms the placeholder messaging, and returns to the existing home state.

## Initiative Verification Gates

- Every run is complete, verified, reviewed, smoke-tested, and committed.
- Guest users can create exactly three eligible counters; clicking `Add counter` when at the cap opens the guest-limit modal directly (not the create form); and the `Add counter` entry point remains visible after the third eligible counter exists.
- Shared counters are excluded from the cap calculation.
- The max-counters modal is reusable UI rather than a one-off browser alert.
- The upgrade placeholder page is reachable from the blocked create path and clearly non-functional.
- Initiative-wide contracts still match the current codebase after the final run.
- PR from `initiative/guest-counter-constraints` to `main` is opened with the initiative summary and verification evidence.
