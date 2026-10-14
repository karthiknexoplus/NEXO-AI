export async function applyGeneratedFiles(
  content: string,
  projectId: string
): Promise<string[]> {
  const res = await fetch("/api/workspace/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, projectId }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || "Could not write files");
  }
  const data = (await res.json()) as { written: string[] };
  return data.written ?? [];
}

export async function clearProjectWorkspace(projectId: string): Promise<void> {
  const res = await fetch("/api/workspace/clear", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId }),
  });
  if (!res.ok) throw new Error("Could not clear project files");
}

export async function listProjectFiles(projectId: string): Promise<string[]> {
  const res = await fetch(
    `/api/workspace/files?projectId=${encodeURIComponent(projectId)}`
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { files: string[] };
  return data.files ?? [];
}

export async function readProjectFile(
  projectId: string,
  filePath: string
): Promise<string> {
  const res = await fetch(
    `/api/workspace/file?projectId=${encodeURIComponent(projectId)}&path=${encodeURIComponent(filePath)}`
  );
  if (!res.ok) throw new Error("Could not load file");
  const data = (await res.json()) as { content: string };
  return data.content;
}

export async function saveProjectFile(
  projectId: string,
  filePath: string,
  content: string
): Promise<void> {
  const res = await fetch("/api/workspace/file", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, path: filePath, content }),
  });
  if (!res.ok) throw new Error("Could not save file");
}

export function downloadProjectZip(projectId: string): void {
  const url = `/api/workspace/download?projectId=${encodeURIComponent(projectId)}`;
  const a = document.createElement("a");
  a.href = url;
  a.download = "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
