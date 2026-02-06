// Store and retrieve directory handles using IndexedDB
// This allows us to remember the project root directory without prompting every time

const DB_NAME = 'postboy-directory-handles';
const DB_VERSION = 1;
const STORE_NAME = 'handles';
const ROOT_HANDLE_KEY = 'project-root';

export async function saveRootDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // FileSystemDirectoryHandle can be stored directly in IndexedDB
    await store.put(handle, ROOT_HANDLE_KEY);
  } catch (error) {
    console.error('Failed to save directory handle:', error);
  }
}

export async function getRootDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.get(ROOT_HANDLE_KEY);
      request.onsuccess = () => {
        const handle = request.result as FileSystemDirectoryHandle | undefined;
        resolve(handle || null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to get directory handle:', error);
    return null;
  }
}

export async function clearRootDirectoryHandle(): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    await store.delete(ROOT_HANDLE_KEY);
  } catch (error) {
    console.error('Failed to clear directory handle:', error);
  }
}

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}
