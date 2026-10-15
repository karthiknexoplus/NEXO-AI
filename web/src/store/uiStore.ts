import { create } from "zustand";

export type GenerationPhase =
  | null
  | "thinking"
  | "drafting"
  | "files"
  | "saving";

interface UiState {
  codePanelOpen: boolean;
  sidebarOpen: boolean;
  workspaceVersion: number;
  pendingPrompt: string | null;
  pendingAutoSend: boolean;
  generationPhase: GenerationPhase;
  generationDetail: string | null;
  openFilePath: string | null;
  toast: { message: string; type?: "info" | "success" | "error" } | null;
  setCodePanelOpen: (open: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  bumpWorkspace: () => void;
  setGeneration: (phase: GenerationPhase, detail?: string | null) => void;
  setOpenFilePath: (path: string | null) => void;
  showToast: (message: string, type?: "info" | "success" | "error") => void;
  clearToast: () => void;
  queuePrompt: (prompt: string, autoSend?: boolean) => void;
  clearPendingPrompt: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  codePanelOpen: true,
  sidebarOpen: false,
  workspaceVersion: 0,
  pendingPrompt: null,
  pendingAutoSend: false,
  generationPhase: null,
  generationDetail: null,
  openFilePath: null,
  toast: null,
  setCodePanelOpen: (open) => set({ codePanelOpen: open }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setOpenFilePath: (path) => set({ openFilePath: path }),
  showToast: (message, type) => set({ toast: { message, type: type || "info" } }),
  clearToast: () => set({ toast: null }),
  bumpWorkspace: () => set((s) => ({ workspaceVersion: s.workspaceVersion + 1 })),
  setGeneration: (phase, detail = null) =>
    set({ generationPhase: phase, generationDetail: detail ?? null }),
  queuePrompt: (prompt, autoSend = false) =>
    set({ pendingPrompt: prompt, pendingAutoSend: autoSend }),
  clearPendingPrompt: () => set({ pendingPrompt: null, pendingAutoSend: false }),
}));
