import { useState } from 'react';
import { useRunnerStore } from '../stores/runnerStore';
import { useCollectionsStore } from '../stores/collectionsStore';
import { useEnvironmentsStore } from '../stores/environmentsStore';
import { executeRequest } from '../utils/httpExecutor';
import { substituteVariables } from '../utils/variableSubstitution';
import type { Collection, Request, RunResult } from '../types';

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

export default function CollectionRunner() {
  const { startRun, addResult, finishRun, isRunning, currentRun, progress, stopRun } = useRunnerStore();
  const { collections } = useCollectionsStore();
  const { getCurrentEnvironment, environments } = useEnvironmentsStore();
  
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [iterations, setIterations] = useState(1);
  const [delay, setDelay] = useState(0);

  const getAllRequests = (collection: Collection): Array<{ request: Request; path: string[] }> => {
    const requests: Array<{ request: Request; path: string[] }> = [];
    
    collection.requests.forEach((req) => {
      requests.push({ request: req, path: [] });
    });

    const processFolders = (folders: typeof collection.folders, currentPath: string[]) => {
      folders.forEach((folder) => {
        folder.requests.forEach((req) => {
          requests.push({ request: req, path: [...currentPath, folder.name] });
        });
        processFolders(folder.folders, [...currentPath, folder.name]);
      });
    };

    processFolders(collection.folders, []);

    return requests;
  };

  const handleRun = async () => {
    if (!selectedCollection) return;

    const collection = collections[selectedCollection];
    if (!collection) return;

    const environment = getCurrentEnvironment();
    const requests = getAllRequests(collection);

    startRun(selectedCollection, environment?.name);

    const totalRequests = requests.length * iterations;
    let completed = 0;

    for (let iter = 0; iter < iterations; iter++) {
      const currentState = useRunnerStore.getState();
      if (!currentState.isRunning) break;

      for (let i = 0; i < requests.length; i++) {
        const state = useRunnerStore.getState();
        if (!state.isRunning) break;

        const { request } = requests[i];

        completed++;
        const progressValue = Math.round((completed / totalRequests) * 100);
        const runnerStore = useRunnerStore.getState();
        runnerStore.setProgress(progressValue);

        try {
          const response = await executeRequest(request, { environment: environment || undefined });
          const result: RunResult = {
            request,
            response,
            timestamp: new Date().toISOString(),
          };
          addResult(result);
        } catch (error) {
          const result: RunResult = {
            request,
            error: error instanceof Error ? error.message : 'Request failed',
            timestamp: new Date().toISOString(),
          };
          addResult(result);
        }

        if (delay > 0 && (i < requests.length - 1 || iter < iterations - 1)) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    finishRun();
  };

  return (
    <div className="h-full flex flex-col px-6 pb-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-text-primary mb-4">Collection Runner</h2>
        
        <div className="bg-surface rounded-lg shadow border border-border p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[180px]">
              <label className="block text-sm font-medium text-text-primary mb-2">
                Collection
              </label>
              <select
                value={selectedCollection}
                onChange={(e) => setSelectedCollection(e.target.value)}
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
              <label className="block text-sm font-medium text-text-primary mb-2">
                Iterations
              </label>
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
              <label className="block text-sm font-medium text-text-primary mb-2">
                Interval (ms)
              </label>
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
                disabled={isRunning || !selectedCollection}
                className={`px-6 py-2 rounded text-sm font-medium ${
                  isRunning || !selectedCollection
                    ? 'bg-surface border border-border text-text-muted cursor-not-allowed'
                    : 'bg-primary text-white hover:bg-primary-hover'
                }`}
              >
                {isRunning ? 'Running...' : 'Run Collection'}
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

      {currentRun && (
        <div className="flex-1 overflow-auto">
          <div className="bg-surface rounded-lg shadow border border-border">
            <div className="p-4 border-b border-border">
              <h3 className="text-lg font-semibold text-text-primary">
                Run Results ({currentRun.results.length} requests)
              </h3>
              {currentRun.endTime && (
                <p className="text-sm text-text-secondary mt-1">
                  Completed in {currentRun.totalTime}ms
                </p>
              )}
            </div>
            <div className="p-4">
              <div className="space-y-2">
                {currentRun.results.map((result, index) => {
                  const getStatusColor = () => {
                    if (result.error) return 'text-error';
                    if (!result.response) return 'text-text-secondary';
                    if (result.response.status >= 500) return 'text-status-5xx';
                    if (result.response.status >= 400) return 'text-status-4xx';
                    if (result.response.status >= 300) return 'text-status-3xx';
                    return 'text-status-2xx';
                  };
                  const env = currentRun.environmentName ? environments[currentRun.environmentName] : undefined;
                  const resolvedUrl = substituteVariables(result.request.url, { environment: env });
                  const endpointDisplay = `${result.request.method} ${resolvedUrl}`;

                  return (
                    <div
                      key={index}
                      className={`p-3 border rounded ${
                        result.error
                          ? 'border-error/20 bg-error/10'
                          : result.response && result.response.status >= 400
                          ? 'border-warning/20 bg-warning/10'
                          : 'border-success/20 bg-success/10'
                      }`}
                    >
                      {/* Row 1: API Name left, response params (status, time, bytes) right */}
                      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                        <span className="font-semibold text-text-primary">
                          {result.request.name}
                        </span>
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
                      {/* Row 2: endpoint invoked with resolved variables */}
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
        </div>
      )}
    </div>
  );
}
