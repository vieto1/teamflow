#!/bin/bash
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$HOME/Applications/Teamflow-KI"
trap 'echo "Update angehalten. Bitte Fehlermeldung oben prüfen."; read -r -p "Enter zum Schließen …"' ERR
if [ "$SOURCE_DIR" = "$APP_DIR" ]; then echo "Bitte Aktualisieren.command aus dem neu heruntergeladenen Ordner öffnen."; read -r -p "Enter …"; exit 1; fi
if [ ! -f "$HOME/Library/Application Support/Teamflow-KI/config.json" ]; then echo "Bitte zuerst Einrichten.command öffnen."; read -r -p "Enter …"; exit 1; fi
PYTHON_BIN="$(brew --prefix python@3.12)/bin/python3.12"
"$PYTHON_BIN" -m py_compile "$SOURCE_DIR/server.py"
echo "Update auf Teamflow KI 1.1.0. Laufende Analysen werden unterbrochen; gespeicherte Aufnahmen bleiben erhalten."
bash "$SOURCE_DIR/Stoppen.command"
cp "$APP_DIR/server.py" "$APP_DIR/server.py.previous"
cp "$SOURCE_DIR/server.py" "$APP_DIR/server.py"
cp -R "$SOURCE_DIR/web/." "$APP_DIR/web/"
for name in Starten.command Stoppen.command Einrichten.command README.md; do cp "$SOURCE_DIR/$name" "$APP_DIR/$name"; done
chmod +x "$APP_DIR/Starten.command" "$APP_DIR/Stoppen.command"
echo "Update fertig. Modelle und Aufnahmen wurden nicht verändert."
exec "$APP_DIR/Starten.command"
