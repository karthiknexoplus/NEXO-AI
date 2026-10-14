import type { GenerationPhase } from "../store/uiStore";

export function labelForPhase(phase: GenerationPhase, detail: string | null): string {
  switch (phase) {
    case "thinking":
      return "Thinking…";
    case "drafting":
      return detail?.startsWith("Part") ? `${detail} — drafting…` : "Drafting response…";
    case "files":
      return detail ? `Writing ${detail}…` : "Generating project files…";
    case "saving":
      return "Saving to project workspace…";
    default:
      return "";
  }
}

/** Update phase from streamed assistant text. */
export function phaseFromStream(acc: string): { phase: GenerationPhase; detail: string | null } {
  if (!acc.trim()) return { phase: "thinking", detail: null };
  if (!acc.includes("```")) return { phase: "drafting", detail: null };

  const paths: string[] = [];
  const re = /```([^\n`]+)\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(acc)) !== null) {
    const header = m[1].trim();
    if (header && (header.includes("/") || header.includes("."))) paths.push(header);
  }
  const last = paths[paths.length - 1];
  return { phase: "files", detail: last ?? null };
}
