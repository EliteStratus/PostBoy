// Core data types for PostBoy

export interface Workspace {
  name: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  currentEnvironment?: string | null;
}

export interface Environment {
  name: string;
  variables: EnvironmentVariable[];
}

export interface EnvironmentVariable {
  key: string;
  value: string;
  type: 'string' | 'secret';
  enabled: boolean;
}

export interface Collection {
  name: string;
  description?: string;
  folders: Folder[];
  requests: Request[];
}

export interface Folder {
  name: string;
  description?: string;
  folders: Folder[];
  requests: Request[];
}

export type AuthType = 'inherit' | 'none' | 'basic' | 'bearer' | 'oauth2' | 'api-key';

/** OAuth 2.0 grant type for request auth */
export type OAuth2GrantType = 'manual' | 'authorization_code' | 'client_credentials';

export interface RequestAuth {
  type: AuthType;
  /** Basic Auth */
  username?: string;
  password?: string;
  /** Bearer Token */
  token?: string;
  /** OAuth 2.0 */
  oauth2GrantType?: OAuth2GrantType;
  /** Manual / resolved token sent as Bearer */
  oauth2Token?: string;
  oauth2RefreshToken?: string;
  /** Authorization Code (PKCE) */
  oauth2AuthUrl?: string;
  oauth2TokenUrl?: string;
  oauth2ClientId?: string;
  oauth2Scope?: string;
  oauth2CallbackUrl?: string;
  /** Client Credentials */
  oauth2ClientSecret?: string;
  /** Optional: token expiry (ISO string) for refresh logic */
  oauth2ExpiresAt?: string;
  /** API Key */
  apiKeyKey?: string;
  apiKeyValue?: string;
  apiKeyAddTo?: 'header' | 'query';
}

export interface Request {
  name: string;
  description?: string;
  method: HttpMethod;
  url: string;
  headers: Header[];
  queryParams: QueryParam[];
  body?: RequestBody;
  auth?: RequestAuth;
  preRequestScript?: string;
  postResponseScript?: string;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface Header {
  key: string;
  value: string;
  enabled: boolean;
}

export interface QueryParam {
  key: string;
  value: string;
  enabled: boolean;
}

export interface RequestBody {
  mode: 'none' | 'formdata' | 'urlencoded' | 'raw' | 'file';
  formdata?: FormDataItem[];
  urlencoded?: FormDataItem[];
  raw?: string;
  rawLanguage?: 'json' | 'xml' | 'text' | 'javascript';
  file?: string;
}

export interface FormDataItem {
  key: string;
  value: string;
  type: 'text' | 'file';
  enabled: boolean;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  time: number;
  size: number;
}

export interface RunResult {
  request: Request;
  response?: HttpResponse;
  error?: string;
  timestamp: string;
}

export interface CollectionRun {
  collectionName: string;
  environmentName?: string;
  results: RunResult[];
  startTime: string;
  endTime?: string;
  totalTime: number;
}

export interface WorkspaceIndex {
  collections: string[];
  environments: string[];
}

// File system paths
export interface WorkspacePaths {
  root: string;
  apiclient: string;
  collections: string;
  environments: string;
  runs: string;
}
