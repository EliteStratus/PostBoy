// IndexedDB-based file system storage
// Stores all workspace data in a fixed location without requiring user permission

interface FileEntry {
  path: string;
  content: string;
  lastModified: number;
}

class IndexedDBFileSystem {
  private dbName = 'postboy-workspace';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) {
      return; // Already initialized
    }

    if (!window.indexedDB) {
      throw new Error('IndexedDB is not supported in this browser. Please use a modern browser like Chrome, Firefox, Safari, or Edge.');
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        const error = request.error || new Error('Failed to open IndexedDB');
        console.error('IndexedDB error:', error);
        reject(new Error('Failed to initialize storage. Please check your browser settings and try again.'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('files')) {
          const objectStore = db.createObjectStore('files', { keyPath: 'path' });
          objectStore.createIndex('path', 'path', { unique: true });
        }
      };
    });
  }

  async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) {
      throw new Error('Failed to initialize IndexedDB');
    }
    return this.db;
  }

  async readFile(path: string): Promise<string | null> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      const request = store.get(path);

      request.onsuccess = () => {
        const entry = request.result as FileEntry | undefined;
        resolve(entry ? entry.content : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async writeFile(path: string, content: string): Promise<boolean> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      const entry: FileEntry = {
        path,
        content,
        lastModified: Date.now(),
      };
      const request = store.put(entry);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async createDirectory(_path: string): Promise<boolean> {
    // In IndexedDB, directories are implicit - just ensure parent paths exist
    return true;
  }

  async listDirectory(path: string): Promise<string[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      const request = store.getAll();

      request.onsuccess = () => {
        const entries = request.result as FileEntry[];
        const prefix = path === '' ? '' : `${path}/`;
        const files = new Set<string>();

        entries.forEach((entry) => {
          if (entry.path.startsWith(prefix)) {
            const relativePath = entry.path.substring(prefix.length);
            const parts = relativePath.split('/');
            if (parts.length > 0 && parts[0]) {
              files.add(parts[0]);
            }
          }
        });

        resolve(Array.from(files));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteFile(path: string): Promise<boolean> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      const request = store.delete(path);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async exportToZip(): Promise<Blob> {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      const request = store.getAll();

      request.onsuccess = async () => {
        const entries = request.result as FileEntry[];
        for (const entry of entries) {
          zip.file(entry.path, entry.content);
        }
        const blob = await zip.generateAsync({ type: 'blob' });
        resolve(blob);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async importFromZip(file: File): Promise<boolean> {
    try {
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(file);
      const db = await this.ensureDB();

      const transaction = db.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');

      const entries: FileEntry[] = [];
      const filePromises: Promise<void>[] = [];
      
      zip.forEach((relativePath, zipFile) => {
        if (!zipFile.dir) {
          filePromises.push(
            zipFile.async('string').then((content) => {
              entries.push({
                path: relativePath,
                content,
                lastModified: Date.now(),
              });
            })
          );
        }
      });

      await Promise.all(filePromises);

      if (entries.length === 0) {
        return true;
      }

      // Write all entries
      return new Promise((resolve, reject) => {
        let writeCompleted = 0;
        entries.forEach((entry) => {
          const putRequest = store.put(entry);
          putRequest.onsuccess = () => {
            writeCompleted++;
            if (writeCompleted === entries.length) {
              resolve(true);
            }
          };
          putRequest.onerror = () => reject(putRequest.error);
        });
      });
    } catch (error) {
      console.error('Failed to import ZIP:', error);
      return false;
    }
  }

  isUsingZipFallback(): boolean {
    return false; // IndexedDB doesn't need fallback
  }

  getRootHandle(): any {
    return { name: 'workspace' }; // Virtual root
  }
}

export const indexedDBFileSystem = new IndexedDBFileSystem();
