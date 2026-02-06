import { create } from 'zustand';
import type { Request, HttpResponse } from '../types';

interface RequestState {
  currentRequest: Request | null;
  response: HttpResponse | null;
  isExecuting: boolean;
  error: string | null;
  executionTime: number | null;

  setCurrentRequest: (request: Request | null) => void;
  setResponse: (response: HttpResponse | null) => void;
  setExecuting: (isExecuting: boolean) => void;
  setError: (error: string | null) => void;
  setExecutionTime: (time: number | null) => void;
  clearResponse: () => void;
}

export const useRequestStore = create<RequestState>((set) => ({
  currentRequest: null,
  response: null,
  isExecuting: false,
  error: null,
  executionTime: null,

  setCurrentRequest: (request) => {
    set({ currentRequest: request, response: null, error: null });
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
}));
