import React, { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "../vscode";
import { CodeBlock } from "./CodeBlock";

interface MessageListProps {
  messages: ChatMessage[];
}

export function MessageList({ messages }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto px-3 py-4">
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center px-4 pt-12 pb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-nexo-accent/30 to-transparent border border-nexo-border flex items-center justify-center mb-4 text-lg font-semibold text-nexo-accent">
            N
          </div>
          <h2 className="text-[15px] font-medium text-nexo-fg mb-1">What should we build?</h2>
          <p className="text-[12px] text-nexo-muted leading-relaxed max-w-[240px]">
            Describe a full app, ask about your code, or use{" "}
            <code className="text-[11px] px-1 py-0.5 rounded bg-nexo-input">@codebase</code> to
            search the project.
          </p>
          <div className="mt-6 grid gap-2 w-full max-w-[260px] text-left">
            {[
              "Build a todo app with Express + HTML frontend",
              "@codebase explain the extension architecture",
              "Refactor this file for readability",
            ].map((hint) => (
              <div
                key={hint}
                className="text-[11px] text-nexo-muted px-3 py-2 rounded-lg border border-nexo-border/60 bg-nexo-elevated/50"
              >
                {hint}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-6 max-w-none">
        {messages.map((msg) => (
          <article key={msg.id} className={msg.role === "user" ? "flex justify-end" : ""}>
            {msg.role === "assistant" && (
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-5 h-5 rounded-md bg-nexo-accent/15 text-[10px] font-bold text-nexo-accent flex items-center justify-center">
                  N
                </span>
                <span className="text-[11px] font-medium text-nexo-muted">NEXO</span>
                {msg.streaming && (
                  <span className="text-[10px] text-nexo-muted animate-pulse">Thinking…</span>
                )}
              </div>
            )}
            <div
              className={
                msg.role === "user"
                  ? "max-w-[92%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed bg-[var(--nexo-user-bubble)] border border-nexo-border text-nexo-fg"
                  : "text-[13px] leading-relaxed text-nexo-fg prose-nexo pl-7"
              }
            >
              {msg.role === "assistant" ? (
                <AssistantContent content={msg.content} streaming={msg.streaming} />
              ) : (
                <p className="whitespace-pre-wrap m-0">{msg.content}</p>
              )}
            </div>
          </article>
        ))}
      </div>
      <div ref={endRef} className="h-2" />
    </div>
  );
}

function AssistantContent({
  content,
  streaming,
}: {
  content: string;
  streaming?: boolean;
}) {
  if (!content && streaming) {
    return (
      <div className="flex gap-1 py-1">
        <span className="w-1.5 h-1.5 rounded-full bg-nexo-muted animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-nexo-muted animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-nexo-muted animate-bounce [animation-delay:300ms]" />
      </div>
    );
  }

  return (
    <div className="prose-nexo max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const code = String(children).replace(/\n$/, "");
            const inline = !match && !code.includes("\n");
            if (inline) {
              return (
                <code className="bg-nexo-input px-1.5 py-0.5 rounded text-[12px]" {...props}>
                  {children}
                </code>
              );
            }
            return <CodeBlock code={code} language={match?.[1]} />;
          },
          pre({ children }) {
            return <>{children}</>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
      {streaming && content && (
        <span className="inline-block w-1.5 h-4 ml-0.5 bg-nexo-accent/80 animate-pulse align-middle rounded-sm" />
      )}
    </div>
  );
}
