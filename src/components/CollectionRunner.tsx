import { useState, useEffect } from 'react';
import { useRunnerStore } from '../stores/runnerStore';
import { useCollectionsStore } from '../stores/collectionsStore';
import { useEnvironmentsStore } from '../stores/environmentsStore';
import { executeRequest } from '../utils/httpExecutor';
import { substituteVariables } from '../utils/variableSubstitution';
import type { Collection, Folder, Request } from '../types';

const DEFAULT_STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  204: 'No Content',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  408: 'Request Timeout',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

function getStatusWithText(status: number, statusText: string): string {
  const text = statusText?.trim() || DEFAULT_STATUS_TEXT[status];
  return text ? `${status} ${text}` : String(status);
}

// Tree nodes for run scope
export type RunTreeNode =
  | { type: 'folder'; id: string; name: string; path: string[]; children: RunTreeNode[]; enabled: boolean }
  | { type: 'request'; id: string; request: Request; path: string[]; enabled: boolean };

function getFolderAtPath(collection: Collection, folderPath: string[]): Folder | null {
  if (folderPath.length === 0) return null;
  let current: Folder[] = collection.folders;
  for (let i = 0; i < folderPath.length; i++) {
    const name = folderPath[i];
    const folder = current.find((f) => f.name === name);
    if (!folder) return null;
    if (i === folderPath.length - 1) return folder;
    current = folder.folders;
  }
  return null;
}

function buildRunTree(
  collection: Collection,
  folderPath: string[] | null,
  baseId: string
): RunTreeNode[] {
  const nodes: RunTreeNode[] = [];
  let folderContents: { requests: Request[]; folders: Folder[] };
  let pathPrefix: string[];

  if (folderPath === null || folderPath.length === 0) {
    folderContents = { requests: collection.requests, folders: collection.folders };
    pathPrefix = [];
  } else {
    const folder = getFolderAtPath(collection, folderPath);
    if (!folder) return [];
    folderContents = { requests: folder.requests, folders: folder.folders };
    pathPrefix = [...folderPath];
  }

  let idx = 0;
  folderContents.requests.forEach((req) => {
    nodes.push({
      type: 'request',
      id: `${baseId}-r-${idx++}`,
      request: req,
      path: pathPrefix,
      enabled: true,
    });
  });

  folderContents.folders.forEach((f, fi) => {
    const childPath = [...pathPrefix, f.name];
    const childId = `${baseId}-f-${fi}`;
    const children: RunTreeNode[] = [];
    let ri = 0;
    f.requests.forEach((req) => {
      children.push({
        type: 'request',
        id: `${childId}-r-${ri++}`,
        request: req,
        path: childPath,
        enabled: true,
      });
    });
    f.folders.forEach((sub, si) => {
      children.push(...buildRunTreeFromFolder(sub, childPath, `${childId}-${si}`));
    });
    nodes.push({
      type: 'folder',
      id: childId,
      name: f.name,
      path: childPath,
      children,
      enabled: true,
    });
  });

  return nodes;
}

function buildRunTreeFromFolder(folder: Folder, parentPath: string[], baseId: string): RunTreeNode[] {
  const path = [...parentPath, folder.name];
  const nodes: RunTreeNode[] = [];
  let idx = 0;
  folder.requests.forEach((req) => {
    nodes.push({
      type: 'request',
      id: `${baseId}-r-${idx++}`,
      request: req,
      path,
      enabled: true,
    });
  });
  folder.folders.forEach((f, fi) => {
    nodes.push(...buildRunTreeFromFolder(f, path, `${baseId}-f-${fi}`));
  });
  return [
    {
      type: 'folder',
      id: baseId,
      name: folder.name,
      path: parentPath,
      children: nodes,
      enabled: true,
    },
  ];
}

function flattenEnabledRequests(nodes: RunTreeNode[]): Request[] {
  const out: Request[] = [];
  function walk(n: RunTreeNode) {
    if (n.type === 'request') {
      if (n.enabled) out.push(n.request);
      return;
    }
    n.children.forEach(walk);
  }
  nodes.forEach(walk);
  return out;
}

