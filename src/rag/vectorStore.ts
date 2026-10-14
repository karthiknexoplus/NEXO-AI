import * as fs from "fs";
import * as path from "path";
import type { IndexedChunk, VectorIndexFile } from "./types";

const INDEX_VERSION = 1;

export class VectorStore {
  constructor(private readonly indexPath: string) {}

  async load(): Promise<VectorIndexFile | null> {
    try {
      const raw = await fs.promises.readFile(this.indexPath, "utf8");
      const parsed = JSON.parse(raw) as VectorIndexFile;
      if (parsed.version !== INDEX_VERSION) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  async save(index: VectorIndexFile): Promise<void> {
    await fs.promises.mkdir(path.dirname(this.indexPath), { recursive: true });
    await fs.promises.writeFile(this.indexPath, JSON.stringify(index), "utf8");
  }

  async clear(): Promise<void> {
    try {
      await fs.promises.unlink(this.indexPath);
    } catch {
      // no index yet
    }
  }

  static buildIndex(
    workspaceRoot: string,
    embeddingModel: string,
    chunks: IndexedChunk[]
  ): VectorIndexFile {
    return {
      version: INDEX_VERSION,
      workspaceRoot,
      embeddingModel,
      indexedAt: new Date().toISOString(),
      chunks,
    };
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
