# Releasing

Work happens on `dev`. `main` is the live version.

- A push to `main` runs CI. CI deploys the web app to GitHub Pages.
- Render deploys the server from the branch set in its dashboard. Keep that branch set to `main`. The `render:start` script applies database migrations before the server starts.
- Users keep their installed App Store builds after a server deploy. Keep each server change compatible with those builds.

## iOS release steps

1. **Set the build number.** On `dev`, increase `ios.buildNumber` in `packages/app/client/app.json`. Each upload needs a new build number. For a new App Store version, also increase `version`. Commit the change.
2. **Deploy the server.** Merge `dev` into `main`, then push `main`.
3. **Check the live app.** Make sure that the Render deploy is complete. Open the App Store build of Tally, sign in, and change a counter.
4. **Archive.** On `main`, run `bun archive:ios` in `packages/app/client`.
5. **Upload.** In Xcode, open **Window > Organizer**. Select the new archive, then use **Distribute App** to upload it to App Store Connect.
6. **Test.** Install the build from TestFlight. Check sign-in, counters, sharing, purchases, and the [widget device checks](ios-widgets.md#verification).
7. **Submit.** In App Store Connect, select the build and submit it for App Review.
8. **Push the tag.** For example, run `git push origin ios/1.0.1-5`.

For a server-only release, do only steps 2 and 3. If TestFlight shows a problem, fix it on `dev`. Then start again at step 1.

## Archive script

`bun archive:ios` does these steps:

1. It stops if the working tree has changes, or if a tag already uses the build number.
2. It regenerates `ios/` with `expo prebuild --clean`.
3. It archives a Release build within the CPU limits in [AGENTS.md](../AGENTS.md).
4. It saves `Tally <version> (<build>).xcarchive` in `~/Library/Developer/Xcode/Archives/<date>/`. Xcode's Organizer lists archives from that folder.
5. It adds a local annotated tag, `ios/<version>-<build>`, to the archived commit.

The Release build reads the API URL from `.env.production`. It also needs the local `.env` and `.env.production.local` files, which git ignores. When `.env.sentry-build-plugin` has a Sentry token, the build uploads source maps and debug symbols to Sentry.

Keep each archive that you upload. Its debug symbols match crash reports from that build. Do not add archives to git.
