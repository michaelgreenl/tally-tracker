#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"

tally_mark='tally.icon/Assets/tally.svg'
tally_primary='#0f7899'

rsvg-convert "$tally_mark" -b "$tally_primary" -o images/icon.png
rsvg-convert "$tally_mark" -b "$tally_primary" -w 512 -h 512 -o store/play-icon.png
rsvg-convert "$tally_mark" -b "$tally_primary" -w 48 -h 48 -o images/favicon.png
rsvg-convert "$tally_mark" -o images/splash-icon.png
# The transparent layer leaves room for Android's masks and motion effects.
rsvg-convert "$tally_mark" -w 880 -h 880 --page-width 1024 --page-height 1024 \
    --left 72 --top 72 -o images/android-icon-foreground.png
rsvg-convert store/feature-graphic.svg -o store/feature-graphic.png
