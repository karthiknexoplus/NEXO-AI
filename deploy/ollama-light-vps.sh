#!/usr/bin/env bash
# 4 GB VPS: CPU-only small model for NEXOPLUS chat.
set -euo pipefail

MODEL="${NEXO_MODEL:-llama3.2:3b}"

run_as_root() {
	[[ "$(id -u)" -eq 0 ]] && "$@" || sudo "$@"
}

echo "→ Ensuring Ollama is running…"
run_as_root systemctl enable ollama 2>/dev/null || true
run_as_root systemctl start ollama 2>/dev/null || true
sleep 2

if ! curl -sf http://127.0.0.1:11434/api/tags >/dev/null; then
	echo "❌ Ollama not responding on :11434. Check: journalctl -u ollama -n 30"
	exit 1
fi

echo "→ Pulling lightweight model: ${MODEL} (first time may take a few minutes)…"
ollama pull "${MODEL}"

echo "→ Restarting nexoplus-web with NEXO_LIGHT=1…"
run_as_root systemctl restart nexoplus-web

echo ""
echo "✅ Test on the server:"
echo "   curl -s http://127.0.0.1:11434/api/tags | head -c 200"
echo "   Use **Fast** mode in the UI. First reply may take 30–90s on CPU."
