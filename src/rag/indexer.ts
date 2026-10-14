import * as crypto from "crypto";
import * as fs from "fs";
import * as vscode from "vscode";
import { chunkFile } from "./chunker";
import { embedTexts, getEmbeddingConfig } from "./embeddings";
import { createWorkspaceIgnore } from "./ignoreFilter";
import { scanWorkspaceFiles } from "./scanner";
import { formatSearchResultsForPrompt, semanticSearch } from "./search";
import type {
  CodeChunk,
  IndexStats,
  IndexedChunk,
  SearchResult,
  VectorIndexFile,
} from "./types";
import { VectorStore } from "./vectorStore";

const CODEBASE_TAG = "@codebase";
const EMBED_BATCH_SIZE = 16;

export class CodebaseIndexer {
  private indexCache: VectorIndexFile | null = null;

  constructor(private readonly storageUri: vscode.Uri) {}

  getIndexPath(workspaceRoot: string): string {
    const hash = crypto.createHash("sha1").update(workspaceRoot).digest("hex");
    return vscode.Uri.joinPath(this.storageUri, `vector-index-${hash}.json`).fsPath;
  }

  async getIndex(workspaceRoot: string): Promise<VectorIndexFile | null> {
    if (this.indexCache && this.indexCache.workspaceRoot === workspaceRoot) {
      return this.indexCache;
    }
    const store = new VectorStore(this.getIndexPath(workspaceRoot));
    const loaded = await store.load();
    if (loaded?.workspaceRoot === workspaceRoot) {
      this.indexCache = loaded;
      return loaded;
    }
    return null;
  }

  async indexWorkspace(
    workspaceRoot: string,
    onProgress?: (message: string) => void
  ): Promise<IndexStats> {
    const started = Date.now();
    const ig = createWorkspaceIgnore(workspaceRoot);
    onProgress?.("Scanning workspace files…");
    const files = await scanWorkspaceFiles(workspaceRoot, ig);

    const allChunks: CodeChunk[] = [];
    let skippedFiles = 0;

    for (const file of files) {
      onProgress?.(`Chunking ${file.relativePath}`);
      try {
        const content = await fs.promises.readFile(file.absolutePath, "utf8");
        const chunks = chunkFile(file.relativePath, file.language, content);
        if (chunks.length === 0) {
          skippedFiles += 1;
        }
        allChunks.push(...chunks);
      } catch {
        skippedFiles += 1;
      }
    }

    const embeddingConfig = getEmbeddingConfig();
    const existing = await this.getIndex(workspaceRoot);
    const existingById = new Map((existing?.chunks ?? []).map((c) => [c.id, c]));

    const indexedChunks: IndexedChunk[] = [];
    const toEmbed: CodeChunk[] = [];

    for (const chunk of allChunks) {
      const prev = existingById.get(chunk.id);
      if (prev && prev.hash === chunk.hash && prev.embedding.length > 0) {
        indexedChunks.push({ ...chunk, embedding: prev.embedding });
      } else {
        toEmbed.push(chunk);
      }
    }

    onProgress?.(`Embedding ${toEmbed.length} new/changed chunks…`);

    for (let i = 0; i < toEmbed.length; i += EMBED_BATCH_SIZE) {
      const batch = toEmbed.slice(i, i + EMBED_BATCH_SIZE);
      const vectors = await embedTexts(batch.map((c) => c.content));
      batch.forEach((chunk, idx) => {
        indexedChunks.push({ ...chunk, embedding: vectors[idx] ?? [] });
      });
      onProgress?.(`Embedded ${Math.min(i + EMBED_BATCH_SIZE, toEmbed.length)} / ${toEmbed.length}`);
    }

    const index = VectorStore.buildIndex(
      workspaceRoot,
      embeddingConfig.model,
      indexedChunks
    );

    const store = new VectorStore(this.getIndexPath(workspaceRoot));
    await store.save(index);
    this.indexCache = index;

    return {
      filesScanned: files.length,
      chunksIndexed: indexedChunks.length,
      skippedFiles,
      durationMs: Date.now() - started,
    };
  }

  async search(workspaceRoot: string, query: string, topK = 3): Promise<SearchResult[]> {
    const index = await this.getIndex(workspaceRoot);
    if (!index) {
      return [];
    }
    return semanticSearch(index, query, topK);
  }

  async buildCodebaseContext(workspaceRoot: string, userMessage: string): Promise<string | null> {
    if (!userMessage.includes(CODEBASE_TAG)) {
      return null;
    }

    const query = userMessage.replaceAll(CODEBASE_TAG, "").trim() || userMessage;
    const index = await this.getIndex(workspaceRoot);

    if (!index) {
      return [
        "The user invoked @codebase but no index exists yet.",
        "Ask them to run the command **Cursor Clone: Index Codebase** first.",
      ].join(" ");
    }

    const results = await this.search(workspaceRoot, query, 3);
    return [
      "The user invoked @codebase. Use the following retrieved code chunks as authoritative project context:",
      "",
      formatSearchResultsForPrompt(results),
    ].join("\n");
  }
}

let indexerSingleton: CodebaseIndexer | undefined;

export function getCodebaseIndexer(context: vscode.ExtensionContext): CodebaseIndexer {
  if (!indexerSingleton) {
    indexerSingleton = new CodebaseIndexer(context.globalStorageUri);
  }
  return indexerSingleton;
}

export function extractCodebaseQuery(userText: string): string {
  return userText.replaceAll(CODEBASE_TAG, "").trim() || userText.trim();
}

export async function runIndexCodebaseCommand(context: vscode.ExtensionContext): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    void vscode.window.showWarningMessage("Open a workspace folder to index the codebase.");
    return;
  }

  const indexer = getCodebaseIndexer(context);

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Cursor Clone: indexing codebase",
      cancellable: false,
    },
    async (progress) => {
      const stats = await indexer.indexWorkspace(folder.uri.fsPath, (message) => {
        progress.report({ message });
      });

      void vscode.window.showInformationMessage(
        `Indexed ${stats.chunksIndexed} chunks from ${stats.filesScanned} files (${Math.round(stats.durationMs / 1000)}s).`
      );
    }
  );
}
