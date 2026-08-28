# Pre-Release Product Roadmap

This plan ends when Tally Tracker is publicly available on the App Store and Google Play.

That release is the checkpoint for starting the broader product roadmap.

## Release Definition

The first public release is complete when:

- Apple and Google approve the app.
- Users can install the app from both stores.
- Production authentication, counters, synchronization, legal links, and account deletion work.
- OAuth, purchases, restoration, and premium access work.
- Production errors reach Sentry.
- Store privacy answers match the app and its third-party services.
- A tested release and recovery process exists.

## Version 1 Scope

- Basic access requires a free account.
- Premium is the only paid tier.
- Monthly, yearly, and lifetime purchases unlock the same premium entitlement.
- OAuth, payments, entitlements, and the upgrade UI block release.
- Password recovery blocks release. Email verification can ship with it.

## Product Foundation

### 1. Settings, Legal Links, and Account Deletion

- [x] implementation complete
- [ ] production verification complete

- Add a Settings page.
- Link to the Privacy Policy, Terms of Service, support, and account deletion help.
- Add an in-app account deletion action.
- Remove server account data and clear local device state during deletion.
- Keep public legal pages available outside the app.
- Verify the production deletion flow before store submission.

### 2. Sentry Crash and Error Reporting

- [x] implementation complete
- [ ] production verification complete

- Report client, native, and server errors.
- Upload production source maps.
- Keep diagnostic collection consistent with the Privacy Policy.
- Verify one controlled production event before store submission.

### 3. Email Verification and Forgot Password

- [ ] complete

Implement this shared token and email foundation:

- Hash one-time tokens.
- Add expiration and consumed timestamps.
- Rate-limit requests.
- Return generic responses that do not reveal account existence.
- Invalidate active sessions after a password reset.
- Verify email delivery outside local development.

### 4. Apple and Google OAuth

- [ ] complete
- [x] required for version 1

Treat OAuth as an identity-model change:

- Add provider identities.
- Support multiple identities for one account.
- Do not create fake passwords for OAuth-only accounts.
- Validate provider tokens on the server.
- Issue the existing access and refresh tokens after validation.

If Google sign-in ships on iOS, ship Sign in with Apple in the same release.

### 5. Payment and Entitlement Foundation

- [ ] complete
- [x] required for version 1

Use RevenueCat or an equivalent entitlement service:

- Configure monthly, yearly, and lifetime products.
- Map paid products to one premium entitlement.
- Sync entitlements to the server.
- Keep the server authoritative for premium access.
- Add purchase restoration and subscription management.

Monthly and yearly plans are subscriptions. Lifetime access is a non-consumable purchase.

Target prices are about 1 USD monthly, 10 USD yearly, and 20 USD lifetime.

### 6. Upgrade UI Replacement

- [ ] complete
- [x] required for version 1

Replace the placeholder after entitlement behavior is reliable:

- Show available plans.
- Support purchase and restoration.
- Show the current entitlement state.
- Link to platform subscription management.
- Keep server tier checks authoritative.

## Store Publication

Start account enrollment and tester recruitment now. They can run beside product work.

### 7. Developer Accounts and App Records

- [ ] Enroll in the Apple Developer Program.
- [ ] Choose an Apple individual or organization account.
- [ ] Create a Google Play Console account.
- [ ] Confirm whether Google's closed-test rule applies.
- [ ] Recruit 12 Android testers if the rule applies.
- [ ] Create the Expo EAS project.
- [ ] Create the App Store Connect app record.
- [ ] Create the Play Console app record.

Apple charges 99 USD each year. Google Play charges a one-time 25 USD fee.

Apple displays the legal name for individual accounts. Organization enrollment needs a D-U-N-S Number.

Google personal accounts created after November 13, 2023 require 12 testers for 14 continuous days.

### 8. Release Identity and Assets

- [ ] Confirm the app name and store availability.
- [ ] Confirm `com.tallytracker.app` before the first store upload.
- [ ] Replace all Expo starter icons and splash assets.
- [ ] Set the public release version.
- [ ] Confirm supported devices, operating systems, and portrait orientation.
- [ ] Remove or hide incomplete version 1 entry points.
- [ ] Confirm public support, privacy, terms, and deletion URLs.
- [ ] Replace placeholder support text with a working contact.
- [ ] Add a web deletion request path that works without app access.

Do not change the bundle identifier or Android package after publication.

### 9. Production Build Configuration

