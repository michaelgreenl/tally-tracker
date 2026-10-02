# iOS release checklist

Status checked: October 1, 2026. This checklist ends with the first public iOS release.
Android remains supported. Google Play publication is deferred.

## Release choices

- App Store name: **Tally | Counters & More**.
- Bundle identifier: `com.tallytracker.app`. App version: `1.0.0`.
- Free download, guest counters, and Basic accounts.
- Premium: USD 1 monthly, USD 10 yearly, or USD 30 lifetime.
- Exclude EU countries and mainland China from the initial release.
- Public support: `tallysupportcontact1@gmail.com`.

## Completed work

These entries record implementation or reported verification, not App Review approval.

- Apple Developer membership and the App Store Connect app record are active.
- Password, Google, and Apple sign-in are implemented. The owner confirmed device sign-in and account linking.
- Usernames, Participants, presence, counter reset, and number editing are implemented.
- Home Screen widgets, rectangular and compact Lock Screen counters, and the launcher are implemented.
- The owner approved the latest phone UI and screenshot composition.
- The approved combined widget screenshot was exported as an opaque 1320 × 2868 PNG.
- Purchases and restoration are implemented. The owner confirmed purchase, cancellation, and expiration behavior in Apple's sandbox.
- Legal pages and account deletion are implemented. The reviewer account and contact form were completed by the owner.
- App Privacy answers were approved by the owner. Check their saved status in App Store Connect before submission.
- Production Sentry verification recorded `TALLY-SERVER-1` and `TALLY-CLIENT-1` on September 28.
- Build 3 uploaded source maps and native debug symbols during that verification.
- Local type, format, lint, unit/component, PostgreSQL, browser, and native widget checks passed.

Render's `EMAIL_FROM` is configured and does not use Resend's restricted test sender, checked October 1.
The old restricted-sender note was stale. Configuration alone does not prove delivery to every recipient.

## Submission work

1. Archive and upload a signed release build from the final verified commit.
2. Select the processed build and attach the first in-app purchases.
3. Upload the approved screenshots and check privacy answers, regions, review access, and required store fields.
4. Submit for App Review.

App Store Connect currently requires sign-in. No final build selection or submission was verified on October 1.

Use one CPU-heavy job at a time. Follow the worker and CPU limits in [AGENTS.md](../../AGENTS.md).
Do not reset or seed production data. Do not treat a Debug phone install as an App Store archive.

## References

- [Billing configuration and verification](../billing.md)
- [Apple sign-in](../apple-sign-in.md)
- [Widget architecture and checks](../ios-widgets.md)
- [App assets](../app-assets.md)
- [Dependency advisories](../dependency-security.md)

After approval, install the public build and check sign-in, counters, purchases, and support links.
Record the released commit and build number. Keep later feature work outside this release.
