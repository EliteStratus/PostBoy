// Cloudflare Pages Function to proxy API requests and bypass CORS

/** Leave only characters that are safe for HTTP header values (avoids "Invalid header value" in Workers). */
function safeHeaderValue(v: string): string {
  return v
    .replace(/[\0-\x1f\x7f\r\n]/g, '')
    .replace(/[^\u0020-\u007E]/g, '')
    .replace(/["\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8192);
}

/** Authorization: allow only HTTP-safe + JWT/base64 chars (Worker runtimes can reject others). */
function safeAuthHeaderValue(v: string): string {
  return v
    .replace(/[\0-\x1f\x7f\r\n]/g, '')
    .replace(/[^\u0020-\u007E]/g, '')
    .replace(/[^ A-Za-z0-9_\-.\/+]/g, '') // only space + Bearer + base64
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8192);
}

/** Cookie: strip only control chars and newlines (values often contain = ; " and must not be altered). */
function safeCookieHeaderValue(v: string): string {
  return v
    .replace(/[\0-\x1f\x7f\r\n]/g, '')
    .replace(/[^\u0020-\u007E]/g, '')
    .trim()
    .slice(0, 8192);
}

/** Build outgoing Headers for fetch; skip any header the runtime rejects. */
function buildOutgoingHeaders(record: Record<string, string>): Headers {
  const h = new Headers();
  for (const [name, value] of Object.entries(record)) {
    if (!name || value == null) continue;
    const s = typeof value === 'string' ? value : String(value);
    const lower = name.toLowerCase();
    const safe = lower === 'authorization'
      ? safeAuthHeaderValue(s)
      : lower === 'cookie'
        ? safeCookieHeaderValue(s)
        : safeHeaderValue(s);
    if (!safe) continue;
    try {
      h.set(name, safe);
    } catch {
      if (lower === 'cookie') {
        const fallback = safeHeaderValue(s);
        if (fallback) try { h.set(name, fallback); } catch { /* skip */ }
      }
      // skip other headers if runtime rejects
    }
  }
  return h;
}

export async function onRequest(context: { request: Request }): Promise<Response> {
  const { request } = context;
  
  // Handle OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth-Companycode, accept',
        'Access-Control-Max-Age': '86400',
      },
    });
  }
  
  const url = new URL(request.url);
  // Prefer POST body: JSON (preserves Bearer token + in base64) or form; fall back to query params
  let targetUrl: string | null = null;
  let isTokenRequest = false;
  let method = request.method;
  let bodyParam: string | null = null;
  let bodyType: string | null = null;
  let headersParam: string | null = null;
  if (request.method === 'POST') {
    const ct = request.headers.get('Content-Type') ?? '';
    if (ct.includes('application/json')) {
      try {
        const json = await request.json() as { url?: string; method?: string; headers?: Record<string, string>; body?: string; bodyType?: string; tokenRequest?: string };
        targetUrl = json.url ?? null;
        method = json.method ?? request.method;
        isTokenRequest = json.tokenRequest === '1';
        bodyParam = json.body ?? null;
        bodyType = json.bodyType ?? null;
        headersParam = json.headers != null ? JSON.stringify(json.headers) : null;
      } catch {
        // fall through to query params
      }
    } else if (ct.includes('application/x-www-form-urlencoded')) {
      try {
        const formData = await request.formData();
        targetUrl = formData.get('url')?.toString() ?? null;
        method = formData.get('method')?.toString() ?? request.method;
        isTokenRequest = formData.get('tokenRequest') === '1';
        bodyParam = formData.get('body')?.toString() ?? null;
        bodyType = formData.get('bodyType')?.toString() ?? null;
        headersParam = formData.get('headers')?.toString() ?? null;
      } catch {
        // fall through
      }
    }
  }
  if (targetUrl == null) {
    targetUrl = url.searchParams.get('url');
    method = url.searchParams.get('method') ?? request.method;
    isTokenRequest = url.searchParams.get('tokenRequest') === '1';
    bodyParam = url.searchParams.get('body');
    bodyType = url.searchParams.get('bodyType');
    headersParam = url.searchParams.get('headers');
  }
  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const target = new URL(targetUrl.trim());
    const methodUpper = (method || request.method).toUpperCase();
    const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    const safeMethod = allowedMethods.includes(methodUpper) ? methodUpper : 'GET';

    let body: string | FormData | null = null;
    if (['POST', 'PUT', 'PATCH'].includes(safeMethod)) {
      if (bodyParam) {
        if (bodyType === 'formdata') {
          try {
            const formDataObj = JSON.parse(bodyParam);
            const formData = new FormData();
            Object.entries(formDataObj).forEach(([key, value]) => {
              formData.append(key, value as string);
            });
            body = formData;
          } catch {
            body = bodyParam;
          }
        } else {
          body = bodyParam;
        }
      }
    }

    let headersRecord: Record<string, string> = {};
    if (isTokenRequest) {
      headersRecord['Content-Type'] = 'application/x-www-form-urlencoded';
      headersRecord['Accept'] = 'application/json';
    } else {
      if (headersParam) {
        try {
          const parsed = JSON.parse(headersParam);
          if (parsed && typeof parsed === 'object') {
            // Collect Authorization (any case); use only real Bearer/Basic, never placeholders like "Value"
            let authorizationValue: string | null = null;
            const placeholderValues = new Set(['value', 'value ', ' value', '']);
            for (const [k, v] of Object.entries(parsed)) {
              const name = String(k).replace(/[^a-zA-Z0-9\-]/g, '').slice(0, 128);
              const val = v != null ? String(v) : '';
              const nameLower = name.toLowerCase();
              if (nameLower === 'authorization') {
                const safe = safeHeaderValue(val);
                const isPlaceholder = !safe || safe.length < 20 || placeholderValues.has(safe.trim().toLowerCase());
                if (safe && !isPlaceholder) {
                  if (safe.startsWith('Bearer ') || safe.startsWith('Basic ')) authorizationValue = safe;
                  else if (!authorizationValue) authorizationValue = safe;
                }
              } else if (nameLower === 'cookie') {
                const safe = safeCookieHeaderValue(val);
                if (name && safe) headersRecord[name] = safe;
              } else {
                const safe = safeHeaderValue(val);
                if (name && safe) headersRecord[name] = safe;
              }
            }
            if (authorizationValue) headersRecord['Authorization'] = authorizationValue;
          }
        } catch {
          // ignore
        }
      }
      // Do not forward the browser's Cookie (request to proxy) to the target — that's for our origin only.
      // Cookie for the target API must come from the payload (Headers tab in the client).
    }

    const outgoingHeaders = buildOutgoingHeaders(headersRecord);

    let proxyResponse: Response;
    try {
      proxyResponse = await fetch(target.toString(), {
        method: safeMethod,
        headers: outgoingHeaders,
        body: body || undefined,
      });
    } catch (fetchError) {
      const msg = fetchError instanceof Error ? fetchError.message : 'Unknown error';
      return new Response(
        JSON.stringify({ error: 'Proxy error', message: `Outgoing request: ${msg}` }),
        { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const responseBody = await proxyResponse.text();

    // Build response with sanitized headers only (avoid "Invalid header value" from upstream headers)
    const responseHeaders = new Headers();
    try {
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Auth-Companycode, accept, Cookie');
      responseHeaders.set('Access-Control-Expose-Headers', '*');
      const contentType = proxyResponse.headers.get('Content-Type');
      const safeContentType = contentType ? safeHeaderValue(contentType).slice(0, 256) : '';
      try {
        responseHeaders.set('Content-Type', safeContentType || 'application/json');
      } catch {
        responseHeaders.set('Content-Type', 'application/json');
      }
      if (!isTokenRequest) {
        const setCookies = proxyResponse.headers.getSetCookie?.();
        if (setCookies?.length) {
          const safeCookies: string[] = [];
          for (const value of setCookies) {
            const safe = safeHeaderValue(value);
            if (safe) {
              try {
                responseHeaders.append('Set-Cookie', safe);
                safeCookies.push(value);
              } catch {
                // skip
              }
            }
          }
          if (safeCookies.length) {
            try {
              responseHeaders.set('X-Response-Set-Cookie', safeCookies.join('\n'));
            } catch {
              // skip
            }
          }
        }
      }
    } catch (headerError) {
      const msg = headerError instanceof Error ? headerError.message : 'Unknown error';
      return new Response(
        JSON.stringify({ error: 'Proxy error', message: `Response header: ${msg}` }),
        { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }
    try {
      return new Response(responseBody, {
        status: proxyResponse.status,
        headers: responseHeaders,
      });
    } catch (responseError) {
      const msg = responseError instanceof Error ? responseError.message : 'Unknown error';
      return new Response(
        JSON.stringify({ error: 'Proxy error', message: `Building response: ${msg}` }),
        { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Proxy error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}
