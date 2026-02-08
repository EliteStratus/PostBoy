import { create } from 'zustand';
import type { Request, HttpResponse } from '../types';

export type TabResponse = { response: HttpResponse | null; error: string | null };

interface RequestState {
  currentRequest: Request | null;
  isExecuting: boolean;
  /** Response and error per tab id so switching tabs does not clear the previous tab's response */
  responsesByTab: Record<string, TabResponse>;

  setCurrentRequest: (request: Request | null) => void;
  setExecuting: (isExecuting: boolean) => void;
  getResponseForTab: (tabId: string) => TabResponse;
  setResponseForTab: (tabId: string, response: HttpResponse | null, error: string | null) => void;
}

export const useRequestStore = create<RequestState>((set, get) => ({
  currentRequest: null,
  isExecuting: false,
  responsesByTab: {},

  setCurrentRequest: (request) => {
    set({ currentRequest: request });
  },

  setExecuting: (isExecuting) => {
    set({ isExecuting });
  },

  getResponseForTab: (tabId) => {
    return get().responsesByTab[tabId] ?? { response: null, error: null };
  },

  setResponseForTab: (tabId, response, error) => {
    set((state) => ({
      responsesByTab: {
        ...state.responsesByTab,
        [tabId]: { response, error },
      },
    }));
  },
}));
