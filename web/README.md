# NEXO Web — Cursor-style AI IDE (browser)

Full-screen web app with **left sidebar** (projects + chats) and **center chat** (Cursor-like composer), powered by **local Ollama**.

## Run (Mac)

```bash
# Terminal 1 — AI engine
ollama serve
ollama pull qwen2.5-coder

# Terminal 2 — web app
cd "/Users/apple/Desktop/NEXO AI/web"
npm install
npm run dev
```

Open **http://localhost:3000**

## Layout

| Area | Features |
|------|----------|
| **Left** | New chat, projects, chat history (persisted in browser) |
| **Center** | Conversation + floating composer, model picker |
| **Settings** | Ollama setup help |

Chats are stored in `localStorage` via Zustand persist.

## vs VS Code extension

Use this folder for the **web product**. The `src/` extension at repo root is optional legacy.

## Production build

```bash
npm run build
npm run preview
```

For production you still need Ollama on the same machine or a backend proxy.
