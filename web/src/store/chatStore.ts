import { create } from "zustand";
import { persist } from "zustand/middleware";

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

export interface Project {
  id: string;
  name: string;
  createdAt: number;
}

interface ChatState {
  projects: Project[];
  threads: ChatThread[];
  activeProjectId: string;
  activeThreadId: string | null;
  model: string;
  setModel: (m: string) => void;
  newProject: (name: string) => void;
  setActiveProject: (id: string) => void;
  newThread: () => string;
  setActiveThread: (id: string) => void;
  appendMessage: (threadId: string, msg: Message) => void;
  updateAssistant: (threadId: string, messageId: string, content: string) => void;
  renameThread: (threadId: string, title: string) => void;
}

const defaultProject: Project = {
  id: "default",
  name: "My Workspace",
  createdAt: Date.now(),
};

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      projects: [defaultProject],
      threads: [],
      activeProjectId: defaultProject.id,
      activeThreadId: null,
      model: "qwen2.5-coder",

      setModel: (model) => set({ model }),

      newProject: (name) => {
        const p: Project = { id: `p-${Date.now()}`, name, createdAt: Date.now() };
        set((s) => ({
          projects: [p, ...s.projects],
          activeProjectId: p.id,
          activeThreadId: null,
        }));
      },

      setActiveProject: (id) => set({ activeProjectId: id, activeThreadId: null }),

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
        return id;
      },

      setActiveThread: (id) => set({ activeThreadId: id }),

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
    }),
    { name: "nexo-chat-v1" }
  )
);
