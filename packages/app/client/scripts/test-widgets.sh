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
