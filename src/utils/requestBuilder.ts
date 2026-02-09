import type { Request, RequestAuth, Environment } from '../types';
import { substituteVariables, type VariableContext } from './variableSubstitution';

/** Remove characters invalid in HTTP header values to avoid "Invalid header value" errors (proxy/fetch). */
function sanitizeHeaderValue(value: string): string {
  return value
    .replace(/[\r\n\x00-\x1f\x7f]/g, '')
    .replace(/["\\]/g, '')
    .trim();
}

/** Cookie values may contain = ; " — only strip control chars so they are not corrupted. */
function sanitizeCookieValue(value: string): string {
  return value.replace(/[\r\n\x00-\x1f\x7f]/g, '').trim();
}

/** Sanitize header name for safe use in requests. */
function sanitizeHeaderName(name: string): string {
  return name.replace(/[\r\n\x00-\x1f\x7f]/g, '').trim().slice(0, 256);
}

export interface BuiltRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string | FormData;
}

export function buildRequest(
  request: Request,
  environment?: Environment
): BuiltRequest {
  const context: VariableContext = {
    environment,
  };

  // Substitute variables in URL
  let url = substituteVariables(request.url, context);
  
  // Build query string
  const queryParams = request.queryParams
    .filter(p => p.enabled)
    .map(p => {
      const key = substituteVariables(p.key, context);
      const value = substituteVariables(p.value, context);
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    });
  
  if (queryParams.length > 0) {
    const separator = url.includes('?') ? '&' : '?';
    url += separator + queryParams.join('&');
  }

  // Build headers (sanitize keys and values to avoid "Invalid header value" at proxy)
  const headers: Record<string, string> = {};
  const auth: RequestAuth | undefined = request.auth?.type ? request.auth : { type: 'inherit' };
  const authSetsAuthorization = auth.type === 'basic' || auth.type === 'bearer' || (auth.type === 'oauth2' && auth.oauth2Token != null);
  request.headers
    .filter(h => h.enabled)
    .forEach(h => {
      const key = sanitizeHeaderName(substituteVariables(h.key, context));
      if (!key) return;
      // Don't allow a manual Authorization header to override or duplicate auth—avoids "Invalid header value"
      if (key.toLowerCase() === 'authorization') {
        if (authSetsAuthorization) return;
        // Never send placeholder values even when no auth type is set (avoids proxy "Invalid header value")
        const rawValue = substituteVariables(h.value, context);
        const v = sanitizeHeaderValue(rawValue);
        if (v.toLowerCase().trim() === 'value' || (v.length < 20 && !v.startsWith('Bearer ') && !v.startsWith('Basic '))) return;
      }
      const rawValue = substituteVariables(h.value, context);
      const value = key.toLowerCase() === 'cookie' ? sanitizeCookieValue(rawValue) : sanitizeHeaderValue(rawValue);
      // Only skip Cookie when it's the read-only placeholder (so real cookie-based auth still works)
      if (key.toLowerCase() === 'cookie' && (value === '' || value.includes('Sent by browser with request'))) return;
      if (value) headers[key] = value;
    });

  // Apply authorization (overwrites any remaining Authorization key)
  if (auth.type === 'basic' && auth.username != null) {
    const username = substituteVariables(auth.username, context);
    const password = substituteVariables(auth.password ?? '', context);
    headers['Authorization'] = 'Basic ' + btoa(unescape(encodeURIComponent(username + ':' + password)));
  } else if (auth.type === 'bearer' && auth.token != null) {
    headers['Authorization'] = 'Bearer ' + sanitizeHeaderValue(substituteVariables(auth.token, context));
  } else if (auth.type === 'oauth2' && auth.oauth2Token != null) {
    headers['Authorization'] = 'Bearer ' + sanitizeHeaderValue(substituteVariables(auth.oauth2Token, context));
  } else if (auth.type === 'api-key' && auth.apiKeyKey != null && auth.apiKeyValue != null) {
    const key = sanitizeHeaderName(substituteVariables(auth.apiKeyKey, context));
    const value = sanitizeHeaderValue(substituteVariables(auth.apiKeyValue, context));
    if (auth.apiKeyAddTo === 'query') {
      const sep = url.includes('?') ? '&' : '?';
      url += sep + encodeURIComponent(key) + '=' + encodeURIComponent(value);
    } else if (key && value) {
      headers[key] = value;
    }
  }
  // inherit / none: no header added

  // Build body
  let body: string | FormData | undefined;
  
  if (request.body && request.body.mode !== 'none') {
    if (request.body.mode === 'formdata' && request.body.formdata) {
      const formData = new FormData();
      request.body.formdata
        .filter(item => item.enabled)
        .forEach(item => {
          const key = substituteVariables(item.key, context);
          const value = substituteVariables(item.value, context);
          if (item.type === 'file') {
            // File handling would need File System API
            // For now, treat as text
            formData.append(key, value);
          } else {
            formData.append(key, value);
          }
        });
      body = formData;
    } else if (request.body.mode === 'urlencoded' && request.body.urlencoded) {
      const params = new URLSearchParams();
      request.body.urlencoded
        .filter(item => item.enabled)
        .forEach(item => {
          const key = substituteVariables(item.key, context);
          const value = substituteVariables(item.value, context);
          params.append(key, value);
        });
      body = params.toString();
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    } else if (request.body.mode === 'raw' && request.body.raw) {
      body = substituteVariables(request.body.raw, context);
      if (request.body.rawLanguage === 'json') {
        headers['Content-Type'] = 'application/json';
      } else if (request.body.rawLanguage === 'xml') {
        headers['Content-Type'] = 'application/xml';
      } else {
        headers['Content-Type'] = 'text/plain';
      }
    }
  }

  return {
    url,
    method: request.method,
    headers,
    body,
  };
}

/** Returns headers that will be added by auth (for readonly display in Headers tab). */
export function getAuthHeaders(
  request: Request,
  environment?: Environment
): Array<{ key: string; value: string }> {
  const result: Array<{ key: string; value: string }> = [];
  const context: VariableContext = { environment };
  const auth: RequestAuth | undefined = request.auth?.type ? request.auth : { type: 'inherit' };
  if (auth.type === 'basic' && auth.username != null) {
    const username = substituteVariables(auth.username, context);
    const password = substituteVariables(auth.password ?? '', context);
    result.push({ key: 'Authorization', value: 'Basic ' + btoa(unescape(encodeURIComponent(username + ':' + password))) });
  } else if (auth.type === 'bearer' && auth.token != null) {
    result.push({ key: 'Authorization', value: 'Bearer ' + sanitizeHeaderValue(substituteVariables(auth.token, context)) });
  } else if (auth.type === 'oauth2' && auth.oauth2Token != null) {
    result.push({ key: 'Authorization', value: 'Bearer ' + sanitizeHeaderValue(substituteVariables(auth.oauth2Token, context)) });
  } else if (auth.type === 'api-key' && auth.apiKeyKey != null && auth.apiKeyValue != null && auth.apiKeyAddTo !== 'query') {
    result.push({
      key: substituteVariables(auth.apiKeyKey, context),
      value: substituteVariables(auth.apiKeyValue, context),
    });
  }
  return result;
}
