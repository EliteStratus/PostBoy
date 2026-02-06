// File System Access API wrapper with ZIP fallback

export interface FileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
}

export interface FileHandle extends FileSystemHandle {
  kind: 'file';
  getFile(): Promise<File>;
}

export interface DirectoryHandle extends FileSystemHandle {
  kind: 'directory';
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandle>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandle>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  queryPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  keys(): AsyncIterableIterator<string>;
  values(): AsyncIterableIterator<FileSystemHandle>;
}

export class FileSystemManager {
  private projectRootHandle: DirectoryHandle | null = null; // Project root (PostBoy folder, where workspaces/ folder is)
  private currentWorkspaceHandle: DirectoryHandle | null = null; // Current workspace directory (inside workspaces/)
  private inMemoryFS: Map<string, string> = new Map();
  private useZipFallback: boolean = false;

  setProjectRootHandle(handle: DirectoryHandle | null) {
    this.projectRootHandle = handle;
    if (handle) {
      this.useZipFallback = false;
    }
  }

  setCurrentWorkspaceHandle(handle: DirectoryHandle) {
    this.currentWorkspaceHandle = handle;
    this.useZipFallback = false;
  }

  getProjectRootHandle(): DirectoryHandle | null {
    return this.projectRootHandle;
  }

  getCurrentWorkspaceHandle(): DirectoryHandle | null {
    return this.currentWorkspaceHandle;
  }

  // For backward compatibility
  getRootHandle(): DirectoryHandle | null {
    return this.currentWorkspaceHandle || this.projectRootHandle;
  }

  async openWorkspace(forcePrompt: boolean = false): Promise<DirectoryHandle | null> {
    // Check if File System Access API is supported
    if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
      this.useZipFallback = true;
      return null;
    }

