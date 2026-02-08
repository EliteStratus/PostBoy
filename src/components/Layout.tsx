import { useState, useCallback, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import RequestEditor from './RequestEditor';
import EnvironmentEditor from './EnvironmentEditor';
import CollectionRunner from './CollectionRunner';
import PostmanImport from './PostmanImport';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useCollectionsStore } from '../stores/collectionsStore';
import { useEnvironmentsStore } from '../stores/environmentsStore';
import { useRequestTabCloseStore } from '../stores/requestTabCloseStore';
import { useThemeStore } from '../stores/themeStore';
import { requestTabId } from '../utils/requestTabId';
import type { HttpMethod } from '../types';

type View = 'request' | 'environment' | 'runner' | 'import';

export type RequestTab = {
  id: string;
  collection: string;
  folder: string[] | null;
  request: string;
};

export { requestTabId };

const SIDEBAR_WIDTH_KEY = 'postboy-sidebar-width';
const SIDEBAR_WIDTH_DEFAULT = 280;
const SIDEBAR_WIDTH_MIN = 200;
const SIDEBAR_WIDTH_MAX = 600;

function getStoredSidebarWidth(): number {
  try {
    const v = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (v != null) {
      const n = parseInt(v, 10);
      if (Number.isFinite(n) && n >= SIDEBAR_WIDTH_MIN && n <= SIDEBAR_WIDTH_MAX) return n;
    }
  } catch {
    /* ignore */
  }
  return SIDEBAR_WIDTH_DEFAULT;
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
  const getTabState = useRequestTabCloseStore((s) => s.getTabState);
  const { theme, toggleTheme } = useThemeStore();
  const [view, setView] = useState<View>('request');
  const [tabs, setTabs] = useState<RequestTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [pendingCloseTabId, setPendingCloseTabId] = useState<string | null>(null);
  const [runnerPreselectedCollection, setRunnerPreselectedCollection] = useState<string | null>(null);
  const [runnerPreselectedFolderPath, setRunnerPreselectedFolderPath] = useState<string[] | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(getStoredSidebarWidth);
  const sidebarResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

  const handleSidebarResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    sidebarResizeRef.current = { startX: e.clientX, startWidth: sidebarWidth };

    const onMove = (moveEvent: MouseEvent) => {
      const ref = sidebarResizeRef.current;
      if (!ref) return;
      const delta = moveEvent.clientX - ref.startX;
      const next = Math.max(SIDEBAR_WIDTH_MIN, Math.min(SIDEBAR_WIDTH_MAX, ref.startWidth + delta));
      sidebarResizeRef.current = { startX: moveEvent.clientX, startWidth: next };
      setSidebarWidth(next);
    };
    const onUp = () => {
      const w = sidebarResizeRef.current?.startWidth;
      sidebarResizeRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (w != null) {
        try {
          localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w));
        } catch {
          /* ignore */
        }
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp, { once: true });
  }, [sidebarWidth]);

  const handleNavigateToRunner = useCallback((collection: string, folderPath: string[] | null) => {
    setRunnerPreselectedCollection(collection);
    setRunnerPreselectedFolderPath(folderPath);
    setView('runner');
  }, []);

  const performCloseTab = useCallback((id: string) => {
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

  const handleCloseTab = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const tabState = getTabState(id);
    if (tabState?.isDirty) {
      setPendingCloseTabId(id);
      return;
    }
    performCloseTab(id);
  }, [getTabState, performCloseTab]);

  const handleCloseConfirmSave = useCallback(async () => {
    if (!pendingCloseTabId) return;
    const state = getTabState(pendingCloseTabId);
    if (state?.save) {
      await state.save();
    }
    performCloseTab(pendingCloseTabId);
    setPendingCloseTabId(null);
  }, [pendingCloseTabId, getTabState, performCloseTab]);

  const handleCloseConfirmDontSave = useCallback(() => {
    if (pendingCloseTabId) {
      performCloseTab(pendingCloseTabId);
      setPendingCloseTabId(null);
    }
  }, [pendingCloseTabId, performCloseTab]);

  const handleCloseConfirmCancel = useCallback(() => {
    setPendingCloseTabId(null);
  }, []);

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
          <div className="flex items-center gap-2">
            <img src="/postboy-logo.png" alt="" className={`h-14 w-auto max-w-[180px] shrink-0 object-contain object-left ${theme === 'dark' ? '[mix-blend-mode:screen]' : ''}`} aria-hidden />
            <span className="text-xl font-bold text-text-primary">PostBoy</span>
          </div>
          {workspace && (
            <span className="text-sm text-text-secondary">
              Workspace: <span className="font-semibold text-primary">{workspace.name}</span>
            </span>
          )}
          {currentEnvironment && (
            <>
              <span className="text-sm text-text-muted">•</span>
              <span className="text-sm text-text-secondary">
                Environment: <span className="font-semibold text-primary">{currentEnvironment}</span>
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('request')}
            className={`px-3 py-1 rounded text-sm ${
              view === 'request'
                ? 'bg-primary text-on-primary'
                : 'bg-surface border border-border text-text-primary hover:bg-surface-secondary'
            }`}
          >
            Request
          </button>
          <button
            onClick={() => setView('environment')}
            className={`px-3 py-1 rounded text-sm ${
              view === 'environment'
                ? 'bg-primary text-on-primary'
                : 'bg-surface border border-border text-text-primary hover:bg-surface-secondary'
            }`}
          >
            Environment
          </button>
          <button
            onClick={() => setView('runner')}
            className={`px-3 py-1 rounded text-sm ${
              view === 'runner'
                ? 'bg-primary text-on-primary'
                : 'bg-surface border border-border text-text-primary hover:bg-surface-secondary'
            }`}
          >
            Runner
          </button>
          <button
            onClick={() => setView('import')}
            className={`px-3 py-1 rounded text-sm ${
              view === 'import'
                ? 'bg-primary text-on-primary'
                : 'bg-surface border border-border text-text-primary hover:bg-surface-secondary'
            }`}
          >
            Import
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light theme' : 'Switch to Dark theme'}
            className="p-1.5 rounded text-text-secondary hover:text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label={theme === 'dark' ? 'Switch to Light theme' : 'Switch to Dark theme'}
          >
            {theme === 'dark' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
          <div className="ml-2 pl-4 border-l border-border">
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
        <div
          className="shrink-0 flex flex-col overflow-hidden border-r border-border"
          style={{ width: sidebarWidth, minWidth: SIDEBAR_WIDTH_MIN, maxWidth: SIDEBAR_WIDTH_MAX }}
        >
          <Sidebar onSelectRequest={handleSelectRequest} onNavigateToRunner={handleNavigateToRunner} />
        </div>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={sidebarWidth}
          aria-valuemin={SIDEBAR_WIDTH_MIN}
          aria-valuemax={SIDEBAR_WIDTH_MAX}
          tabIndex={0}
          onMouseDown={handleSidebarResizeStart}
          className="shrink-0 w-2 cursor-col-resize flex items-stretch justify-center group hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset select-none"
          title="Drag to resize collections pane"
        >
          <span className="w-0.5 bg-border group-hover:bg-primary group-active:bg-primary transition-colors rounded-full" aria-hidden />
        </div>
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden pt-6">
          {view === 'request' && (
            <>
              {tabs.length > 0 && (
                <div className="flex flex-nowrap items-center gap-0.5 border-b border-border bg-surface-secondary overflow-x-auto shrink-0 min-h-0">
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
                        className={`flex items-center gap-2 pl-3 pr-1 py-2 shrink-0 border-b-2 cursor-pointer transition-colors ${
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
                        <span className="text-sm font-medium whitespace-nowrap shrink-0" title={tab.request}>
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
          {view === 'runner' && (
            <CollectionRunner
              preselectedCollection={runnerPreselectedCollection}
              preselectedFolderPath={runnerPreselectedFolderPath}
              onPreselectedConsumed={() => {
                setRunnerPreselectedCollection(null);
                setRunnerPreselectedFolderPath(null);
              }}
            />
          )}
          {view === 'import' && <PostmanImport />}
        </main>
      </div>

      {/* Save before close tab dialog */}
      {pendingCloseTabId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleCloseConfirmCancel}>
          <div
            className="bg-surface rounded-lg shadow-xl p-6 max-w-md w-full mx-4 border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-text-primary mb-2">Save changes?</h3>
            <p className="text-text-secondary mb-4">
              This request has unsaved changes. Save before closing?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCloseConfirmCancel}
                className="px-4 py-2 text-sm font-medium text-text-secondary bg-surface-secondary hover:bg-surface rounded border border-border"
              >
                Cancel
              </button>
              <button
                onClick={handleCloseConfirmDontSave}
                className="px-4 py-2 text-sm font-medium text-text-secondary bg-surface-secondary hover:bg-surface rounded border border-border"
              >
                Don&apos;t Save
              </button>
              <button
                onClick={handleCloseConfirmSave}
                className="px-4 py-2 text-sm font-medium text-on-primary bg-primary hover:bg-primary-hover rounded"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
