# NEXO AI — Local Cursor-style coding assistant

## NEXOPLUS Web (recommended)

**Cursor-style web app** — NEXOPLUS branding, projects/chats sidebar, auto file creation, dark/light mode.

### One command

```bash
chmod +x setup.sh && ./setup.sh
```

Cloud: `docker compose up -d` — see [web/README.md](web/README.md).

Repo: [github.com/karthiknexoplus/NEXO-AI](https://github.com/karthiknexoplus/NEXO-AI)

---

# Cursor Clone (NEXO AI) — VS Code Extension MVP

A Cursor-style AI assistant for VS Code / Code-OSS: sidebar chat, **Cmd/Ctrl+K** inline edit, and ghost-text inline completions.

## Prerequisites

- **Node.js** 18+
- **VS Code** 1.85+ (or Code-OSS)
- Optional: [Ollama](https://ollama.com) for local models (`localhost:11434`)
- Optional: [OpenRouter](https://openrouter.ai) API key for cloud free-tier models

## Setup

```bash
cd "/Users/apple/Desktop/NEXO AI"
npm install
npm run build
```

For development, keep a watch build running:

```bash
npm run watch
```

## Run & debug

1. Open this folder in VS Code.
2. Press **F5** (or **Run → Start Debugging** → **Run Extension**).
3. A new **Extension Development Host** window opens with the extension loaded.

## Try it

| Action | How |
|--------|-----|
| Open chat sidebar | Activity bar **Cursor Clone** icon, or **Cmd/Ctrl+Shift+L** |
| Inline edit | Select code (optional), **Cmd/Ctrl+K**, type instruction in the floating panel, review streamed diff, **Cmd/Ctrl+Enter** accept or **Esc** reject |
| Ghost completion | Type in an editor; pause briefly for inline suggestion (Tab to accept) |

### Provider configuration (Ollama-first)

Default provider is **Ollama** at `http://localhost:11434/v1/chat/completions` (free local models).

1. Install [Ollama](https://ollama.com) and run `ollama serve`
2. Pull a coder model: `ollama pull qwen2.5-coder` (or `deepseek-r1`)
3. In chat, use the **Model** dropdown (auto-loaded from `ollama list`) or enter a custom model name → **Save**

Cloud fallback: **OpenRouter** or **Custom** OpenAI-compatible APIs in the same selector.

Inline edit and completions use the same workspace settings.

## Project layout

```
src/
  extension.ts              # Activation, commands, providers
  ChatViewProvider.ts       # Sidebar webview host + message bridge
  context.ts                # Editor / selection / cursor context
  llmClient.ts              # Provider-agnostic SSE streaming client
  inlineEdit.ts             # Cmd+K flow
  inlineCompletionProvider.ts
  webview/                  # React + Tailwind UI
dist/
  extension.js              # Bundled extension
  webview.js                # Bundled webview (includes CSS)
```

## Build

- `esbuild.config.js` bundles the extension (Node, `vscode` external) and webview (browser IIFE + PostCSS/Tailwind).

## Package VSIX (optional)

```bash
npx vsce package
```

Install the generated `.vsix` via **Extensions → … → Install from VSIX**.

## Codebase RAG (`@codebase`)

1. Run **Cursor Clone: Index Codebase** (Command Palette) to scan the workspace (respects `.gitignore`, skips `node_modules`), AST-chunk TS/JS files, embed chunks, and save a local JSON vector cache under extension global storage.
2. In chat, include `@codebase` in your message (e.g. `@codebase where is inline edit handled?`) to inject the top **3** semantic matches into the system prompt.

Embedding settings: `cursor-clone.embeddingProvider`, `cursor-clone.embeddingModel` (default OpenRouter `openai/text-embedding-3-small`), or Ollama `nomic-embed-text`.

## Notes & next steps

- Ghost completions debounce (~400ms) and call the LLM; disable via `cursor-clone.inlineCompletionEnabled`.
- **Cmd+K** may conflict with VS Code’s default chord on macOS; rebind in Keyboard Shortcuts if needed.
- For production, consider rate limits, caching, `@` file references, diff preview before apply, and a dedicated inline-edit webview.
