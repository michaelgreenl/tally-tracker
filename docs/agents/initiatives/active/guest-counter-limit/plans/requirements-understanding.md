# Guest Counter Limit — Requirements Understanding

## 1. Initiative Summary

Add a hard cap of **5 counters** for guest (unauthenticated) users. When a guest attempts to create a 6th counter, a modal appears explaining the limit and offering a boilerplate upgrade prompt (no functional upgrade path yet).

---

## 2. Functional Requirements

- A guest user (`isAuthenticated === false` / `userId === 'guest'`) **may not hold more than 5 counters**.
- When a guest who already has 5 counters taps **"Add counter"** (or submits `CounterForm`), creation is **blocked** and an upgrade modal is displayed instead.
- The modal must contain at minimum:
    - A heading (e.g., "Counter Limit Reached")
    - A short explanatory message (e.g., "Guest accounts are limited to 5 counters. Create a free account to add more.")
    - A dismiss/close button
    - A placeholder CTA button for a future upgrade/register flow (inert for now)
- `counterStore.createCounter()` **must not mutate `counters[]`** if the guest limit is exceeded — the store must stay consistent.
- The limit is enforced **client-side only** (guests have no server state).
- No changes are made to authenticated user flows or the server.

---

## 3. Non-Functional Requirements

- **UX:** The "Add counter" button should remain visible at 5 counters; the gate happens on the _attempt_ (not by hiding the button), so the affordance is preserved.
- **Accessibility:** The modal must be keyboard/screen-reader accessible. Ionic's `ion-modal` or `ion-alert` satisfies this out of the box.
- **Performance:** The limit check is a synchronous array-length comparison — no measurable overhead.
- **No regressions:** Authenticated users (premium or not) must be completely unaffected by this change.
- **SCSS/Stylelint:** Any new modal styles must pass the existing Stylelint config.

---

## 4. Scope Boundaries

### In Scope

- Guest counter limit logic (check + block)
- Boilerplate upgrade modal (UI only, no routing or API calls)
- Store-level guard inside `counterStore.createCounter()`
- Triggering the modal from `HomeView` or `CounterForm` when the guard fires

### Out of Scope

- Authenticated user limits of any tier (free, premium, etc.)
- Actual account upgrade / registration flow from the modal
- Any server changes
- Backfilling or retroactively removing counters from guests who already have > 5
- Hiding/disabling UI elements prior to reaching the limit
- Analytics or tracking of limit-hit events

---

## 5. Assumptions

| # | Assumption | Basis |
| --- | --- | --- |
| A1 | The limit applies **only to guests** (`isAuthenticated === false`). Authenticated free-tier users are not limited at this time. | Prompt says "guest account constraints." `authStore` distinguishes guest vs. authenticated; `isPremium` exists for future gating. |
| A2 | The limit is **not retroactive**. Guests who somehow have > 5 counters already (edge case) are not force-deleted. | Prompt makes no mention of cleanup; retroactive removal would be destructive and surprising. |
| A3 | The **"Add counter" button remains visible** at the limit; the modal fires on tap. | Better UX — hiding the button gives no signal about _why_ they can't add more. |
| A4 | The upgrade modal CTA can be **completely inert** (no `@click` handler or a `TODO` comment stub). | Prompt explicitly states "no logic for upgrading accounts yet." |
| A5 | The guard lives in **`counterStore.createCounter()`**, returning a `fail()` `StoreResponse`, which the view/component then uses to decide whether to show the modal. | This keeps business logic out of components, is consistent with the existing `StoreResponse` contract (`ok()` / `fail()`), and is the lowest-blast-radius insertion point. |
| A6 | The modal is implemented as a **Vue component** rendered conditionally in `HomeView`, controlled by a `ref<boolean>`. Using `ion-modal` or `ion-alert` inline is acceptable; a separate `GuestLimitModal.vue` is preferred for testability. | Project uses Ionic 8; `ion-modal` / `ion-alert` are already available. A dedicated component follows the existing `Counter.vue` / `CounterForm.vue` pattern. |
| A7 | The constant `GUEST_COUNTER_LIMIT = 5` is defined **once** (e.g., in the store or a shared constants file) and not magic-numbered. | Future changeability. |

---

## 6. Clarifying Questions

These are the remaining ambiguities that need your input before planning begins.

### Q1 — Where exactly should the modal be triggered?

**Context:** The guard can live in the store (`createCounter` returns `fail()`), but _showing_ the modal requires UI state. Two natural trigger points exist:

- **Option A — `HomeView.vue`:** The `showCounterForm = true` click handler checks the count before revealing the form. If at the limit, it shows the modal instead. The form is never opened.
- **Option B — `CounterForm.vue`:** The form's `updateCounter` submit handler calls `createCounter`, receives `fail()`, and emits an event or sets a local `ref` to open the modal.

**Question:** Should the limit be checked **before the form opens** (Option A — click on "Add counter") or **on form submission** (Option B — after the user fills in the form)? Option A is friendlier (prevents wasted effort filling a form), but needs confirmation.

---

### Q2 — Should authenticated **free-tier** (non-premium) users also be limited?

**Context:** The prompt says "guest account constraints," but the app has three tiers: guest, authenticated-free, and authenticated-premium. `isPremium` already exists in `authStore`. It's easy to extend the same limit to free-tier accounts now, but the prompt didn't explicitly ask for it.

**Question:** Is this limit **guests only**, or **guests + authenticated free-tier users**?

---

### Q3 — What should the upgrade CTA do (if anything)?

**Context:** The prompt says "boilerplate since there's no logic yet." Options:

- **Option A — Completely static:** CTA button renders but has no handler (or `@click="() => {}"` stub).
- **Option B — Navigate to `/login` or `/register`:** Even though upgrade logic doesn't exist, the button could route to the registration flow.

**Question:** Should the modal CTA navigate somewhere (e.g., `/register` or `/login`), or should it be a fully inert placeholder?

---

### Q4 — `ion-modal` vs. `ion-alert` vs. custom component?

**Context:** Ionic provides:

- `ion-alert` — simple, quick, accessible; limited styling control.
- `ion-modal` — full-screen or sheet; more flexible for future content (pricing table, etc.).
- A custom Vue component wrapping either — most flexible and testable.

**Question:** Do you have a preference for the modal style/component, or should we pick the most appropriate Ionic primitive?

---

### Q5 — Should the "Add counter" button be visually different at the limit?

**Context:** Even if the button stays visible, it could show a badge, tooltip, or different label (e.g., "Upgrade to add more") when a guest is at the cap, rather than looking identical to a normal "Add counter" button.

**Question:** Should the button appearance change at the limit, or should it look identical and only reveal the modal on click?
