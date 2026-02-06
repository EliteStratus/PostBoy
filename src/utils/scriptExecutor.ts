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

// Simple inline execution without worker for now
// Worker can be added later if needed for better isolation
export async function executeScript(
  script: string,
  context: ScriptContext,
  timeout: number = 5000
): Promise<ScriptResult> {
  // Execute in a timeout
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Script execution timeout'));
    }, timeout);

    try {
      const env: Record<string, string> = { ...(context.environment || {}) };
      const collection: Record<string, string> = { ...(context.collection || {}) };
      const global: Record<string, string> = { ...(context.global || {}) };

      const pm = {
        environment: {
          get: (key: string) => env[key],
          set: (key: string, value: string) => { env[key] = value; },
          unset: (key: string) => { delete env[key]; },
          has: (key: string) => key in env,
          toObject: () => ({ ...env }),
        },
        collectionVariables: {
          get: (key: string) => collection[key],
          set: (key: string, value: string) => { collection[key] = value; },
          unset: (key: string) => { delete collection[key]; },
          has: (key: string) => key in collection,
          toObject: () => ({ ...collection }),
        },
        global: {
          get: (key: string) => global[key],
          set: (key: string, value: string) => { global[key] = value; },
          unset: (key: string) => { delete global[key]; },
          has: (key: string) => key in global,
          toObject: () => ({ ...global }),
        },
        request: context.request || {},
        response: context.response || {},
        require: (module: string) => {
          if (module === 'crypto-js') return CryptoJS;
          throw new Error(`Module ${module} not found`);
        },
      };

      const func = new Function('pm', script);
      const result = func(pm);

      clearTimeout(timeoutId);
      resolve({
        success: true,
        result,
        environment: pm.environment.toObject(),
        collection: pm.collectionVariables.toObject(),
        global: pm.global.toObject(),
      });
    } catch (error) {
      clearTimeout(timeoutId);
      resolve({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
