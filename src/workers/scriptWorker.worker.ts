// Web Worker for script execution - inline version
// This will be bundled separately

import CryptoJS from 'crypto-js';

export interface ScriptContext {
  environment?: Record<string, string>;
  collection?: Record<string, string>;
  global?: Record<string, string>;
  request?: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  };
  response?: {
    status?: number;
    statusText?: string;
    headers?: Record<string, string>;
    body?: string;
    time?: number;
  };
}

export interface ScriptResult {
  success: boolean;
  result?: any;
  error?: string;
  environment?: Record<string, string>;
  collection?: Record<string, string>;
  global?: Record<string, string>;
}

// PM-Lite API implementation
function createPmAPI(context: ScriptContext) {
  const env: Record<string, string> = { ...context.environment };
  const collection: Record<string, string> = { ...context.collection || {} };
  const global: Record<string, string> = { ...context.global || {} };

  return {
    environment: {
      get: (key: string): string | undefined => env[key],
      set: (key: string, value: string): void => {
        env[key] = value;
      },
      unset: (key: string): void => {
        delete env[key];
      },
      has: (key: string): boolean => key in env,
      toObject: (): Record<string, string> => ({ ...env }),
    },
    collectionVariables: {
      get: (key: string): string | undefined => collection[key],
      set: (key: string, value: string): void => {
        collection[key] = value;
      },
      unset: (key: string): void => {
        delete collection[key];
      },
      has: (key: string): boolean => key in collection,
      toObject: (): Record<string, string> => ({ ...collection }),
    },
    global: {
      get: (key: string): string | undefined => global[key],
      set: (key: string, value: string): void => {
        global[key] = value;
      },
      unset: (key: string): void => {
        delete global[key];
      },
      has: (key: string): boolean => key in global,
      toObject: (): Record<string, string> => ({ ...global }),
    },
    request: {
      url: context.request?.url || '',
      method: context.request?.method || 'GET',
      headers: context.request?.headers || {},
      body: context.request?.body || '',
    },
    response: context.response ? {
      status: context.response.status || 0,
      statusText: context.response.statusText || '',
      headers: context.response.headers || {},
      body: context.response.body || '',
      time: context.response.time || 0,
      code: context.response.status || 0,
    } : undefined,
    require: (module: string): any => {
      if (module === 'crypto-js') {
        return CryptoJS;
      }
      throw new Error(`Module ${module} not found`);
    },
  };
}

self.onmessage = async (event: MessageEvent<{ script: string; context: ScriptContext; timeout?: number }>) => {
  const { script, context, timeout = 5000 } = event.data;

  try {
    const pm = createPmAPI(context);
    
    const result = await Promise.race([
      new Promise((resolve, reject) => {
        try {
          const func = new Function('pm', script);
          const scriptResult = func(pm);
          resolve(scriptResult);
        } catch (error) {
          reject(error);
        }
      }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Script execution timeout')), timeout);
      }),
    ]);

    const response: ScriptResult = {
      success: true,
      result,
      environment: pm.environment.toObject(),
      collection: pm.collectionVariables.toObject(),
      global: pm.global.toObject(),
    };

    self.postMessage(response);
  } catch (error) {
    const response: ScriptResult = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    self.postMessage(response);
  }
};
