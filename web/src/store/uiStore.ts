import { create } from "zustand";

export type GenerationPhase =
  | null
  | "thinking"
  | "drafting"
  | "files"
  | "saving";

interface UiState {
  codePanelOpen: boolean;
  workspaceVersion: number;
  pendingPrompt: string | null;
  pendingAutoSend: boolean;
  generationPhase: GenerationPhase;
  generationDetail: string | null;
  openFilePath: string | null;
  setCodePanelOpen: (open: boolean) => void;
  bumpWorkspace: () => void;
  setGeneration: (phase: GenerationPhase, detail?: string | null) => void;
  setOpenFilePath: (path: string | null) => void;
  queuePrompt: (prompt: string, autoSend?: boolean) => void;
  clearPendingPrompt: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  codePanelOpen: true,
  workspaceVersion: 0,
  pendingPrompt: null,
  pendingAutoSend: false,
  generationPhase: null,
  generationDetail: null,
  openFilePath: null,
  setCodePanelOpen: (open) => set({ codePanelOpen: open }),
  setOpenFilePath: (path) => set({ openFilePath: path }),
  bumpWorkspace: () => set((s) => ({ workspaceVersion: s.workspaceVersion + 1 })),
  setGeneration: (phase, detail = null) =>
    set({ generationPhase: phase, generationDetail: detail ?? null }),
  queuePrompt: (prompt, autoSend = false) =>
    set({ pendingPrompt: prompt, pendingAutoSend: autoSend }),
  clearPendingPrompt: () => set({ pendingPrompt: null, pendingAutoSend: false }),
}));
