# Security and longevity review

Review date: 2026-09-17. Remediation record updated: 2026-09-18.
Original revision: `49ece1c`. Repairs are local commits on `dev`.

This record tracks the source review and its repairs. It is not a release certification or a production penetration test.
No repair in this review has been pushed or deployed. Production settings and native store transactions remain unverified.

## Findings

| ID | Original finding | Source repair |
| --- | --- | --- |
| F01 | Pending work could cross accounts. | Session scopes stop stale requests, queue work, token writes, and cache writes. Requests carry the expected account ID. |
| F02 | An old refresh cookie could restore another account. | Login replaces the credential set. Non-remembered login clears the old refresh cookie. Web Locks coordinate cookie changes across tabs. |
| F03 | Logout left access tokens and sockets valid. | Logout revokes all account sessions and disconnects old sockets. Sockets also stop at token expiry. |
| F04 | An unused credential endpoint bypassed ownership checks. | The client and API account-update paths were removed. Password recovery remains the supported password-change path. |
| F05 | Monitoring retained private request data. | Client and server filters exclude bodies, credentials, private error values, extras, and breadcrumbs. |
| F06 | Runtime dependencies had known vulnerabilities. | Runtime fixes and compatible build-tool updates are installed. Two unpatched development-tool advisories remain; see below. |
| F07 | Sync retained deleted counters and overwrote local work. | Server snapshots determine current membership and deletions. Pending commands preserve unsent changes. Events request fresh snapshots. |
| F08 | One rejected command blocked unrelated counters. | Rejections remain visible and recoverable. Independent counters continue to sync. Corrected commands keep operation order. |
| F09 | Offline retries outlived deduplication records. | Mutation receipts no longer expire after 24 hours. Account deletion still removes its receipts. |
| F10 | Database failures became authentication failures. | Infrastructure errors use the temporary server-error path. The client keeps its offline session and pending work. |
| F11 | Validation discarded normalized input. | Controllers receive parsed request values, including normalization and field filtering. |
| F12 | API failures disclosed internal details. | Unexpected errors use a stable public response and sanitized server monitoring. |
| F13 | Password and login controls were weak. | Stronger password boundaries, generic credential errors, and persistent account/IP login limits are in place. |
| F14 | Concurrent joins bypassed the Basic limit. | A database account lock serializes the quota check and membership change. |
| F15 | Refresh rotation could leave a partial result. | Rotation and revocation share a transaction boundary. A 30-second retry can return the same direct successor. |
| F16 | Logout lacked confirmation and waited for the server. | A confirmation dialog precedes immediate local sign-out. Failed remote revocation produces a separate notice. |

The focused cleanup removed the unused `SET_COUNT` API and queue path, unused repository exports, and three direct server dependencies.
It also removed a slowdown stage that could not run before the hard request limit rejected the same traffic.

## Account and data rules

- Logout hides private UI immediately. It preserves unsent commands and saved ordering under the original account.
- Successful remote logout ends all sessions for that account. Offline logout does not claim remote revocation succeeded.
- Confirmed account deletion removes its cached counters, joined-counter cache, queued commands, and order key on that device.
- Deletion waits for started writes. A later login cannot cancel account-targeted cleanup or lose its own credentials.
- Failed server deletion preserves the account and local work. Failed local cleanup produces a notice after server deletion.
- Browser deletion can refresh expired access without holding the same Web Lock twice.
- Email verification is required before checkout, starting sharing, or joining. Personal counters remain available.
- Verification returns to the selected plan or original invite. Users must explicitly submit the code.
- Restoration and server purchase verification remain available to signed-in users without email verification.
- Deleting a Tally account does not cancel an Apple or Google subscription.

Passwords require at least 15 Unicode code points, an uppercase letter, and a number. The maximum is 72 UTF-8 bytes.
The byte limit prevents silent bcrypt truncation. Login accepts existing password lengths; registration and reset enforce the new policy.

Production login allows 10 attempts per account and 30 attempts per IP during 15 minutes. Successful attempts also count.
Postgres shares these limits across server processes and restarts. Development and test environments do not enforce the production limits.

## Release configuration

Production startup validates database, signing, email, frontend, port, and configured billing settings before accepting requests.
Signing and email-code secrets must differ and contain at least 32 characters. Frontend URLs must use HTTPS.
Billing API and webhook credentials must be configured together. Errors identify invalid fields without printing their values.
Development and test environments retain their local defaults. Startup validation does not prove provider credentials are valid.

