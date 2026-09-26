#!/bin/sh
set -eu
widget_check_dir=$(mktemp -d "${TMPDIR:-/tmp}/tally-widget-build.XXXXXX")
trap 'rm -rf "$widget_check_dir"' EXIT
xcrun swiftc -module-cache-path "$widget_check_dir/cache" \
    -target "$(uname -m)-apple-macosx15.0" \
    targets/tally-widgets/WidgetStore.swift tests/widgets/main.swift -o "$widget_check_dir/check"
"$widget_check_dir/check"
widget_ios_sdk=$(xcrun --sdk iphoneos --show-sdk-path)
xcrun swiftc -typecheck -module-cache-path "$widget_check_dir/cache" \
    -sdk "$widget_ios_sdk" -target arm64-apple-ios17.0 \
    targets/tally-widgets/*.swift

# Supply WidgetKit's host-only environment values when rendering through Mac Catalyst.
sed -e 's/@Environment(\\.widgetFamily) private var family/let family: WidgetFamily/' \
    -e 's/: contentMargins$/: (family == .systemMedium ? EdgeInsets(top: 16, leading: 16, bottom: 16, trailing: 16) : contentMargins)/' \
    targets/tally-widgets/WidgetViews.swift > "$widget_check_dir/WidgetViews.swift"
widget_mac_sdk=$(xcrun --sdk macosx --show-sdk-path)
xcrun swiftc -parse-as-library -module-cache-path "$widget_check_dir/cache" \
    -target "$(uname -m)-apple-ios17.0-macabi" -sdk "$widget_mac_sdk" \
    -F "$widget_mac_sdk/System/iOSSupport/System/Library/Frameworks" \
    -I "$widget_mac_sdk/System/iOSSupport/usr/include" \
    -L "$widget_mac_sdk/System/iOSSupport/usr/lib" \
    targets/tally-widgets/WidgetStore.swift targets/tally-widgets/WidgetIntents.swift \
    targets/tally-widgets/WidgetProviders.swift targets/tally-widgets/CounterText.swift \
    "$widget_check_dir/WidgetViews.swift" tests/widgets/layout.swift -o "$widget_check_dir/layout"
"$widget_check_dir/layout"
