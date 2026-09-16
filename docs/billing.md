# RevenueCat Billing

## Current scope

The native upgrade screen loads RevenueCat's current offering and localized prices. Signed-in users can purchase or restore. The server verifies Premium access before the client changes its account state.

Guests and web users can preview plans, but cannot buy or restore from that screen. Web users retain Premium access through their Tally account. Native Premium users can open the store management URL when RevenueCat supplies one. Lifetime purchases do not need subscription cancellation.

The existing Basic and Premium tiers remain. All three products grant the same entitlement. The Tally Test Store uses `tally_premium`; the server default is `premium`, so set the override below. Monthly and yearly products renew. Lifetime access does not expire.

The Test Store's current `default` offering contains:

| Package        | Product                  | Test price      |
| -------------- | ------------------------ | --------------- |
| `$rc_monthly`  | `tally_premium_monthly`  | USD 1 per month |
| `$rc_annual`   | `tally_premium_yearly`   | USD 10 per year |
| `$rc_lifetime` | `tally_premium_lifetime` | USD 20 once     |

Store credentials, webhook delivery, and a new native development build remain necessary for manual testing. This integration does not enable production payments.

## Client configuration

Set `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY` to the Test Store's public SDK key in the client's ignored `.env`. Restart Expo after changes. Test Store keys are accepted only in development builds.

Keep `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` and `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` empty until real store billing is ready. Release builds accept only the matching `appl_` or `goog_` SDK key. Never use a secret API key in the client.

The SDK uses the Tally account UUID. It does not configure anonymous customers. SDK account changes wait for any open purchase to finish. Tally logout removes listeners; the next signed-in account identifies itself before any store action. The SDK's anonymous logout operation is not used.

Customer updates and app foreground events request server verification. Failed background checks preserve the last verified profile. Purchase and restore failures show a recoverable message. A completed purchase with failed verification directs the user to restore, not buy again.

## Server configuration

Apply the committed database migrations before starting the updated API. Do not reset or seed a deployed database.

Set these server-only values:

| Variable                    | Value                                                                    |
| --------------------------- | ------------------------------------------------------------------------ |
| `REVENUECAT_SECRET_API_KEY` | A RevenueCat secret API key with access to the v1 customer lookup.       |
| `REVENUECAT_ENTITLEMENT_ID` | `tally_premium` for the configured Tally Test Store.                     |
| `REVENUECAT_WEBHOOK_SECRET` | At least 32 random characters.                                           |
| `REVENUECAT_ALLOW_SANDBOX`  | `true` on the test backend. Leave `false` on the public release backend. |

Never add a secret key to an `EXPO_PUBLIC_` variable. Keep test and public release billing in separate RevenueCat projects and databases. This prevents sandbox purchases from replacing a customer's production entitlement snapshot.

Configure the RevenueCat webhook with:

- URL: `https://<api-host>/billing/revenuecat`
- Authorization header: `Bearer <REVENUECAT_WEBHOOK_SECRET>`
- All customer lifecycle event types, including transfers.
- The purchase environment used by that backend.

The API returns success only after the refresh completes. A failed lookup returns `503` so RevenueCat can retry. Invalid authorization returns `401`. Dashboard test events return success without changing accounts.

## Access rules

- Use the Tally account UUID as the RevenueCat App User ID. Require sign-in before purchase or restoration.
- After purchase or restoration, call `POST /billing/sync` with the existing Tally authentication. Send no body.
- The server fetches RevenueCat's customer record. It does not accept a client-supplied account ID, tier, or receipt as proof.
- The response contains the verified tier. The client must refresh its account profile before changing Premium controls.
- Cancellation retains access through the paid period or active billing grace period.
- Expiration, refunds, and transfers use the current RevenueCat entitlement state, not the notification's event name.
- Older snapshots cannot overwrite newer verified state. Repeated notifications can safely refresh the same account.
- Failed lookups preserve the last verified state. The server still rejects expired grants and disabled sandbox grants.
- Lifetime access has no expiration date. A later verified revocation removes it.
- Deleted Tally accounts do not create new RevenueCat records when notifications arrive.

The server stores the last verified tier, its expiration, the snapshot time, and whether the purchase used a sandbox. Existing manually assigned tiers remain until RevenueCat verifies that account.

The normal account endpoints and premium feature checks apply expiration rules when reading the stored tier. No background timer is required to stop expired access.

## Manual Test Store checks

1. Configure the test backend with the server key, entitlement identifier, sandbox access, and webhook secret.
2. Configure the matching RevenueCat webhook. Confirm its test event succeeds.
3. Rebuild the native development app and sign in with a Basic test account.
4. Open Upgrade. Confirm all three store prices match the table above.
5. Cancel checkout, then simulate failure. Neither action must grant Premium.
6. Complete a test purchase. Confirm server-verified Premium and sharing access.
7. Restart the app and restore the purchase. Confirm no second payment occurs.
8. Test with a second Tally account after selecting the project's restore policy. Confirm the resulting ownership matches that policy.
9. Let a test subscription expire. Confirm webhook and foreground verification remove Premium access.
10. Test lifetime access, cancellation, refunds, offline verification, and recovery without a second purchase.

RevenueCat's Test Store simulates payments. It does not charge a payment card. Decide whether restoration transfers access or requires the original Tally login before testing account transfers.

Adding the native SDK requires a new development build. Test Store checks do not replace Apple and Google sandbox checks.

Before release, configure both real stores, test signed builds, update privacy disclosures, and verify account deletion with billing data. Deleting a Tally account must not imply that a store subscription was canceled.

## Verification

Unit tests exercise entitlement parsing, lifetime access, expiration boundaries, billing grace periods, malformed responses, and sandbox restrictions. Client tests cover SDK identity, checkout serialization, release-key guards, server verification, and account changes during verification. SDK tests replace the store boundary; they do not prove native checkout works.

PostgreSQL integration tests exercise authenticated refresh, premium feature access, cancellation, refunds, stale snapshots, provider failures, transfers, and rejected requests. These tests replace only RevenueCat's HTTP response. They do not execute a store purchase.

Live RevenueCat and store verification remain required.

## References

- [RevenueCat Expo installation](https://www.revenuecat.com/docs/getting-started/installation/expo)
- [RevenueCat Test Store](https://www.revenuecat.com/docs/test-and-launch/sandbox/test-store)
- [Customer identification](https://www.revenuecat.com/docs/customers/identifying-customers)
- [Restore behavior](https://www.revenuecat.com/docs/projects/restore-behavior)
- [Webhook processing](https://www.revenuecat.com/docs/integrations/webhooks)
- [Customer record format](https://www.revenuecat.com/docs/api-v1/customer-info-model)
