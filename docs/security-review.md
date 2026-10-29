# Account and data boundaries

This document describes the current source contracts.
It does not certify production configuration or replace device and provider checks.

## Sessions and credentials

- Session scopes stop stale requests, queue work, token writes, and cache writes after an account change.
- Authenticated requests carry the expected account ID. The server still validates the credential and current session.
- Web Locks coordinate credential changes across browser tabs.
- Logout closes private UI immediately and preserves unsent commands under their original account.
- Default logout revokes only the current login, including its rotated refresh tokens and sockets.
- Selecting “Log out all devices” revokes every account session. This option is off by default.
- Failed remote logout does not block local sign-out. The client reports incomplete revocation.
- Refresh rotation and revocation use account locks and transactions.
- A rotated token can return the same active replacement for 30 seconds. It cannot create another replacement.
- Database and network failures preserve the local session and pending work.

Passwords require eight Unicode code points, an uppercase letter, and a number.
New hashes use scrypt. Existing bcrypt hashes remain usable without accepting truncated password suffixes.
Login does not apply registration length rules to existing passwords.

Production login allows 10 attempts per account and 30 per IP during 15 minutes.
Successful attempts also count. PostgreSQL shares these limits across processes and restarts.

## Account deletion

Confirmed deletion removes server account data and that account's local counters, commands, and saved order.
Local cleanup waits for started writes and preserves a later account's credentials.
Failed server deletion preserves local work. Failed local cleanup produces a notice after server deletion.

Apple-linked deletion revokes the Apple token before deleting account data.
Deleting a Tally account does not cancel an Apple or Google subscription.

## Counter access and synchronization

Only owners and accepted participants can read or change a shared counter.
Starting sharing requires a verified Premium account.
Owners and accepted participants can forward an established invite without Premium.
New participants must sign in and verify their email. Basic accounts can join one shared counter.

Premium expiration preserves existing memberships and invites.
Reopening an accepted invite succeeds even when several memberships remain after expiration.
The server checks quotas under an account lock.

Owner deletion removes the counter for everyone. Leaving or removing a participant changes only that membership.
Membership events refresh affected clients. Presence and last actions are limited to shared participants.

Server snapshots determine membership and deletions. Pending commands preserve unsent changes.
Rejected commands remain recoverable while unrelated counters continue to synchronize.
Idempotency receipts remain until account deletion because offline retries have no fixed deadline.

## Billing and email

Email verification precedes purchase, new sharing, and joining.
Restoration and server purchase verification remain available without email verification.
RevenueCat verification, not client claims, controls Premium access.
See [billing](billing.md) for credentials, sandbox isolation, and entitlement rules.

Email codes are hashed, expire, have attempt limits, and can be consumed only once.
A password reset revokes existing sessions. Reusing the current password does not consume a valid recovery code.

## Validation and monitoring

Zod passes normalized, filtered values to controllers.
Unexpected errors use a stable public response.
Sentry filters omit credentials, request bodies, private error values, extras, and breadcrumbs.

Production startup validates required environment fields before listening.
Signing and email-code secrets must differ and contain at least 32 characters.
Frontend URLs must use HTTPS. Billing API and webhook credentials must be configured together.
Startup errors identify fields without exposing values. Validation does not prove credentials work.

## Verification boundaries

Unit and component checks cover session changes, queue recovery, and error handling.
PostgreSQL checks cover authorization, quota locks, idempotency, rotation, and deletion.
Browser checks cover account and counter flows.
Provider tests replace external HTTP responses; they do not prove live authorization or store purchases.

Apply committed migrations before starting the API. Never reset or seed a deployed database.
Check current dependency findings in [dependency security](dependency-security.md).