- [ ] Add the minimum `eas.json` production build and submit profiles.
- [ ] Link the project to the correct Expo account.
- [ ] Configure production API and Sentry environment values.
- [ ] Let EAS manage signing credentials unless a store credential already exists.
- [ ] Set automatic iOS build numbers and Android version codes.
- [ ] Build iOS with the iOS 26 SDK or later.
- [ ] Target Android 16, API level 36, or later.
- [ ] Run Expo Doctor before each release candidate.
- [ ] Produce signed iOS and Android production builds.

Use EAS Build and EAS Submit first. Add release automation only after manual releases become repetitive.

### 10. Store Metadata and Compliance

- [ ] Write the app name, subtitle, short description, and full description.
- [ ] Select store categories, regions, age groups, and content ratings.
- [ ] Capture final iPhone and Android screenshots.
- [ ] Add support and privacy URLs to both store records.
- [ ] Complete Apple's App Privacy answers.
- [ ] Complete Google's Data safety form.
- [ ] Include server and Sentry data in both privacy disclosures.
- [ ] Add Google's account deletion web URL.
- [ ] Declare ads, target audience, and app access details.
- [ ] Create a stable reviewer account and clear review instructions.
- [ ] Complete export, trader, and other applicable declarations.

EAS Submit uploads binaries. It does not complete store metadata or screenshots.

### 11. Beta and Release Testing

- [ ] Distribute the iOS build through TestFlight.
- [ ] Distribute the Android build through an internal test.
- [ ] Start the required Android closed test, if applicable.
- [ ] Keep 12 Android testers opted in for 14 continuous days, if required.
- [ ] Test on at least one physical iPhone and one physical Android phone.
- [ ] Test install, registration, login, token refresh, logout, and password recovery.
- [ ] Test counter creation, updates, deletion, and synchronization.
- [ ] Test Basic limits and Premium shared-counter access.
- [ ] Test offline recovery, app restart, and network failure behavior.
- [ ] Test legal links, account deletion, and local data clearing.
- [ ] Confirm Sentry receives release events with readable source maps.
- [ ] Fix release blockers and repeat affected checks.

Do not add broad test coverage here. Add tests only for real contracts and discovered regressions.

### 12. Submission and Public Release

- [ ] Freeze version 1 scope.
- [ ] Build the final signed binaries from the release commit.
- [ ] Upload both binaries with EAS Submit.
- [ ] Complete each store's final review checklist.
- [ ] Submit the iOS build for App Review.
- [ ] Apply for Google production access after required testing.
- [ ] Submit the Android release for review.
- [ ] Resolve review feedback without unrelated changes.
- [ ] Use manual release control for the first launch.
- [ ] Publish both approved releases.
- [ ] Tag the released commit with the public version.

### 13. Launch Verification

- [ ] Install each public store build.
- [ ] Run the critical account and counter flows against production.
- [ ] Monitor Sentry and Render during the first release window.
- [ ] Confirm support and deletion requests reach the correct destination.
- [ ] Record the final build, submission, and recovery commands.
- [ ] Move unfinished product items into the post-release roadmap.

## Immediate Next Work

1. Start Apple and Google account enrollment.
2. Confirm whether the Google 12-tester rule applies.
3. Implement email verification and password recovery.
4. Add Apple and Google OAuth.
5. Add premium entitlements, purchases, restoration, and the upgrade UI.
6. Replace starter assets and prepare the EAS production configuration.

## Suggested Branch Slices

- `feat/email-verification-reset`
- `feat/oauth-identities`
- `feat/premium-entitlements`
- `feat/upgrade-paywall`
- `chore/app-release-assets`
- `chore/eas-store-builds`
- `chore/store-metadata`
- `fix/release-candidate`

Each slice must contain one concern and no unrelated cleanup.

## Official References

- [Expo production builds](https://docs.expo.dev/deploy/build-project/)
- [Expo store submission](https://docs.expo.dev/deploy/submit-to-app-stores/)
- [Apple submission requirements](https://developer.apple.com/app-store/submitting/)
- [Apple App Privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)
- [Apple account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- [Google Play app setup](https://support.google.com/googleplay/android-developer/answer/9859152?hl=en)
- [Google Play review preparation](https://support.google.com/googleplay/android-developer/answer/9859455?hl=en)
- [Google Play Data safety](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Google Play account deletion](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)
- [Google Play closed testing](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-GB)
- [Google Play target API rules](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en)
