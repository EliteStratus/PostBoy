import { create } from 'zustand';
import type { Environment, EnvironmentVariable } from '../types';
import { fileSystemManager } from '../utils/fileSystem';
import { getEnvironmentPath } from '../utils/workspace';

interface EnvironmentsState {
  environments: Record<string, Environment>;
  currentEnvironment: string | null;
  isLoading: boolean;
  error: string | null;

  loadEnvironments: () => Promise<void>;
  createEnvironment: (name: string) => Promise<void>;
  updateEnvironment: (name: string, updates: Partial<Environment>) => Promise<void>;
  deleteEnvironment: (name: string) => Promise<void>;
  setCurrentEnvironment: (name: string | null) => Promise<void>;
  getCurrentEnvironment: () => Environment | null;
  addVariable: (environmentName: string, variable: EnvironmentVariable) => Promise<void>;
  updateVariable: (environmentName: string, key: string, updates: Partial<EnvironmentVariable>) => Promise<void>;
  deleteVariable: (environmentName: string, key: string) => Promise<void>;
  setError: (error: string | null) => void;
}

export const useEnvironmentsStore = create<EnvironmentsState>((set, get) => ({
  environments: {},
  currentEnvironment: null,
  isLoading: false,
  error: null,

  loadEnvironments: async () => {
    set({ isLoading: true, error: null });
    try {
      const environments: Record<string, Environment> = {};
      const envFiles = await fileSystemManager.listDirectory('environments');
      
      for (const file of envFiles) {
        if (file.endsWith('.env.json')) {
          const envName = file.replace('.env.json', '');
          const envJson = await fileSystemManager.readFile(getEnvironmentPath(envName));
          if (envJson) {
            environments[envName] = JSON.parse(envJson);
          }
        }
      }
      
      set({ environments, isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error.message : 'Failed to load environments' });
    }
  },

  createEnvironment: async (name: string) => {
    try {
      // Standard variables to include in new environments
      const standardVariables: EnvironmentVariable[] = [
        { key: 'url', value: '', type: 'string', enabled: true },
        { key: 'username', value: '', type: 'string', enabled: true },
        { key: 'password', value: '', type: 'secret', enabled: true },
        { key: 'environment', value: name, type: 'string', enabled: true },
        { key: 'companyCode', value: '', type: 'string', enabled: true },
        { key: 'time', value: new Date().toISOString(), type: 'string', enabled: true },
      ];
      
      const environment: Environment = {
        name,
        variables: standardVariables,
      };
      
      await fileSystemManager.writeFile(
        getEnvironmentPath(name),
        JSON.stringify(environment, null, 2)
      );
      
      set(state => ({
        environments: { ...state.environments, [name]: environment },
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create environment' });
    }
  },

  updateEnvironment: async (name: string, updates: Partial<Environment>) => {
    const { environments } = get();
    const environment = environments[name];
    if (!environment) return;

    const updated = { ...environment, ...updates };
    await fileSystemManager.writeFile(
      getEnvironmentPath(name),
      JSON.stringify(updated, null, 2)
    );

    set(state => ({
      environments: { ...state.environments, [name]: updated },
    }));
  },

  deleteEnvironment: async (name: string) => {
    const { environments } = get();
    const updated = { ...environments };
    delete updated[name];
    
    if (get().currentEnvironment === name) {
      set({ currentEnvironment: null });
    }
    
    set({ environments: updated });
  },

  setCurrentEnvironment: async (name: string | null) => {
    set({ currentEnvironment: name });
    // Save to workspace.json (but don't await to avoid blocking UI)
    try {
      const { useWorkspaceStore } = await import('./workspaceStore');
      const workspace = useWorkspaceStore.getState().workspace;
      if (workspace) {
        workspace.currentEnvironment = name;
        // Save asynchronously without blocking
        useWorkspaceStore.getState().saveWorkspace().catch(() => {
          // Ignore save errors
        });
      }
    } catch {
      // Ignore errors when saving - workspace might not be open yet
    }
  },

  getCurrentEnvironment: () => {
    const { environments, currentEnvironment } = get();
    if (!currentEnvironment) return null;
    return environments[currentEnvironment] || null;
  },

  addVariable: async (environmentName: string, variable: EnvironmentVariable) => {
    const { environments } = get();
    const environment = environments[environmentName];
    if (!environment) return;

    // Create a new array and new environment object to ensure proper immutability
    const updatedEnvironment = {
      ...environment,
      variables: [...environment.variables, variable],
    };
    
    await fileSystemManager.writeFile(
      getEnvironmentPath(environmentName),
      JSON.stringify(updatedEnvironment, null, 2)
    );

    set(state => ({
      environments: { ...state.environments, [environmentName]: updatedEnvironment },
    }));
  },

  updateVariable: async (environmentName: string, key: string, updates: Partial<EnvironmentVariable>) => {
    const { environments } = get();
    const environment = environments[environmentName];
    if (!environment) return;

    const index = environment.variables.findIndex(v => v.key === key);
    if (index >= 0) {
      // Create a new array and new object to ensure proper immutability
      const updatedVariables = [...environment.variables];
      updatedVariables[index] = { ...updatedVariables[index], ...updates };
      
      const updatedEnvironment = {
        ...environment,
        variables: updatedVariables,
      };
      
      await fileSystemManager.writeFile(
        getEnvironmentPath(environmentName),
        JSON.stringify(updatedEnvironment, null, 2)
      );

      set(state => ({
        environments: { ...state.environments, [environmentName]: updatedEnvironment },
      }));
    }
  },

  deleteVariable: async (environmentName: string, key: string) => {
    const { environments } = get();
    const environment = environments[environmentName];
    if (!environment) return;

    // Create a new array and new environment object to ensure proper immutability
    const updatedEnvironment = {
      ...environment,
      variables: environment.variables.filter(v => v.key !== key),
    };
    
    await fileSystemManager.writeFile(
      getEnvironmentPath(environmentName),
      JSON.stringify(updatedEnvironment, null, 2)
    );

    set(state => ({
      environments: { ...state.environments, [environmentName]: updatedEnvironment },
    }));
  },

  setError: (error: string | null) => {
    set({ error });
  },
}));
