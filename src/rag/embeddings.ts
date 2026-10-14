import * as vscode from "vscode";
import { getLlmConfigFromWorkspace, LlmProvider } from "../llmClient";

export interface EmbeddingConfig {
  provider: LlmProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export function getEmbeddingConfig(): EmbeddingConfig {
  const config = vscode.workspace.getConfiguration("cursor-clone");
  const provider = config.get<LlmProvider>("embeddingProvider") ?? "openrouter";
  const model =
    config.get<string>("embeddingModel") ?? "openai/text-embedding-3-small";

  const llm = getLlmConfigFromWorkspace({ provider });

  if (provider === "ollama") {
    return {
      provider,
      baseUrl: llm.baseUrl,
      apiKey: "",
      model: config.get<string>("ollamaEmbeddingModel") ?? "nomic-embed-text",
    };
  }

  return {
    provider,
    baseUrl: llm.baseUrl,
    apiKey: llm.apiKey,
    model,
  };
}

function embeddingsUrl(baseUrl: string, provider: LlmProvider): string {
  if (provider === "ollama") {
    return `${baseUrl}/api/embeddings`;
  }
  return `${baseUrl}/embeddings`;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const config = getEmbeddingConfig();

  if (config.provider === "ollama") {
    const vectors: number[][] = [];
    for (const text of texts) {
      const response = await fetch(embeddingsUrl(config.baseUrl, config.provider), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: config.model, prompt: text }),
      });
      if (!response.ok) {
        throw new Error(`Ollama embeddings failed: ${await response.text()}`);
      }
      const data = (await response.json()) as { embedding: number[] };
      vectors.push(data.embedding);
    }
    return vectors;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }
  if (config.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://cursor-clone.local";
    headers["X-Title"] = "Cursor Clone VS Code Extension";
  }

  const response = await fetch(embeddingsUrl(config.baseUrl, config.provider), {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.model,
      input: texts,
    }),
  });

  if (!response.ok) {
    throw new Error(`Embeddings request failed (${response.status}): ${await response.text()}`);
  }

  const payload = (await response.json()) as {
    data: Array<{ embedding: number[]; index: number }>;
  };

  return payload.data
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}
