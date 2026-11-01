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
if curl --max-time 2 -fsS "http://127.0.0.1:8765/" | grep -q 'Teamflow · Lokale KI'; then open "http://127.0.0.1:8765/"; exit 0; fi
if ! curl --max-time 2 -fsS "http://127.0.0.1:11434/api/tags" >/dev/null 2>&1; then ollama serve >"$STATE_DIR/ollama.log" 2>&1 & fi
for i in $(seq 1 30); do if curl --max-time 2 -fsS "http://127.0.0.1:11434/api/tags" >/dev/null 2>&1; then break; fi; sleep 1; done
(cd "$APP_DIR" && "$PYTHON_BIN" server.py) &
TEAMFLOW_PID=$!
trap 'kill "$TEAMFLOW_PID" 2>/dev/null || true' EXIT INT TERM
for i in $(seq 1 30); do if curl --max-time 2 -fsS "http://127.0.0.1:8765/" >/dev/null 2>&1; then break; fi; sleep 1; done
open "http://127.0.0.1:8765/"
echo "Teamflow KI ist geöffnet. Dieses Terminal während der Analyse geöffnet lassen."
wait "$TEAMFLOW_PID"
