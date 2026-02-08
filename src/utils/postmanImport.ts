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

/** Export environment to standard v2.1 environment JSON (importable in common API clients). */
export function exportEnvironmentToPostman(env: Environment): string {
  const values = env.variables.map((v) => ({
    key: v.key,
    value: v.value,
    type: v.type === 'secret' ? 'secret' : 'default',
    enabled: v.enabled,
  }));
  const payload = {
    id: crypto.randomUUID?.() ?? `env-${Date.now()}`,
    name: env.name,
    values,
    _postman_variable_scope: 'environment',
    _postman_exported_at: new Date().toISOString(),
    _postman_exported_using: 'PostBoy',
  };
  return JSON.stringify(payload, null, 2);
}

// --- Collection export (our format -> v2.1 collection JSON) ---

function requestToPostmanAuth(auth: Request['auth']): PostmanRequest['auth'] | undefined {
  if (!auth || auth.type === 'inherit' || auth.type === 'none') return undefined;
  if (auth.type === 'basic') {
    return { type: 'basic', basic: [{ key: 'username', value: auth.username ?? '' }, { key: 'password', value: auth.password ?? '' }] };
  }
  if (auth.type === 'bearer') {
    return { type: 'bearer', bearer: [{ key: 'token', value: auth.token }] };
  }
  if (auth.type === 'oauth2') {
    return { type: 'oauth2', oauth2: [{ key: 'accessToken', value: auth.oauth2Token }] };
  }
  if (auth.type === 'api-key') {
    return { type: 'apikey', apikey: [{ key: 'key', value: auth.apiKeyKey }, { key: 'value', value: auth.apiKeyValue }, { key: 'in', value: auth.apiKeyAddTo === 'query' ? 'query' : 'header' }] };
  }
  return undefined;
}

function requestToPostmanRequest(req: Request): PostmanRequest {
  const header: PostmanHeader[] = (req.headers || []).filter((h) => h.enabled).map((h) => ({ key: h.key, value: h.value }));
  const url: PostmanUrl | string = req.queryParams?.length
    ? { raw: req.url, query: req.queryParams.filter((q) => q.enabled).map((q) => ({ key: q.key, value: q.value })) }
    : req.url;
  let body: PostmanBody | undefined;
  if (req.body && req.body.mode !== 'none') {
    if (req.body.mode === 'raw' && req.body.raw != null) {
      body = { mode: 'raw', raw: req.body.raw };
    } else if (req.body.mode === 'urlencoded' && req.body.urlencoded?.length) {
      body = { mode: 'urlencoded', urlencoded: req.body.urlencoded.filter((u) => u.enabled).map((u) => ({ key: u.key, value: u.value })) };
    } else if (req.body.mode === 'formdata' && req.body.formdata?.length) {
      body = { mode: 'formdata', formdata: req.body.formdata.filter((f) => f.enabled).map((f) => ({ key: f.key, value: f.value, type: f.type })) };
    }
  }
  const auth = requestToPostmanAuth(req.auth);
  return { method: req.method, header, url, body, description: req.description, auth };
}

function requestToPostmanItem(req: Request): PostmanItem {
  return { name: req.name, description: req.description, request: requestToPostmanRequest(req) };
}

function folderToPostmanItems(folder: Folder): PostmanItem[] {
  const items: PostmanItem[] = [];
  (folder.folders || []).forEach((f) => {
    items.push({ name: f.name, description: f.description, item: folderToPostmanItems(f) });
  });
  (folder.requests || []).forEach((r) => items.push(requestToPostmanItem(r)));
  return items;
}

function collectionToPostmanItems(collection: Collection): PostmanItem[] {
  const items: PostmanItem[] = [];
  (collection.folders || []).forEach((f) => {
    items.push({ name: f.name, description: f.description, item: folderToPostmanItems(f) });
  });
  (collection.requests || []).forEach((r) => items.push(requestToPostmanItem(r)));
  return items;
}

/** Export collection to standard v2.1 collection JSON (importable in common API clients). */
export function exportCollectionToPostman(collection: Collection): string {
  const payload: PostmanCollection = {
    info: {
      name: collection.name,
      description: collection.description,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: collectionToPostmanItems(collection),
  };
  return JSON.stringify(payload, null, 2);
}

/** Export a single folder as a collection (one root folder with same name). */
export function exportFolderAsCollection(folder: Folder): string {
  const asCollection: Collection = {
    name: folder.name,
    description: folder.description,
    folders: folder.folders || [],
    requests: folder.requests || [],
  };
  return exportCollectionToPostman(asCollection);
}
