# App assets

Tally uses the existing tally-mark logo, white on the app's teal color. The launch screen uses the same mark on the app's dark background.

## Sources

- `packages/app/client/assets/tally.icon`: editable Apple Icon Composer project.
- `packages/app/client/assets/tally.icon/Assets/tally.svg`: vector mark, matching the in-app `TallyLogo` artwork.
- `packages/app/client/assets/store/feature-graphic.svg`: editable Google Play cover, with illustrative counters.

Keep the vector mark and the in-app `TallyLogo` paths aligned when the logo changes.

## Exports

| File under `packages/app/client/assets` | Size        | Use                                                     |
| --------------------------------------- | ----------- | ------------------------------------------------------- |
| `images/icon.png`                       | 1024 × 1024 | Default app icon and older Android launchers            |
| `images/android-icon-foreground.png`    | 1024 × 1024 | Android adaptive foreground and themed monochrome layer |
| `images/splash-icon.png`                | 1024 × 1024 | Transparent launch-screen mark                          |
| `images/favicon.png`                    | 48 × 48     | Browser tab icon                                        |
| `store/play-icon.png`                   | 512 × 512   | Google Play listing icon                                |
| `store/feature-graphic.png`             | 1024 × 500  | Google Play feature graphic                             |

The operating systems apply launcher masks. Do not add rounded corners to the exported app icons. The Android foreground includes extra transparent space for masks and motion effects. Its white silhouette also serves as the monochrome layer.

To regenerate the PNG files, install `librsvg`, then run this command from the repository root:

```sh
sh packages/app/client/assets/generate.sh
```

The cover uses Arial. Install that font before regenerating it to preserve the text layout. Normal app builds use the committed files and do not need these graphics tools.

## Device verification

Icon and launch-screen changes require a new native build. A JavaScript reload cannot replace installed native assets. Check the iOS icon in default, dark, and tinted appearances. Check the Android icon with round, square, and themed launcher masks. Use a preview or release build to verify the launch screen; the development client can show its own screen.

Final App Store and Google Play screenshots still need captures from the release app. The feature graphic is artwork, not a replacement for store screenshots.

References: [Expo icons and launch screens](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/), [Android adaptive icons](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive), [Google Play preview assets](https://support.google.com/googleplay/android-developer/answer/9866151).
