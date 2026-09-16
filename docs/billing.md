# RevenueCat Billing

## Current scope

The server verifies Premium access with RevenueCat. The native purchase screen, Restore Purchases action, and subscription management are not connected yet.

The existing Basic and Premium tiers remain. Monthly, yearly, and lifetime products must grant the same `premium` entitlement. Monthly and yearly products renew. Lifetime access does not expire.

No RevenueCat account, store products, signing credentials, or deployed settings are created by this change.

## Server configuration

Apply the committed database migrations before starting the updated API. Do not reset or seed a deployed database.

Set these server-only values:

| Variable | Value |
| --- | --- |
| `REVENUECAT_SECRET_API_KEY` | A RevenueCat secret API key with access to the v1 customer lookup. |
| `REVENUECAT_ENTITLEMENT_ID` | `premium`, unless the project uses a different entitlement identifier. |
| `REVENUECAT_WEBHOOK_SECRET` | At least 32 random characters. |
| `REVENUECAT_ALLOW_SANDBOX` | `true` on the test backend. Leave `false` on the public release backend. |

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

## Next integration slice

1. Create a RevenueCat project and its Test Store.
2. Create the `premium` entitlement and monthly, yearly, and lifetime packages in the current offering.
3. Select restore behavior for purchases associated with a different Tally account. Review transfers before enabling live billing.
4. Connect the native SDK, purchase screen, explicit Restore Purchases action, and subscription management.
5. Verify purchase, cancellation, failure, restoration, account switching, and expiration with Test Store.

Adding the native SDK requires a new development build. Test Store checks do not replace Apple and Google sandbox checks.

Before release, configure both real stores, test signed builds, update privacy disclosures, and verify account deletion with billing data. Deleting a Tally account must not imply that a store subscription was canceled.

## Verification

Unit tests exercise entitlement parsing, lifetime access, expiration boundaries, billing grace periods, malformed responses, and sandbox restrictions.

PostgreSQL integration tests exercise authenticated refresh, premium feature access, cancellation, refunds, stale snapshots, provider failures, transfers, and rejected requests. These tests replace only RevenueCat's HTTP response. They do not execute a store purchase.

Live RevenueCat and store verification remain required.

## References

- [RevenueCat Expo installation](https://www.revenuecat.com/docs/getting-started/installation/expo)
- [RevenueCat Test Store](https://www.revenuecat.com/docs/test-and-launch/sandbox/test-store)
- [Customer identification](https://www.revenuecat.com/docs/customers/identifying-customers)
- [Restore behavior](https://www.revenuecat.com/docs/projects/restore-behavior)
- [Webhook processing](https://www.revenuecat.com/docs/integrations/webhooks)
- [Customer record format](https://www.revenuecat.com/docs/api-v1/customer-info-model)
