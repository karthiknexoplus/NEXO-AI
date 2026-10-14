import {
  isFailedAssistantReply,
  stripAssistantLeaks,
} from "./sanitizeAssistant";
import { streamIntelligenceChat, type IntelligenceMode } from "./intelligence";
import { applyGeneratedFiles } from "./workspace";
import { isMultiFileBuildRequest } from "./workspaceContext";
import { phaseFromStream } from "./generationStatus";
import type { GenerationPhase } from "../store/uiStore";

export type ChatTurnMessage = { role: "user" | "assistant"; content: string };

const MAX_PASSES = 4;

function countFences(text: string): number {
  return (text.match(/```[^\n]+\n/g) ?? []).length;
}

function needsAnotherPass(
  userText: string,
  acc: string,
  writtenPaths: string[]
): boolean {
  if (!isMultiFileBuildRequest(userText)) return false;
  const fences = countFences(acc);
  if (fences >= 2 && writtenPaths.length >= 2) return false;
  if (acc.length > 800 && fences === 0) return true;
  if (isMultiFileBuildRequest(userText) && writtenPaths.length < 2 && acc.length > 400) {
    return true;
  }
  return false;
}

export async function runChatGeneration(opts: {
  mode: IntelligenceMode;
  projectId: string;
  userText: string;
  chatHistory: ChatTurnMessage[];
  onToken: (content: string, phase: GenerationPhase, detail: string | null) => void;
  onSaving: () => void;
  onFilesWritten?: (paths: string[]) => void;
}): Promise<{ content: string; written: string[] }> {
  const { mode, projectId, userText, chatHistory, onToken, onSaving, onFilesWritten } =
    opts;

  const runStream = async (messages: ChatTurnMessage[], detailOverride?: string | null) => {
    let acc = "";
    await streamIntelligenceChat(messages, mode, (token) => {
      acc += token;
      const clean = stripAssistantLeaks(acc);
      const { phase, detail } = phaseFromStream(clean);
      onToken(clean, phase, detailOverride ?? detail);
    });
    return stripAssistantLeaks(acc);
  };

  let messages = [...chatHistory];
  let acc = "";
  const allWritten: string[] = [];

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let part: string;
    try {
      part = await runStream(messages, pass > 0 ? `Part ${pass + 1}` : null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (pass < MAX_PASSES - 1 && /load failed|failed to fetch/i.test(msg)) {
        messages = [
          ...chatHistory,
          ...(acc
            ? [{ role: "assistant" as const, content: acc.slice(-6000) }]
            : []),
          {
            role: "user",
            content:
              "Connection dropped. Continue the same project with remaining files only (path fences, max 4 files).",
          },
        ];
        continue;
      }
      throw e;
    }
    acc = pass === 0 ? part : `${acc}\n\n${part}`;

    onSaving();
    const written = await applyGeneratedFiles(part, projectId).catch(() => [] as string[]);
    if (written.length) onFilesWritten?.(written);
    allWritten.push(...written);

    const failed = isFailedAssistantReply(acc);
    const more = needsAnotherPass(userText, acc, allWritten);

    if (!failed && !more) break;

    if (pass === MAX_PASSES - 1) break;

    messages = [
      ...chatHistory,
      { role: "assistant", content: acc.slice(-6000) },
      {
        role: "user",
        content:
          `Continue the same NEXOPLUS project. Output at most 4 files per reply using path fences only.\nAlready saved: ${allWritten.length ? allWritten.join(", ") : "(none yet)"}\nFinish missing files (e.g. index.html, styles.css, script.js, README.md).`,
      },
    ];
  }

  if (isFailedAssistantReply(acc)) {
    const retry = await runStream([
      ...chatHistory,
      {
        role: "user",
        content: `${userText}\n\nUse markdown path fences only. No tool_call syntax.`,
      },
    ]);
    acc = retry;
    onToken(acc, phaseFromStream(acc).phase, null);
    onSaving();
    const w = await applyGeneratedFiles(retry, projectId).catch(() => [] as string[]);
    if (w.length) onFilesWritten?.(w);
    allWritten.push(...w);
  }

  return { content: acc, written: [...new Set(allWritten)] };
}
