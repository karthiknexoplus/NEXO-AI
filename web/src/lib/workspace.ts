const fetchOpts: RequestInit = { credentials: "include" };

export async function applyGeneratedFiles(
  content: string,
  projectId: string
): Promise<string[]> {
  const res = await fetch("/api/workspace/apply", {
    ...fetchOpts,
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
    ...fetchOpts,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId }),
  });
  if (!res.ok) throw new Error("Could not clear project files");
}

export async function listProjectFiles(projectId: string): Promise<string[]> {
  const res = await fetch(
    `/api/workspace/files?projectId=${encodeURIComponent(projectId)}`,
    fetchOpts
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
    `/api/workspace/file?projectId=${encodeURIComponent(projectId)}&path=${encodeURIComponent(filePath)}`,
    fetchOpts
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
    ...fetchOpts,
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, path: filePath, content }),
  });
  if (!res.ok) throw new Error("Could not save file");
}

const IMPORT_SKIP = /(?:^|\/)(node_modules|\.git|dist|build|\.next)(?:\/|$)/;

export function folderNameFromFileList(list: FileList): string {
  const first = list[0];
  if (!first) return "Imported folder";
  const rel =
    (first as File & { webkitRelativePath?: string }).webkitRelativePath || first.name;
  const top = rel.replace(/\\/g, "/").split("/")[0];
  return top || "Imported folder";
}

export async function importLocalFolder(
  projectId: string,
  fileList: FileList
): Promise<string[]> {
  const files: { path: string; content: string }[] = [];
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const rel =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    const path = rel.replace(/\\/g, "/").replace(/^\.\//, "");
    if (!path || IMPORT_SKIP.test(path)) continue;
    if (file.size > 2 * 1024 * 1024) continue;
    try {
      files.push({ path, content: await file.text() });
    } catch {
      /* skip binary */
    }
  }
  if (files.length === 0) throw new Error("No text files to import");

  const res = await fetch("/api/workspace/import", {
    ...fetchOpts,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, files }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || "Import failed");
  }
  const data = (await res.json()) as { written: string[] };
  return data.written ?? [];
}

export async function deleteProjectFile(projectId: string, filePath: string): Promise<void> {
  const res = await fetch("/api/workspace/file", {
    ...fetchOpts,
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, path: filePath }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || "Could not delete file");
  }
}

export async function renameProjectFile(projectId: string, from: string, to: string): Promise<void> {
  const res = await fetch("/api/workspace/file/rename", {
    ...fetchOpts,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, from, to }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || "Could not rename file");
  }
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
