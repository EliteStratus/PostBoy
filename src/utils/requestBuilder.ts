import type { Request, Environment } from '../types';
import { substituteVariables, type VariableContext } from './variableSubstitution';

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

  // Build headers
  const headers: Record<string, string> = {};
  request.headers
    .filter(h => h.enabled)
    .forEach(h => {
      const key = substituteVariables(h.key, context);
      const value = substituteVariables(h.value, context);
      headers[key] = value;
    });

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