function setNodeEnabled(nodes: RunTreeNode[], id: string, enabled: boolean): RunTreeNode[] {
  return nodes.map((n) => {
    if (n.id === id) {
      if (n.type === 'folder') {
        return { ...n, enabled, children: setAllEnabled(n.children, enabled) };
      }
      return { ...n, enabled };
    }
    if (n.type === 'folder') {
      return { ...n, children: setNodeEnabled(n.children, id, enabled) };
    }
    return n;
  });
}

function setAllEnabled(nodes: RunTreeNode[], enabled: boolean): RunTreeNode[] {
  return nodes.map((n) => {
    if (n.type === 'folder') {
      return { ...n, enabled, children: setAllEnabled(n.children, enabled) };
    }
    return { ...n, enabled };
  });
}

function collectFolderIds(nodes: RunTreeNode[]): Set<string> {
  const ids = new Set<string>();
  function walk(n: RunTreeNode) {
    if (n.type === 'folder') {
      ids.add(n.id);
      n.children.forEach(walk);
    }
  }
  nodes.forEach(walk);
  return ids;
}

interface CollectionRunnerProps {
  preselectedCollection?: string | null;
  preselectedFolderPath?: string[] | null;
  onPreselectedConsumed?: () => void;
}

export default function CollectionRunner({
  preselectedCollection,
  preselectedFolderPath,
  onPreselectedConsumed,
}: CollectionRunnerProps) {
  const { startRun, addResult, finishRun, isRunning, currentRun, progress, stopRun, clearRun } = useRunnerStore();
  const { collections } = useCollectionsStore();
  const { getCurrentEnvironment, environments } = useEnvironmentsStore();

  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [runTree, setRunTree] = useState<RunTreeNode[]>([]);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  const [iterations, setIterations] = useState(1);
  const [delay, setDelay] = useState(0);
  const [requestsExpanded, setRequestsExpanded] = useState(true);
  const [resultsExpanded, setResultsExpanded] = useState(false);

  // When preselected, set collection and build tree
  useEffect(() => {
    if (preselectedCollection && collections[preselectedCollection]) {
      setSelectedCollection(preselectedCollection);
      const collection = collections[preselectedCollection];
      const tree = buildRunTree(collection, preselectedFolderPath ?? null, 'root');
      setRunTree(tree);
      setExpandedFolderIds(new Set()); // all collapsed
      onPreselectedConsumed?.();
    }
  }, [preselectedCollection, preselectedFolderPath, collections]);

  const handleCollectionChange = (value: string) => {
    setSelectedCollection(value);
    if (value) {
      const tree = buildRunTree(collections[value], null, 'root');
      setRunTree(tree);
      setExpandedFolderIds(new Set());
    } else {
      setRunTree([]);
    }
  };

  const toggleFolderExpanded = (id: string) => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setNodeEnabledById = (id: string, enabled: boolean) => {
    setRunTree((prev) => setNodeEnabled(prev, id, enabled));
  };

  const handleSelectAll = () => setRunTree((prev) => setAllEnabled(prev, true));
  const handleDeselectAll = () => setRunTree((prev) => setAllEnabled(prev, false));
  const handleExpandAll = () => setExpandedFolderIds(collectFolderIds(runTree));
  const handleCollapseAll = () => setExpandedFolderIds(new Set());

  const requestsToRun = flattenEnabledRequests(runTree);

  const resultCounts = currentRun
    ? (() => {
        let success = 0;
        let failed = 0;
        let attention = 0;
        for (const r of currentRun.results) {
          if (r.error) failed++;
          else if (r.response) {
            const s = r.response.status;
            if (s >= 200 && s < 300) success++;
            else if (s >= 400) failed++;
            else attention++;
          } else failed++;
        }
        return { success, failed, attention };
      })()
    : null;

  const handleRun = async () => {
    if (!selectedCollection || requestsToRun.length === 0) return;

    const collection = collections[selectedCollection];
    if (!collection) return;

    clearRun();
    setRequestsExpanded(false);
    setResultsExpanded(true);

    const environment = getCurrentEnvironment();
    startRun(selectedCollection, environment?.name);

    const totalRequests = requestsToRun.length * iterations;
    let completed = 0;

    for (let iter = 0; iter < iterations; iter++) {
      const currentState = useRunnerStore.getState();
      if (!currentState.isRunning) break;

      for (let i = 0; i < requestsToRun.length; i++) {
        const state = useRunnerStore.getState();
        if (!state.isRunning) break;

        const request = requestsToRun[i];
        completed++;
        const progressValue = Math.round((completed / totalRequests) * 100);
        useRunnerStore.getState().setProgress(progressValue);

        try {
          const response = await executeRequest(request, { environment: environment || undefined });
          addResult({ request, response, timestamp: new Date().toISOString() });
        } catch (error) {
          addResult({
            request,
            error: error instanceof Error ? error.message : 'Request failed',
            timestamp: new Date().toISOString(),
          });
        }

        if (delay > 0 && (i < requestsToRun.length - 1 || iter < iterations - 1)) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    finishRun();
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'text-method-get';
      case 'POST': return 'text-method-post';
      case 'PUT': return 'text-method-put';
      case 'PATCH': return 'text-method-patch';
      case 'DELETE': return 'text-method-delete';
      default: return 'text-text-secondary';
    }
  };

  function renderTreeNode(nodes: RunTreeNode[], depth: number) {
    return nodes.map((node) => {
      if (node.type === 'request') {
        return (
          <div
            key={node.id}
            className="flex items-center gap-2 py-1.5 pr-2 hover:bg-surface-secondary/50 rounded"
            style={{ paddingLeft: `${depth * 20 + 8}px` }}
          >
            <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
              <input
                type="checkbox"
                checked={node.enabled}
                onChange={(e) => setNodeEnabledById(node.id, e.target.checked)}
                disabled={isRunning}
                className="w-4 h-4 rounded border-input-border shrink-0"
              />
              <span className={`text-xs font-semibold shrink-0 ${getMethodColor(node.request.method)}`}>
                {node.request.method}
              </span>
              <span className="text-sm text-text-primary truncate" title={node.request.name}>
                {node.request.name}
              </span>
            </label>
          </div>
        );
      }
      const isExpanded = expandedFolderIds.has(node.id);
      return (
        <div key={node.id}>
          <div
            className="flex items-center gap-2 py-1.5 pr-2 hover:bg-surface-secondary/50 rounded cursor-pointer"
            style={{ paddingLeft: `${depth * 20 + 8}px` }}
            onClick={() => toggleFolderExpanded(node.id)}
          >
            <span className="w-4 h-4 flex items-center justify-center shrink-0 text-text-muted">
              {isExpanded ? '▼' : '▶'}
            </span>
            <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={node.enabled}
                onChange={(e) => setNodeEnabledById(node.id, e.target.checked)}
                disabled={isRunning}
                className="w-4 h-4 rounded border-input-border shrink-0"
              />
              <span className="text-sm font-medium text-text-primary">{node.name}</span>
            </label>
          </div>
          {isExpanded && (
            <div className="border-l border-border ml-2" style={{ marginLeft: `${depth * 20 + 16}px` }}>
              {renderTreeNode(node.children, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  }

  return (
    <div className="h-full flex flex-col px-6 pb-6 min-h-0">
      <div className="mb-4 shrink-0">
        <h2 className="text-2xl font-bold text-text-primary mb-4">Collection Runner</h2>

        <div className="bg-surface rounded-lg shadow border border-border p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[180px]">
              <label className="block text-sm font-medium text-text-primary mb-2">Collection</label>
              <select
                value={selectedCollection}
                onChange={(e) => handleCollectionChange(e.target.value)}
                disabled={isRunning}
                className="w-full border border-input-border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 bg-input-bg text-text-primary"
              >
                <option value="">Select</option>
                {Object.keys(collections).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-24">
              <label className="block text-sm font-medium text-text-primary mb-2">Iterations</label>
              <input
                type="number"
                value={iterations}
                onChange={(e) => setIterations(Math.max(1, Number(e.target.value) || 1))}
                min={1}
                disabled={isRunning}
                className="w-full border border-input-border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 bg-input-bg text-text-primary"
              />
            </div>

            <div className="w-28">
              <label className="block text-sm font-medium text-text-primary mb-2">Interval (ms)</label>
              <input
                type="number"
                value={delay}
                onChange={(e) => setDelay(Math.max(0, Number(e.target.value) || 0))}
                min={0}
                disabled={isRunning}
                className="w-full border border-input-border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 bg-input-bg text-text-primary"
              />
            </div>

            <div className="ml-auto flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleRun}
                disabled={isRunning || !selectedCollection || requestsToRun.length === 0}
                className={`px-6 py-2 rounded text-sm font-medium ${
                  isRunning || !selectedCollection || requestsToRun.length === 0
                    ? 'bg-surface border border-border text-text-muted cursor-not-allowed'
                    : 'bg-primary text-white hover:bg-primary-hover'
                }`}
              >
                {isRunning ? 'Running...' : 'Run'}
              </button>
              {isRunning && (
                <button
                  onClick={stopRun}
                  className="bg-error text-white px-6 py-2 rounded hover:bg-error/90 text-sm font-medium"
                >
                  Stop
                </button>
              )}
            </div>
          </div>

          {isRunning && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-text-secondary">Progress</span>
                <span className="text-sm text-text-secondary">{progress}%</span>
              </div>
              <div className="w-full bg-surface-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Requests + Results: share vertical space only when a section is expanded (avoids gap when both collapsed) */}
      <div
        className={`flex flex-col min-h-0 gap-0 ${
          (requestsExpanded && selectedCollection && runTree.length > 0) || (resultsExpanded && currentRun)
            ? 'flex-1'
            : ''
        }`}
      >
        {/* Requests: collapsible section, expanded by default; uses remaining space when Results collapsed */}
        {selectedCollection && runTree.length > 0 && (
          <div
            className={`flex flex-col min-h-0 ${resultsExpanded ? 'shrink-0' : 'flex-1'}`}
          >
            <div
              className="flex items-center justify-between py-2 cursor-pointer select-none border-b border-border shrink-0"
              onClick={() => setRequestsExpanded((e) => !e)}
            >
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 flex items-center justify-center text-text-muted shrink-0">
                  {requestsExpanded ? '▼' : '▶'}
                </span>
                <h3 className="text-lg font-semibold text-text-primary">
                  Requests
                  <span className="font-bold text-primary ml-1">
                    ({requestsToRun.length})
                  </span>
                </h3>
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  disabled={isRunning}
                  className="text-sm text-primary hover:text-primary-hover disabled:opacity-50"
                >
                  Select All
                </button>
                <span className="text-text-muted">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  disabled={isRunning}
                  className="text-sm text-primary hover:text-primary-hover disabled:opacity-50"
                >
                  Deselect All
                </button>
                <span className="text-text-muted">|</span>
                <button
                  type="button"
                  onClick={handleExpandAll}
                  disabled={isRunning}
                  className="text-sm text-primary hover:text-primary-hover disabled:opacity-50"
                >
                  Expand All
                </button>
                <span className="text-text-muted">|</span>
                <button
                  type="button"
                  onClick={handleCollapseAll}
                  disabled={isRunning}
                  className="text-sm text-primary hover:text-primary-hover disabled:opacity-50"
                >
                  Collapse All
                </button>
              </div>
            </div>
            {requestsExpanded && (
              <div
                className={`bg-surface rounded-lg border border-border overflow-auto py-1 mt-2 min-h-0 ${
                  resultsExpanded ? 'max-h-[280px]' : 'flex-1'
                }`}
              >
                {renderTreeNode(runTree, 0)}
              </div>
            )}
          </div>
        )}

        {/* Results: collapsible section, expanded when run starts */}
        <div
          className={`flex flex-col min-h-0 ${resultsExpanded ? 'flex-1' : 'shrink-0'}`}
        >
        <div
          className={`flex items-center justify-between py-2 cursor-pointer select-none border-b border-border ${currentRun ? '' : 'opacity-70'}`}
          onClick={() => currentRun && setResultsExpanded((e) => !e)}
        >
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 flex items-center justify-center text-text-muted shrink-0">
              {resultsExpanded ? '▼' : '▶'}
            </span>
            <h3 className="text-lg font-semibold text-text-primary">
              Results
              {resultCounts && (
                <span className="font-bold ml-1">
                  {resultCounts.success > 0 && (
                    <span className="text-[var(--color-success)]">{resultCounts.success} Success</span>
                  )}
                  {resultCounts.failed > 0 && (
                    <>
                      {resultCounts.success > 0 && <span className="text-text-muted mx-1">·</span>}
                      <span className="text-error">{resultCounts.failed} Failed</span>
                    </>
                  )}
                  {resultCounts.attention > 0 && (
                    <>
                      {(resultCounts.success > 0 || resultCounts.failed > 0) && (
                        <span className="text-text-muted mx-1">·</span>
                      )}
                      <span className="text-warning">{resultCounts.attention} Attention</span>
                    </>
                  )}
                  {resultCounts.success === 0 && resultCounts.failed === 0 && resultCounts.attention === 0 && (
                    <span className="text-text-secondary font-normal">(0)</span>
                  )}
                </span>
              )}
            </h3>
          </div>
          {currentRun && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clearRun();
              }}
              className="text-sm text-primary hover:text-primary-hover"
            >
              Clear
            </button>
          )}
        </div>
        {resultsExpanded && currentRun && (
          <div className="bg-surface rounded-lg shadow border border-border flex-1 min-h-0 overflow-auto mt-2">
            {currentRun.endTime && (
              <p className="text-sm text-text-secondary px-4 pt-4">
                Completed in {currentRun.totalTime}ms
              </p>
            )}
            <div className="p-4">
              <div className="space-y-2">
                {currentRun.results.map((result, index) => {
                  const getStatusColor = () => {
                    if (result.error) return 'text-error';
                    if (!result.response) return 'text-text-secondary';
                    const s = result.response.status;
                    if (s >= 200 && s < 300) return 'text-status-2xx';
                    if (s >= 400) return 'text-error';
                    return 'text-warning';
                  };
                  const getCardStyle = () => {
                    if (result.error) return 'border-error/20 bg-error/10';
                    if (!result.response) return 'border-error/20 bg-error/10';
                    const s = result.response.status;
                    if (s >= 200 && s < 300) return 'border-success/20 bg-success/10';
                    if (s >= 400) return 'border-error/20 bg-error/10';
                    return 'border-warning/20 bg-warning/10';
                  };
                  const env = currentRun.environmentName ? environments[currentRun.environmentName] : undefined;
                  const resolvedUrl = substituteVariables(result.request.url, { environment: env });
                  const endpointDisplay = `${result.request.method} ${resolvedUrl}`;

                  return (
                    <div
                      key={index}
                      className={`p-3 border rounded ${getCardStyle()}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                        <span className="font-semibold text-text-primary">{result.request.name}</span>
                        <div className="flex items-center gap-x-4 flex-shrink-0">
                          {result.response && (
                            <span className={`text-sm font-semibold ${getStatusColor()}`}>
                              {getStatusWithText(result.response.status, result.response.statusText)}
                            </span>
                          )}
                          {result.error && (
                            <span className="text-sm font-semibold text-error">Error</span>
                          )}
                          {result.response && (
                            <>
                              <span className="text-sm text-text-secondary">{result.response.time}ms</span>
                              <span className="text-sm text-text-secondary">{result.response.size} bytes</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-text-muted mt-1 truncate" title={endpointDisplay}>
                        {endpointDisplay}
                      </div>
                      {result.error && (
                        <div className="text-sm text-error mt-1">{result.error}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
