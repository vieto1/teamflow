#!/bin/bash
set -euo pipefail
SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/Applications/Teamflow.app"
AGENT="$HOME/Library/LaunchAgents/de.teamflow.desktop.plist"
trap 'echo "Installation angehalten. Bitte die Meldung oben prüfen."; read -r -p "Enter zum Schließen …"' ERR
if [ "$(uname -s)" != Darwin ]; then echo "Dieser Helfer ist für macOS 15 oder neuer."; exit 1; fi
if [ ! -f "$HOME/Library/Application Support/Teamflow-KI/config.json" ]; then
 echo "Die bestehende Teamflow-KI fehlt. Bitte zuerst Einrichten.command aus dem KI-Paket ausführen."
 read -r -p "Enter zum Schließen …"; exit 1
fi
if pgrep -f "$DEST/Contents/MacOS/Teamflow" >/dev/null; then echo "Bitte die laufende Teamflow-Mac-App zuerst über das TF-Menü beenden."; read -r -p "Enter …"; exit 1; fi
codesign --verify --deep --strict "$SOURCE_DIR/Teamflow.app"
mkdir -p "$HOME/Applications" "$HOME/Library/LaunchAgents"
ditto "$SOURCE_DIR/Teamflow.app" "$DEST"
/usr/bin/plutil -create xml1 "$AGENT.new"
/usr/bin/plutil -insert Label -string de.teamflow.desktop "$AGENT.new"
/usr/bin/plutil -insert ProgramArguments -json "[]" "$AGENT.new"
/usr/bin/plutil -insert ProgramArguments.0 -string /usr/bin/open "$AGENT.new"
/usr/bin/plutil -insert ProgramArguments.1 -string -W "$AGENT.new"
/usr/bin/plutil -insert ProgramArguments.2 -string "$DEST" "$AGENT.new"
/usr/bin/plutil -insert ProgramArguments.3 -string --args "$AGENT.new"
/usr/bin/plutil -insert ProgramArguments.4 -string --background "$AGENT.new"
/usr/bin/plutil -insert RunAtLoad -bool YES "$AGENT.new"
mv "$AGENT.new" "$AGENT"
echo "Teamflow ist installiert. Es startet künftig bei deiner Mac-Anmeldung im Hintergrund (TF-Menü)."
echo "Beim ersten Aufnahmestart Mikrofon sowie Bildschirm-/Systemaudioaufnahme für Teamflow erlauben."
echo "Keine Bildschirmbilder werden gespeichert. macOS kann nach der Freigabe einen App-Neustart verlangen."
open "$DEST"
