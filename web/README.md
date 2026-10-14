# NEXOPLUS Web

Cursor-style AI studio for **NEXOPLUS Automations** — local/cloud Ollama, auto file creation, dark/light theme.

## One command (Mac / Linux server)

From repo root:

```bash
chmod +x setup.sh
./setup.sh
```

Opens **http://localhost:3080** (auto-picks next free port if busy; override with `PORT=3090`).

## Docker (public cloud)

```bash
docker compose up -d --build
# First time: docker compose exec ollama ollama pull $NEXO_MODEL
```

Expose port **3080** (or your `PORT`) behind nginx/Caddy with HTTPS.

## VPS: SSH vs opening the website

SSH and the web app use **different ports**:

| What | Example |
|------|---------|
| SSH (terminal) | `ssh root@51.68.205.225 -p 20000` |
| NEXOPLUS in browser | **http://51.68.205.225:3080** |

Port **20000** is only for SSH. The app listens on **3080** (unless you set `PORT`).

On the server (once):

```bash
ufw allow 20000/tcp   # SSH (if using ufw)
ufw allow 3080/tcp    # NEXOPLUS web
ufw reload
```

Also check your cloud provider’s **security group / firewall** panel and allow **TCP 3080** inbound. Without that, the browser cannot reach the app even if systemd is running.

Test on the VPS: `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3080` (expect `200`).

## systemd (always on, survives reboot)

From repo root on Linux (after `./setup.sh` once, or at least `cd web && npm run build`):

```bash
chmod +x deploy/install-systemd.sh
./deploy/install-systemd.sh
```

Then:

```bash
sudo systemctl status nexoplus-web
sudo journalctl -u nexoplus-web -f
```

Stop the foreground `./setup.sh` server first if it is still running on 3080, then use systemd.

## Subdomain (e.g. `ai.nexoplus.in`) while main site stays on Netlify

Yes — **only the subdomain** points to your VPS. **`nexoplus.in` / `www` can keep using Netlify** unchanged.

### 1. DNS (Netlify)

In **Netlify** → your team → **Domains** → **nexoplus.in** → **DNS records** (or your registrar if DNS is not on Netlify):

| Type | Name | Value |
|------|------|--------|
| **A** | `ai` | `51.68.205.225` (your AICCloud VPS IP) |

Do **not** change apex/`www` records that point to Netlify. Wait 5–30 minutes for DNS to propagate. Check: `dig +short ai.nexoplus.in` should show your VPS IP.

### 2. VPS firewall (AICCloud)

Open **TCP 80** and **443** (and **3080** only if you skip nginx). NEXOPLUS stays on **3080** internally.

### 3. Nginx (recommended — same as bharathherbal on your VPS)

If **bharathherbal.com** already runs on this server with **nginx + certbot**, use the same pattern for NEXO:

```bash
cd ~/NEXO-AI
git pull
chmod +x deploy/install-nginx.sh deploy/install-systemd.sh
CERTBOT_EMAIL=you@nexoplus.in ./deploy/install-nginx.sh
# or HTTPS manually: sudo certbot --nginx -d ai.nexoplus.in
```

This stops **Caddy**, installs **nginx**, proxies **ai.nexoplus.in** → `127.0.0.1:3080`, and runs **certbot** like your bharath site.

Compare with bharath: `ls /etc/nginx/sites-enabled/` and `cat /etc/nginx/sites-enabled/*bharath*`.

### 3b. Caddy (alternative)

```bash
sudo apt-get update && sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install -y caddy

sudo cp ~/NEXO-AI/deploy/Caddyfile /etc/caddy/Caddyfile
# Edit domain if needed: sudo nano /etc/caddy/Caddyfile
sudo systemctl enable --now caddy
sudo systemctl reload caddy
```

Ensure `nexoplus-web` is running on **3080** (`systemctl status nexoplus-web`).

Visit **https://ai.nexoplus.in** (Caddy obtains a Let’s Encrypt certificate automatically).

**First launch (recommended):** the default `deploy/Caddyfile` serves **HTTP only** so you avoid a redirect loop while no certificate exists. Open **http://ai.nexoplus.in** (not `https` yet).

```bash
sudo cp ~/NEXO-AI/deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl stop caddy
sudo rm -rf /var/lib/caddy/.config/caddy /var/lib/caddy/.local/share/caddy
sudo systemctl start caddy
curl -sI http://ai.nexoplus.in/ | head -5   # expect 200, not 308
```

**HTTPS with Certbot + Netlify DNS** (do not press Enter in certbot until TXT exists):

1. Netlify → **Domains** → **nexoplus.in** → **DNS** → **Add record**  
   - Type: **TXT**  
   - Name: `_acme-challenge.ai` (Netlify may show as `_acme-challenge.ai.nexoplus.in`)  
   - Value: paste the string certbot prints (a **new** value each run)

2. Wait 2–5 minutes, then on the VPS:

```bash
dig +short TXT _acme-challenge.ai.nexoplus.in
```

You must see the quoted TXT value before continuing certbot.

```bash
sudo certbot certonly --manual --preferred-challenges dns -d ai.nexoplus.in
# Only press Enter after dig shows the TXT record
sudo cp ~/NEXO-AI/deploy/Caddyfile.certbot /etc/caddy/Caddyfile
sudo systemctl restart caddy
```

Open **https://ai.nexoplus.in**.

If certbot says **NXDOMAIN**, the TXT was missing or DNS for `nexoplus.in` is not managed in Netlify (`dig NS nexoplus.in` — nameservers should be Netlify if you edit DNS there).

## Dev

```bash
cd web
npm install
npm run dev
```

Visit **http://localhost:5173** (API on 3001).

## Auto-created files

Generated files land in `web/workspace/project-<id>/` when the model uses:

```markdown
```src/index.ts
// code
```
```

## Branding

Logo: `public/nexoplus-logo.png` · Footer beta notice · Built in Coimbatore with love.
