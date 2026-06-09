# Run Spec: Run 3: Add upgrade placeholder navigation

## Assigned Workflow

`coding`

## Task

Add a guest-accessible `/upgrade` placeholder route/page, wire the guest-limit modal CTA to it, and finish Cypress coverage for the blocked-create navigation path back to home.

## Current State

- `app/client/src/views/HomeView.vue` already guards the `Add counter` entry point with `eligibleCount` and opens `BaseModal` when a guest is at the cap, but the modal only shows explanatory copy plus a dismiss button.
- `app/client/src/components/base/BaseModal.vue` is already generic and parent-controlled. It exposes a body slot and a built-in dismiss action, so the upgrade CTA can be rendered from `HomeView.vue` without introducing modal-specific props.
- `app/client/src/router/index.ts` only registers `/`, `/login`, `/register`, `/home`, and `/join`; there is no `/upgrade` destination or title metadata for an upgrade page.
- `app/client/src/App.vue` uses `ion-router-outlet`, so route views participate in Ionic's navigation stack. If `HomeView.vue` leaves `showGuestLimitModal` true while navigating away, the cached home page can resurface with the modal still open when the user returns.
- `app/client/tests/e2e/specs/counters.cy.ts` currently proves only the at-cap modal open/dismiss path. It does not cover following an upgrade CTA to a placeholder page and returning to the existing home state.

## Goal (Run Outcome)

Guests who hit the three-counter limit can open an informational `/upgrade` page from the guest-limit modal, read clearly non-functional placeholder messaging, and return to `/home` without losing counters, changing auth state, or bypassing the guest-limit behavior. Cypress covers the full modal -> upgrade -> home path.

## Scope

- `app/client/src/router/index.ts` route registration for `/upgrade`, including page title metadata and guest accessibility.
- New `app/client/src/views/UpgradeView.vue` placeholder page.
- `app/client/src/views/HomeView.vue` modal CTA wiring and any tiny local state reset needed before navigation.
- Stable selectors and placeholder copy needed for the Cypress navigation assertions.
- Cypress coverage in `app/client/tests/e2e/specs/counters.cy.ts` for the blocked-create navigation flow.

## Out of Scope

- Billing, checkout, subscriptions, premium unlocks, or any server/API changes.
- Counter-cap rules, `counterStore.createCounter()`, `CounterForm.vue`, or authenticated create behavior.
- Refactoring `BaseModal.vue` into a multi-action abstraction; keep the upgrade CTA wired from `HomeView.vue` through the existing slot-based API.
- Login/register flow changes, auth guard redesign, or unrelated view cleanup.

## Contracts

- `/upgrade` is guest-accessible. Do not add `requiresAuth`, and do not redirect guests away from the page.
- The placeholder page must clearly state that upgrade and billing functionality are not implemented yet. It must not imply that a purchase can be completed in this run.
- Clicking the upgrade CTA from the guest-limit modal must not call `createCounter()`, mutate `counterStore.counters`, or change `authStore.isAuthenticated`.
- `HomeView.vue` must clear its guest-limit modal state before navigating to `/upgrade` so returning through Ionic navigation does not reopen the modal unexpectedly.
- The create form remains closed on the blocked path before and after the trip to `/upgrade`.
- Returning from the placeholder page to `/home` preserves the existing three counters and leaves the guest-limit behavior intact.
- `BaseModal.vue` remains generic and free of upgrade-specific props or branching.
- Stable selectors are required for the Cypress flow: `data-testid="guest-limit-modal-upgrade"` on the modal CTA, `data-testid="upgrade-placeholder-page"` on the placeholder page wrapper, and `data-testid="upgrade-placeholder-back"` on the return action.

## Implementation Plan

1. Add `app/client/src/views/UpgradeView.vue` as a small route-level Ionic page using `<script setup lang="ts">`. Keep it single-file and minimal: a title, one or two short paragraphs explaining that upgrade/billing is not available yet, and a single return action back to `/home`.
2. In `app/client/src/router/index.ts`, import `UpgradeView` and register `{ path: '/upgrade', name: 'Upgrade', component: UpgradeView, meta: { title: 'Upgrade' } }`. Leave the existing auth guard behavior unchanged so the page stays accessible to guests and authenticated users alike.
3. In `UpgradeView.vue`, use the existing router instance and a `BaseButton` return action with `test-id="upgrade-placeholder-back"`. Route back to `/home` explicitly with `router.replace('/home')` so leaving the placeholder page is deterministic and does not depend on browser history state.
4. In `app/client/src/views/HomeView.vue`, add a small CTA handler for the guest-limit modal. That handler must set `showGuestLimitModal = false`, keep `showCounterForm = false`, and then `router.push('/upgrade')`.
5. Render the CTA from `HomeView.vue` inside the existing `BaseModal` default slot using `BaseButton` with `test-id="guest-limit-modal-upgrade"`. Keep `BaseModal.vue` unchanged unless a tiny selector-forwarding adjustment is strictly required.
6. Add a lightweight wrapper on the upgrade page with `data-testid="upgrade-placeholder-page"`, and use copy that explicitly says the page is informational only and that no upgrade or billing action is available yet.
7. Extend `app/client/tests/e2e/specs/counters.cy.ts` in the guest suite: create three guest counters, open the guest-limit modal, click `[data-testid="guest-limit-modal-upgrade"]`, assert the URL includes `/upgrade`, assert the placeholder page and non-functional copy are visible, click `[data-testid="upgrade-placeholder-back"]`, assert the URL returns to `/home`, assert the three counters still exist, and assert the create form is still closed.
8. Finish the Cypress proof by clicking `Add counter` again after returning home and confirming the guest-limit modal opens again instead of the form. That verifies the navigation round-trip did not clear counters or weaken the existing cap enforcement.

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

- Guests can reach `/upgrade` from the guest-limit modal and leave the page without losing their existing counters.
- The `/upgrade` page clearly communicates that upgrade/billing is only a placeholder in this run.
- Returning to `/home` leaves the create form closed and preserves the existing guest-limit behavior.
- Cypress covers the modal -> upgrade -> home round-trip with stable selectors.
- Code review is clear or all findings have been resolved.
- Verification commands pass.
- Smoke verification passes, or HITL confirms manual smoke instructions were completed.
- No out-of-scope billing, store, auth, or backend changes were introduced.
- Run is ready to become one commit on the initiative branch.
