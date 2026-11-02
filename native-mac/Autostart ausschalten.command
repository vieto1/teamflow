#!/bin/bash
set -euo pipefail
AGENT="$HOME/Library/LaunchAgents/de.teamflow.desktop.plist"
launchctl bootout "gui/$(id -u)" "$AGENT" 2>/dev/null || true
if [ -f "$AGENT" ]; then rm "$AGENT"; fi
echo "Teamflow-Autostart ausgeschaltet. App und Daten bleiben erhalten."
read -r -p "Enter zum Schließen …"
