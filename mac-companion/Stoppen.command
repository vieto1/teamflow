#!/bin/bash
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
APP_DIR="$HOME/Applications/Teamflow-KI"
PIDS=$(lsof -nP -t -iTCP:8765 -sTCP:LISTEN 2>/dev/null || true)
for TEAMFLOW_PID in $PIDS; do
 COMMAND=$(ps -p "$TEAMFLOW_PID" -o args= || true)
 PROCESS_DIR=$(lsof -a -p "$TEAMFLOW_PID" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')
 if [[ "$PROCESS_DIR" != "$APP_DIR" ]] || [[ "$COMMAND" != *server.py* ]] || [[ "$COMMAND" != *[Pp]ython* ]]; then
  echo "Port 8765 gehört nicht eindeutig zur installierten Teamflow-KI. Es wurde nichts beendet."
  exit 1
 fi
 echo "Teamflow-KI wird beendet (Prozess $TEAMFLOW_PID). Lokale Aufnahmen bleiben gespeichert."
 kill -TERM "$TEAMFLOW_PID" 2>/dev/null || true
 for i in $(seq 1 30); do
  if ! kill -0 "$TEAMFLOW_PID" 2>/dev/null; then break; fi
  sleep 1
 done
 if kill -0 "$TEAMFLOW_PID" 2>/dev/null; then echo "Der Dienst läuft noch. Bitte die Ausgabe prüfen."; exit 1; fi
 done
echo "Teamflow-KI ist gestoppt."
