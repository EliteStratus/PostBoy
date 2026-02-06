import { create } from 'zustand';
import type { CollectionRun, RunResult } from '../types';

interface RunnerState {
  isRunning: boolean;
  currentRun: CollectionRun | null;
  progress: number;
  error: string | null;

  startRun: (collectionName: string, environmentName?: string) => void;
  addResult: (result: RunResult) => void;
  finishRun: () => void;
  stopRun: () => void;
  setProgress: (progress: number) => void;
  setError: (error: string | null) => void;
  clearRun: () => void;
}

export const useRunnerStore = create<RunnerState>((set, get) => ({
  isRunning: false,
  currentRun: null,
  progress: 0,
  error: null,

  startRun: (collectionName: string, environmentName?: string) => {
    const run: CollectionRun = {
      collectionName,
      environmentName,
      results: [],
      startTime: new Date().toISOString(),
      totalTime: 0,
    };
    set({ isRunning: true, currentRun: run, progress: 0, error: null });
  },

  addResult: (result: RunResult) => {
    const { currentRun } = get();
    if (!currentRun) return;

    currentRun.results.push(result);
    set({ currentRun: { ...currentRun } });
  },

  finishRun: () => {
    const { currentRun } = get();
    if (!currentRun) return;

    const endTime = new Date().toISOString();
    const totalTime = new Date(endTime).getTime() - new Date(currentRun.startTime).getTime();

    set({
      isRunning: false,
      currentRun: { ...currentRun, endTime, totalTime },
      progress: 100,
    });
  },

  stopRun: () => {
    set({ isRunning: false });
  },

  setProgress: (progress: number) => {
    set({ progress });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  clearRun: () => {
    set({ isRunning: false, currentRun: null, progress: 0, error: null });
  },
}));
