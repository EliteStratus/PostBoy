import type { Collection, Request, Folder, Environment } from '../types';

// Postman v2.1 collection format types
interface PostmanCollection {
  info: {
    name: string;
    description?: string;
    schema: string;
  };
  item: PostmanItem[];
  variable?: PostmanVariable[];
}

interface PostmanItem {
  name: string;
  request?: PostmanRequest;
  item?: PostmanItem[];
  description?: string;
}

interface PostmanRequest {
  method: string;
  header?: PostmanHeader[];
  url: PostmanUrl | string;
  body?: PostmanBody;
  description?: string;
  auth?: {
    type: string;
    [key: string]: any;
  };
}

interface PostmanHeader {
  key: string;
  value: string;
  disabled?: boolean;
}

interface PostmanUrl {
  raw?: string;
  protocol?: string;
  host?: string[];
  path?: string[];
  query?: PostmanQueryParam[];
}

interface PostmanQueryParam {
  key: string;
  value: string;
  disabled?: boolean;
}

interface PostmanBody {
  mode?: 'raw' | 'urlencoded' | 'formdata' | 'file';
  raw?: string;
  urlencoded?: PostmanFormDataItem[];
  formdata?: PostmanFormDataItem[];
}

interface PostmanFormDataItem {
  key: string;
  value?: string;
  type?: string;
  disabled?: boolean;
}

interface PostmanVariable {
  key: string;
  value: string;
  type?: string;
}

export function convertPostmanCollection(postmanCollection: PostmanCollection): Collection {
  const collection: Collection = {
    name: postmanCollection.info.name,
    description: postmanCollection.info.description,
    folders: [],
    requests: [],
  };

  const processItems = (items: PostmanItem[], parentFolders: Folder[] = []): void => {
    items.forEach((item) => {
      if (item.request) {
        // It's a request
        const request = convertPostmanRequest(item);
        if (parentFolders.length === 0) {
          collection.requests.push(request);
        } else {
          // Add to last folder
          const lastFolder = parentFolders[parentFolders.length - 1];
          lastFolder.requests.push(request);
        }
      } else if (item.item) {
        // It's a folder
        const folder: Folder = {
          name: item.name,
          description: item.description,
          folders: [],
          requests: [],
        };

        if (parentFolders.length === 0) {
          collection.folders.push(folder);
        } else {
          const lastFolder = parentFolders[parentFolders.length - 1];
          lastFolder.folders.push(folder);
        }

        processItems(item.item, [...parentFolders, folder]);
      }
    });
  };

  if (postmanCollection.item) {
    processItems(postmanCollection.item);
  }

  return collection;
}

function convertPostmanRequest(item: PostmanItem): Request {
  const pmRequest = item.request!;
  
  // Parse URL
  let url = '';
  let queryParams: Array<{ key: string; value: string; enabled: boolean }> = [];

  if (typeof pmRequest.url === 'string') {
    url = pmRequest.url;
  } else if (pmRequest.url) {
    const urlObj = pmRequest.url;
    if (urlObj.raw) {
      url = urlObj.raw;
    } else {
      const protocol = urlObj.protocol || 'https';
      const host = urlObj.host?.join('.') || '';
      const path = urlObj.path?.join('/') || '';
      url = `${protocol}://${host}/${path}`;
    }
    if (urlObj.query) {
      queryParams = urlObj.query.map((q) => ({
        key: q.key,
        value: q.value || '',
        enabled: !q.disabled,
      }));
    }
  }

  // Convert headers
  const headers = pmRequest.header
    ? pmRequest.header.map((h) => ({
        key: h.key,
        value: h.value,
        enabled: !h.disabled,
      }))
    : [];

  // Handle auth - convert basic auth to headers if present
  if (pmRequest.auth && pmRequest.auth.type === 'basic') {
    // Basic auth is typically handled by the browser, but we can add Authorization header
    // Note: Postman handles this automatically, but we'll skip it for now
    // as it requires base64 encoding which should be done in pre-request script if needed
  }

  // Convert body
  let body: Request['body'];
  if (pmRequest.body) {
    if (pmRequest.body.mode === 'raw') {
      body = {
        mode: 'raw',
        raw: pmRequest.body.raw || '',
        rawLanguage: 'json',
      };
    } else if (pmRequest.body.mode === 'urlencoded') {
      body = {
        mode: 'urlencoded',
        urlencoded: (pmRequest.body.urlencoded || []).map((item) => ({
          key: item.key,
          value: item.value || '',
          type: 'text' as const,
          enabled: !item.disabled,
        })),
      };
    } else if (pmRequest.body.mode === 'formdata') {
      body = {
        mode: 'formdata',
        formdata: (pmRequest.body.formdata || []).map((item) => ({
          key: item.key,
          value: item.value || '',
          type: item.type === 'file' ? 'file' : 'text',
          enabled: !item.disabled,
        })),
      };
    }
  }

  return {
    name: item.name,
    description: item.description,
    method: (pmRequest.method || 'GET').toUpperCase() as any,
    url,
    headers,
    queryParams,
    body,
  };
}

export function convertPostmanEnvironment(postmanEnv: {
  name: string;
  values: PostmanVariable[];
}): Environment {
  return {
    name: postmanEnv.name,
    variables: postmanEnv.values.map((v) => ({
      key: v.key,
      value: v.value || '',
      type: v.type === 'secret' ? 'secret' : 'string',
      enabled: true,
    })),
  };
}

export async function importPostmanCollection(file: File): Promise<Collection> {
  const text = await file.text();
  let postmanCollection: PostmanCollection;
  
  try {
    postmanCollection = JSON.parse(text) as PostmanCollection;
  } catch (error) {
    throw new Error('Invalid JSON file');
  }
  
  if (!postmanCollection.info) {
    throw new Error('Invalid Postman collection format: missing info');
  }

  if (!postmanCollection.item || !Array.isArray(postmanCollection.item)) {
    throw new Error('Invalid Postman collection format: missing items');
  }

  return convertPostmanCollection(postmanCollection);
}

export async function importPostmanEnvironment(file: File): Promise<Environment> {
  const text = await file.text();
  const postmanEnv = JSON.parse(text) as { name: string; values: PostmanVariable[] };
  
  if (!postmanEnv.name || !postmanEnv.values) {
    throw new Error('Invalid Postman environment format');
  }

  return convertPostmanEnvironment(postmanEnv);
}
