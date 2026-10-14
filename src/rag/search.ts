import { embedTexts } from "./embeddings";
import { cosineSimilarity } from "./vectorStore";
import type { SearchResult, VectorIndexFile } from "./types";

export async function semanticSearch(
  index: VectorIndexFile,
  query: string,
  topK = 3
): Promise<SearchResult[]> {
  if (!query.trim() || index.chunks.length === 0) {
    return [];
  }

  try {
    const [queryVector] = await embedTexts([query]);
    const ranked = index.chunks
      .map((chunk) => ({
        ...chunk,
        score: cosineSimilarity(queryVector, chunk.embedding),
      }))
      .sort((a, b) => b.score - a.score);

    return ranked.slice(0, topK);
  } catch {
    return keywordSearch(index, query, topK);
  }
}

function keywordSearch(
  index: VectorIndexFile,
  query: string,
  topK: number
): SearchResult[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);

  const ranked = index.chunks
    .map((chunk) => {
      const haystack = `${chunk.symbol} ${chunk.content} ${chunk.relativePath}`.toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (haystack.includes(term)) {
          score += 1;
        }
      }
      return { ...chunk, score };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked.slice(0, topK);
}

export function formatSearchResultsForPrompt(results: SearchResult[]): string {
  if (results.length === 0) {
    return "No relevant codebase chunks were found in the index.";
  }

  const blocks = results.map((r, i) => {
    return [
      `### Chunk ${i + 1} (score: ${r.score.toFixed(3)})`,
      `File: ${r.relativePath}`,
      `Symbol: ${r.symbol}`,
      `Lines: ${r.startLine}-${r.endLine}`,
      "```",
      r.content,
      "```",
    ].join("\n");
  });

  return blocks.join("\n\n");
}
