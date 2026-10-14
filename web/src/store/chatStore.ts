import { create } from "zustand";
import { persist } from "zustand/middleware";
import { clearProjectWorkspace } from "../lib/workspace";
import { useUiStore } from "./uiStore";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface ChatThread {
  id: string;
  projectId: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

export type ProjectKind = "default" | "imported";

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  kind?: ProjectKind;
}

interface ChatState {
  projects: Project[];
  threads: ChatThread[];
  activeProjectId: string;
  activeThreadId: string | null;
  intelligenceMode: "fast" | "smart" | "deep";
  setIntelligenceMode: (m: "fast" | "smart" | "deep") => void;
  newProject: (name: string) => void;
  newImportedProject: (name: string) => string;
  setActiveProject: (id: string) => void;
  newThread: () => string;
  newThreadInProject: (projectId: string) => string;
  setActiveThread: (id: string) => void;
  appendMessage: (threadId: string, msg: Message) => void;
  updateAssistant: (threadId: string, messageId: string, content: string) => void;
  renameThread: (threadId: string, title: string) => void;
  deleteThread: (threadId: string) => void;
}

const defaultProject: Project = {
  id: "default",
  name: "My Workspace",
  createdAt: Date.now(),
  kind: "default",
};

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      projects: [defaultProject],
      threads: [],
      activeProjectId: defaultProject.id,
      activeThreadId: null,
      intelligenceMode: "fast",

      setIntelligenceMode: (intelligenceMode) => set({ intelligenceMode }),

      newProject: (name) => {
        const p: Project = {
          id: `p-${Date.now()}`,
          name,
          createdAt: Date.now(),
          kind: "default",
        };
        set((s) => ({
          projects: [p, ...s.projects],
          activeProjectId: p.id,
          activeThreadId: null,
        }));
      },

      newImportedProject: (name) => {
        const p: Project = {
          id: `p-${Date.now()}`,
          name,
          createdAt: Date.now(),
          kind: "imported",
        };
        set((s) => ({
          projects: [p, ...s.projects],
          activeProjectId: p.id,
          activeThreadId: null,
        }));
        return p.id;
      },

      setActiveProject: (id) => {
        set({ activeProjectId: id, activeThreadId: null });
        useUiStore.getState().bumpWorkspace();
      },

      newThread: () => {
        const id = `t-${Date.now()}`;
        const thread: ChatThread = {
          id,
          projectId: get().activeProjectId,
          title: "New Chat",
          messages: [],
          updatedAt: Date.now(),
        };
        set((s) => ({
          threads: [thread, ...s.threads],
          activeThreadId: id,
        }));
        useUiStore.getState().bumpWorkspace();
        return id;
      },

      newThreadInProject: (projectId) => {
        const id = `t-${Date.now()}`;
        const thread: ChatThread = {
          id,
          projectId,
          title: "New Chat",
          messages: [],
          updatedAt: Date.now(),
        };
        set((s) => ({
          threads: [thread, ...s.threads],
          activeProjectId: projectId,
          activeThreadId: id,
        }));
        useUiStore.getState().bumpWorkspace();
        return id;
      },

      setActiveThread: (id) => {
        const thread = get().threads.find((t) => t.id === id);
        set({
          activeThreadId: id,
          ...(thread ? { activeProjectId: thread.projectId } : {}),
        });
        useUiStore.getState().bumpWorkspace();
      },

      appendMessage: (threadId, msg) =>
        set((s) => ({
          threads: s.threads.map((t) =>
            t.id === threadId
              ? {
                  ...t,
                  messages: [...t.messages, msg],
                  updatedAt: Date.now(),
                  title:
                    t.messages.length === 0 && msg.role === "user"
                      ? msg.content.slice(0, 42) + (msg.content.length > 42 ? "…" : "")
                      : t.title,
                }
              : t
          ),
        })),

      updateAssistant: (threadId, messageId, content) =>
        set((s) => ({
          threads: s.threads.map((t) =>
            t.id === threadId
              ? {
                  ...t,
                  messages: t.messages.map((m) =>
                    m.id === messageId ? { ...m, content } : m
                  ),
                  updatedAt: Date.now(),
                }
              : t
          ),
        })),

      renameThread: (threadId, title) =>
        set((s) => ({
          threads: s.threads.map((t) => (t.id === threadId ? { ...t, title } : t)),
        })),

      deleteThread: (threadId) => {
        const thread = get().threads.find((t) => t.id === threadId);
        const project = thread
          ? get().projects.find((p) => p.id === thread.projectId)
          : null;

        set((s) => {
          const remaining = s.threads.filter((t) => t.id !== threadId);
          const inProject = remaining.filter((t) => t.projectId === s.activeProjectId);
          let activeThreadId = s.activeThreadId;
          if (activeThreadId === threadId) {
            activeThreadId = inProject[0]?.id ?? null;
          }
          return { threads: remaining, activeThreadId };
        });

        if (thread && project?.kind !== "imported") {
          void clearProjectWorkspace(thread.id).then(() => {
            useUiStore.getState().bumpWorkspace();
          });
        }
      },
    }),
    { name: "nexo-chat-v2" }
  )
);
