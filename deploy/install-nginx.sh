#!/usr/bin/env bash
# Nginx reverse proxy for NEXOPLUS — same style as bharathherbal on this VPS.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOMAIN="${NEXO_DOMAIN:-ai.nexoplus.in}"
SITE_NAME="${DOMAIN}"
AVAILABLE="/etc/nginx/sites-available/${SITE_NAME}"
ENABLED="/etc/nginx/sites-enabled/${SITE_NAME}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"

run_as_root() {
	if [[ "$(id -u)" -eq 0 ]]; then
		"$@"
	else
		sudo "$@"
	fi
}

echo "→ NEXOPLUS nginx install (domain: ${DOMAIN})"

if [[ -d /root/bharath ]] || [[ -d /root/bharathherbal ]]; then
	echo "   (bharath site folder found on this VPS — using same nginx + certbot pattern)"
fi

if [[ -d /etc/nginx/sites-enabled ]]; then
	echo "→ Existing nginx sites:"
	run_as_root ls -1 /etc/nginx/sites-enabled/ 2>/dev/null || true
fi

run_as_root apt-get update -qq
run_as_root apt-get install -y nginx certbot python3-certbot-nginx

if [[ ! -d "${ROOT}/web/dist" ]]; then
	echo "→ Building web app…"
	cd "${ROOT}/web"
	npm ci 2>/dev/null || npm install
	npm run build
fi

if [[ -x "${ROOT}/deploy/install-systemd.sh" ]]; then
	"${ROOT}/deploy/install-systemd.sh" || true
fi

run_as_root systemctl enable nexoplus-web 2>/dev/null || true
run_as_root systemctl restart nexoplus-web

# Caddy conflicts on :80 / :443
if systemctl is-active --quiet caddy 2>/dev/null; then
	echo "→ Stopping Caddy (nginx will use ports 80/443)…"
	run_as_root systemctl stop caddy
	run_as_root systemctl disable caddy
fi

sed "s/@DOMAIN@/${DOMAIN}/g" "${ROOT}/deploy/nginx-ai.nexoplus.in.conf" | run_as_root tee "${AVAILABLE}" >/dev/null
run_as_root ln -sf "${AVAILABLE}" "${ENABLED}"

# Do not remove default if bharath relies on it; only disable default if it conflicts
if [[ -f /etc/nginx/sites-enabled/default ]] && [[ ! -f /etc/nginx/sites-enabled/bharathherbal.com ]]; then
	run_as_root rm -f /etc/nginx/sites-enabled/default
fi

run_as_root nginx -t
run_as_root systemctl enable nginx
run_as_root systemctl reload nginx

echo ""
echo "→ HTTP proxy ready. Test:"
echo "   curl -sI http://127.0.0.1/ -H 'Host: ${DOMAIN}' | head -3"
echo ""

if [[ -n "${CERTBOT_EMAIL}" ]]; then
	echo "→ Requesting HTTPS certificate…"
	run_as_root certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${CERTBOT_EMAIL}" --redirect
else
	echo "→ HTTPS: run (same as bharathherbal):"
	echo "   sudo certbot --nginx -d ${DOMAIN}"
fi

echo ""
echo "✅ Nginx → http://127.0.0.1:3080 for ${DOMAIN}"
echo "   Open https://${DOMAIN} after certbot succeeds."
