import { useState } from 'react';
import { useRunnerStore } from '../stores/runnerStore';
import { useCollectionsStore } from '../stores/collectionsStore';
import { useEnvironmentsStore } from '../stores/environmentsStore';
import { executeRequest } from '../utils/httpExecutor';
import type { Collection, Request, RunResult } from '../types';

export default function CollectionRunner() {
  const { startRun, addResult, finishRun, isRunning, currentRun, progress, stopRun } = useRunnerStore();
  const { collections } = useCollectionsStore();
  const { getCurrentEnvironment } = useEnvironmentsStore();
  
  const [selectedCollection, setSelectedCollection] = useState<string>('');
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

    for (let i = 0; i < requests.length; i++) {
      const currentState = useRunnerStore.getState();
      if (!currentState.isRunning) break;

      const { request } = requests[i];

      // Update progress
      const progressValue = Math.round(((i + 1) / requests.length) * 100);
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

      // Delay between requests
      if (delay > 0 && i < requests.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    finishRun();
  };

  return (
    <div className="h-full flex flex-col px-6 pb-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-text-primary mb-4">Collection Runner</h2>
        
        <div className="bg-surface rounded-lg shadow border border-border p-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Select Collection
              </label>
              <select
                value={selectedCollection}
                onChange={(e) => setSelectedCollection(e.target.value)}
                disabled={isRunning}
                className="w-full border border-input-border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 bg-input-bg"
              >
                <option value="">-- Select Collection --</option>
                {Object.keys(collections).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Delay between requests (ms)
              </label>
              <input
                type="number"
                value={delay}
                onChange={(e) => setDelay(Number(e.target.value))}
                min="0"
                disabled={isRunning}
                className="w-full border border-input-border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 bg-input-bg"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleRun}
                disabled={isRunning || !selectedCollection}
                className="bg-primary text-white px-6 py-2 rounded hover:bg-primary-hover disabled:opacity-50 disabled:bg-primary-soft"
              >
                {isRunning ? 'Running...' : 'Run Collection'}
              </button>
              {isRunning && (
                <button
                  onClick={stopRun}
                  className="bg-error text-white px-6 py-2 rounded hover:bg-error/90"
                >
                  Stop
                </button>
              )}
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
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-text-primary">
                          {result.request.method} {result.request.name}
                        </span>
                        {result.response && (
                          <span className={`text-sm font-semibold ${getStatusColor()}`}>
                            {result.response.status} {result.response.statusText}
                          </span>
                        )}
                        {result.error && (
                          <span className="text-sm font-semibold text-error">Error</span>
                        )}
                      </div>
                      {result.response && (
                        <div className="text-sm text-text-secondary">
                          {result.response.time}ms • {result.response.size} bytes
                        </div>
                      )}
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
