import { create } from 'zustand';
import type { Workspace } from '../types';
import { fileSystemManager, type DirectoryHandle } from '../utils/fileSystem';
import { getWorkspaceJsonPath, setCurrentWorkspacePath } from '../utils/workspace';

interface WorkspaceState {
  workspace: Workspace | null;
  workspacePath: string | null;
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  
  openWorkspace: (workspacePath?: string) => Promise<void>;
  createWorkspace: (name: string) => Promise<void>;
  saveWorkspace: () => Promise<void>;
  closeWorkspace: () => void;
  setError: (error: string | null) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspace: null,
  workspacePath: null,
  isOpen: false,
  isLoading: false,
  error: null,

  openWorkspace: async (workspacePath?: string) => {
    set({ isLoading: true, error: null });
    try {
      // If workspacePath provided, open that specific workspace directory
      if (workspacePath) {
        // Get the saved project root handle or prompt once
        let rootHandle = fileSystemManager.getProjectRootHandle();
        if (!rootHandle) {
          rootHandle = await fileSystemManager.openWorkspace();
          if (!rootHandle) {
            if (fileSystemManager.isUsingZipFallback()) {
              set({ isLoading: false, error: 'File System Access API not supported. Please use Chrome 86+, Edge 86+, or Opera 72+ on HTTPS.' });
            } else {
              set({ isLoading: false, error: 'Please select your project directory to open workspaces.' });
            }
            return;
          }
          fileSystemManager.setProjectRootHandle(rootHandle);
        }
        const handle = rootHandle;

        // Navigate to workspaces folder
        let workspacesHandle: DirectoryHandle;
        try {
          workspacesHandle = await handle.getDirectoryHandle('workspaces', { create: false });
        } catch {
          set({ isLoading: false, error: 'Workspaces folder not found. Please create a workspace first.' });
          return;
        }

        // Navigate to the workspace subdirectory
        let workspaceHandle: DirectoryHandle;
        try {
          workspaceHandle = await workspacesHandle.getDirectoryHandle(workspacePath, { create: false });
        } catch {
          set({ isLoading: false, error: `Workspace "${workspacePath}" not found. Please create it first.` });
          return;
        }

        // Set current workspace path and workspace handle
        setCurrentWorkspacePath(workspacePath);
        fileSystemManager.setCurrentWorkspaceHandle(workspaceHandle);

        // Try to load existing workspace
        const workspaceJson = await fileSystemManager.readFile(getWorkspaceJsonPath());
        
        if (workspaceJson) {
          const workspace = JSON.parse(workspaceJson) as Workspace;
          // Don't add to localStorage - workspaces are now read from file system
          set({ workspace, workspacePath, isOpen: true, isLoading: false });
          
          // Restore current environment if saved (will be done after environments load in App.tsx)
          // We'll restore it after environments are loaded to avoid race conditions
          
          // Collections and environments will be loaded by App.tsx useEffect when isOpen becomes true
        } else {
          set({ isLoading: false, error: 'Workspace file not found in selected directory.' });
        }
        } else {
          // Get the saved project root handle or prompt once
          let rootHandle = fileSystemManager.getProjectRootHandle();
          if (!rootHandle) {
            rootHandle = await fileSystemManager.openWorkspace();
            if (!rootHandle) {
              if (fileSystemManager.isUsingZipFallback()) {
                set({ isLoading: false, error: 'File System Access API not supported. Please use Chrome 86+, Edge 86+, or Opera 72+ on HTTPS.' });
              } else {
                // User cancelled - don't show error, just stay on workspace selector
                set({ isLoading: false });
              }
              return;
            }
            fileSystemManager.setProjectRootHandle(rootHandle);
          }
          const handle = rootHandle;

        // List workspaces from file system
        try {
          // Navigate to workspaces folder
          const workspacesHandle = await handle.getDirectoryHandle('workspaces', { create: false });
          
          // Get the first workspace found (or most recent if we can determine it)
          let foundWorkspace = false;
          for await (const entry of workspacesHandle.values()) {
            if (entry.kind === 'directory') {
              const workspacePath = entry.name;
              try {
                const workspaceHandle = await workspacesHandle.getDirectoryHandle(workspacePath, { create: false });
                setCurrentWorkspacePath(workspacePath);
                fileSystemManager.setCurrentWorkspaceHandle(workspaceHandle);
                
                const workspaceJson = await fileSystemManager.readFile(getWorkspaceJsonPath());
                if (workspaceJson) {
                  const workspace = JSON.parse(workspaceJson) as Workspace;
                  set({ workspace, workspacePath, isOpen: true, isLoading: false });
                  
                  // Restore current environment if saved (will be done after environments load in App.tsx)
                  // We'll restore it after environments are loaded to avoid race conditions
                  
                  // Collections and environments will be loaded by App.tsx useEffect when isOpen becomes true
                  
                  foundWorkspace = true;
                  break;
                }
              } catch {
                // Continue to next workspace
                continue;
              }
            }
          }
          
          if (!foundWorkspace) {
            set({ isLoading: false, error: 'No valid workspaces found. Please create a new workspace.' });
          }
        } catch {
          set({ isLoading: false, error: 'Workspaces folder not found. Please create a new workspace.' });
        }
      }
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error.message : 'Failed to open workspace' });
    }
  },

  createWorkspace: async (name: string) => {
    set({ isLoading: true, error: null });
    try {
      // Get or prompt for the project root directory (only prompts once)
      let rootHandle = fileSystemManager.getProjectRootHandle();
      if (!rootHandle) {
        rootHandle = await fileSystemManager.openWorkspace();
        if (!rootHandle) {
          if (fileSystemManager.isUsingZipFallback()) {
            set({ isLoading: false, error: 'File System Access API not supported. Please use Chrome 86+, Edge 86+, or Opera 72+ on HTTPS.' });
          } else {
            set({ isLoading: false, error: 'Please select your project directory to store workspaces.' });
          }
          return;
        }
        fileSystemManager.setProjectRootHandle(rootHandle);
      } else {
        // Verify the handle is still valid by trying to access it
        try {
          // Try to query the handle to verify it's still accessible
          const permission = await rootHandle.queryPermission({ mode: 'readwrite' });
          if (permission !== 'granted') {
            throw new Error('Permission not granted');
          }
          // Try to access a property to ensure the handle is still valid
          void rootHandle.name;
        } catch {
          // Handle lost permission or invalid - re-prompt
          fileSystemManager.setProjectRootHandle(null);
          const { clearRootDirectoryHandle } = await import('../utils/directoryHandleStorage');
          await clearRootDirectoryHandle();
          rootHandle = await fileSystemManager.openWorkspace();
          if (!rootHandle) {
            set({ isLoading: false, error: 'Please select your project directory to store workspaces.' });
            return;
          }
          fileSystemManager.setProjectRootHandle(rootHandle);
        }
      }

      // If the saved handle is the workspaces folder, clear it and reprompt
      if (rootHandle.name === 'workspaces') {
        const { clearRootDirectoryHandle } = await import('../utils/directoryHandleStorage');
        await clearRootDirectoryHandle();
        fileSystemManager.setProjectRootHandle(null);
        rootHandle = await fileSystemManager.openWorkspace();
        if (!rootHandle) {
          set({ isLoading: false, error: 'Please select the project root directory (PostBoy folder), not the workspaces folder.' });
          return;
        }
        fileSystemManager.setProjectRootHandle(rootHandle);
      }

      // Request permission if needed
      try {
        const permission = await rootHandle.queryPermission({ mode: 'readwrite' });
        if (permission !== 'granted') {
          const newPermission = await rootHandle.requestPermission({ mode: 'readwrite' });
          if (newPermission !== 'granted') {
            set({ isLoading: false, error: 'Permission denied. Please grant read/write access to the directory.' });
            return;
          }
        }
      } catch {
        // Permission query/request might not be supported, continue anyway
      }

      // Create or get the 'workspaces' folder in the project directory
      let workspacesHandle: DirectoryHandle;
      try {
        workspacesHandle = await rootHandle.getDirectoryHandle('workspaces', { create: true });
      } catch (error) {
        // If permission error, try to re-prompt for directory
        if (error instanceof Error && error.message.includes('not allowed')) {
          fileSystemManager.setProjectRootHandle(null);
          const { clearRootDirectoryHandle } = await import('../utils/directoryHandleStorage');
          await clearRootDirectoryHandle();
          rootHandle = await fileSystemManager.openWorkspace();
          if (!rootHandle) {
            set({ isLoading: false, error: 'Please select your project directory again to grant permission.' });
            return;
          }
          fileSystemManager.setProjectRootHandle(rootHandle);
          // Retry creating workspaces directory
          try {
            workspacesHandle = await rootHandle.getDirectoryHandle('workspaces', { create: true });
          } catch (retryError) {
            set({ isLoading: false, error: `Failed to create workspaces directory: ${retryError instanceof Error ? retryError.message : 'Unknown error'}` });
            return;
          }
        } else {
          set({ isLoading: false, error: `Failed to create workspaces directory: ${error instanceof Error ? error.message : 'Unknown error'}` });
          return;
        }
      }

      // Generate workspace directory name
      const workspaceDirName = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      
      // Create or get workspace directory inside 'workspaces' folder
      let workspaceHandle: DirectoryHandle;
      try {
        workspaceHandle = await workspacesHandle.getDirectoryHandle(workspaceDirName, { create: true });
      } catch (error) {
        set({ isLoading: false, error: `Failed to create workspace directory: ${error instanceof Error ? error.message : 'Unknown error'}` });
        return;
      }

      // Set current workspace path and workspace handle
      setCurrentWorkspacePath(workspaceDirName);
      fileSystemManager.setCurrentWorkspaceHandle(workspaceHandle);

      // Create workspace structure
      const workspace: Workspace = {
        name,
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Create directory structure
      await fileSystemManager.createDirectory('.apiclient');
      await fileSystemManager.createDirectory('collections');
      await fileSystemManager.createDirectory('environments');
      await fileSystemManager.createDirectory('.apiclient/runs');

      // Save workspace.json
      await fileSystemManager.writeFile(getWorkspaceJsonPath(), JSON.stringify(workspace, null, 2));

      // Create index.json
      const { getIndexJsonPath } = await import('../utils/workspace');
      const index = {
        collections: [],
        environments: [],
      };
      await fileSystemManager.writeFile(getIndexJsonPath(), JSON.stringify(index, null, 2));
      
      // Add to recent workspaces
          // Don't add to localStorage - workspaces are now read from file system
      
      set({ workspace, workspacePath: workspaceDirName, isOpen: true, isLoading: false });
      
      // Collections and environments will be loaded by App.tsx useEffect when isOpen becomes true
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error.message : 'Failed to create workspace' });
    }
  },

  saveWorkspace: async () => {
    const { workspace } = get();
    if (!workspace) return;

    try {
      workspace.updatedAt = new Date().toISOString();
      await fileSystemManager.writeFile(getWorkspaceJsonPath(), JSON.stringify(workspace, null, 2));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to save workspace' });
    }
  },

  closeWorkspace: () => {
    // Save workspace before closing
    const { workspace } = get();
    if (workspace) {
      workspace.updatedAt = new Date().toISOString();
      fileSystemManager.writeFile(getWorkspaceJsonPath(), JSON.stringify(workspace, null, 2)).catch(() => {
        // Ignore save errors on close
      });
    }
    // Clear workspace path
    setCurrentWorkspacePath(null);
    set({ workspace: null, workspacePath: null, isOpen: false, error: null });
  },

  setError: (error: string | null) => {
    set({ error });
  },
}));
