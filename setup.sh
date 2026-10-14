#!/usr/bin/env bash
# NEXOPLUS — one-command setup (Mac / Linux cloud server)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
MODEL="${NEXO_MODEL:-qwen2.5-coder}"
PORT="${PORT:-3000}"

run_as_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

install_linux_prereqs() {
  [[ "$(uname -s)" == "Linux" ]] || return 0

  local need_apt=false
  command -v zstd >/dev/null 2>&1 || need_apt=true
  command -v curl >/dev/null 2>&1 || need_apt=true

  if [[ "${need_apt}" != "true" ]]; then
    return 0
  fi

  echo "→ Installing Linux prerequisites (zstd, curl)…"

  if command -v apt-get >/dev/null 2>&1; then
    run_as_root apt-get update -qq
    run_as_root apt-get install -y zstd curl ca-certificates
  elif command -v dnf >/dev/null 2>&1; then
    run_as_root dnf install -y zstd curl ca-certificates
  elif command -v yum >/dev/null 2>&1; then
    run_as_root yum install -y zstd curl ca-certificates
  elif command -v pacman >/dev/null 2>&1; then
    run_as_root pacman -Sy --noconfirm zstd curl
  else
    echo "❌ Install zstd and curl manually, then re-run ./setup.sh"
    exit 1
  fi
}

echo "╔══════════════════════════════════════╗"
echo "║   NEXOPLUS AI — setup                ║"
echo "╚══════════════════════════════════════╝"

command -v node >/dev/null 2>&1 || {
  echo "❌ Node.js 18+ required."
  echo "   Debian/Ubuntu: curl -fsSL https://deb.nodesource.com/setup_20.x | run_as_root bash - && run_as_root apt-get install -y nodejs"
  exit 1
}

install_linux_prereqs

if ! command -v ollama >/dev/null 2>&1; then
  echo "→ Installing Ollama…"
  if ! curl -fsSL https://ollama.com/install.sh | sh; then
    echo "❌ Ollama install failed. On Ubuntu/Debian run:"
    echo "   apt-get update && apt-get install -y zstd curl && ./setup.sh"
    exit 1
  fi
fi

if ! curl -sf "http://127.0.0.1:11434/api/tags" >/dev/null 2>&1; then
  echo "→ Starting Ollama…"
  if command -v systemctl >/dev/null 2>&1; then
    run_as_root systemctl enable ollama 2>/dev/null || true
    run_as_root systemctl start ollama 2>/dev/null || ollama serve >/tmp/ollama.log 2>&1 &
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
echo "   Public VPS: open firewall port ${PORT} (ufw allow ${PORT}) or use nginx/Caddy."
echo "   Built in Coimbatore with love — NEXOPLUS Automations"
echo ""

exec node server.mjs
