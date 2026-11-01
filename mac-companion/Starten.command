#!/bin/bash
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
export OLLAMA_HOST="127.0.0.1:11434"
export OLLAMA_NO_CLOUD=1
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
STATE_DIR="$HOME/Library/Application Support/Teamflow-KI"
umask 077
mkdir -p "$STATE_DIR"
if [ ! -f "$STATE_DIR/config.json" ]; then echo "Bitte zuerst Einrichten.command öffnen."; read -r -p "Enter zum Schließen …"; exit 1; fi
PYTHON_BIN="$(brew --prefix python@3.12)/bin/python3.12"
if curl --max-time 2 -fsS -D - -o /dev/null "http://127.0.0.1:8765/" 2>/dev/null | grep -qi 'X-Teamflow-Version: 1.1.0'; then open "http://127.0.0.1:8765/"; exit 0; fi
if curl --max-time 2 -fsS "http://127.0.0.1:8765/" >/dev/null 2>&1; then
 echo "Auf Port 8765 läuft bereits ein anderer oder älterer Dienst. Bitte Stoppen.command und danach Starten.command öffnen."
 read -r -p "Enter zum Schließen …"
 exit 1
fi
if ! curl --max-time 2 -fsS "http://127.0.0.1:11434/api/tags" >/dev/null 2>&1; then ollama serve >"$STATE_DIR/ollama.log" 2>&1 & fi
for i in $(seq 1 30); do if curl --max-time 2 -fsS "http://127.0.0.1:11434/api/tags" >/dev/null 2>&1; then break; fi; sleep 1; done
cd "$APP_DIR"
"$PYTHON_BIN" "$APP_DIR/server.py" &
TEAMFLOW_PID=$!
cleanup(){ kill -TERM "$TEAMFLOW_PID" 2>/dev/null || true; wait "$TEAMFLOW_PID" 2>/dev/null || true; }
trap cleanup EXIT
trap 'exit 0' INT TERM
for i in $(seq 1 30); do if curl --max-time 2 -fsS "http://127.0.0.1:8765/" >/dev/null 2>&1; then break; fi; sleep 1; done
if ! kill -0 "$TEAMFLOW_PID" 2>/dev/null; then echo "Start fehlgeschlagen. Bitte Ausgabe oben prüfen."; exit 1; fi
open "http://127.0.0.1:8765/"
echo "Teamflow KI ist geöffnet. Dieses Terminal während der Analyse geöffnet lassen."
wait "$TEAMFLOW_PID"
