#!/usr/bin/env bash
# Install NEXOPLUS web as a systemd service (Linux VPS).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UNIT_NAME="nexoplus-web.service"
DEST="/etc/systemd/system/${UNIT_NAME}"

run_as_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

if [[ ! -f "${ROOT}/web/server.mjs" ]]; then
  echo "❌ Run this from the NEXO-AI repo (missing web/server.mjs)."
  exit 1
fi

if [[ ! -d "${ROOT}/web/dist" ]]; then
  echo "→ Building web app (required before first start)…"
  cd "${ROOT}/web"
  npm ci 2>/dev/null || npm install
  npm run build
fi

mkdir -p "${ROOT}/web/workspace"

sed "s|@REPO_ROOT@|${ROOT}|g" "${ROOT}/deploy/nexoplus-web.service" | run_as_root tee "${DEST}" >/dev/null

run_as_root systemctl daemon-reload
run_as_root systemctl enable "${UNIT_NAME}"
run_as_root systemctl restart "${UNIT_NAME}"

echo ""
echo "✅ ${UNIT_NAME} is running."
echo "   Status:  sudo systemctl status ${UNIT_NAME}"
echo "   Logs:    sudo journalctl -u ${UNIT_NAME} -f"
echo "   Open in browser (after firewall): http://YOUR_SERVER_IP:3080"
echo ""
