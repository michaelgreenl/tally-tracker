# Settings, Legal, and Account Deletion Roadmap

This plan is the first pre-UI product slice. It creates the account and compliance surface needed before OAuth, payments, and App Store submission.

## Scope

- Settings page.
- Legal and support links.
- In-app account deletion.
- Public account deletion fallback page.
- Store metadata URLs.

## Out of Scope

- Apple or Google OAuth.
- Email verification.
- Forgot password.
- RevenueCat or payment UI.
- Final visual redesign.

## Phase 1: Public URLs

Create stable public URLs for:

- Privacy Policy.
- Terms of Service or EULA.
- Account deletion instructions.
- Support/contact.

The current GitHub Pages direction is appropriate because these pages must work outside the app. They are needed for store metadata and for users who cannot access the installed app.

## Phase 2: Delete Route Hardening

Before wiring a Settings button to account deletion, harden the backend route:

- Ensure account deletion clears auth cookies in the response.
- Remove or explicitly retain user-linked operational records such as idempotency logs.
- Avoid returning `500` for repeated deletion attempts or valid-but-stale tokens.
- Add route tests that lock down these behaviors.

See [delete-user-route-audit.md](./delete-user-route-audit.md).

## Phase 3: Client Settings Page

Add a minimal Settings page with these sections:

- Account:
    - signed-in email
    - current tier
    - logout
- Subscription:
    - placeholder or hidden row until payment support exists
    - future manage-subscription entry point
- Legal:
    - Privacy Policy
    - Terms of Service
    - Support/contact
    - Account deletion help
- Danger zone:
    - Delete Account action

The page should be useful without trying to solve final UI polish.

## Phase 4: In-App Account Deletion Flow

The user-facing flow should be explicit and hard to trigger accidentally:

- Require an authenticated session.
- Require online state or handle offline failure clearly.
- Show a confirmation modal.
- Call `DELETE /users`.
- Clear local auth state.
- Clear cached user profile.
- Clear local counters for the deleted account.
- Clear pending sync queue commands.
- Disconnect sockets.
- Route out of authenticated views.

Do not route users only to the public deletion page. The in-app button should perform deletion.

## Phase 5: Store Submission Checklist

For App Store Connect:

- Privacy Policy URL.
- Support URL.
- In-app account deletion path.
- Subscription terms when paid subscriptions ship.

For Google Play:

- Privacy Policy URL.
- Data Safety form.
- Web account deletion URL.
- In-app account deletion path.

## Acceptance Criteria

- A signed-in user can delete their account from Settings.
- The backend deletes account-owned data and clears session cookies.
- Local auth, cached account data, counters, and pending sync commands are cleared.
- Public legal/deletion URLs are reachable without app auth.
- Tests cover successful deletion and retry/stale-token behavior.
