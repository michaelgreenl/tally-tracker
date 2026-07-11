# Pre-UI Product Roadmap

This plan covers the product and platform work to complete before deeper UI/UX polish.

## Goals

- Make account lifecycle, legal links, and store-compliance paths reliable.
- Put crash/error visibility in place before higher-risk auth and billing changes.
- Add recovery and identity features without compromising the current session model.
- Build premium entitlement support before replacing the upgrade placeholder.

## Recommended Sequence

### 1. Settings, Legal Links, and Account Deletion

- [x] complete

Ship the compliance foundation first:

- Add a Settings page.
- Link to Privacy Policy, Terms of Service, support/contact, and account deletion help.
- Add an in-app account deletion action.
- Ensure account deletion removes server-side account data and clears local device state.
- Keep public legal pages available outside the app for App Store Connect and Google Play.

This should happen before OAuth and billing because both features depend on clear account ownership and deletion behavior.

### 2. Sentry Crash and Error Reporting

- [x] complete

Add minimal monitoring early:

- Client/native error reporting.
- Server error reporting.
- Source-map handling if practical for production builds.
- Privacy policy language that matches any diagnostics collected.

Avoid broader observability changes in this slice. The immediate value is catching regressions during the remaining account and payment work.

### 3. Email Verification and Forgot Password

- [ ] complete

Implement these together because they share token and email infrastructure:

- Hashed one-time tokens.
- Expiration and consumed timestamps.
- Rate limiting.
- Generic responses that do not reveal whether an account exists.
- Password reset session invalidation.

Email verification can gate account trust later without blocking the account deletion foundation.

### 4. Apple and Google OAuth

- [ ] complete

Treat OAuth as an identity-model change, not a button-only change:

- Add a provider identity model.
- Support linking multiple identities to one account.
- Avoid fake passwords for OAuth-only accounts.
- Validate provider tokens on the backend.
- Issue existing app access and refresh tokens after provider validation.

If Google sign-in ships on iOS, Sign in with Apple should ship in the same release.

### 5. Payment and Entitlement Foundation

- [ ] complete

Use RevenueCat or equivalent entitlement infrastructure before building the final paywall:

- Configure monthly, yearly, and lifetime products.
- Map all paid products to a single premium entitlement.
- Sync entitlements to the backend.
- Treat the client as a display layer, not the source of truth for premium access.
- Add restore purchases and subscription-management paths.

Monthly and yearly plans are subscriptions. Lifetime access should likely be modeled as a non-consumable purchase.

### 6. Upgrade UI Replacement

- [ ] complete

Replace the current informational upgrade page after entitlement behavior is reliable:

- Show available plans.
- Support purchase and restore.
- Reflect current entitlement state.
- Route users to platform subscription management where appropriate.
- Keep server-side tier gating authoritative.

## Suggested Branch Slices

- `feat/settings-account-lifecycle`
- `feat/sentry-monitoring`
- `feat/email-verification-reset`
- `feat/oauth-identities`
- `feat/premium-entitlements`
- `feat/upgrade-paywall`

Each slice should stay narrow and avoid unrelated cleanup.
