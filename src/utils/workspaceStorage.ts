// Workspace metadata storage in localStorage

export interface WorkspaceMetadata {
  name: string;
  path: string;
  lastOpened: string;
  createdAt: string;
}

const STORAGE_KEY = 'postboy_workspaces';

export function getRecentWorkspaces(): WorkspaceMetadata[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function addRecentWorkspace(metadata: WorkspaceMetadata): void {
  try {
    const workspaces = getRecentWorkspaces();
    // Remove if already exists
    const filtered = workspaces.filter(w => w.path !== metadata.path);
    // Add to beginning
    const updated = [metadata, ...filtered].slice(0, 10); // Keep last 10
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore errors
  }
}

export function removeRecentWorkspace(path: string): void {
  try {
    const workspaces = getRecentWorkspaces();
    const filtered = workspaces.filter(w => w.path !== path);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch {
    // Ignore errors
  }
}

export function updateWorkspaceLastOpened(path: string): void {
  try {
    const workspaces = getRecentWorkspaces();
    const updated = workspaces.map(w => 
      w.path === path ? { ...w, lastOpened: new Date().toISOString() } : w
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore errors
  }
}
