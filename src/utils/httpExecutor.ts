import type { Request, HttpResponse, Environment } from '../types';
import { getStoredCookies, setStoredCookiesFromSetCookie } from './cookieStore';
import { buildRequest } from './requestBuilder';
import { executeScript, type ScriptContext } from './scriptExecutor';

export interface ExecutionOptions {
  environment?: Environment;
  timeout?: number;
  onProgress?: (progress: number) => void;
}

export async function executeRequest(
  request: Request,
  options: ExecutionOptions = {}
): Promise<HttpResponse> {
  const { environment, timeout = 30000 } = options;
  const startTime = Date.now();

  try {
    // Execute pre-request script
    let scriptContext: ScriptContext = {
      environment: environment?.variables.reduce((acc, v) => {
        if (v.enabled) acc[v.key] = v.value;
        return acc;
      }, {} as Record<string, string>),
      request: {
        url: request.url,
        method: request.method,
        headers: request.headers.reduce((acc, h) => {
          if (h.enabled) acc[h.key] = h.value;
          return acc;
        }, {} as Record<string, string>),
        body: request.body?.raw || '',
      },
    };

    if (request.preRequestScript) {
      try {
        const scriptResult = await executeScript(request.preRequestScript, scriptContext, 5000);
        if (scriptResult.environment) {
          // Update environment variables from script
          scriptContext.environment = { ...scriptContext.environment, ...scriptResult.environment };
        }
      } catch {
        // Continue execution even if script fails
      }
    }

    // Build request with updated environment
    const builtRequest = buildRequest(request, environment);

    // Automatically add stored cookies for this origin (from previous Set-Cookie responses)
    try {
      const origin = new URL(builtRequest.url).origin;
      const stored = getStoredCookies(origin);
      if (stored) {
        const existing = builtRequest.headers['Cookie'] ?? builtRequest.headers['cookie'];
        builtRequest.headers['Cookie'] = existing ? `${existing}; ${stored}` : stored;
        delete builtRequest.headers['cookie']; // avoid duplicate
      }
    } catch {
      // ignore invalid URL
    }

    // Execute HTTP request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Check if we need to use proxy (CORS issue)
      const targetUrl = new URL(builtRequest.url);
      const currentOrigin = window.location.origin;
      const needsProxy = targetUrl.origin !== currentOrigin;
      
      let finalUrl = builtRequest.url;
      let fetchOptions: RequestInit = {
        method: builtRequest.method,
        headers: builtRequest.headers,
        signal: controller.signal,
        credentials: 'include', // Send and receive cookies (e.g. session from auth API)
      };

      if (builtRequest.body) {
        if (builtRequest.body instanceof FormData) {
          fetchOptions.body = builtRequest.body;
        } else {
          fetchOptions.body = builtRequest.body;
        }
      }

      // Use proxy if needed to bypass CORS
      if (needsProxy) {
        const proxyUrl = new URL('/proxy', window.location.origin);
        // Use JSON body so Bearer token (base64 with +) is not corrupted by form-urlencoded + → space
        const proxyPayload: { url: string; method: string; headers: Record<string, string>; body?: string; bodyType?: string } = {
          url: builtRequest.url,
          method: builtRequest.method,
          headers: builtRequest.headers,
        };
        if (builtRequest.body) {
          if (typeof builtRequest.body === 'string') {
            proxyPayload.body = builtRequest.body;
          } else if (builtRequest.body instanceof FormData) {
            const formDataObj: Record<string, string> = {};
            builtRequest.body.forEach((value, key) => {
              formDataObj[key] = value.toString();
            });
            proxyPayload.body = JSON.stringify(formDataObj);
            proxyPayload.bodyType = 'formdata';
          }
        }
        finalUrl = proxyUrl.toString();
        fetchOptions.method = 'POST';
        fetchOptions.body = JSON.stringify(proxyPayload);
        fetchOptions.headers = {
          'Content-Type': 'application/json',
        };
        fetchOptions.credentials = 'omit';
      }

      const response = await fetch(finalUrl, fetchOptions);
      clearTimeout(timeoutId);

      // Read response
      const responseText = await response.text();
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        const lower = key.toLowerCase();
        if (lower === 'x-response-set-cookie') {
          // Proxy sends Set-Cookie here (browser forbids JS from reading Set-Cookie). Show as Set-Cookie in Headers tab.
          responseHeaders['Set-Cookie'] = value;
          return;
        }
        if (lower !== 'set-cookie') {
          responseHeaders[key] = value;
        }
      });
      // Copy proxy's cookie exposure into Set-Cookie for display (if not already set)
      const exposed = response.headers.get('x-response-set-cookie');
      if (exposed != null && responseHeaders['Set-Cookie'] == null) {
        responseHeaders['Set-Cookie'] = exposed;
      }
      // Server-side getSetCookie() is not available in browser; use x-response-set-cookie from proxy when present
      if (responseHeaders['Set-Cookie'] == null) {
        const setCookies = response.headers.getSetCookie?.();
        if (setCookies?.length) {
          responseHeaders['Set-Cookie'] = setCookies.join('\n');
        } else {
          const single = response.headers.get('set-cookie');
          if (single != null) responseHeaders['Set-Cookie'] = single;
        }
      }

      // Store Set-Cookie for this origin so we send it automatically on the next request
      const setCookieValue = responseHeaders['Set-Cookie'];
      if (setCookieValue) {
        try {
          const origin = new URL(builtRequest.url).origin;
          setStoredCookiesFromSetCookie(origin, setCookieValue);
        } catch {
          // ignore
        }
      }

      const httpResponse: HttpResponse = {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseText,
        time: Date.now() - startTime,
        size: new Blob([responseText]).size,
      };

      // Execute post-response script
      if (request.postResponseScript) {
        try {
          scriptContext.response = {
            status: httpResponse.status,
            statusText: httpResponse.statusText,
            headers: httpResponse.headers,
            body: httpResponse.body,
            time: httpResponse.time,
          };
          await executeScript(request.postResponseScript, scriptContext, 5000);
        } catch {
          // Continue even if script fails
        }
      }

      return httpResponse;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timeout after 30 seconds');
        }
        // Provide more detailed error messages
        if (error.message.includes('Failed to fetch')) {
          // Check if URL might be invalid
          if (builtRequest.url.includes('{{') || builtRequest.url.includes('}}')) {
            throw new Error(`Failed to fetch: URL contains unresolved variables. Please check your environment variables. URL: ${builtRequest.url}`);
          }
          
          // Check if it's likely a CORS issue
          let urlObj: URL;
          try {
            urlObj = new URL(builtRequest.url);
          } catch (urlParseError) {
            // URL parsing failed - invalid URL format
            throw new Error(`Failed to fetch: Invalid URL format. URL: ${builtRequest.url}`);
          }
          
          // URL is valid, check if it's a CORS issue
          const currentOrigin = window.location.origin;
          if (urlObj.origin !== currentOrigin) {
            // Different origin - likely CORS issue
            throw new Error(`Failed to fetch: CORS error. The server at ${urlObj.origin} is not allowing requests from ${currentOrigin}. The server needs to include appropriate CORS headers (Access-Control-Allow-Origin) to allow this request. URL: ${builtRequest.url}`);
          } else {
            // Same origin - likely network or server error
            throw new Error(`Failed to fetch: Network or server error. The request to ${builtRequest.url} could not be completed. This might be due to network connectivity issues, the server being down, or firewall restrictions.`);
          }
        }
        throw error;
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof Error) {
      // Don't wrap if it's already a detailed error
      if (error.message.includes('Failed to fetch') || error.message.includes('timeout')) {
        throw error;
      }
      throw new Error(`Request execution failed: ${error.message}`);
    }
    throw new Error('Request execution failed: Unknown error');
  }
}
