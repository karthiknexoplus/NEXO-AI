# NEXOPLUS Web

Cursor-style AI studio for **NEXOPLUS Automations** — local/cloud Ollama, auto file creation, dark/light theme.

## One command (Mac / Linux server)

From repo root:

```bash
chmod +x setup.sh
./setup.sh
```

Opens **http://localhost:3000** (set `PORT` for cloud).

## Docker (public cloud)

```bash
docker compose up -d --build
# First time: docker compose exec ollama ollama pull $NEXO_MODEL
```

Expose port **3000** behind nginx/Caddy with HTTPS.

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
