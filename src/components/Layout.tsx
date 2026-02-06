import { useState, useCallback, useEffect } from 'react';
import Sidebar from './Sidebar';
import RequestEditor from './RequestEditor';
import EnvironmentEditor from './EnvironmentEditor';
import CollectionRunner from './CollectionRunner';
import PostmanImport from './PostmanImport';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useCollectionsStore } from '../stores/collectionsStore';
import { useEnvironmentsStore } from '../stores/environmentsStore';
import type { HttpMethod } from '../types';

type View = 'request' | 'environment' | 'runner' | 'import';

export type RequestTab = {
  id: string;
  collection: string;
  folder: string[] | null;
  request: string;
};

function requestTabId(collection: string, folder: string[] | null, request: string): string {
  const folderPart = (folder && folder.length > 0) ? folder.join('/') : '';
  return `${collection}\n${folderPart}\n${request}`;
}

const getMethodColor = (method: HttpMethod): string => {
  switch (method) {
    case 'GET': return 'text-method-get';
    case 'POST': return 'text-method-post';
    case 'PUT': return 'text-method-put';
    case 'PATCH': return 'text-method-patch';
    case 'DELETE': return 'text-method-delete';
    default: return 'text-text-secondary';
  }
};

const getMethodIcon = (method: HttpMethod) => {
  switch (method) {
    case 'GET':
      return (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      );
    case 'POST':
      return (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      );
    case 'PUT':
      return (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      );
    case 'PATCH':
      return (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      );
    case 'DELETE':
      return (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      );
    default:
      return (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
};

export default function Layout() {
  const { workspace, closeWorkspace } = useWorkspaceStore();
  const { getRequest } = useCollectionsStore();
  const { currentEnvironment } = useEnvironmentsStore();
  const [view, setView] = useState<View>('request');
  const [tabs, setTabs] = useState<RequestTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

  const handleSelectRequest = useCallback((collection: string, folder: string[] | null, request: string) => {
    const id = requestTabId(collection, folder, request);
    setTabs((prev) => {
      const exists = prev.some((t) => t.id === id);
      if (exists) return prev;
      return [...prev, { id, collection, folder, request }];
    });
    setActiveTabId(id);
    setView('request');
  }, []);

  const handleCloseTab = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (activeTabId === id) {
        const idx = prev.findIndex((t) => t.id === id);
        const newActive = idx > 0 ? prev[idx - 1].id : next[0]?.id ?? null;
        setActiveTabId(newActive);
      }
      return next;
    });
  }, [activeTabId]);

  const handleTabClick = useCallback((id: string) => {
    setActiveTabId(id);
  }, []);

  useEffect(() => {
    if (view === 'request' && activeTab) {
      document.title = `${activeTab.request} – PostBoy`;
    } else {
      document.title = 'PostBoy';
    }
  }, [view, activeTab]);

  return (
    <div className="h-screen flex flex-col bg-bg-app">
      {/* Header */}
      <header className="bg-surface border-b border-border px-4 py-1 flex items-center justify-between min-h-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-text-primary">PostBoy</h1>
          {workspace && (
            <span className="text-sm text-text-secondary">
              Workspace: <span className="font-semibold text-emerald-600">{workspace.name}</span>
            </span>
          )}
          {currentEnvironment && (
            <>
              <span className="text-sm text-text-muted">•</span>
              <span className="text-sm text-text-secondary">
                Environment: <span className="font-semibold text-emerald-600">{currentEnvironment}</span>
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('request')}
            className={`px-3 py-1 rounded text-sm ${
              view === 'request'
                ? 'bg-primary text-white'
                : 'bg-surface border border-border text-text-primary hover:bg-surface-secondary'
            }`}
          >
            Request
          </button>
          <button
            onClick={() => setView('environment')}
            className={`px-3 py-1 rounded text-sm ${
              view === 'environment'
                ? 'bg-primary text-white'
                : 'bg-surface border border-border text-text-primary hover:bg-surface-secondary'
            }`}
          >
            Environment
          </button>
          <button
            onClick={() => setView('runner')}
            className={`px-3 py-1 rounded text-sm ${
              view === 'runner'
                ? 'bg-primary text-white'
                : 'bg-surface border border-border text-text-primary hover:bg-surface-secondary'
            }`}
          >
            Runner
          </button>
          <button
            onClick={() => setView('import')}
            className={`px-3 py-1 rounded text-sm ${
              view === 'import'
                ? 'bg-primary text-white'
                : 'bg-surface border border-border text-text-primary hover:bg-surface-secondary'
            }`}
          >
            Import
          </button>
          <div className="ml-4 pl-4 border-l border-border">
            <button
              onClick={closeWorkspace}
              className="px-3 py-1 rounded text-sm bg-surface border border-border text-text-primary hover:bg-surface-secondary"
            >
              Close Workspace
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar onSelectRequest={handleSelectRequest} />
        <main className="flex-1 flex flex-col overflow-hidden pt-6">
          {view === 'request' && (
            <>
              {tabs.length > 0 && (
                <div className="flex items-center gap-0.5 border-b border-border bg-surface-secondary overflow-x-auto shrink-0">
                  {tabs.map((tab) => {
                    const request = getRequest(tab.collection, tab.folder, tab.request);
                    const method = request?.method || 'GET';
                    const isActive = tab.id === activeTabId;
                    
                    return (
                      <div
                        key={tab.id}
                        role="tab"
                        tabIndex={0}
                        onClick={() => handleTabClick(tab.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleTabClick(tab.id);
                          }
                        }}
                        className={`flex items-center gap-2 pl-3 pr-1 py-2 min-w-[120px] flex-1 max-w-none border-b-2 cursor-pointer transition-colors ${
                          isActive
                            ? 'border-primary bg-surface text-text-primary'
                            : 'border-transparent bg-surface-secondary text-text-secondary hover:bg-surface hover:text-text-primary'
                        }`}
                      >
                        <span className={`${getMethodColor(method)} shrink-0`}>
                          {getMethodIcon(method)}
                        </span>
                        <span className={`font-semibold text-xs ${getMethodColor(method)} shrink-0`}>
                          {method}
                        </span>
                        <span className="text-sm font-medium flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap" title={tab.request}>
                          {tab.request}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleCloseTab(tab.id, e)}
                          className="p-1 rounded hover:bg-surface-secondary shrink-0 text-text-muted hover:text-text-primary"
                          aria-label={`Close ${tab.request}`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex-1 overflow-auto">
                {activeTab ? (
                  <RequestEditor
                    key={activeTab.id}
                    collection={activeTab.collection}
                    folder={activeTab.folder}
                    requestName={activeTab.request}
                  />
                ) : (
                  <div className="p-8 text-center text-text-muted">
                    Select a request from the sidebar to open it in a tab
                  </div>
                )}
              </div>
            </>
          )}
          {view === 'environment' && <EnvironmentEditor />}
          {view === 'runner' && <CollectionRunner />}
          {view === 'import' && <PostmanImport />}
        </main>
      </div>
    </div>
  );
}
