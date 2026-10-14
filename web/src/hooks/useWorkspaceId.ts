import { useChatStore } from "../store/chatStore";
import { resolveWorkspaceId, workspaceLabel } from "../lib/workspaceId";

export function useWorkspaceId(): string | null {
  const projects = useChatStore((s) => s.projects);
  const activeProjectId = useChatStore((s) => s.activeProjectId);
  const activeThreadId = useChatStore((s) => s.activeThreadId);
  return resolveWorkspaceId(projects, activeProjectId, activeThreadId);
}

export function useWorkspaceLabel(): string {
  const projects = useChatStore((s) => s.projects);
  const activeProjectId = useChatStore((s) => s.activeProjectId);
  const activeThreadId = useChatStore((s) => s.activeThreadId);
  return workspaceLabel(projects, activeProjectId, activeThreadId);
}
