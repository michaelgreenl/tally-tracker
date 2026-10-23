#!/bin/sh
set -eu
# The archive and its tag must match a commit.
if [ -n "$(git status --porcelain)" ]; then
    echo 'Commit or stash your changes before you archive.' >&2
    exit 1
fi
version=$(node -p "require('./app.json').expo.version")
build=$(node -p "require('./app.json').expo.ios.buildNumber")
tag="ios/$version-$build"
if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
    echo "$tag was already archived. Increase ios.buildNumber in app.json." >&2
    exit 1
fi
# Xcode's Organizer lists archives from this folder.
archive="$HOME/Library/Developer/Xcode/Archives/$(date +%F)/Tally $version ($build).xcarchive"

expo prebuild --platform ios --clean
xcodebuild archive -workspace ios/Tally.xcworkspace -scheme Tally -configuration Release \
    -destination 'generic/platform=iOS' -archivePath "$archive" -allowProvisioningUpdates \
    -jobs 2 ONLY_ACTIVE_ARCH=YES SWIFT_USE_PARALLEL_WHOLE_MODULE_OPTIMIZATION=NO \
    OTHER_SWIFT_FLAGS='$(inherited) -j1 -num-threads 1'
git tag -a "$tag" -m "Tally $version ($build)"
echo "Saved $archive"
echo "Tagged $tag. Upload the archive from Xcode's Organizer. Push the tag after you submit the build."
