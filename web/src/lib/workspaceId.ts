import type { Project } from "../store/chatStore";

/** Disk bucket id sent to /api/workspace/* */
export function resolveWorkspaceId(
  projects: Project[],
  activeProjectId: string,
  activeThreadId: string | null
): string | null {
  const project = projects.find((p) => p.id === activeProjectId);
  if (project?.kind === "imported") return project.id;
  return activeThreadId;
}

export function workspaceLabel(
  projects: Project[],
  activeProjectId: string,
  activeThreadId: string | null
): string {
  const project = projects.find((p) => p.id === activeProjectId);
  const ws = resolveWorkspaceId(projects, activeProjectId, activeThreadId);
  if (!ws) return "No workspace";
  if (project?.kind === "imported") return `Folder · ${project.name}`;
  return "This chat";
}
