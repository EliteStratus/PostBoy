// Cloudflare Pages Function to proxy API requests and bypass CORS
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
  
  // Get the target URL from query parameter
  const targetUrl = url.searchParams.get('url');
  
  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  try {
    // Parse the target URL
    const target = new URL(targetUrl);
    
    // Get the method from query parameter or use the request method
    const method = url.searchParams.get('method') || request.method;
    
    // Get headers from query parameter (JSON encoded)
    let headers: HeadersInit = {};
    const headersParam = url.searchParams.get('headers');
    if (headersParam) {
      try {
        headers = JSON.parse(headersParam);
      } catch {
        // If parsing fails, use empty headers
      }
    }
    // Forward cookie header so session from auth API is sent to target
    const cookie = request.headers.get('Cookie');
    if (cookie) {
      headers = { ...headers, Cookie: cookie };
    }
    
    // Get body from query parameter for POST/PUT/PATCH
    let body: string | FormData | null = null;
    if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      const bodyParam = url.searchParams.get('body');
      const bodyType = url.searchParams.get('bodyType');
      if (bodyParam) {
        if (bodyType === 'formdata') {
          // Reconstruct FormData from JSON
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
    
    // Make the proxied request
    const proxyResponse = await fetch(target.toString(), {
      method,
      headers,
      body: body || undefined,
    });
    
    // Get response body
    const responseBody = await proxyResponse.text();
    
    // Build response headers (use Headers for multiple Set-Cookie)
    const responseHeaders = new Headers({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth-Companycode, accept, Cookie',
      'Access-Control-Expose-Headers': '*',
    });
    const contentType = proxyResponse.headers.get('Content-Type');
    if (contentType) {
      responseHeaders.set('Content-Type', contentType);
    }
    // Forward Set-Cookie so browser stores session (e.g. from auth API) for subsequent requests
    const setCookies = proxyResponse.headers.getSetCookie?.();
    if (setCookies?.length) {
      for (const value of setCookies) {
        responseHeaders.append('Set-Cookie', value);
      }
      // Expose cookie(s) to client JS (browser forbids reading Set-Cookie); show in Response Headers tab
      responseHeaders.set('X-Response-Set-Cookie', setCookies.join('\n'));
    }
    
    return new Response(responseBody, {
      status: proxyResponse.status,
      statusText: proxyResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: 'Proxy error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
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
