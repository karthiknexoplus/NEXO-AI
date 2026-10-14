import { create } from "zustand";

interface UiState {
  codePanelOpen: boolean;
  workspaceVersion: number;
  pendingPrompt: string | null;
  pendingAutoSend: boolean;
  setCodePanelOpen: (open: boolean) => void;
  bumpWorkspace: () => void;
  queuePrompt: (prompt: string, autoSend?: boolean) => void;
  clearPendingPrompt: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  codePanelOpen: true,
  workspaceVersion: 0,
  pendingPrompt: null,
  pendingAutoSend: false,
  setCodePanelOpen: (open) => set({ codePanelOpen: open }),
  bumpWorkspace: () => set((s) => ({ workspaceVersion: s.workspaceVersion + 1 })),
  queuePrompt: (prompt, autoSend = false) =>
    set({ pendingPrompt: prompt, pendingAutoSend: autoSend }),
  clearPendingPrompt: () => set({ pendingPrompt: null, pendingAutoSend: false }),
}));
