import { useState, useEffect } from 'react';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { fileSystemManager } from '../utils/fileSystem';
import type { WorkspaceMetadata } from '../utils/workspaceStorage';

export default function WorkspaceSelector() {
  const { createWorkspace, error, isLoading, isOpen } = useWorkspaceStore();
  const [workspaceName, setWorkspaceName] = useState('My Workspace');
  const [showCreate, setShowCreate] = useState(false);
  const [recentWorkspaces, setRecentWorkspaces] = useState<WorkspaceMetadata[]>([]);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(false);
  const [isChoosingLocation, setIsChoosingLocation] = useState(false);

  const handleChooseWorkspaceLocation = async () => {
    if (isChoosingLocation) return;
    setIsChoosingLocation(true);
    try {
      const rootHandle = await fileSystemManager.openWorkspace(true);
      if (rootHandle) {
        fileSystemManager.setProjectRootHandle(rootHandle);
        await loadWorkspacesFromFileSystem();
      }
    } finally {
      setIsChoosingLocation(false);
    }
  };

  const loadWorkspacesFromFileSystem = async () => {
    setIsLoadingWorkspaces(true);
    try {
      // Get project root handle
      let rootHandle = fileSystemManager.getProjectRootHandle();
      if (!rootHandle) {
        // Try to get saved handle
        const { getRootDirectoryHandle } = await import('../utils/directoryHandleStorage');
        const savedHandle = await getRootDirectoryHandle();
        if (savedHandle) {
          fileSystemManager.setProjectRootHandle(savedHandle as any);
          rootHandle = savedHandle as any;
        } else {
          // No root handle yet, return empty list
          setRecentWorkspaces([]);
          setIsLoadingWorkspaces(false);
          return;
        }
      }

      if (!rootHandle) {
        setRecentWorkspaces([]);
        setIsLoadingWorkspaces(false);
        return;
      }

      // Check if workspaces directory exists
      let workspacesHandle: any;
      try {
        workspacesHandle = await (rootHandle as any).getDirectoryHandle('workspaces', { create: false });
      } catch {
        // Workspaces directory doesn't exist yet
        setRecentWorkspaces([]);
        setIsLoadingWorkspaces(false);
        return;
      }

      // List all workspace directories
      const workspaces: WorkspaceMetadata[] = [];
      for await (const entry of (workspacesHandle as any).values()) {
        if (entry.kind === 'directory') {
          const workspaceName = entry.name;
          try {
            // Try to read workspace.json to get metadata
            const workspaceHandle = await workspacesHandle.getDirectoryHandle(workspaceName, { create: false });
            const apiclientHandle = await workspaceHandle.getDirectoryHandle('.apiclient', { create: false });
            const workspaceFileHandle = await apiclientHandle.getFileHandle('workspace.json', { create: false });
            const workspaceFile = await workspaceFileHandle.getFile();
            const workspaceJson = await workspaceFile.text();
            const workspace = JSON.parse(workspaceJson);
            
            workspaces.push({
              name: workspace.name,
              path: workspaceName,
              lastOpened: workspace.updatedAt || workspace.createdAt,
              createdAt: workspace.createdAt,
            });
          } catch {
            // If workspace.json doesn't exist, still add it with default info
            workspaces.push({
              name: workspaceName,
              path: workspaceName,
              lastOpened: new Date().toISOString(),
              createdAt: new Date().toISOString(),
            });
          }
        }
      }

      // Sort by last opened (most recent first)
      workspaces.sort((a, b) => 
        new Date(b.lastOpened).getTime() - new Date(a.lastOpened).getTime()
      );

      setRecentWorkspaces(workspaces);
    } catch (error) {
      console.error('Failed to load workspaces:', error);
      setRecentWorkspaces([]);
    } finally {
      setIsLoadingWorkspaces(false);
    }
  };

  useEffect(() => {
    loadWorkspacesFromFileSystem();
  }, []);

  // Refresh workspaces when workspace opens or closes
  useEffect(() => {
    if (!isOpen) {
      loadWorkspacesFromFileSystem();
    }
  }, [isOpen]);

  const handleOpenRecent = async (workspace: WorkspaceMetadata) => {
    // Open the workspace from file system
    const { openWorkspace } = useWorkspaceStore.getState();
    await openWorkspace(workspace.path);
    // Refresh list after opening
    await loadWorkspacesFromFileSystem();
  };

  const handleCreate = async () => {
    if (workspaceName.trim()) {
      await createWorkspace(workspaceName.trim());
      // Refresh workspaces from file system after creation
      await loadWorkspacesFromFileSystem();
      setShowCreate(false);
      setWorkspaceName('My Workspace');
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-emerald-50/40 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Soothing background graphics */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Soft gradient orbs */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-200/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-200/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-slate-200/10 rounded-full blur-3xl"></div>
        
        {/* Subtle grid pattern */}
        <svg className="absolute top-0 left-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="20" cy="20" r="1" fill="currentColor" className="text-slate-600" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Floating API graphics with soothing colors */}
        <div className="absolute top-[10%] right-[8%] opacity-15">
          <div className="bg-gradient-to-br from-blue-100 to-blue-50 p-4 rounded-2xl shadow-sm border border-blue-200/50">
            <svg className="w-12 h-12 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </div>
        
        <div className="absolute top-[25%] left-[6%] opacity-12">
          <div className="bg-gradient-to-br from-emerald-100 to-emerald-50 p-4 rounded-2xl shadow-sm border border-emerald-200/50">
            <svg className="w-12 h-12 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
          </div>
        </div>

        <div className="absolute bottom-[30%] right-[10%] opacity-10">
          <div className="bg-gradient-to-br from-slate-100 to-slate-50 p-4 rounded-2xl shadow-sm border border-slate-200/50">
            <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        </div>

        {/* Network connection illustration */}
        <div className="absolute bottom-[15%] left-[8%] opacity-8">
          <svg width="140" height="60" viewBox="0 0 140 60" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="30" r="8" fill="currentColor" className="text-blue-300" />
            <circle cx="70" cy="30" r="8" fill="currentColor" className="text-emerald-300" />
            <circle cx="120" cy="30" r="8" fill="currentColor" className="text-slate-300" />
            <path d="M28 30h34M78 30h34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-slate-300" opacity="0.5" />
          </svg>
        </div>

        {/* API flow illustration */}
        <div className="absolute top-[45%] right-[5%] opacity-8">
          <svg width="120" height="50" viewBox="0 0 120 50" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="5" y="15" width="25" height="20" rx="4" fill="currentColor" className="text-blue-200" opacity="0.6" />
            <path d="M35 25h25M65 25h25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-slate-300" opacity="0.4" />
            <path d="M58 20l7 5-7 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300" opacity="0.4" />
            <rect x="90" y="15" width="25" height="20" rx="4" fill="currentColor" className="text-emerald-200" opacity="0.6" />
          </svg>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200/60 p-8 max-w-2xl w-full relative z-10">
        {/* Choose Workspace Location - icon top right with tooltip (folder + location) */}
        <div className="absolute top-4 right-4 flex items-center">
          <button
            type="button"
            onClick={handleChooseWorkspaceLocation}
            disabled={isChoosingLocation}
            title="Choose Workspace Location"
            className="group/btn flex items-center justify-center w-11 h-9 rounded-lg border border-slate-200/80 bg-slate-50/80 hover:bg-emerald-50 hover:border-emerald-200/80 text-slate-600 hover:text-emerald-700 transition-all duration-200 shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-emerald-400/40 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isChoosingLocation ? (
              <svg className="animate-spin w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <span className="flex items-center gap-0.5">
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}>
                  <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <svg className="w-4 h-4 shrink-0 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
                </svg>
              </span>
            )}
          </button>
          <span className="pointer-events-none absolute right-12 left-auto top-1/2 -translate-y-1/2 px-2.5 py-1.5 text-xs font-medium bg-slate-800 text-white rounded-md opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap shadow-lg z-20">
            Choose Workspace Location
          </span>
        </div>

        {/* Hero with API illustration */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            {/* Main API icon */}
            <div className="bg-gradient-to-br from-blue-100 to-emerald-100 p-4 rounded-2xl shadow-md border border-blue-200/50">
              <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-700 to-slate-900 bg-clip-text text-transparent mb-1">PostBoy</h1>
              <p className="text-base text-slate-600 font-medium">Your ultimate Handy Dandy API Client</p>
            </div>
          </div>
          
          {/* Subtle API flow illustration */}
          <div className="mt-5 flex items-center justify-center gap-3 text-base text-emerald-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-base font-medium">Client</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            <span className="text-base font-medium">Server</span>
            <svg className="w-5 h-5 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            <span className="text-base font-medium">Response</span>
          </div>
        </div>

        {error && (
          <div className="mb-5 p-4 bg-red-50/80 border border-red-200/60 rounded-xl text-red-700 text-base shadow-sm">
            {error}
          </div>
        )}

        {!showCreate ? (
          <div className="space-y-5 mt-12">
            {/* Workspaces List */}
            <div className="pt-8">
              <div className="flex items-center gap-2 mb-5">
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <h2 className="text-xl font-semibold text-slate-700">Workspaces</h2>
              </div>
              {isLoadingWorkspaces ? (
                <div className="text-base text-slate-500 py-5 flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading workspaces...
                </div>
              ) : recentWorkspaces.length > 0 ? (
                <div className="space-y-3">
                  {recentWorkspaces.map((workspace) => (
                    <div
                      key={workspace.path}
                      className="flex items-center p-5 bg-white border border-slate-200/80 rounded-xl shadow-sm hover:bg-emerald-50 hover:shadow-md hover:border-emerald-200/80 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 group"
                      onClick={() => handleOpenRecent(workspace)}
                    >
                      <div className="bg-gradient-to-br from-blue-50 to-emerald-50 p-3 rounded-lg mr-4 border border-blue-100/50">
                        <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-lg font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">{workspace.name}</div>
                        <div className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {formatDate(workspace.lastOpened)}
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-slate-400 group-hover:text-blue-500 shrink-0 ml-3 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-base text-slate-500 py-5 flex items-center gap-2">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  No workspaces found. Create one to get started.. or choose an existing location
                </div>
              )}
            </div>

            {/* Create Workspace Link */}
            <div>
              <button
                onClick={() => setShowCreate(true)}
                className="text-[#14532D] hover:text-[#0F5132] hover:underline py-1 text-base font-medium transition-colors"
              >
                + Create Workspace
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <label className="block text-base font-medium text-slate-700 mb-2">
                Workspace Name
              </label>
              <input
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') setShowCreate(false);
                }}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 bg-white shadow-sm"
                placeholder="My Workspace"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCreate}
                disabled={isLoading || !workspaceName.trim()}
                className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white py-2.5 px-4 rounded-xl text-base font-medium hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:from-slate-300 disabled:to-slate-400 shadow-sm hover:shadow transition-all duration-200"
              >
                Create
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 bg-white border border-slate-200 text-slate-700 py-2.5 px-4 rounded-xl text-base font-medium hover:bg-slate-50 hover:border-slate-300 transition-all duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