Pages deployment now depends on static checks, unit tests, API tests, Postgres integration tests, and browser tests.
Only a successful `main` run can deploy. Manual deployment uses the CI workflow on `main` with the same checks.
These workflows pin Bun to 1.3.9. The Render build now uses the frozen lockfile.
The existing Husky wrapper already stops on the first failed check; no hook change was needed.

Apply committed migrations before starting the repaired API. This review added:

- `20260917190000_refresh_rotation`
- `20260917230000_login_rate_limits`

The local test database has both migrations. No production migration was applied during this review.
Do not reset or seed a deployed database to apply these changes.

## Approved sharing rules

Starting sharing requires a verified Premium account. Once one participant accepts, owners and accepted participants can copy the existing link without Premium.
Forwarding that link does not require a new email-verification check. Anyone who holds the link can pass it on.
Recipients must still sign in and verify their email. Basic accounts can join one counter; Premium accounts can join more.
The API checks ownership or accepted membership before returning a counter or its invite. Other accounts cannot retrieve the link by counter ID.

The owner's Delete action requires confirmation. Once deletion syncs, it removes the counter for everyone and invalidates its invite.
Participants see Leave instead of Delete. Their confirmation removes only their membership; the counter remains available to others.
There is no separate Stop sharing action that converts the counter to private. Join and leave events refresh all affected participants.

Premium expiration keeps existing memberships and invites valid. Reading, updating, and forwarding established shared counters remain available.
Basic limits apply only to new joins. Reopening an already-joined invite succeeds, even when several memberships remain after expiration.
The client no longer rejects this request from its cached quota. The server checks current membership and limits.

These rules follow the user's release-policy choices. No source-policy question remains from this review.

## Remaining release checks

- Resolve or explicitly accept the two build-tool advisories in [dependency security](dependency-security.md).
- Check repository branch protection and Render's deployment gate. They were not inspected or changed.
- Test backup restoration, database access controls, secret rotation, and production monitoring with redacted events.
- Confirm the repaired account and sharing flows against the deployed API after release approval.
- Test signed iOS and Android builds. Browser checks do not prove native keyboard, sheet, menu, or accessibility behavior.
- Test real Apple and Google checkout, restoration, cancellation, refunds, expiration, and account transfer.
- Disable sandbox grants on the public release backend. Keep test billing and production billing separate.
- Finish OAuth and the store requirements in the [release roadmap](plans/pre-ui-product-roadmap.md).

## Verification

The review uses an isolated Postgres database with fixture data. It does not use the user's development database.
The completed source repairs passed these local checks:

| Check | Result |
| --- | --- |
| Type checking, lint, and formatting | Passed. Eight existing generated-type warnings remain. |
| Client unit tests | 111 passed. |
| Server unit tests | 53 passed. |
| API component tests | 76 passed. |
| Postgres integration tests | 38 passed. |
| Browser tests | 44 passed. |
| API build and web, iOS, Android exports | Passed. Exports are not signed device builds. |
| Prisma client and Zod generation, schema validation | Passed. |
| Invalid production startup | Rejected before listening; fixture secrets were absent from errors. |
| Frozen dependency install | Passed without lockfile changes. |
| Workflow syntax and deployment dependencies | Local checks passed. GitHub execution remains unverified. |
| Dependency audit | Failed on the two unpatched development-tool advisories. |

The 322 automated tests include the approved sharing rules.
New checks reproduced blocked Basic forwarding, missing membership notifications, and the cached-quota rejection before repair.
Real Postgres checks cover denied outsiders, participant departure, owner deletion, invalidated invites, and retained access after expiration.
Browser checks cover forwarding, cancellation, deletion versus departure, and stable dialog content during its exit animation.
The first final browser run passed 43 of 44 checks. The deletion-expiry fixture could refresh during background sync before deletion.
The fixture now expires only the first deletion request. Two focused reruns passed with real rejection, refresh, and deletion responses.
Test review verdict: KEEP. These checks protect permissions, saved data, and session boundaries without replacing the tested behavior with mocks.
The upgrade layout was also checked in Chrome at desktop, 390px, and 320px widths.
Its compact account section has matching dividers. The smaller note wraps into balanced lines at 320px.

Tests cover real session transitions, persisted state, API authorization, queue recovery, and database concurrency.
Store tests replace the provider boundary. No simulator, new signed build, or live store purchase was used during this review.

The security review guides the trust boundaries. Ponytail guides minimal implementation and confirmed dead-code removal.
WIO guides test placement and assertions. Impeccable guides the verification and failed-sync UI refinements.
Authorization checks use current server state, consistent with [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).
