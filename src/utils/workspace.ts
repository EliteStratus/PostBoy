import type { WorkspacePaths } from '../types';

let currentWorkspacePath: string | null = null;

export function setCurrentWorkspacePath(workspacePath: string | null) {
  currentWorkspacePath = workspacePath;
}

export function getCurrentWorkspacePath(): string | null {
  return currentWorkspacePath;
}

export const WORKSPACE_PATHS: WorkspacePaths = {
  root: '',
  apiclient: '.apiclient',
  collections: 'collections',
  environments: 'environments',
  runs: '.apiclient/runs',
};

export function getCollectionPath(collectionName: string): string {
  return `${WORKSPACE_PATHS.collections}/${collectionName}`;
}

export function getCollectionJsonPath(collectionName: string): string {
  return `${getCollectionPath(collectionName)}/collection.json`;
}

export function getRequestPath(collectionName: string, requestName: string): string {
  return `${getCollectionPath(collectionName)}/requests/${sanitizeFileName(requestName)}.request.json`;
}

export function getFolderPath(collectionName: string, folderPath: string[]): string {
  const folderChain = folderPath.join('/');
  return `${getCollectionPath(collectionName)}/folders/${folderChain}`;
}

export function getFolderJsonPath(collectionName: string, folderPath: string[]): string {
  return `${getFolderPath(collectionName, folderPath)}/folder.json`;
}

export function getFolderRequestPath(collectionName: string, folderPath: string[], requestName: string): string {
  return `${getFolderPath(collectionName, folderPath)}/requests/${sanitizeFileName(requestName)}.request.json`;
}

export function getEnvironmentPath(environmentName: string): string {
  return `${WORKSPACE_PATHS.environments}/${sanitizeFileName(environmentName)}.env.json`;
}

export function getWorkspaceJsonPath(): string {
  return `${WORKSPACE_PATHS.apiclient}/workspace.json`;
}

export function getIndexJsonPath(): string {
  return `${WORKSPACE_PATHS.apiclient}/index.json`;
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function parseRequestFileName(fileName: string): string {
  return fileName.replace(/\.request\.json$/, '');
}

export function parseEnvironmentFileName(fileName: string): string {
  return fileName.replace(/\.env\.json$/, '');
}