    // Check if we're on HTTPS or localhost (required for File System Access API)
    const isSecureContext = window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isSecureContext) {
      this.useZipFallback = true;
      return null;
    }

      // Try to get saved root handle first (unless forcing prompt)
    if (!forcePrompt && !this.projectRootHandle) {
      const { getRootDirectoryHandle } = await import('./directoryHandleStorage');
      const savedHandle = await getRootDirectoryHandle();
      if (savedHandle) {
        // Verify the handle is still accessible by trying to access it
        try {
          // Try to verify the handle is still valid by checking if we can query it
          await savedHandle.getDirectoryHandle('.', { create: false });
          this.projectRootHandle = savedHandle as any;
          this.useZipFallback = false;
          return this.projectRootHandle;
        } catch {
          // Permission revoked or handle invalid, clear it and prompt
          const { clearRootDirectoryHandle } = await import('./directoryHandleStorage');
          await clearRootDirectoryHandle();
        }
      }
    }

    // Prompt user to select directory
    try {
      this.projectRootHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
      });
      this.useZipFallback = false;
      
      // Save the handle for future use
      const { saveRootDirectoryHandle } = await import('./directoryHandleStorage');
      await saveRootDirectoryHandle(this.projectRootHandle as any);
      
      return this.projectRootHandle;
    } catch (error) {
      // User cancelled the dialog - this is not an error
      if ((error as any)?.name === 'AbortError' || (error as any)?.code === 20) {
        return null;
      }
      console.error('Failed to open workspace:', error);
      this.useZipFallback = true;
      return null;
    }
  }

  async readFile(path: string): Promise<string | null> {
    const rootHandle = this.currentWorkspaceHandle || this.projectRootHandle;
    if (this.useZipFallback || !rootHandle) {
      return this.inMemoryFS.get(path) || null;
    }

    try {
      const parts = path.split('/').filter(p => p);
      let current: DirectoryHandle | FileHandle = rootHandle;

      for (let i = 0; i < parts.length - 1; i++) {
        current = await (current as DirectoryHandle).getDirectoryHandle(parts[i]);
      }

      const fileHandle = await (current as DirectoryHandle).getFileHandle(parts[parts.length - 1]);
      const file = await (fileHandle as FileHandle).getFile();
      return await file.text();
    } catch (error) {
      console.error(`Failed to read file ${path}:`, error);
      return null;
    }
  }

  async writeFile(path: string, content: string): Promise<boolean> {
    const rootHandle = this.currentWorkspaceHandle || this.projectRootHandle;
    if (this.useZipFallback || !rootHandle) {
      this.inMemoryFS.set(path, content);
      return true;
    }

    try {
      const parts = path.split('/').filter(p => p);
      let current: DirectoryHandle = rootHandle;

      // Create directories
      for (let i = 0; i < parts.length - 1; i++) {
        try {
          current = await current.getDirectoryHandle(parts[i]);
        } catch {
          current = await current.getDirectoryHandle(parts[i], { create: true });
        }
      }

      // Create or update file
      const fileName = parts[parts.length - 1];
      const fileHandle = await current.getFileHandle(fileName, { create: true });
      const writable = await (fileHandle as any).createWritable();
      await writable.write(content);
      await writable.close();
      return true;
    } catch (error) {
      console.error(`Failed to write file ${path}:`, error);
      return false;
    }
  }

  async createDirectory(path: string): Promise<boolean> {
    const rootHandle = this.currentWorkspaceHandle || this.projectRootHandle;
    if (this.useZipFallback || !rootHandle) {
      return true;
    }

    try {
      const parts = path.split('/').filter(p => p);
      let current: DirectoryHandle = rootHandle;

      for (const part of parts) {
        try {
          current = await current.getDirectoryHandle(part);
        } catch {
          current = await current.getDirectoryHandle(part, { create: true });
        }
      }
      return true;
    } catch (error) {
      console.error(`Failed to create directory ${path}:`, error);
      return false;
    }
  }

  async listDirectory(path: string): Promise<string[]> {
    const rootHandle = this.currentWorkspaceHandle || this.projectRootHandle;
    if (this.useZipFallback || !rootHandle) {
      return Array.from(this.inMemoryFS.keys())
        .filter(key => key.startsWith(path))
        .map(key => key.substring(path.length + 1).split('/')[0]);
    }

    try {
      const parts = path.split('/').filter(p => p);
      let current: DirectoryHandle = rootHandle;

      for (const part of parts) {
        current = await current.getDirectoryHandle(part, { create: false });
      }

      const entries: string[] = [];
      for await (const entry of current.keys()) {
        entries.push(entry);
      }
      return entries;
    } catch (error) {
      // Directory doesn't exist - this is fine for new workspaces
      if (error instanceof Error && error.name === 'NotFoundError') {
        return [];
      }
      console.error(`Failed to list directory ${path}:`, error);
      return [];
    }
  }

  async exportToZip(): Promise<Blob> {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    
    if (this.useZipFallback) {
      for (const [path, content] of this.inMemoryFS.entries()) {
        zip.file(path, content);
      }
    } else {
      // Would need to recursively read all files
      // For now, use in-memory fallback
      for (const [path, content] of this.inMemoryFS.entries()) {
        zip.file(path, content);
      }
    }

    return await zip.generateAsync({ type: 'blob' });
  }

  async importFromZip(file: File): Promise<boolean> {
    try {
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(file);
      this.inMemoryFS.clear();

      for (const [path, zipFile] of Object.entries(zip.files)) {
        if (!zipFile.dir) {
          const content = await zipFile.async('string');
          this.inMemoryFS.set(path, content);
        }
      }

      this.useZipFallback = true;
      return true;
    } catch (error) {
      console.error('Failed to import ZIP:', error);
      return false;
    }
  }

  async deleteFile(path: string): Promise<boolean> {
    const rootHandle = this.currentWorkspaceHandle || this.projectRootHandle;
    if (this.useZipFallback || !rootHandle) {
      this.inMemoryFS.delete(path);
      return true;
    }

    try {
      const parts = path.split('/').filter(p => p);
      let current: DirectoryHandle = rootHandle;

      // Navigate to parent directory
      for (let i = 0; i < parts.length - 1; i++) {
        current = await current.getDirectoryHandle(parts[i]);
      }

      // Delete the file
      const fileName = parts[parts.length - 1];
      await current.removeEntry(fileName);
      return true;
    } catch (error) {
      console.error(`Failed to delete file ${path}:`, error);
      return false;
    }
  }

  async deleteDirectory(path: string): Promise<boolean> {
    const rootHandle = this.currentWorkspaceHandle || this.projectRootHandle;
    if (this.useZipFallback || !rootHandle) {
      // For in-memory, just remove all files with this prefix
      for (const key of this.inMemoryFS.keys()) {
        if (key.startsWith(path + '/')) {
          this.inMemoryFS.delete(key);
        }
      }
      return true;
    }

    try {
      const parts = path.split('/').filter(p => p);
      let current: DirectoryHandle = rootHandle;

      // Navigate to parent directory
      for (let i = 0; i < parts.length - 1; i++) {
        current = await current.getDirectoryHandle(parts[i]);
      }

      // Delete the directory recursively
      const dirName = parts[parts.length - 1];
      await current.removeEntry(dirName, { recursive: true });
      return true;
    } catch (error) {
      console.error(`Failed to delete directory ${path}:`, error);
      return false;
    }
  }

  isUsingZipFallback(): boolean {
    return this.useZipFallback;
  }

}

export const fileSystemManager = new FileSystemManager();
