import { create } from 'zustand';

interface TabCloseState {
  isDirty: boolean;
  save: () => Promise<void>;
}

interface RequestTabCloseState {
  /** tabId -> { isDirty, save } for the currently mounted request editor (active tab only) */
  tabState: Record<string, TabCloseState>;
  setTabState: (tabId: string, state: TabCloseState | null) => void;
  getTabState: (tabId: string) => TabCloseState | null;
}

export const useRequestTabCloseStore = create<RequestTabCloseState>((set, get) => ({
  tabState: {},
  setTabState: (tabId, state) => {
    set((prev) => {
      const next = { ...prev.tabState };
      if (state === null) {
        delete next[tabId];
      } else {
        next[tabId] = state;
      }
      return { tabState: next };
    });
  },
  getTabState: (tabId) => get().tabState[tabId] ?? null,
}));
