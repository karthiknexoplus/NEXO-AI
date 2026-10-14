import * as crypto from "crypto";
import * as ts from "typescript";
import type { CodeChunk } from "./types";

const MAX_CHUNK_CHARS = 2400;
const MIN_CHUNK_CHARS = 40;

export function chunkFile(
  relativePath: string,
  language: string,
  content: string
): CodeChunk[] {
  const ext = relativePath.split(".").pop()?.toLowerCase() ?? "";
  if (["ts", "tsx", "js", "jsx", "mjs", "cjs"].includes(ext)) {
    const astChunks = chunkWithTypescriptAst(relativePath, language, content);
    if (astChunks.length > 0) {
      return astChunks;
    }
  }

  return chunkByLines(relativePath, language, content);
}

function chunkWithTypescriptAst(
  relativePath: string,
  language: string,
  content: string
): CodeChunk[] {
  const scriptKind = relativePath.endsWith(".tsx") || relativePath.endsWith(".jsx")
    ? ts.ScriptKind.TSX
    : relativePath.endsWith(".js") || relativePath.endsWith(".mjs") || relativePath.endsWith(".cjs")
      ? ts.ScriptKind.JS
      : ts.ScriptKind.TS;

  const sourceFile = ts.createSourceFile(
    relativePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    scriptKind
  );

  const chunks: CodeChunk[] = [];
  const visit = (node: ts.Node): void => {
    if (isChunkableNode(node)) {
      const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
      const slice = content.slice(node.getStart(sourceFile), node.getEnd()).trim();

      if (slice.length >= MIN_CHUNK_CHARS) {
        chunks.push(
          makeChunk(
            relativePath,
            language,
            getNodeSymbol(node),
            start.line + 1,
            end.line + 1,
            slice
          )
        );
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  if (chunks.length === 0 && content.trim().length >= MIN_CHUNK_CHARS) {
    return chunkByLines(relativePath, language, content);
  }

  return dedupeChunks(chunks);
}

function isChunkableNode(node: ts.Node): boolean {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isEnumDeclaration(node) ||
    (ts.isVariableStatement(node) && node.declarationList.declarations.length > 0)
  );
}

function getNodeSymbol(node: ts.Node): string {
  if (ts.isVariableStatement(node)) {
    const name = node.declarationList.declarations[0]?.name;
    if (name && ts.isIdentifier(name)) {
      return name.text;
    }
    return "variable";
  }

  const named = node as ts.NamedDeclaration;
  if (named.name && ts.isIdentifier(named.name)) {
    return named.name.text;
  }
  return node.kind.toString();
}

function chunkByLines(relativePath: string, language: string, content: string): CodeChunk[] {
  const lines = content.split("\n");
  const chunks: CodeChunk[] = [];
  let buffer: string[] = [];
  let startLine = 1;

  const flush = (endLine: number) => {
    const text = buffer.join("\n").trim();
    if (text.length >= MIN_CHUNK_CHARS) {
      chunks.push(
        makeChunk(relativePath, language, "block", startLine, endLine, text.slice(0, MAX_CHUNK_CHARS))
      );
    }
    buffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    if (buffer.length === 0) {
      startLine = lineNumber;
    }
    buffer.push(lines[i]);

    const joined = buffer.join("\n");
    const isBoundary = lines[i].trim() === "" || joined.length >= MAX_CHUNK_CHARS;
    if (isBoundary) {
      flush(lineNumber);
    }
  }

  if (buffer.length > 0) {
    flush(lines.length);
  }

  return dedupeChunks(chunks);
}

function makeChunk(
  relativePath: string,
  language: string,
  symbol: string,
  startLine: number,
  endLine: number,
  content: string
): CodeChunk {
  const hash = crypto.createHash("sha1").update(content).digest("hex");
  return {
    id: `${relativePath}:${startLine}-${endLine}:${hash.slice(0, 8)}`,
    relativePath,
    language,
    symbol,
    startLine,
    endLine,
    content,
    hash,
  };
}

function dedupeChunks(chunks: CodeChunk[]): CodeChunk[] {
  const seen = new Set<string>();
  return chunks.filter((c) => {
    if (seen.has(c.id)) {
      return false;
    }
    seen.add(c.id);
    return true;
  });
}
