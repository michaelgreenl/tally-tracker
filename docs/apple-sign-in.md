# Sign in with Apple

## Scope

The iOS app uses Apple's native sign-in control. Web and Android keep their existing sign-in methods. The client sends a single-use authorization code and nonce. The API verifies Apple's signed identity token. It reuses Tally's session, billing identity, and counter storage.

An Apple identity uses its stable subject identifier, not its email address. Matching email addresses never merge accounts automatically. Existing users must sign in first, then select **Connect Apple** in Settings. This preserves their counters, Premium access, and existing email, including when Apple supplies a private relay address. An Apple email does not verify a different Tally email.

## Configuration

1. Enable Sign in with Apple for `com.tallytracker.app` in Apple Developer.
2. Create a Sign in with Apple key for that App ID. Keep the downloaded `.p8` file outside this repository.
3. Configure the API with the values below. Apply database migrations without resetting or seeding the deployed database.
4. Set the App ID's server notification URL to `https://<api-host>/users/apple/notifications` after the updated API is deployed.
5. Register Tally's outbound email domain and sender with Apple's private email relay service. Verify its SPF or DKIM configuration.
6. Set `EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED=true` in the iOS build environment only after the API and relay are ready.
7. Create a new signed development build. The native module and entitlement require a rebuild and updated provisioning.

| Server variable              | Value                                                          |
| ---------------------------- | -------------------------------------------------------------- |
| `APPLE_CLIENT_ID`            | `com.tallytracker.app`                                         |
| `APPLE_TEAM_ID`              | The Apple Developer team identifier                            |
| `APPLE_KEY_ID`               | The Sign in with Apple key identifier                          |
| `APPLE_PRIVATE_KEY`          | The `.p8` contents; real newlines or escaped `\n` are accepted |
| `APPLE_TOKEN_ENCRYPTION_KEY` | 32 random bytes encoded as 64 hexadecimal characters           |

Never put either private key in an `EXPO_PUBLIC_` variable. Production startup rejects partial Apple configuration. Back up the token-encryption key with the deployment secrets. Do not replace it when rotating Apple's signing key. Losing it prevents decryption of stored revocation credentials.

The API encrypts Apple refresh tokens before storage. Account deletion revokes the Apple token before deleting local account data. If Apple is unavailable, deletion fails without removing that data, so the user can retry. Signed consent-revocation and account-deletion notifications invalidate Tally sessions and remove the stored Apple token. Reauthorization retains the same Tally account. Duplicate and older notifications do not revoke a newer authorization.

## Device verification

1. Create an account with Apple using **Hide My Email**. Sign out, then sign in again. Confirm the same account and counters.
2. Sign in to an existing password or Google account. Connect Apple in Settings, then sign in with Apple after logout.
3. Confirm the account identifier, counters, and Premium state remain unchanged. Repeat with a private relay address.
4. Cancel Apple's sheet. Confirm no error, login, or stuck loading state. Confirm other sign-in controls remain usable.
5. Send a password-reset email to a test relay address. Confirm delivery through the registered sender.
6. Revoke Tally access in Apple settings. Confirm notification delivery and rejection of the previous Tally session.
7. Authorize Apple again. Confirm access returns to the original Tally account.
8. Delete a disposable Apple-linked account. Confirm Apple revocation and removal of its Tally data.
9. Check VoiceOver, larger text, and button width on a physical iPhone. Automated callback tests do not verify native appearance.

## Automated checks

Service tests use real signed JWTs and encryption with a fake Apple HTTP boundary. API integration tests use PostgreSQL, real sessions, and the account locks; only Apple responses are replaced. Client tests cover nonce/state handling, cancellation, disabled presses, linking, and stale callbacks. These checks do not replace real Apple authorization, relay delivery, notifications, or a signed device build.

## References

- [Expo Apple Authentication](https://docs.expo.dev/versions/latest/sdk/apple-authentication/)
- [Create an Apple sign-in key](https://developer.apple.com/help/account/capabilities/create-a-sign-in-with-apple-private-key/)
- [Configure private email relay](https://developer.apple.com/help/account/capabilities/configure-private-email-relay-service/)
- [Handle account changes](https://developer.apple.com/documentation/signinwithapple/processing-changes-for-sign-in-with-apple-accounts)
- [Account deletion and token revocation](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple)
