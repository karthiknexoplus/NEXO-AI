import React, { useMemo } from "react";
import hljs from "highlight.js/lib/core";
import typescript from "highlight.js/lib/languages/typescript";
import javascript from "highlight.js/lib/languages/javascript";
import python from "highlight.js/lib/languages/python";
import json from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";
import { vscode } from "../vscode";

hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("json", json);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("tsx", typescript);
hljs.registerLanguage("jsx", javascript);

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language }: CodeBlockProps) {
  const highlighted = useMemo(() => {
    try {
      if (language && hljs.getLanguage(language)) {
        return hljs.highlight(code, { language }).value;
      }
      return hljs.highlightAuto(code).value;
    } catch {
      return code;
    }
  }, [code, language]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      vscode.postMessage({ type: "copyFallback", code });
    }
  };

  const apply = () => {
    vscode.postMessage({ type: "applyCode", code, language });
  };

  return (
    <div className="my-3 rounded-xl border border-nexo-border overflow-hidden">
      <div className="flex items-center justify-between bg-nexo-input/60 px-3 py-1.5 text-[11px] text-nexo-muted">
        <span className="font-mono">{language || "code"}</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={copy}
            className="hover:text-nexo-fg transition-colors"
          >
            Copy
          </button>
          <button
            type="button"
            onClick={apply}
            className="text-nexo-accent hover:underline font-medium"
          >
            Apply
          </button>
        </div>
      </div>
      <pre className="m-0">
        <code className="hljs" dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  );
}
