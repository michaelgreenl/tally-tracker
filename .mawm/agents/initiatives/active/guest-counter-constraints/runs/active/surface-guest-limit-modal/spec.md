# Run Spec: Run 2: Surface the guest-limit modal

## Assigned Workflow

`coding`

## Task

Add a reusable client modal and wire the `Add counter` entry point in `HomeView.vue` so that a guest at the three-counter eligible cap sees the modal immediately instead of the create form.

## Current State

- `app/client/src/stores/counterStore.ts` now exports `GUEST_COUNTER_CAP`, `GUEST_COUNTER_LIMIT_MESSAGE`, and `eligibleCount`. `createCounter()` already blocks over-limit guest eligible creates before any local mutation as defense-in-depth.
- `app/client/src/views/HomeView.vue` owns `showCounterForm` and `counterToUpdate`, but the `Add counter` button still uses inline `@click="showCounterForm = true"` with no entry-point guard or modal state.
- `app/client/src/components/counter/CounterForm.vue` still awaits `createCounter()` and emits `done` unconditionally, so blocked-create UX must happen before the form opens in this run.
- `app/client/src/components/base/` currently contains only `BaseButton.vue` and `BaseNavLink.vue`; there is no reusable overlay or modal shell aligned with the existing base-component layer.
- `app/client/tests/e2e/specs/counters.cy.ts` already has a guest helper that creates counters through the current UI and verifies guest persistence/consolidation, but it does not cover clicking `Add counter` after the third eligible counter exists.

## Goal (Run Outcome)

When a guest with three eligible counters clicks `Add counter`, a guest-limit modal opens immediately, the create form stays closed, and no fourth counter is added. Guests under the cap and authenticated users still open the create form with no regression. Dismissing the modal returns to the same home state.

## Scope

- New reusable `app/client/src/components/base/BaseModal.vue` built on Ionic modal primitives and the existing base-button pattern.
- `app/client/src/views/HomeView.vue` entry-point guard, guest-limit modal state, and stable home-view selectors needed for Cypress.
- Guest-limit title/body copy for the modal.
- Guest at-cap Cypress coverage in `app/client/tests/e2e/specs/counters.cy.ts`.

## Out of Scope

- `app/client/src/components/counter/CounterForm.vue` behavior or `StoreResponse` handling.
- Guest-cap logic, thresholds, or eligibility rules in `counterStore.ts`.
- Upgrade route/page work, modal CTA navigation, router changes, or billing/tier behavior.
- New component-test infrastructure or unrelated UI cleanup.

## Contracts

- The `Add counter` entry point remains visible whenever the create form is not already open, including when a guest session is at the cap.
- When `!authStore.isAuthenticated && counterStore.eligibleCount >= GUEST_COUNTER_CAP`, clicking `Add counter` opens the guest-limit modal and leaves `showCounterForm` false.
- When under the cap or authenticated, clicking `Add counter` opens the existing create form flow and does not open the modal.
- Dismissing the modal closes only the modal; no counter is created, the form stays closed, and the existing list remains unchanged.
- `BaseModal.vue` is parent-controlled and generic. It accepts `isOpen`, `title`, optional `dismissLabel` (default `'Close'`), and optional `testId`, renders slot content for the body, and emits a single `close` event from the modal dismissal lifecycle. The dismiss button must use that same dismissal path so button, backdrop, and hardware-back dismissal all converge on one parent handler. It must not contain guest-counter-specific logic.
- Stable selectors are required for the blocked flow: `data-testid="add-counter-button"` on the home entry point, `data-testid="home-counter-form"` on the rendered create/update form wrapper, `data-testid="guest-limit-modal"` on the modal shell, and `data-testid="guest-limit-modal-dismiss"` on the modal dismiss button.
- Modal copy states that guest sessions can create up to three counters and that existing counters remain usable. It must not mention `/upgrade`, billing, or working tier changes in this run.
- `CounterForm.vue` create/update behavior and authenticated flows remain unchanged.

## Implementation Plan

1. Add `app/client/src/components/base/BaseModal.vue` as a small wrapper around Ionic's `IonModal` using `<script setup lang="ts">`. Keep it generic, use an Ionic-style title/body layout, and reuse `BaseButton` for the footer dismiss action instead of introducing a second button pattern.
2. In `BaseModal`, expose props `isOpen`, `title`, optional `dismissLabel = 'Close'`, and optional `testId`. Render the body through the default slot. Apply `data-testid` to a modal wrapper element when `testId` is provided, and derive `${testId}-dismiss` for the dismiss button selector.
3. Route every dismissal through the modal's normal dismiss lifecycle. The explicit dismiss button should trigger modal dismissal rather than directly mutating parent state, and `BaseModal` should emit `close` from the modal dismiss event so button, backdrop tap, and hardware-back all resolve through the same parent callback.
4. In `app/client/src/views/HomeView.vue`, replace the inline add-button toggle with a small `handleAddCounterClick()` function. Guard it with the existing store state: if the session is guest and `eligibleCount >= GUEST_COUNTER_CAP`, set `showGuestLimitModal = true`; otherwise open the existing form flow.
5. In `HomeView.vue`, keep form and modal states mutually exclusive. Add `showGuestLimitModal = ref(false)`, set `testId="add-counter-button"` on the add button, and wrap the existing form/cancel block in a container with `data-testid="home-counter-form"`.
6. Render `BaseModal` in `HomeView.vue` with guest-limit copy, `testId="guest-limit-modal"`, `isOpen` bound to `showGuestLimitModal`, and `@close="showGuestLimitModal = false"`. Do not add navigation or a secondary CTA in this run.
7. Extend `app/client/tests/e2e/specs/counters.cy.ts` in the guest suite. Reuse the existing guest create helper to create three eligible counters, click `[data-testid="add-counter-button"]`, assert `[data-testid="guest-limit-modal"]` is visible, assert `[data-testid="home-counter-form"]` does not exist, assert `ion-list ion-item` still has length `3`, dismiss via `[data-testid="guest-limit-modal-dismiss"]`, and confirm the modal is gone while the add button remains available.

## Verification Commands

- `bun run format:check`
- `bun --filter=client run lint`
- `bun --filter=client run typecheck`
- `bun --filter=client run test:unit`
- `bun --filter=client run test:e2e:spec -- tests/e2e/specs/counters.cy.ts`

## Smoke Verification

- Mode: `headless`
- Method: `bun --filter=client run test:e2e:spec -- tests/e2e/specs/counters.cy.ts`
- Manual instructions, if needed: `N/A`

## Completion Gate

- Guest users at the cap see the guest-limit modal directly from `Add counter`, and the create form never opens on that path.
- Guest users under the cap and authenticated users still open the create form without regression.
- Dismissing the modal returns to the same home state with no new counter and the add button still available.
- `BaseModal.vue` is generic, parent-controlled, and contains no counter-specific logic.
- Cypress covers the blocked entry-point flow with stable selectors.
- Code review is clear or all findings have been resolved.
- Verification commands pass.
- Smoke verification passes, or HITL confirms manual smoke instructions were completed.
- No out-of-scope form, store, router, or billing changes were introduced.
- Run is ready to become one commit on the initiative branch.
