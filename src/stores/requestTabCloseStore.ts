import { create } from 'zustand';

interface TabCloseState {
  isDirty: boolean;
  save: () => Promise<void>;
}

/** Request pane tab: Params, Headers, Body, Authorization, Scripts */
export type RequestPaneTabId = 'query-params' | 'headers' | 'body' | 'authorization' | 'scripts';

interface RequestTabCloseState {
  /** tabId -> { isDirty, save } for the currently mounted request editor (active tab only) */
  tabState: Record<string, TabCloseState>;
  setTabState: (tabId: string, state: TabCloseState | null) => void;
  getTabState: (tabId: string) => TabCloseState | null;
  /** tabId -> request pane tab (Params/Headers/Body/etc.) so each request tab remembers its own sub-tab */
  paneTabByTabId: Record<string, RequestPaneTabId>;
  getPaneTab: (tabId: string) => RequestPaneTabId | undefined;
  setPaneTab: (tabId: string, paneTab: RequestPaneTabId) => void;
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
  paneTabByTabId: {},
  getPaneTab: (tabId) => get().paneTabByTabId[tabId],
  setPaneTab: (tabId, paneTab) => {
    set((prev) => ({
      paneTabByTabId: { ...prev.paneTabByTabId, [tabId]: paneTab },
    }));
  },
}));
