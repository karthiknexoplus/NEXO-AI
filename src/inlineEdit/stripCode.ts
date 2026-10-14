export function stripMarkdownFences(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```[\w]*\n([\s\S]*?)\n```$/);
  if (match) {
    return match[1];
  }
  return trimmed;
}
