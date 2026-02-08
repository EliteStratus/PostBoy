import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { useRequestStore } from '../stores/requestStore';
import { useCollectionsStore } from '../stores/collectionsStore';
import { useEnvironmentsStore } from '../stores/environmentsStore';
import { useRequestTabCloseStore } from '../stores/requestTabCloseStore';
import { useThemeStore } from '../stores/themeStore';
import { executeRequest } from '../utils/httpExecutor';
import { getAuthHeaders } from '../utils/requestBuilder';
import { requestTabId } from '../utils/requestTabId';
import type { Request, HttpMethod, RequestBody, AuthType } from '../types';
import ResponseViewer from './ResponseViewer';
import { VariableHighlight } from './VariableHighlight';

function requestDeepEqual(a: Request | null, b: Request | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

type RequestPaneTab = 'query-params' | 'headers' | 'body' | 'authorization' | 'scripts';

interface RequestEditorProps {
  collection?: string;
  folder?: string[] | null;
  requestName?: string;
}

export default function RequestEditor({ collection, folder, requestName }: RequestEditorProps) {
  const tabId = requestTabId(collection ?? '', folder ?? null, requestName ?? '');
  const { getRequest, createRequest, updateRequest } = useCollectionsStore();
  const { getCurrentEnvironment } = useEnvironmentsStore();
  const { setCurrentRequest, setResponseForTab, setExecuting, isExecuting } = useRequestStore();
  const response = useRequestStore((s) => s.responsesByTab[tabId]?.response ?? null);
  const error = useRequestStore((s) => s.responsesByTab[tabId]?.error ?? null);
  const { setTabState } = useRequestTabCloseStore();
  const theme = useThemeStore((s) => s.theme);
  const monacoTheme = theme === 'dark' ? 'vs-dark' : 'vs';

  const [request, setRequest] = useState<Request | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [showMethodDropdown, setShowMethodDropdown] = useState(false);
  const [requestPaneTab, setRequestPaneTab] = useState<RequestPaneTab>('query-params');
  const [scriptTab, setScriptTab] = useState<'pre-request' | 'post-response'>('pre-request');
  const RESPONSE_PANE_STORAGE_KEY = 'postboy-response-pane-height';
  const [responsePaneHeight, setResponsePaneHeight] = useState(() => {
    try {
      const s = localStorage.getItem(RESPONSE_PANE_STORAGE_KEY);
      if (s) {
        const n = parseInt(s, 10);
        if (!isNaN(n) && n >= 200 && n <= 600) return n;
      }
    } catch (_) {}
    return 320;
  });
  const [bodyEditorWidth, setBodyEditorWidth] = useState<number>(0);
  const [bodyEditorHeight, setBodyEditorHeight] = useState<number>(300);
  const [scriptEditorWidth, setScriptEditorWidth] = useState<number>(0);
  const [scriptEditorHeight, setScriptEditorHeight] = useState<number>(280);
  const bodyEditorContainerRef = useRef<HTMLDivElement>(null);
  const scriptEditorContainerRef = useRef<HTMLDivElement>(null);
  const lastRawBodyRef = useRef<{ raw: string; rawLanguage: 'json' | 'xml' | 'text' }>({ raw: '', rawLanguage: 'json' });
  const responsePaneHeightRef = useRef(responsePaneHeight);
  const saveCallbackRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const handleResizerDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = responsePaneHeight;
    responsePaneHeightRef.current = startHeight;
    const onMove = (moveEvent: MouseEvent) => {
      const delta = startY - moveEvent.clientY;
      const newHeight = Math.min(600, Math.max(200, startHeight + delta));
      responsePaneHeightRef.current = newHeight;
      setResponsePaneHeight(newHeight);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      try {
        localStorage.setItem(RESPONSE_PANE_STORAGE_KEY, String(responsePaneHeightRef.current));
      } catch (_) {}
    };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [responsePaneHeight]);

  // Memoize environment to avoid recreating context on every render
  const currentEnvironment = getCurrentEnvironment();
  const variableContext = useMemo(() => ({ environment: currentEnvironment || undefined }), [currentEnvironment]);

  useEffect(() => {
    if (collection && requestName) {
      const req = getRequest(collection, folder || null, requestName);
      if (req) {
        setRequest({
          ...req,
          auth: req.auth?.type ? req.auth : { type: 'inherit' },
        });
        setCurrentRequest(req);
        setIsNew(false);
      }
    } else {
      // Create new request
      const newRequest: Request = {
        name: 'New Request',
        method: 'GET',
        url: '',
        headers: [],
        queryParams: [],
        auth: { type: 'inherit' },
      };
      setRequest(newRequest);
      setCurrentRequest(newRequest);
      setIsNew(true);
    }
  }, [collection, folder, requestName, getRequest, setCurrentRequest]);

  // Keep last raw body in ref so we can restore when switching back to Raw
  useEffect(() => {
    if (request?.body?.mode === 'raw') {
      lastRawBodyRef.current = {
        raw: request.body.raw ?? '',
        rawLanguage: (request.body.rawLanguage as 'json' | 'xml' | 'text') ?? 'json',
      };
    }
  }, [request?.body?.mode, request?.body?.raw, request?.body?.rawLanguage]);

  // Resize observer so Request Body editor resizes with window
  useEffect(() => {
    const el = bodyEditorContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry?.contentRect) {
        setBodyEditorWidth(entry.contentRect.width);
        setBodyEditorHeight(entry.contentRect.height);
      }
    });
    ro.observe(el);
    const rect = el.getBoundingClientRect();
    setBodyEditorWidth(rect.width);
    setBodyEditorHeight(rect.height);
    return () => ro.disconnect();
  }, [requestPaneTab, request?.body?.mode]);

  // Resize observer so Scripts editor resizes when response pane divider is moved
  useEffect(() => {
    const el = scriptEditorContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry?.contentRect) {
        setScriptEditorWidth(entry.contentRect.width);
        setScriptEditorHeight(entry.contentRect.height);
      }
    });
    ro.observe(el);
    const rect = el.getBoundingClientRect();
    setScriptEditorWidth(rect.width);
    setScriptEditorHeight(rect.height);
    return () => ro.disconnect();
  }, [requestPaneTab]);

  const handleSave = useCallback(async () => {
    if (!request || !collection) return;
    try {
      if (isNew) {
        await createRequest(collection, folder || null, request);
        setIsNew(false);
      } else {
        await updateRequest(collection, folder || null, request.name, request);
      }
      const tabId = requestTabId(collection, folder || null, request.name);
      setTabState(tabId, { isDirty: false, save: () => saveCallbackRef.current?.() ?? Promise.resolve() });
    } catch (error) {
      console.error('Failed to save request:', error);
    }
  }, [request, collection, folder, isNew, createRequest, updateRequest, setTabState]);

  saveCallbackRef.current = handleSave;

  // Register tab dirty/save state for close-without-save prompt
  useEffect(() => {
    if (!collection || !requestName || !request) return;
    const tabId = requestTabId(collection, folder || null, requestName);
    const savedRequest = getRequest(collection, folder || null, requestName) ?? null;
    const normalizedSaved =
      savedRequest && savedRequest.auth?.type
        ? { ...savedRequest, auth: savedRequest.auth }
        : savedRequest
          ? { ...savedRequest, auth: { type: 'inherit' as const } }
          : null;
    const isDirty = isNew || !requestDeepEqual(request, normalizedSaved);
    setTabState(tabId, {
      isDirty,
      save: async () => {
        await saveCallbackRef.current?.();
      },
    });
    return () => {
      setTabState(tabId, null);
    };
  }, [collection, folder, requestName, request, isNew, getRequest, setTabState]);

  const handleExecute = async () => {
    if (!request) return;

    setExecuting(true);
    setResponseForTab(tabId, null, null);

    try {
      const environment = getCurrentEnvironment();
      
      // Check if URL has unresolved variables before executing
      if (request.url.includes('{{') && request.url.includes('}}')) {
        const { extractVariables } = await import('../utils/variableSubstitution');
        const variables = extractVariables(request.url);
        const unresolved = variables.filter(v => {
          if (!environment) return true;
          const envVar = environment.variables.find(ev => ev.key === v.trim() && ev.enabled);
          return !envVar;
        });
        
        if (unresolved.length > 0) {
          setResponseForTab(tabId, null, `Unresolved variables in URL: ${unresolved.join(', ')}. Please set these in your environment.`);
          setExecuting(false);
          return;
        }
      }
      
      const httpResponse = await executeRequest(request, { environment: environment || undefined });
      setResponseForTab(tabId, httpResponse, null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Request failed';
      setResponseForTab(tabId, null, errorMessage);
      console.error('Request execution error:', err);
    } finally {
      setExecuting(false);
    }
  };

  if (!request) {
    return (
      <div className="p-8 text-center text-text-muted">
        Select a request or create a new one
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="p-4 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-4 mb-4">
          {/* Custom HTTP Method Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMethodDropdown(!showMethodDropdown)}
              className={`h-8 min-w-[100px] text-left flex items-center justify-between font-semibold rounded-xl px-4 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-surface transition-all duration-200 bg-input-bg border border-input-border hover:border-primary/30 ${
                request.method === 'GET' ? 'text-method-get' :
                request.method === 'POST' ? 'text-method-post' :
                request.method === 'PUT' ? 'text-method-put' :
                request.method === 'PATCH' ? 'text-method-patch' :
                request.method === 'DELETE' ? 'text-method-delete' :
                'text-text-primary'
              }`}
            >
              <span>{request.method}</span>
              <svg className={`w-4 h-4 ml-2 transition-transform duration-200 ${showMethodDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showMethodDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMethodDropdown(false)}
                />
                <div className="absolute top-full left-0 mt-2 bg-surface border border-border rounded-xl shadow-xl ring-1 ring-black/5 py-1 z-20 min-w-[100px] overflow-hidden">
                  <button
                    type="button"
                    onClick={async () => {
                      const newMethod: HttpMethod = 'GET';
                      const updatedRequest = { ...request, method: newMethod };
                      setRequest(updatedRequest);
                      setCurrentRequest(updatedRequest);
                      setShowMethodDropdown(false);
                      if (collection && requestName && !isNew) {
                        await updateRequest(collection, folder || null, requestName, { method: newMethod });
                      }
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-primary-soft text-method-get font-semibold transition-colors first:pt-2.5"
                  >
                    GET
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const newMethod: HttpMethod = 'POST';
                      const updatedRequest = { ...request, method: newMethod };
                      setRequest(updatedRequest);
                      setCurrentRequest(updatedRequest);
                      setShowMethodDropdown(false);
                      if (collection && requestName && !isNew) {
                        await updateRequest(collection, folder || null, requestName, { method: newMethod });
                      }
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-primary-soft text-method-post font-semibold transition-colors"
                  >
                    POST
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const newMethod: HttpMethod = 'PUT';
                      const updatedRequest = { ...request, method: newMethod };
                      setRequest(updatedRequest);
                      setCurrentRequest(updatedRequest);
                      setShowMethodDropdown(false);
                      if (collection && requestName && !isNew) {
                        await updateRequest(collection, folder || null, requestName, { method: newMethod });
                      }
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-primary-soft text-method-put font-semibold transition-colors"
                  >
                    PUT
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const newMethod: HttpMethod = 'PATCH';
                      const updatedRequest = { ...request, method: newMethod };
                      setRequest(updatedRequest);
                      setCurrentRequest(updatedRequest);
                      setShowMethodDropdown(false);
                      if (collection && requestName && !isNew) {
                        await updateRequest(collection, folder || null, requestName, { method: newMethod });
                      }
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-primary-soft text-method-patch font-semibold transition-colors"
                  >
                    PATCH
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const newMethod: HttpMethod = 'DELETE';
                      const updatedRequest = { ...request, method: newMethod };
                      setRequest(updatedRequest);
                      setCurrentRequest(updatedRequest);
                      setShowMethodDropdown(false);
                      if (collection && requestName && !isNew) {
                        await updateRequest(collection, folder || null, requestName, { method: newMethod });
                      }
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-primary-soft text-method-delete font-semibold transition-colors last:pb-2.5"
                  >
                    DELETE
                  </button>
                </div>
              </>
            )}
          </div>
          <div className="h-8 flex-1 relative bg-input-bg rounded border border-input-border focus-within:ring-2 focus-within:ring-primary flex items-center">
            <input
              type="text"
              value={request.url}
              onChange={(e) => {
                const newUrl = e.target.value;
                setRequest({ ...request, url: newUrl });
              }}
              className="w-full h-full rounded px-3 py-0 focus:outline-none bg-transparent relative z-10 border-0"
              style={{ color: 'transparent', caretColor: 'var(--color-text-primary)' }}
              placeholder="https://api.example.com/endpoint"
            />
            <div className="absolute inset-0 pointer-events-none px-3 flex items-center overflow-hidden z-20" style={{ color: 'var(--color-text-primary)' }}>
              {request.url ? (
                <VariableHighlight
                  text={request.url}
                  context={variableContext}
                />
              ) : (
                <span style={{ color: 'var(--color-text-muted)' }}>https://api.example.com/endpoint</span>
              )}
            </div>
          </div>
          <button
            onClick={handleExecute}
            disabled={isExecuting || !request.url?.trim()}
            className="h-8 bg-primary text-on-primary px-4 rounded hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-surface-secondary flex items-center"
          >
            {isExecuting ? 'Sending...' : 'Send'}
          </button>
          {collection && (
            <button
              onClick={handleSave}
              className="h-8 bg-surface border border-border text-text-primary px-4 rounded hover:bg-surface-secondary flex items-center"
            >
              Save
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Request pane tabs — width sized to tab title, no flex-grow */}
        <div className="flex flex-nowrap border-b border-border bg-surface shrink-0 gap-0 overflow-x-auto min-h-0">
          {[
            { id: 'query-params' as const, label: 'Params' },
            { id: 'authorization' as const, label: 'Authorization' },
            { id: 'headers' as const, label: 'Headers' },
            { id: 'body' as const, label: 'Body' },
            { id: 'scripts' as const, label: 'Scripts' },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setRequestPaneTab(id)}
              className={`shrink-0 whitespace-nowrap px-3 py-1.5 text-sm border-b-2 transition-colors ${
                requestPaneTab === id
                  ? 'border-primary text-text-primary font-semibold bg-surface-secondary'
                  : 'border-transparent text-text-secondary font-medium hover:text-text-primary hover:bg-surface-secondary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 flex flex-col min-h-0 overflow-auto p-4 min-w-0">
          <div className={`flex flex-col min-h-0 w-full min-w-0 ${(requestPaneTab === 'body' && request?.body?.mode === 'raw') || requestPaneTab === 'scripts' || requestPaneTab === 'authorization' ? 'flex-1' : ''}`}>
            {requestPaneTab === 'query-params' && (
          <div>
            <h3 className="font-semibold mb-3 text-text-primary">Query Parameters</h3>
            {/* Header row */}
            <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 items-center pb-2 mb-2 text-sm font-medium text-text-secondary border-b border-border">
              <div className="w-9 h-9 flex items-center justify-center" aria-hidden="true" />
              <div>Key</div>
              <div>Value</div>
              <div className="w-9 h-9 flex items-center justify-center" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              {request.queryParams.map((param, index) => (
                <div key={index} className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 items-center">
                  <label className="flex items-center justify-center w-9 h-9 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={param.enabled}
                      onChange={(e) => {
                        const newParams = [...request.queryParams];
                        newParams[index].enabled = e.target.checked;
                        setRequest({ ...request, queryParams: newParams });
                      }}
                      className="w-5 h-5 rounded border-input-border"
                    />
                  </label>
                  <input
                    type="text"
                    value={param.key}
                    onChange={(e) => {
                      const newParams = [...request.queryParams];
                      newParams[index].key = e.target.value;
                      setRequest({ ...request, queryParams: newParams });
                    }}
                    placeholder="Key"
                    className="border border-input-border rounded px-2 py-1.5 h-9 bg-input-bg"
                  />
                  <div className="relative bg-input-bg rounded border border-input-border h-9">
                    <input
                      type="text"
                      value={param.value}
                      onChange={(e) => {
                        const wasFocused = document.activeElement === e.target;
                        const newParams = [...request.queryParams];
                        newParams[index].value = e.target.value;
                        setRequest({ ...request, queryParams: newParams });
                        if (wasFocused && e.target instanceof HTMLInputElement) {
                          requestAnimationFrame(() => {
                            e.target.focus();
                            const len = e.target.value.length;
                            e.target.setSelectionRange(len, len);
                          });
                        }
                      }}
                      placeholder="Value"
                      className="w-full h-full rounded px-2 py-1.5 bg-transparent relative z-10 border-0"
                      style={{ color: 'transparent', caretColor: 'var(--color-text-primary)' }}
                    />
                    <div className="absolute inset-0 pointer-events-none px-2 py-1.5 flex items-center overflow-hidden z-20" style={{ color: 'var(--color-text-primary)' }}>
                      {param.value ? (
                        <VariableHighlight
                          text={param.value}
                          context={variableContext}
                        />
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>Value</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRequest({
                        ...request,
                        queryParams: request.queryParams.filter((_, i) => i !== index),
                      });
                    }}
                    className="flex items-center justify-center w-9 h-9 text-error hover:bg-error/10 rounded border border-transparent hover:border-error/30"
                    title="Remove parameter"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  setRequest({
                    ...request,
                    queryParams: [...request.queryParams, { key: '', value: '', enabled: true }],
                  });
                }}
                className="text-primary hover:text-primary-hover text-sm"
              >
                + Add Parameter
              </button>
            </div>
          </div>
            )}

            {requestPaneTab === 'headers' && (
          <div>
            <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 items-center pb-2 mb-2 text-sm font-medium text-text-secondary border-b border-border">
              <div className="w-9 h-9 flex items-center justify-center" aria-hidden="true" />
              <div>Key</div>
              <div>Value</div>
              <div className="w-9 h-9 flex items-center justify-center" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              {/* Auth-derived headers (read-only) in same table */}
              {getAuthHeaders(request, currentEnvironment || undefined).map((h, i) => (
                <div key={`auth-${i}`} className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 items-center">
                  <div className="w-9 h-9 flex items-center justify-center">
                    <input type="checkbox" checked readOnly disabled className="w-5 h-5 rounded border-input-border opacity-70" title="From Authorization (read-only)" />
                  </div>
                  <input
                    type="text"
                    readOnly
                    value={h.key}
                    className="border border-border rounded px-2 py-1.5 h-9 bg-surface-secondary text-text-secondary text-sm cursor-default"
                  />
                  <input
                    type="text"
                    readOnly
                    value={h.value}
                    className="border border-border rounded px-2 py-1.5 h-9 bg-surface-secondary text-text-secondary text-sm cursor-default"
                  />
                  <div className="w-9 h-9" aria-hidden="true" />
                </div>
              ))}
              {/* Cookie header (always sent by browser with credentials: include) - read-only. HttpOnly cookies (e.g. SESSION) are not visible in document.cookie. */}
              <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 items-center">
                <div className="w-9 h-9 flex items-center justify-center">
                  <input type="checkbox" checked readOnly disabled className="w-5 h-5 rounded border-input-border opacity-70" title="Sent by browser (read-only)" />
                </div>
                <input
                  type="text"
                  readOnly
                  value="Cookie"
                  className="border border-border rounded px-2 py-1.5 h-9 bg-surface-secondary text-text-secondary text-sm cursor-default"
                />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <input
                    type="text"
                    readOnly
                    value={typeof document !== 'undefined' && document.cookie ? document.cookie : '(sent by browser—may include HttpOnly cookies e.g. SESSION)'}
                    className="border border-border rounded px-2 py-1.5 h-9 bg-surface-secondary text-text-secondary text-sm cursor-default font-mono text-xs break-all"
                    title="HttpOnly cookies (e.g. from auth) are sent by the browser but not visible here"
                  />
                  {typeof document !== 'undefined' && !document.cookie && (
                    <span className="text-xs text-text-muted px-0.5">Included with request; value hidden for HttpOnly cookies.</span>
                  )}
                </div>
                <div className="w-9 h-9" aria-hidden="true" />
              </div>
              {request.headers.map((header, index) => (
                <div key={index} className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 items-center">
                  <label className="flex items-center justify-center w-9 h-9 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={header.enabled}
                      onChange={(e) => {
                        const newHeaders = [...request.headers];
                        newHeaders[index].enabled = e.target.checked;
                        setRequest({ ...request, headers: newHeaders });
                      }}
                      className="w-5 h-5 rounded border-input-border"
                    />
                  </label>
                  <input
                    type="text"
                    value={header.key}
                    onChange={(e) => {
                      const newHeaders = [...request.headers];
                      newHeaders[index].key = e.target.value;
                      setRequest({ ...request, headers: newHeaders });
                    }}
                    placeholder="Key"
                    className="border border-input-border rounded px-2 py-1.5 h-9 bg-input-bg"
                  />
                  <div className="relative bg-input-bg rounded border border-input-border h-9">
                    <input
                      type="text"
                      value={header.value}
                      onChange={(e) => {
                        const wasFocused = document.activeElement === e.target;
                        const newHeaders = [...request.headers];
                        newHeaders[index].value = e.target.value;
                        setRequest({ ...request, headers: newHeaders });
                        if (wasFocused && e.target instanceof HTMLInputElement) {
                          requestAnimationFrame(() => {
                            e.target.focus();
                            const len = e.target.value.length;
                            e.target.setSelectionRange(len, len);
                          });
                        }
                      }}
                      placeholder="Value"
                      className="w-full h-full rounded px-2 py-1.5 bg-transparent relative z-10 border-0"
                      style={{ color: 'transparent', caretColor: 'var(--color-text-primary)' }}
                    />
                    <div className="absolute inset-0 pointer-events-none px-2 py-1.5 flex items-center overflow-hidden z-20" style={{ color: 'var(--color-text-primary)' }}>
                      {header.value ? (
                        <VariableHighlight
                          text={header.value}
                          context={variableContext}
                        />
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>Value</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRequest({
                        ...request,
                        headers: request.headers.filter((_, i) => i !== index),
                      });
                    }}
                    className="flex items-center justify-center w-9 h-9 text-error hover:bg-error/10 rounded border border-transparent hover:border-error/30"
                    title="Remove header"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  setRequest({
                    ...request,
                    headers: [...request.headers, { key: '', value: '', enabled: true }],
                  });
                }}
                className="text-primary hover:text-primary-hover text-sm"
              >
                + Add Header
              </button>
            </div>
          </div>
            )}

            {requestPaneTab === 'authorization' && (
          <div className="flex flex-1 min-h-0 gap-0 min-w-0">
            {/* Left pane: Auth Type + description */}
            <div className="flex flex-col border-r border-border bg-surface-secondary shrink-0 min-w-[16rem] w-[calc(24rem-5px)] max-w-full pl-4 pr-4 overflow-auto">
              <label className="block text-sm font-medium text-text-primary mb-2 pt-0.5">Auth Type</label>
              <select
                value={request.auth?.type ?? 'inherit'}
                onChange={(e) => {
                  const type = e.target.value as AuthType;
                  setRequest({
                    ...request,
                    auth: { ...(request.auth || { type: 'inherit' }), type, username: undefined, password: undefined, token: undefined, oauth2Token: undefined, apiKeyKey: undefined, apiKeyValue: undefined, apiKeyAddTo: undefined },
                  });
                }}
                className="max-w-[14rem] w-full border border-input-border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary bg-input-bg text-text-primary text-sm"
              >
                <option value="inherit">Inherit from parent</option>
                <option value="none">No Auth</option>
                <option value="basic">Basic Auth</option>
                <option value="bearer">Bearer Token</option>
                <option value="oauth2">OAuth 2.0</option>
                <option value="api-key">API Key</option>
              </select>
              <div className="mt-6 text-sm text-text-secondary leading-relaxed bg-surface/60 rounded-md pt-3 pr-3 pb-3 pl-[8px] border border-border/60 break-words min-w-0 [overflow-wrap:anywhere]">
                {(!request.auth?.type || request.auth?.type === 'inherit') && (
                  <>Resolves the effective auth at runtime by walking up the tree (Folder → Collection → Workspace) to find the nearest non-inherit auth config. Applies that auth as if set on this request (e.g. sets <span className="font-medium text-text-secondary">Authorization</span> header or query param). Only the resolved auth is transmitted.</>
                )}
                {request.auth?.type === 'none' && (
                  <>Sends the request as defined (URL, headers, body) <span className="font-medium text-text-secondary">without adding</span> an Authorization header or auth-related query parameters.</>
                )}
                {request.auth?.type === 'bearer' && (
                  <>Adds header: <code className="text-xs bg-surface px-1 rounded">Authorization: Bearer &lt;token&gt;</code>. The token can include variables (e.g. <code className="text-xs bg-surface px-1 rounded">{'{{accessToken}}'}</code>). Transmitted as an HTTP request header.</>
                )}
                {request.auth?.type === 'basic' && (
                  <>Adds header: <code className="text-xs bg-surface px-1 rounded">Authorization: Basic &lt;base64(username:password)&gt;</code>. Builds <code className="text-xs bg-surface px-1 rounded">username:password</code> after variable substitution, UTF-8 encodes, Base64 encodes, and sets it as an HTTP request header.</>
                )}
                {request.auth?.type === 'api-key' && (
                  <>Key/value credential (e.g. from API gateways). <span className="font-medium text-text-secondary">If Header:</span> adds <code className="text-xs bg-surface px-1 rounded">&lt;key&gt;: &lt;value&gt;</code> (e.g. <code className="text-xs bg-surface px-1 rounded">x-api-key: &lt;value&gt;</code>). <span className="font-medium text-text-secondary">If Query:</span> appends <code className="text-xs bg-surface px-1 rounded">?&lt;key&gt;=&lt;value&gt;</code> (URL-encoded). Values can use variables like <code className="text-xs bg-surface px-1 rounded">{'{{apiKey}}'}</code>.</>
                )}
                {request.auth?.type === 'oauth2' && (
                  <>Uses the configured token to send an <span className="font-medium text-text-secondary">Authorization</span> header. Default: <code className="text-xs bg-surface px-1 rounded">Authorization: Bearer &lt;access_token&gt;</code>. Token type defaults to Bearer; header name defaults to Authorization. No token refresh or auth-code exchange in this version.</>
                )}
              </div>
            </div>
            {/* Right pane: attributes only (label | input in two columns) */}
            <div className="flex-1 min-w-0 pl-4 overflow-auto flex flex-col items-end">
              {request.auth?.type === 'basic' && (
                <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 items-center w-full min-w-0">
                  <label className="text-sm font-medium text-text-primary">Username</label>
                  <div className="relative bg-input-bg rounded border border-input-border focus-within:ring-2 focus-within:ring-primary h-9 min-w-0">
                      <input
                        type="text"
                        value={request.auth.username ?? ''}
                        onChange={(e) => {
                          const wasFocused = document.activeElement === e.target;
                          setRequest({ ...request, auth: { ...request.auth!, username: e.target.value } });
                          if (wasFocused && e.target instanceof HTMLInputElement) {
                            requestAnimationFrame(() => {
                              e.target.focus();
                              const len = e.target.value.length;
                              e.target.setSelectionRange(len, len);
                            });
                          }
                        }}
                        placeholder="Username"
                        className="w-full h-full rounded px-3 py-1.5 bg-transparent border-0 focus:outline-none relative z-10"
                        style={{ color: 'transparent', caretColor: 'var(--color-text-primary)' }}
                      />
                      <div className="absolute inset-0 pointer-events-none px-3 py-1.5 flex items-center overflow-hidden z-20" style={{ color: 'var(--color-text-primary)' }}>
                        {request.auth.username != null && request.auth.username !== '' ? (
                          <VariableHighlight text={request.auth.username} context={variableContext} />
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)' }}>Username</span>
                        )}
                      </div>
                    </div>
                  <label className="text-sm font-medium text-text-primary">Password</label>
                  <div className="relative bg-input-bg rounded border border-input-border focus-within:ring-2 focus-within:ring-primary h-9 min-w-0">
                      <input
                        type="text"
                        value={request.auth.password ?? ''}
                        onChange={(e) => {
                          const wasFocused = document.activeElement === e.target;
                          setRequest({ ...request, auth: { ...request.auth!, password: e.target.value } });
                          if (wasFocused && e.target instanceof HTMLInputElement) {
                            requestAnimationFrame(() => {
                              e.target.focus();
                              const len = e.target.value.length;
                              e.target.setSelectionRange(len, len);
                            });
                          }
                        }}
                        placeholder="Password"
                        className="w-full h-full rounded px-3 py-1.5 bg-transparent border-0 focus:outline-none relative z-10"
                        style={{ color: 'transparent', caretColor: 'var(--color-text-primary)' }}
                      />
                      <div className="absolute inset-0 pointer-events-none px-3 py-1.5 flex items-center overflow-hidden z-20" style={{ color: 'var(--color-text-primary)' }}>
                        {request.auth.password != null && request.auth.password !== '' ? (
                          <VariableHighlight text={request.auth.password} context={variableContext} />
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)' }}>Password</span>
                        )}
                      </div>
                    </div>
                </div>
              )}
              {request.auth?.type === 'bearer' && (
                <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 items-center w-full min-w-0">
                  <label className="text-sm font-medium text-text-primary">Token</label>
                  <div className="relative bg-input-bg rounded border border-input-border focus-within:ring-2 focus-within:ring-primary h-9 min-w-0">
                    <input
                      value={request.auth.token ?? ''}
                      onChange={(e) => {
                        const wasFocused = document.activeElement === e.target;
                        setRequest({ ...request, auth: { ...request.auth!, token: e.target.value } });
                        if (wasFocused && e.target instanceof HTMLInputElement) {
                          requestAnimationFrame(() => {
                            e.target.focus();
                            const len = e.target.value.length;
                            e.target.setSelectionRange(len, len);
                          });
                        }
                      }}
                      placeholder="Bearer token"
                      className="w-full h-full rounded px-3 py-1.5 bg-transparent border-0 focus:outline-none relative z-10"
                      style={{ color: 'transparent', caretColor: 'var(--color-text-primary)' }}
                    />
                    <div className="absolute inset-0 pointer-events-none px-3 py-1.5 flex items-center overflow-hidden z-20" style={{ color: 'var(--color-text-primary)' }}>
                      {request.auth.token ? (
                        <VariableHighlight text={request.auth.token} context={variableContext} />
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>Bearer token</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {request.auth?.type === 'oauth2' && (
                <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 items-center w-full min-w-0">
                  <label className="text-sm font-medium text-text-primary">Access Token</label>
                  <div className="relative bg-input-bg rounded border border-input-border focus-within:ring-2 focus-within:ring-primary h-9 min-w-0">
                    <input
                      value={request.auth.oauth2Token ?? ''}
                      onChange={(e) => {
                        const wasFocused = document.activeElement === e.target;
                        setRequest({ ...request, auth: { ...request.auth!, oauth2Token: e.target.value } });
                        if (wasFocused && e.target instanceof HTMLInputElement) {
                          requestAnimationFrame(() => {
                            e.target.focus();
                            const len = e.target.value.length;
                            e.target.setSelectionRange(len, len);
                          });
                        }
                      }}
                      placeholder="OAuth 2.0 access token"
                      className="w-full h-full rounded px-3 py-1.5 bg-transparent border-0 focus:outline-none relative z-10"
                      style={{ color: 'transparent', caretColor: 'var(--color-text-primary)' }}
                    />
                    <div className="absolute inset-0 pointer-events-none px-3 py-1.5 flex items-center overflow-hidden z-20" style={{ color: 'var(--color-text-primary)' }}>
                      {request.auth.oauth2Token ? (
                        <VariableHighlight text={request.auth.oauth2Token} context={variableContext} />
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>OAuth 2.0 access token</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {request.auth?.type === 'api-key' && (
                <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 items-center w-full min-w-0">
                  <label className="text-sm font-medium text-text-primary">Key</label>
                  <div className="relative bg-input-bg rounded border border-input-border focus-within:ring-2 focus-within:ring-primary h-9 min-w-0">
                      <input
                        type="text"
                        value={request.auth.apiKeyKey ?? ''}
                        onChange={(e) => {
                          const wasFocused = document.activeElement === e.target;
                          setRequest({ ...request, auth: { ...request.auth!, apiKeyKey: e.target.value } });
                          if (wasFocused && e.target instanceof HTMLInputElement) {
                            requestAnimationFrame(() => {
                              e.target.focus();
                              const len = e.target.value.length;
                              e.target.setSelectionRange(len, len);
                            });
                          }
                        }}
                        placeholder="e.g. X-API-Key"
                        className="w-full h-full rounded px-3 py-1.5 bg-transparent border-0 focus:outline-none relative z-10"
                        style={{ color: 'transparent', caretColor: 'var(--color-text-primary)' }}
                      />
                      <div className="absolute inset-0 pointer-events-none px-3 py-1.5 flex items-center overflow-hidden z-20" style={{ color: 'var(--color-text-primary)' }}>
                        {request.auth.apiKeyKey != null && request.auth.apiKeyKey !== '' ? (
                          <VariableHighlight text={request.auth.apiKeyKey} context={variableContext} />
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)' }}>e.g. X-API-Key</span>
                        )}
                      </div>
                    </div>
                  <label className="text-sm font-medium text-text-primary">Value</label>
                  <div className="relative bg-input-bg rounded border border-input-border focus-within:ring-2 focus-within:ring-primary h-9 min-w-0">
                      <input
                        value={request.auth.apiKeyValue ?? ''}
                        onChange={(e) => {
                          const wasFocused = document.activeElement === e.target;
                          setRequest({ ...request, auth: { ...request.auth!, apiKeyValue: e.target.value } });
                          if (wasFocused && e.target instanceof HTMLInputElement) {
                            requestAnimationFrame(() => {
                              e.target.focus();
                              const len = e.target.value.length;
                              e.target.setSelectionRange(len, len);
                            });
                          }
                        }}
                        placeholder="API key value"
                        className="w-full h-full rounded px-3 py-1.5 bg-transparent border-0 focus:outline-none relative z-10"
                        style={{ color: 'transparent', caretColor: 'var(--color-text-primary)' }}
                      />
                      <div className="absolute inset-0 pointer-events-none px-3 py-1.5 flex items-center overflow-hidden z-20" style={{ color: 'var(--color-text-primary)' }}>
                        {request.auth.apiKeyValue ? (
                          <VariableHighlight text={request.auth.apiKeyValue} context={variableContext} />
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)' }}>API key value</span>
                        )}
                      </div>
                    </div>
                  <label className="text-sm font-medium text-text-primary">Add to</label>
                  <select
                      value={request.auth.apiKeyAddTo ?? 'header'}
                      onChange={(e) => setRequest({ ...request, auth: { ...request.auth!, apiKeyAddTo: e.target.value as 'header' | 'query' } })}
                      className="w-full border border-input-border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary bg-input-bg text-text-primary"
                    >
                      <option value="header">Header</option>
                      <option value="query">Query Params</option>
                    </select>
                </div>
              )}
            </div>
          </div>
            )}

            {requestPaneTab === 'body' && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex flex-wrap items-center gap-3 mb-4 shrink-0">
              <select
                value={request.body?.mode || 'none'}
                onChange={(e) => {
                  const mode = e.target.value as RequestBody['mode'];
                  const current = request.body;
                  if (mode === 'none') {
                    if (current?.mode === 'raw') {
                      lastRawBodyRef.current = { raw: current.raw ?? '', rawLanguage: (current.rawLanguage as 'json' | 'xml' | 'text') ?? 'json' };
                    }
                    setRequest({ ...request, body: undefined });
                  } else if (mode === 'raw') {
                    const { raw, rawLanguage } = lastRawBodyRef.current;
                    setRequest({
                      ...request,
                      body: { mode: 'raw', raw, rawLanguage },
                    });
                  } else if (mode === 'formdata') {
                    if (current?.mode === 'raw') {
                      lastRawBodyRef.current = { raw: current.raw ?? '', rawLanguage: (current.rawLanguage as 'json' | 'xml' | 'text') ?? 'json' };
                    }
                    setRequest({
                      ...request,
                      body: { mode: 'formdata', formdata: [] },
                    });
                  } else if (mode === 'urlencoded') {
                    if (current?.mode === 'raw') {
                      lastRawBodyRef.current = { raw: current.raw ?? '', rawLanguage: (current.rawLanguage as 'json' | 'xml' | 'text') ?? 'json' };
                    }
                    setRequest({
                      ...request,
                      body: { mode: 'urlencoded', urlencoded: [] },
                    });
                  }
                }}
                className="h-8 rounded-xl border border-input-border bg-input-bg px-4 pr-10 text-sm font-medium text-text-primary shadow-md hover:shadow-lg hover:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 focus:ring-offset-surface focus:border-primary cursor-pointer appearance-none bg-no-repeat bg-[length:1.25rem_1.25rem] bg-[right_0.5rem_center] transition-all duration-200"
                style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23059669' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpath d='M6 9l6 6 6-6'/%3e%3c/svg%3e")` }}
              >
                <option value="none">None</option>
                <option value="formdata">Form Data</option>
                <option value="urlencoded">x-www-form-urlencoded</option>
                <option value="raw">Raw</option>
              </select>
              {request.body?.mode === 'raw' && (
                <select
                  value={request.body.rawLanguage || 'json'}
                  onChange={(e) => {
                    setRequest({
                      ...request,
                      body: {
                        ...request.body!,
                        rawLanguage: e.target.value as 'json' | 'xml' | 'text',
                      },
                    });
                  }}
                  className="h-8 rounded-xl border border-input-border bg-input-bg px-4 pr-10 text-sm font-medium text-text-primary shadow-md hover:shadow-lg hover:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 focus:ring-offset-surface focus:border-primary cursor-pointer appearance-none bg-no-repeat bg-[length:1.25rem_1.25rem] bg-[right_0.5rem_center] transition-all duration-200"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23059669' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpath d='M6 9l6 6 6-6'/%3e%3c/svg%3e")` }}
                >
                  <option value="json">JSON</option>
                  <option value="xml">XML</option>
                  <option value="text">Text</option>
                </select>
              )}
              {request.body?.mode === 'raw' && (request.body.rawLanguage === 'json' || request.body.rawLanguage === 'xml') && (
                <button
                  type="button"
                  onClick={() => {
                    const raw = request.body?.raw?.trim() ?? '';
                    if (!raw) return;
                    const lang = request.body?.rawLanguage || 'json';
                    try {
                      let formatted: string;
                      if (lang === 'json') {
                        formatted = JSON.stringify(JSON.parse(raw), null, 2);
                      } else if (lang === 'xml') {
                        const withNewlines = raw.replace(/><(?![\/\s])/g, '>\n<');
                        const lines = withNewlines.split('\n').map((l) => l.trim()).filter(Boolean);
                        let depth = 0;
                        const result: string[] = [];
                        for (const line of lines) {
                          const isClosing = line.startsWith('</');
                          const isSelfClosing = line.endsWith('/>') || line.startsWith('<?') || line.startsWith('<!');
                          if (isClosing) depth = Math.max(0, depth - 1);
                          result.push('  '.repeat(depth) + line);
                          if (!isClosing && !isSelfClosing && line.startsWith('<')) depth++;
                        }
                        formatted = result.join('\n');
                      } else {
                        return;
                      }
                      setRequest({
                        ...request,
                        body: { ...request.body!, raw: formatted },
                      });
                    } catch {
                      // invalid JSON/XML, do nothing
                    }
                  }}
                  className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-hover hover:underline focus:outline-none"
                  title="Format request body (JSON/XML)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 6.75l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                  </svg>
                  Beautify
                </button>
              )}
            </div>

            {request.body?.mode === 'raw' && (
              <div ref={bodyEditorContainerRef} className="flex-1 min-h-[200px] w-full min-w-0">
                <div className="border border-input-border rounded-lg bg-input-bg shadow-sm overflow-hidden w-full h-full">
                  <Editor
                    theme={monacoTheme}
                    width={bodyEditorWidth || '100%'}
                    height={bodyEditorHeight || 300}
                    language={request.body.rawLanguage || 'json'}
                    value={request.body.raw || ''}
                    onChange={(value: string | undefined) => {
                      setRequest({
                        ...request,
                        body: { ...request.body!, raw: value || '' },
                      });
                    }}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      lineNumbersMinChars: 3,
                    }}
                  />
                </div>
              </div>
            )}

            {request.body?.mode === 'formdata' && request.body.formdata && (
              <div className="space-y-2">
                {request.body.formdata.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={item.key}
                      onChange={(e) => {
                        const newItems = [...request.body!.formdata!];
                        newItems[index].key = e.target.value;
                        setRequest({ ...request, body: { ...request.body!, formdata: newItems } });
                      }}
                      placeholder="Key"
                      className="flex-1 border border-input-border rounded px-2 py-1 bg-input-bg"
                    />
                    <div className="flex-1 relative bg-input-bg rounded border border-input-border">
                      <input
                        type="text"
                        value={item.value}
                        onChange={(e) => {
                          const wasFocused = document.activeElement === e.target;
                          const newItems = [...request.body!.formdata!];
                          newItems[index].value = e.target.value;
                          setRequest({ ...request, body: { ...request.body!, formdata: newItems } });
                          if (wasFocused && e.target instanceof HTMLInputElement) {
                            requestAnimationFrame(() => {
                              e.target.focus();
                              const len = e.target.value.length;
                              e.target.setSelectionRange(len, len);
                            });
                          }
                        }}
                        placeholder="Value"
                        className="w-full rounded px-2 py-1 bg-transparent relative z-10 border-0"
                        style={{ color: 'transparent', caretColor: 'var(--color-text-primary)' }}
                      />
                      <div className="absolute inset-0 pointer-events-none px-2 py-1 flex items-center overflow-hidden z-20" style={{ color: 'var(--color-text-primary)' }}>
                        {item.value ? (
                          <VariableHighlight
                            text={item.value}
                            context={variableContext}
                          />
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)' }}>Value</span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const newItems = request.body!.formdata!.filter((_, i) => i !== index);
                        setRequest({ ...request, body: { ...request.body!, formdata: newItems } });
                      }}
                      className="flex items-center justify-center text-error hover:opacity-90 p-1"
                      title="Remove field"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    setRequest({
                      ...request,
                      body: {
                        ...request.body!,
                        formdata: [...request.body!.formdata!, { key: '', value: '', type: 'text', enabled: true }],
                      },
                    });
                  }}
                  className="text-primary hover:text-primary-hover text-sm"
                >
                  + Add Field
                </button>
              </div>
            )}

            {request.body?.mode === 'urlencoded' && request.body.urlencoded && (
              <div className="space-y-2">
                {request.body.urlencoded.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={item.key}
                      onChange={(e) => {
                        const newItems = [...request.body!.urlencoded!];
                        newItems[index].key = e.target.value;
                        setRequest({ ...request, body: { ...request.body!, urlencoded: newItems } });
                      }}
                      placeholder="Key"
                      className="flex-1 border border-input-border rounded px-2 py-1 bg-input-bg"
                    />
                    <div className="flex-1 relative bg-input-bg rounded border border-input-border">
                      <input
                        type="text"
                        value={item.value}
                        onChange={(e) => {
                          const wasFocused = document.activeElement === e.target;
                          const newItems = [...request.body!.urlencoded!];
                          newItems[index].value = e.target.value;
                          setRequest({ ...request, body: { ...request.body!, urlencoded: newItems } });
                          if (wasFocused && e.target instanceof HTMLInputElement) {
                            requestAnimationFrame(() => {
                              e.target.focus();
                              const len = e.target.value.length;
                              e.target.setSelectionRange(len, len);
                            });
                          }
                        }}
                        placeholder="Value"
                        className="w-full rounded px-2 py-1 bg-transparent relative z-10 border-0"
                        style={{ color: 'transparent', caretColor: 'var(--color-text-primary)' }}
                      />
                      <div className="absolute inset-0 pointer-events-none px-2 py-1 flex items-center overflow-hidden z-20" style={{ color: 'var(--color-text-primary)' }}>
                        {item.value ? (
                          <VariableHighlight
                            text={item.value}
                            context={variableContext}
                          />
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)' }}>Value</span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const newItems = request.body!.urlencoded!.filter((_, i) => i !== index);
                        setRequest({ ...request, body: { ...request.body!, urlencoded: newItems } });
                      }}
                      className="flex items-center justify-center text-error hover:opacity-90 p-1"
                      title="Remove field"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button
                    onClick={() => {
                      setRequest({
                        ...request,
                        body: {
                          ...request.body!,
                          urlencoded: [...request.body!.urlencoded!, { key: '', value: '', type: 'text', enabled: true }],
                        },
                      });
                    }}
                  className="text-primary hover:text-primary-hover text-sm"
                >
                  + Add Field
                </button>
              </div>
            )}
          </div>
            )}

            {requestPaneTab === 'scripts' && (
          <div className="flex flex-1 min-h-0 gap-0">
            {/* Vertical tabs */}
            <div className="flex flex-col border-r border-border bg-surface-secondary shrink-0 w-40">
              <button
                type="button"
                onClick={() => setScriptTab('pre-request')}
                className={`px-4 py-2.5 text-left text-sm font-medium border-l-2 transition-colors ${
                  scriptTab === 'pre-request'
                    ? 'border-primary text-text-primary bg-surface'
                    : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-surface'
                }`}
              >
                Pre Request
              </button>
              <button
                type="button"
                onClick={() => setScriptTab('post-response')}
                className={`px-4 py-2.5 text-left text-sm font-medium border-l-2 transition-colors ${
                  scriptTab === 'post-response'
                    ? 'border-primary text-text-primary bg-surface'
                    : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-surface'
                }`}
              >
                Post Response
              </button>
            </div>
            {/* Script editor */}
            <div ref={scriptEditorContainerRef} className="flex-1 min-w-0 flex flex-col border border-input-border rounded bg-input-bg overflow-hidden min-h-[200px]">
              <Editor
                theme={monacoTheme}
                width={scriptEditorWidth || '100%'}
                height={scriptEditorHeight || 280}
                language="javascript"
                value={scriptTab === 'pre-request' ? (request.preRequestScript || '') : (request.postResponseScript || '')}
                onChange={(value: string | undefined) => {
                  if (scriptTab === 'pre-request') {
                    setRequest({ ...request, preRequestScript: value || '' });
                  } else {
                    setRequest({ ...request, postResponseScript: value || '' });
                  }
                }}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbersMinChars: 3,
                }}
              />
            </div>
          </div>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* Resizable divider */}
      <div
        role="separator"
        aria-label="Resize request and response panes"
        onMouseDown={handleResizerDown}
        className="h-1.5 flex-shrink-0 bg-surface-secondary hover:bg-border cursor-ns-resize select-none transition-colors"
      />

      {/* Response pane - always visible */}
      <div
        style={{ height: responsePaneHeight }}
        className="flex-shrink-0 flex flex-col min-h-[200px] border-t border-border bg-surface overflow-hidden"
      >
        <ResponseViewer response={response} error={error} />
      </div>
    </div>
  );
}
