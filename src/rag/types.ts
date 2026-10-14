export interface CodeChunk {
  id: string;
  relativePath: string;
  language: string;
  symbol: string;
  startLine: number;
  endLine: number;
  content: string;
  hash: string;
}

export interface IndexedChunk extends CodeChunk {
  embedding: number[];
}

export interface VectorIndexFile {
  version: number;
  workspaceRoot: string;
  embeddingModel: string;
  indexedAt: string;
  chunks: IndexedChunk[];
}

export interface IndexProgress {
  phase: "scanning" | "chunking" | "embedding" | "saving";
  processed: number;
  total: number;
  currentFile?: string;
}

export interface IndexStats {
  filesScanned: number;
  chunksIndexed: number;
  skippedFiles: number;
  durationMs: number;
}

export interface SearchResult extends CodeChunk {
  score: number;
}
