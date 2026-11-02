#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
DEST="${1:-$ROOT/build}"
mkdir -p "$DEST/Teamflow.app/Contents/MacOS" "$DEST/Teamflow.app/Contents/Resources"
mkdir -p "$DEST/Teamflow.app/Contents/Resources/Teamflow-KI"
cp "$ROOT/../mac-companion/server.py" "$DEST/Teamflow.app/Contents/Resources/Teamflow-KI/"
ditto "$ROOT/../mac-companion/web" "$DEST/Teamflow.app/Contents/Resources/Teamflow-KI/web"
ICONSET="$DEST/Teamflow.iconset"
mkdir -p "$ICONSET"
for SIZE in 16 32 128 256 512; do
 sips -z "$SIZE" "$SIZE" "$ROOT/../public/app-icon-512.png" --out "$ICONSET/icon_${SIZE}x${SIZE}.png" >/dev/null
 if [ "$SIZE" -le 256 ]; then DOUBLE=$((SIZE*2)); sips -z "$DOUBLE" "$DOUBLE" "$ROOT/../public/app-icon-512.png" --out "$ICONSET/icon_${SIZE}x${SIZE}@2x.png" >/dev/null; fi
done
iconutil -c icns "$ICONSET" -o "$DEST/Teamflow.app/Contents/Resources/Teamflow.icns"
cp "$ROOT/Info.plist" "$DEST/Teamflow.app/Contents/Info.plist"
xcrun swiftc -swift-version 5 -parse-as-library -O -target ${TEAMFLOW_ARCH:-arm64}-apple-macos15.0 -sdk "$(xcrun --sdk macosx --show-sdk-path)" "$ROOT/Teamflow.swift" -o "$DEST/Teamflow.app/Contents/MacOS/Teamflow" -framework Cocoa -framework WebKit -framework ScreenCaptureKit -framework AVFoundation -framework CoreMedia
codesign --force --sign - --identifier de.teamflow.desktop "$DEST/Teamflow.app"
codesign --verify --deep --strict "$DEST/Teamflow.app"
