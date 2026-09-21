# iOS widgets

Tally includes two WidgetKit widgets on iOS 17 and later:

- **Counter:** Small and medium Home Screen widgets. Choose a counter in Edit Widget. Use its existing increment for each tap.
- **Open Tally:** Circular and rectangular Lock Screen shortcuts. They open `tally://home`.

Widget taps work with Tally closed. Open Tally to send those changes to the server. Remote changes reach widgets after the app refreshes. Widgets do not run a separate network or login client. Android and web do not expose these widgets.

## Signing and installation

The existing app remains `com.tallytracker.app`. The extension uses `com.tallytracker.app.widgets`. Both targets require the App Group `group.com.tallytracker.app`.

1. Finish Apple Developer enrollment and identity verification.
2. Register the App Group. Enable it for both identifiers in the same Apple team.
3. Set `ios.appleTeamId` in the Expo configuration to that verified team.
4. Generate the iOS project. Build and install both targets together with updated profiles.
5. Open Tally once. Add a counter or sign in, then add the widgets through iOS.

A development-server reload cannot install an extension. This feature needs a new native build. The widget selector is account-specific. Select a counter again after changing accounts.

## Data handoff

`targets/tally-widgets/WidgetStore.swift` is shared by the extension and the local Expo module. The root `TallyWidgetBridge.podspec` includes both source locations without copying that store. The extension build comes from `@bacons/apple-targets`; native source stays outside generated `ios` files.

The store uses an App Group file, a cross-process lock, and atomic writes. Each tap saves its amount and a unique command ID with the widget count. It uses the same six-decimal range as the core counter model.

The app imports taps through its existing serialized counter writes. Counts and import receipts commit together before commands enter the existing sync queue. The app acknowledges a widget tap only after both writes succeed. Retries keep the command ID, so server idempotency still applies. Guest taps stay local and use the existing guest-account consolidation.

Server processing waits until the native journal acknowledges the handoff. This prevents server retries from taking ownership too early.

Conflicting widget taps remain stored if another device reaches the counter limit. Decrease the count or delete the counter in Tally to resolve them.

No passwords, tokens, or share links enter the App Group. Session changes hide widget counter data. Account deletion also removes that account's pending widget taps. Home Screen counter content uses system privacy redaction. The Lock Screen shortcut has no counter data.

## Verification

From `packages/app/client`, run `bun test:widgets` on a Mac with Xcode. This checks concurrent native writers, decimal counts, acknowledgement, account isolation, and the iOS widget types. The regular client tests check interrupted app imports and their integration with the sync queue.

Before release, check these on a signed phone build:

1. Add small and medium widgets. Choose different counters, including a shared counter.
2. Tap plus and minus with Tally closed and without network access. Open Tally and check the exact total.
3. Restore network access. Check that another signed-in device receives the total once.
4. Change the increment in Tally. Confirm the next widget tap uses it.
5. Test long names, large text, VoiceOver, tinted widgets, and Reduce Motion.
6. Delete a selected counter, sign out, and switch accounts. Old widgets must not change another account.
7. Use the Lock Screen shortcut. Confirm that it opens Tally after the system unlock step.

Signing, phone appearance, and extension interactions still need device verification.
