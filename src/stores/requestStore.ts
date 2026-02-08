import { create } from 'zustand';
import type { Request, HttpResponse } from '../types';

export type TabResponse = { response: HttpResponse | null; error: string | null };

interface RequestState {
  currentRequest: Request | null;
  /** @deprecated use getResponseForTab / setResponseForTab; kept for selectors that expect a single response */
  response: HttpResponse | null;
  isExecuting: boolean;
  /** @deprecated use getResponseForTab / setResponseForTab */
  error: string | null;
  executionTime: number | null;
  /** Response and error per tab id so switching tabs does not clear the previous tab's response */
  responsesByTab: Record<string, TabResponse>;

  setCurrentRequest: (request: Request | null) => void;
  setResponse: (response: HttpResponse | null) => void;
  setExecuting: (isExecuting: boolean) => void;
  setError: (error: string | null) => void;
  setExecutionTime: (time: number | null) => void;
  clearResponse: () => void;
  getResponseForTab: (tabId: string) => TabResponse;
  setResponseForTab: (tabId: string, response: HttpResponse | null, error: string | null) => void;
}

export const useRequestStore = create<RequestState>((set, get) => ({
  currentRequest: null,
  response: null,
  isExecuting: false,
  error: null,
  executionTime: null,
  responsesByTab: {},

  setCurrentRequest: (request) => {
    set({ currentRequest: request });
  },

  setResponse: (response) => {
    set({ response, error: null });
  },

  setExecuting: (isExecuting) => {
    set({ isExecuting });
  },

  setError: (error) => {
    set({ error, response: null });
  },

  setExecutionTime: (time) => {
    set({ executionTime: time });
  },

  clearResponse: () => {
    set({ response: null, error: null, executionTime: null });
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
      response,
      error,
    }));
  },
}));
