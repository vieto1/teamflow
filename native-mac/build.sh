#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
DEST="${1:-$ROOT/build}"
mkdir -p "$DEST/Teamflow.app/Contents/MacOS" "$DEST/Teamflow.app/Contents/Resources"
cp "$ROOT/Info.plist" "$DEST/Teamflow.app/Contents/Info.plist"
xcrun swiftc -swift-version 5 -parse-as-library -O -target ${TEAMFLOW_ARCH:-arm64}-apple-macos15.0 -sdk "$(xcrun --sdk macosx --show-sdk-path)" "$ROOT/Teamflow.swift" -o "$DEST/Teamflow.app/Contents/MacOS/Teamflow" -framework Cocoa -framework WebKit -framework ScreenCaptureKit -framework AVFoundation -framework CoreMedia
codesign --force --sign - --identifier de.teamflow.desktop "$DEST/Teamflow.app"
codesign --verify --deep --strict "$DEST/Teamflow.app"
