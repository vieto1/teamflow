#!/bin/bash
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
export OLLAMA_HOST="127.0.0.1:11434"
export OLLAMA_NO_CLOUD=1
SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$HOME/Applications/Teamflow-KI"
STATE_DIR="$HOME/Library/Application Support/Teamflow-KI"
umask 077
finish_error(){ echo; echo "Einrichtung angehalten. Die Fehlermeldung oben hilft beim nächsten Schritt."; read -r -p "Enter zum Schließen …"; }
trap finish_error ERR
if [ "$(uname -s)" != "Darwin" ]; then echo "Diese Einrichtung ist für macOS."; exit 1; fi
if ! command -v brew >/dev/null 2>&1; then
 echo "Bitte zuerst Homebrew von https://brew.sh installieren. Danach diese Datei erneut öffnen."
 open "https://brew.sh"
 read -r -p "Enter zum Schließen …"
 exit 1
fi
FREE_KB=$(df -Pk "$HOME" | awk 'NR==2 {print $4}')
if [ "$FREE_KB" -lt 10485760 ]; then echo "Bitte mindestens 10 GB freien Speicher schaffen."; exit 1; fi
printf '\nTeamflow KI – lokale Einrichtung\n\n'
echo "Installiert werden Python, FFmpeg, whisper.cpp, Ollama und PDF-Textextraktion."
echo "Sprachmodelle werden einmalig heruntergeladen. Es wird kein kostenpflichtiges KI-Konto eingerichtet."
brew install python@3.12 ffmpeg whisper.cpp ollama poppler
PYTHON_BIN="$(brew --prefix python@3.12)/bin/python3.12"
mkdir -p "$STATE_DIR/models" "$APP_DIR"
if [ "$SOURCE_DIR" != "$APP_DIR" ]; then cp -R "$SOURCE_DIR/." "$APP_DIR/"; fi
chmod +x "$APP_DIR/Starten.command" "$APP_DIR/Einrichten.command"
MEMORY_BYTES=$(sysctl -n hw.memsize)
AI_MODEL="qwen2.5:3b"
WHISPER_KIND="base"
WHISPER_SHA="465707469ff3a37a2b9b8d8f89f2f99de7299dac"
if [ "$MEMORY_BYTES" -ge 17179869184 ]; then AI_MODEL="qwen2.5:7b"; WHISPER_KIND="small"; WHISPER_SHA="55356645c2b361a969dfd0ef2c5a50d530afd8d5"; fi
MODEL_FILE="$STATE_DIR/models/ggml-$WHISPER_KIND.bin"
if [ ! -f "$MODEL_FILE" ] || [ "$(shasum -a 1 "$MODEL_FILE" | awk '{print $1}')" != "$WHISPER_SHA" ]; then
 echo "Spracherkennungsmodell wird heruntergeladen: $WHISPER_KIND"
 curl -fL --retry 3 "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-$WHISPER_KIND.bin" -o "$MODEL_FILE.part"
 if [ "$(shasum -a 1 "$MODEL_FILE.part" | awk '{print $1}')" != "$WHISPER_SHA" ]; then echo "Prüfsumme stimmt nicht. Download bitte wiederholen."; rm -f "$MODEL_FILE.part"; exit 1; fi
 mv "$MODEL_FILE.part" "$MODEL_FILE"
fi
if ! curl --max-time 2 -fsS "http://127.0.0.1:11434/api/tags" >/dev/null 2>&1; then
 ollama serve >"$STATE_DIR/ollama.log" 2>&1 &
fi
for i in $(seq 1 40); do if curl --max-time 2 -fsS "http://127.0.0.1:11434/api/tags" >/dev/null 2>&1; then break; fi; sleep 1; done
ollama pull "$AI_MODEL"
"$PYTHON_BIN" - "$STATE_DIR/config.json" "$AI_MODEL" "$MODEL_FILE" <<'PY'
import json,sys
from pathlib import Path
Path(sys.argv[1]).write_text(json.dumps({'model':sys.argv[2],'whisperModel':sys.argv[3]}))
PY
printf '\nEinrichtung abgeschlossen. Teamflow KI wird geöffnet.\n'
exec "$APP_DIR/Starten.command"
