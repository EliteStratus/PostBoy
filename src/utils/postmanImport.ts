import type { Collection, Request, Folder, Environment, RequestAuth } from '../types';

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

interface PostmanAuthParam {
  key: string;
  value?: string;
}

interface PostmanRequest {
  method: string;
  header?: PostmanHeader[];
  url: PostmanUrl | string;
  body?: PostmanBody;
  description?: string;
  auth?: {
    type: string;
    basic?: PostmanAuthParam[];
    bearer?: PostmanAuthParam[];
    apikey?: PostmanAuthParam[];
    oauth2?: PostmanAuthParam[];
    [key: string]: PostmanAuthParam[] | string | undefined;
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
  value?: string;
  /** Postman "Initial Value" - used when value is empty (e.g. for some secret exports). */
  initialValue?: string;
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

function getAuthParam(params: PostmanAuthParam[] | undefined, key: string): string | undefined {
  if (!params || !Array.isArray(params)) return undefined;
  const entry = params.find((p) => p.key === key);
  return entry?.value;
}

function convertPostmanAuth(pmAuth: PostmanRequest['auth']): RequestAuth | undefined {
  if (!pmAuth || !pmAuth.type) return undefined;
  const type = pmAuth.type.toLowerCase();
  if (type === 'noauth') {
    return { type: 'none' };
  }
  if (type === 'basic') {
    const username = getAuthParam(pmAuth.basic, 'username');
    const password = getAuthParam(pmAuth.basic, 'password');
    return { type: 'basic', username: username ?? '', password: password ?? '' };
  }
  if (type === 'bearer') {
    const token = getAuthParam(pmAuth.bearer, 'token');
    return { type: 'bearer', token: token ?? '' };
  }
  if (type === 'oauth2') {
    const token = getAuthParam(pmAuth.oauth2, 'accessToken') ?? getAuthParam(pmAuth.oauth2, 'token');
    return { type: 'oauth2', oauth2Token: token ?? '' };
  }
  if (type === 'apikey') {
    const key = getAuthParam(pmAuth.apikey, 'key');
    const value = getAuthParam(pmAuth.apikey, 'value');
    const inWhere = getAuthParam(pmAuth.apikey, 'in');
    return {
      type: 'api-key',
      apiKeyKey: key ?? '',
      apiKeyValue: value ?? '',
      apiKeyAddTo: inWhere === 'query' ? 'query' : 'header',
    };
  }
  return undefined;
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

  // Convert auth from Postman format to our RequestAuth
  const auth = convertPostmanAuth(pmRequest.auth);

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
    auth: auth ?? { type: 'inherit' },
  };
}

export function convertPostmanEnvironment(postmanEnv: {
  name: string;
  values: PostmanVariable[];
}): Environment {
  return {
    name: postmanEnv.name,
    variables: postmanEnv.values.map((v) => {
      // Use value, then initialValue (Postman exports may put secret/current value in either)
      const value = v.value ?? v.initialValue ?? '';
      return {
        key: v.key,
        value,
        type: v.type === 'secret' ? 'secret' : 'string',
        enabled: true,
      };
    }),
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
