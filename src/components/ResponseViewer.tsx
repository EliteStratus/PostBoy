import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { useThemeStore } from '../stores/themeStore';
import type { HttpResponse } from '../types';

type ResponseTab = 'body' | 'cookies' | 'headers';

interface ResponseViewerProps {
  response: HttpResponse | null;
  error: string | null;
}

function formatTime(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${ms} ms`;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function getStatusColorClass(status: number): string {
  if (status >= 200 && status < 300) return 'bg-status-2xx/15 text-status-2xx border-status-2xx/30';
  if (status >= 300 && status < 400) return 'bg-status-3xx/15 text-status-3xx border-status-3xx/30';
  if (status >= 400 && status < 500) return 'bg-status-4xx/15 text-status-4xx border-status-4xx/30';
  return 'bg-status-5xx/15 text-status-5xx border-status-5xx/30';
}

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

export default function ResponseViewer({ response, error }: ResponseViewerProps) {
  const theme = useThemeStore((s) => s.theme);
  const monacoTheme = theme === 'dark' ? 'vs-dark' : 'vs';
  const [activeTab, setActiveTab] = useState<ResponseTab>('body');
  const [viewMode, setViewMode] = useState<'pretty' | 'raw'>('pretty');

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-4 px-4 h-[38px] border-b border-border bg-surface-secondary shrink-0">
          <div className="flex gap-1">
            {(['body', 'cookies', 'headers'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 text-sm font-medium capitalize rounded-t transition-colors ${
                  activeTab === tab
                    ? 'bg-surface text-text-primary border-b-2 border-primary'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <span className="px-2.5 py-0.5 rounded-md text-sm font-bold bg-status-5xx/15 text-status-5xx border border-status-5xx/30">
            Error
          </span>
        </div>
        <div className="p-4 flex-1 overflow-auto">
          <div className="bg-error/10 border border-error/20 rounded-lg p-4">
            <h3 className="font-semibold text-error mb-2">Error</h3>
            <p className="text-error">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-4 px-4 h-[38px] border-b border-border bg-surface-secondary shrink-0">
          <div className="flex gap-1">
            {(['body', 'cookies', 'headers'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 text-sm font-medium capitalize rounded-t transition-colors ${
                  activeTab === tab
                    ? 'bg-surface text-text-primary border-b-2 border-primary'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex-1" />
        </div>
        <div className="flex-1 flex items-center justify-center text-text-muted text-sm p-4">
          Send a request to see the response
        </div>
      </div>
    );
  }

  const getContentType = () => {
    const contentType = response.headers['content-type'] || response.headers['Content-Type'] || '';
    return contentType.toLowerCase();
  };

  const formatBody = () => {
    const contentType = getContentType();
    if (contentType.includes('application/json')) {
      try {
        return JSON.stringify(JSON.parse(response.body), null, 2);
      } catch {
        return response.body;
      }
    }
    return response.body;
  };

  const getLanguage = () => {
    const contentType = getContentType();
    if (contentType.includes('application/json')) return 'json';
    if (contentType.includes('application/xml') || contentType.includes('text/xml')) return 'xml';
    if (contentType.includes('text/html')) return 'html';
    return 'text';
  };

  const setCookieHeaders = Object.entries(response.headers).filter(
    ([k]) => k.toLowerCase() === 'set-cookie'
  );
  // Support multiple Set-Cookie: newline-separated (from executor) or comma-separated
  const cookies = setCookieHeaders.flatMap(([, v]) =>
    typeof v === 'string'
      ? v.split(/\n/).flatMap((line) => line.split(/,\s*(?=\w+=)/).map((s) => s.trim())).filter(Boolean)
      : []
  );

  const statusColorClass = getStatusColorClass(response.status);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Tabs row + status, timing, size */}
      <div className="flex items-center gap-4 px-4 h-[38px] border-b border-border bg-surface-secondary shrink-0">
        <div className="flex gap-1">
          {(['body', 'cookies', 'headers'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 text-sm font-medium capitalize rounded-t transition-colors ${
                activeTab === tab
                  ? 'bg-surface text-text-primary border-b-2 border-primary font-semibold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab}
              {tab === 'headers' && Object.keys(response.headers).length > 0 && (
                <span className="ml-1.5 text-xs opacity-80">({Object.keys(response.headers).length})</span>
              )}
              {tab === 'cookies' && cookies.length > 0 && (
                <span className="ml-1.5 text-xs opacity-80">({cookies.length})</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-0" />
        <div className="flex items-center gap-3 shrink-0 font-bold">
          <span
            className={`px-2.5 py-0.5 rounded-md text-sm font-bold border ${statusColorClass}`}
            title="Response status"
          >
            {getStatusWithText(response.status, response.statusText)}
          </span>
          <span className="text-sm text-text-primary font-bold" title="Time">
            {formatTime(response.time)}
          </span>
          <span className="text-sm text-text-primary font-bold" title="Size">
            {formatSize(response.size)}
          </span>
          {activeTab === 'body' && (
            <button
              onClick={() => setViewMode(viewMode === 'pretty' ? 'raw' : 'pretty')}
              className="text-sm font-semibold text-primary hover:text-primary-hover hover:underline pl-3 ml-3 border-l border-border"
              title={viewMode === 'pretty' ? 'Show raw response' : 'Show pretty-printed response'}
            >
              {viewMode === 'pretty' ? 'Raw' : 'Pretty'}
            </button>
          )}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-auto p-4">
        {activeTab === 'body' && (
          <div className="h-full min-h-[240px]">
            <div className="border border-border rounded-lg bg-input-bg overflow-hidden" style={{ height: '100%', minHeight: '240px' }}>
              <Editor
                theme={monacoTheme}
                height="100%"
                language={getLanguage()}
                value={
                  viewMode === 'raw'
                    ? response.body
                    : formatBody()
                }
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbersMinChars: 3,
                  wordWrap: viewMode === 'raw' ? 'on' : 'off',
                }}
              />
            </div>
          </div>
        )}

        {activeTab === 'cookies' && (
          <div>
            {cookies.length === 0 ? (
              <p className="text-text-muted text-sm">No cookies in response</p>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-surface-secondary">
                    <tr>
                      <th className="w-[30%] min-w-[120px] px-3 py-2 text-left font-semibold text-text-primary">Name</th>
                      <th className="px-3 py-2 text-left font-semibold text-text-primary">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cookies.map((cookie, i) => {
                      const eq = cookie.indexOf('=');
                      const name = eq >= 0 ? cookie.slice(0, eq).trim() : cookie;
                      const value = eq >= 0 ? cookie.slice(eq + 1).trim() : '—';
                      return (
                        <tr key={i} className="border-t border-border">
                          <td className="w-[30%] min-w-[120px] px-3 py-2 font-mono font-semibold text-text-primary align-top">{name}</td>
                          <td className="px-3 py-2 font-mono text-text-secondary break-all">{value}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'headers' && (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-secondary">
                <tr>
                  <th className="w-[30%] min-w-[150px] px-3 py-2 text-left font-bold text-text-primary">Name</th>
                  <th className="px-3 py-2 text-left font-bold text-text-primary">Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(response.headers).map(([key, value]) => (
                  <tr key={key} className="border-t border-border">
                    <td className="w-[30%] min-w-[150px] px-3 py-2 font-mono font-semibold text-text-primary align-top">{key}</td>
                    <td className="px-3 py-2 font-mono text-text-secondary break-all">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
