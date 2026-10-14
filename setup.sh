#!/usr/bin/env bash
# NEXOPLUS — one-command setup (Mac / Linux cloud server)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
MODEL="${NEXO_MODEL:-qwen2.5-coder}"
PORT="${PORT:-3000}"

echo "╔══════════════════════════════════════╗"
echo "║   NEXOPLUS AI — setup                ║"
echo "╚══════════════════════════════════════╝"

command -v node >/dev/null 2>&1 || {
  echo "❌ Node.js 18+ required. Install from https://nodejs.org"
  exit 1
}

if ! command -v ollama >/dev/null 2>&1; then
  echo "→ Installing Ollama…"
  curl -fsSL https://ollama.com/install.sh | sh
fi

if ! curl -sf "http://127.0.0.1:11434/api/tags" >/dev/null 2>&1; then
  echo "→ Starting Ollama…"
  if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl enable ollama 2>/dev/null || true
    sudo systemctl start ollama 2>/dev/null || ollama serve >/tmp/ollama.log 2>&1 &
  else
    ollama serve >/tmp/ollama.log 2>&1 &
  fi
  sleep 3
fi

echo "→ Downloading NEXOPLUS intelligence engine (first run may take several minutes)…"
ollama pull "${MODEL}" || ollama pull "${MODEL%%:*}"

echo "→ Installing web dependencies…"
cd "${ROOT}/web"
npm ci 2>/dev/null || npm install

echo "→ Building NEXOPLUS web app…"
npm run build

mkdir -p "${ROOT}/web/workspace"

echo "→ Starting server on port ${PORT}…"
export PORT
export OLLAMA_HOST="${OLLAMA_HOST:-http://127.0.0.1:11434}"
export WORKSPACE_ROOT="${WORKSPACE_ROOT:-${ROOT}/web/workspace}"

echo ""
echo "✅ Ready: http://localhost:${PORT}"
echo "   Public cloud: open firewall port ${PORT} or use reverse proxy (nginx/caddy)."
echo "   Built in Coimbatore with love — NEXOPLUS Automations"
echo ""

exec node server.mjs
