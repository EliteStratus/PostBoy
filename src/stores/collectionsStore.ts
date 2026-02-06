import { create } from 'zustand';
import type { Collection, Folder, Request } from '../types';
import { fileSystemManager } from '../utils/fileSystem';
import {
  getCollectionJsonPath,
  getRequestPath,
  getFolderRequestPath,
  getCollectionPath,
} from '../utils/workspace';

interface CollectionsState {
  collections: Record<string, Collection>;
  isLoading: boolean;
  error: string | null;

  loadCollections: () => Promise<void>;
  createCollection: (name: string, description?: string) => Promise<void>;
  updateCollection: (name: string, updates: Partial<Collection>) => Promise<void>;
  deleteCollection: (name: string) => Promise<void>;
  createFolder: (collectionName: string, folderPath: string[], name: string) => Promise<void>;
  renameFolder: (collectionName: string, folderPath: string[], newName: string) => Promise<void>;
  deleteFolder: (collectionName: string, folderPath: string[]) => Promise<void>;
  createRequest: (collectionName: string, folderPath: string[] | null, request: Request) => Promise<void>;
  updateRequest: (collectionName: string, folderPath: string[] | null, requestName: string, updates: Partial<Request>) => Promise<void>;
  renameRequest: (collectionName: string, folderPath: string[] | null, oldName: string, newName: string) => Promise<void>;
  deleteRequest: (collectionName: string, folderPath: string[] | null, requestName: string) => Promise<void>;
  getRequest: (collectionName: string, folderPath: string[] | null, requestName: string) => Request | null;
  moveRequest: (fromCollection: string, fromFolder: string[] | null, toCollection: string, toFolder: string[] | null, requestName: string) => Promise<void>;
  moveFolder: (collectionName: string, fromFolder: string[], toFolder: string[]) => Promise<void>;
  reorderItems: (collectionName: string, folderPath: string[] | null, itemType: 'folder' | 'request', fromIndex: number, toIndex: number) => Promise<void>;
  setError: (error: string | null) => void;
}

export const useCollectionsStore = create<CollectionsState>((set, get) => ({
  collections: {},
  isLoading: false,
  error: null,

  loadCollections: async () => {
    set({ isLoading: true, error: null });
    try {
      const collections: Record<string, Collection> = {};
      
      // Check if workspace handle is set
      const workspaceHandle = fileSystemManager.getCurrentWorkspaceHandle();
      if (!workspaceHandle) {
        set({ collections, isLoading: false });
        return;
      }

      const collectionDirs = await fileSystemManager.listDirectory('collections');

      for (const dir of collectionDirs) {
        try {
          const collectionJson = await fileSystemManager.readFile(getCollectionJsonPath(dir));
          if (collectionJson) {
            const collection = JSON.parse(collectionJson) as Collection;
            collections[dir] = collection;
          }
        } catch {
          // Continue loading other collections
        }
      }

      set({ collections, isLoading: false });
    } catch (error) {
      console.error('Failed to load collections:', error);
      set({ isLoading: false, error: error instanceof Error ? error.message : 'Failed to load collections' });
    }
  },

  createCollection: async (name: string, description?: string) => {
    try {
      const collection: Collection = {
        name,
        description,
        folders: [],
        requests: [],
      };
      
      await fileSystemManager.createDirectory(getCollectionPath(name));
      await fileSystemManager.createDirectory(`${getCollectionPath(name)}/requests`);
      await fileSystemManager.createDirectory(`${getCollectionPath(name)}/folders`);
      
      await fileSystemManager.writeFile(
        getCollectionJsonPath(name),
        JSON.stringify(collection, null, 2)
      );
      
      set(state => ({
        collections: { ...state.collections, [name]: collection },
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create collection' });
    }
  },

  updateCollection: async (name: string, updates: Partial<Collection>) => {
    const { collections } = get();
    const collection = collections[name];
    if (!collection) return;

    const updated = { ...collection, ...updates };
    const newName = updates.name || name;

    // If name changed, we need to move the collection directory
    if (updates.name && updates.name !== name) {
      // Read all files from old collection
      const oldCollectionPath = getCollectionPath(name);
      const newCollectionPath = getCollectionPath(newName);
      
      // Get all files in the old collection
      const allFiles: Array<{ path: string; content: string }> = [];
      
      // Use the updated collection.json with the new name
      allFiles.push({ 
        path: getCollectionJsonPath(newName), 
        content: JSON.stringify(updated, null, 2) 
      });

      // Read all request files
      const requestFiles = await fileSystemManager.listDirectory(`${oldCollectionPath}/requests`);
      for (const file of requestFiles) {
        const content = await fileSystemManager.readFile(`${oldCollectionPath}/requests/${file}`);
        if (content) {
          allFiles.push({ path: `${newCollectionPath}/requests/${file}`, content });
        }
      }

      // Read all folder files recursively
      const folderFiles = await fileSystemManager.listDirectory(`${oldCollectionPath}/folders`);
      for (const folder of folderFiles) {
        const folderPath = `${oldCollectionPath}/folders/${folder}`;
        const folderJson = await fileSystemManager.readFile(`${folderPath}/folder.json`);
        if (folderJson) {
          allFiles.push({ path: `${newCollectionPath}/folders/${folder}/folder.json`, content: folderJson });
        }
        
        // Read folder requests
        const folderRequestFiles = await fileSystemManager.listDirectory(`${folderPath}/requests`);
        for (const reqFile of folderRequestFiles) {
          const reqContent = await fileSystemManager.readFile(`${folderPath}/requests/${reqFile}`);
          if (reqContent) {
            allFiles.push({ path: `${newCollectionPath}/folders/${folder}/requests/${reqFile}`, content: reqContent });
          }
        }
      }

      // Create new collection directory structure
      await fileSystemManager.createDirectory(newCollectionPath);
      await fileSystemManager.createDirectory(`${newCollectionPath}/requests`);
      await fileSystemManager.createDirectory(`${newCollectionPath}/folders`);

      // Write all files to new location
      for (const file of allFiles) {
        await fileSystemManager.writeFile(file.path, file.content);
      }

      // Delete the old collection directory recursively
      await fileSystemManager.deleteDirectory(oldCollectionPath);
    } else {
      // Name didn't change, just update the collection.json
      await fileSystemManager.writeFile(
        getCollectionJsonPath(newName),
        JSON.stringify(updated, null, 2)
      );
    }

    // Update in-memory state
    const updatedCollections = { ...collections };
    if (updates.name && updates.name !== name) {
      delete updatedCollections[name];
      updatedCollections[newName] = updated;
    } else {
      updatedCollections[name] = updated;
    }

    set({ collections: updatedCollections });
  },

  deleteCollection: async (name: string) => {
    // Note: File System API doesn't support recursive delete easily
    // This would need to be implemented with recursive deletion
    const { collections } = get();
    const updated = { ...collections };
    delete updated[name];
    set({ collections: updated });
  },

  createFolder: async (collectionName: string, folderPath: string[], name: string) => {
    const { collections } = get();
    const collection = collections[collectionName];
    if (!collection) return;

    const workspaceUtils = await import('../utils/workspace');
    const folderPathFull = workspaceUtils.getFolderPath(collectionName, [...folderPath, name]);
    await fileSystemManager.createDirectory(folderPathFull);
    await fileSystemManager.createDirectory(`${folderPathFull}/requests`);
    
    const folder: Folder = {
      name,
      folders: [],
      requests: [],
    };
    
    const folderJsonPath = workspaceUtils.getFolderJsonPath(collectionName, [...folderPath, name]);
    await fileSystemManager.writeFile(
      folderJsonPath,
      JSON.stringify(folder, null, 2)
    );

    // Update in-memory structure
    let target: Folder | Collection = collection;
    for (const pathPart of folderPath) {
      const folders = 'folders' in target ? target.folders : (target as Collection).folders;
      const found: Folder | undefined = folders?.find(f => f.name === pathPart);
      if (found) {
        target = found;
      }
    }
    
    if ('folders' in target) {
      target.folders.push(folder);
    }

    await fileSystemManager.writeFile(
      getCollectionJsonPath(collectionName),
      JSON.stringify(collection, null, 2)
    );

    set(state => ({
      collections: { ...state.collections, [collectionName]: collection },
    }));
  },

  renameFolder: async (collectionName: string, folderPath: string[], newName: string) => {
    const { collections } = get();
    const collection = collections[collectionName];
    if (!collection) return;
    if (!folderPath.length) return;

    const workspaceUtils = await import('../utils/workspace');
    const oldFolderPath = workspaceUtils.getFolderPath(collectionName, folderPath);
    const newFolderPath = [...folderPath.slice(0, -1), newName];
    const newFolderPathFull = workspaceUtils.getFolderPath(collectionName, newFolderPath);

    // Read old folder.json (optional - we can still update in-memory + collection.json)
    const oldFolderJsonPath = workspaceUtils.getFolderJsonPath(collectionName, folderPath);
    const folderJson = await fileSystemManager.readFile(oldFolderJsonPath);
    let folderData: { name: string; folders?: Folder[]; requests?: Request[] } = { name: newName, folders: [], requests: [] };
    if (folderJson) {
      try {
        folderData = { ...JSON.parse(folderJson), name: newName };
      } catch {
        folderData = { name: newName, folders: [], requests: [] };
      }
    }

    // Create new folder directory structure
    await fileSystemManager.createDirectory(newFolderPathFull);
    await fileSystemManager.createDirectory(`${newFolderPathFull}/requests`);

    // Write new folder.json
    const newFolderJsonPath = workspaceUtils.getFolderJsonPath(collectionName, newFolderPath);
    await fileSystemManager.writeFile(newFolderJsonPath, JSON.stringify(folderData, null, 2));

    // Move all request files from old folder to new folder
    try {
      const oldRequestsPath = `${oldFolderPath}/requests`;
      const requestFiles = await fileSystemManager.listDirectory(oldRequestsPath);
      for (const file of requestFiles) {
        const content = await fileSystemManager.readFile(`${oldRequestsPath}/${file}`);
        if (content) {
          await fileSystemManager.writeFile(`${newFolderPathFull}/requests/${file}`, content);
        }
      }
    } catch (error) {
      console.error('Error moving request files:', error);
    }

    // Update in-memory structure
    let target: Folder | Collection = collection;
    for (let i = 0; i < folderPath.length - 1; i++) {
      const folders = 'folders' in target ? target.folders : (target as Collection).folders;
      const foundFolder: Folder | undefined = folders?.find(f => f.name === folderPath[i]);
      if (foundFolder) {
        target = foundFolder;
      }
    }

    if ('folders' in target) {
      const folderIndex = target.folders.findIndex(f => f.name === folderPath[folderPath.length - 1]);
      if (folderIndex >= 0) {
        target.folders[folderIndex].name = newName;
      }
    }

    // Update collection.json
    await fileSystemManager.writeFile(
      getCollectionJsonPath(collectionName),
      JSON.stringify(collection, null, 2)
    );

    // Reload collections to ensure consistency
    await get().loadCollections();
  },

  deleteFolder: async (collectionName: string, folderPath: string[]) => {
    const { collections } = get();
    const collection = collections[collectionName];
    if (!collection) return;

    // Remove from structure
    let target: Folder | Collection = collection;
    for (let i = 0; i < folderPath.length - 1; i++) {
      const folders = 'folders' in target ? target.folders : (target as Collection).folders;
      const foundFolder: Folder | undefined = folders?.find(f => f.name === folderPath[i]);
      if (foundFolder) {
        target = foundFolder;
      }
    }
    
    if ('folders' in target) {
      target.folders = target.folders.filter(f => f.name !== folderPath[folderPath.length - 1]);
    }

    await fileSystemManager.writeFile(
      getCollectionJsonPath(collectionName),
      JSON.stringify(collection, null, 2)
    );

    set(state => ({
      collections: { ...state.collections, [collectionName]: collection },
    }));
  },

  createRequest: async (collectionName: string, folderPath: string[] | null, request: Request) => {
    const { collections } = get();
    const collection = collections[collectionName];
    if (!collection) return;

    const path = folderPath
      ? getFolderRequestPath(collectionName, folderPath, request.name)
      : getRequestPath(collectionName, request.name);

    // Ensure the requests directory exists
    if (folderPath) {
      const workspaceUtils = await import('../utils/workspace');
      const folderPathFull = workspaceUtils.getFolderPath(collectionName, folderPath);
      try {
        await fileSystemManager.createDirectory(`${folderPathFull}/requests`);
      } catch {
        // Directory might already exist, ignore
      }
    } else {
      try {
        await fileSystemManager.createDirectory(`${getCollectionPath(collectionName)}/requests`);
      } catch {
        // Directory might already exist, ignore
      }
    }

    await fileSystemManager.writeFile(path, JSON.stringify(request, null, 2));

    // Update in-memory structure
    if (folderPath && folderPath.length > 0) {
      let target: Folder | Collection = collection;
      for (const pathPart of folderPath) {
        const folders = 'folders' in target ? target.folders : (target as Collection).folders;
        const found = folders?.find(f => f.name === pathPart);
        if (found) {
          target = found;
        } else {
          // Folder not found in structure, this shouldn't happen but handle gracefully
          console.error(`Folder ${pathPart} not found in collection structure`);
          return;
        }
      }
      if ('requests' in target) {
        target.requests.push(request);
      }
    } else {
      collection.requests.push(request);
    }

    await fileSystemManager.writeFile(
      getCollectionJsonPath(collectionName),
      JSON.stringify(collection, null, 2)
    );

    set(state => ({
      collections: { ...state.collections, [collectionName]: collection },
    }));
  },

  updateRequest: async (collectionName: string, folderPath: string[] | null, requestName: string, updates: Partial<Request>) => {
    const request = get().getRequest(collectionName, folderPath, requestName);
    if (!request) return;

    const updated = { ...request, ...updates };
    const path = folderPath
      ? getFolderRequestPath(collectionName, folderPath, requestName)
      : getRequestPath(collectionName, requestName);

    await fileSystemManager.writeFile(path, JSON.stringify(updated, null, 2));

    // Update in-memory
    const { collections } = get();
    const collection = collections[collectionName];
    if (!collection) return;

    if (folderPath && folderPath.length > 0) {
      let target: Folder | Collection = collection;
      for (const pathPart of folderPath) {
        const folders = 'folders' in target ? target.folders : (target as Collection).folders;
        const found = folders?.find(f => f.name === pathPart);
        if (found) {
          target = found;
        }
      }
      if ('requests' in target) {
        const index = target.requests.findIndex(r => r.name === requestName);
        if (index >= 0) {
          target.requests[index] = updated;
        }
      }
    } else {
      const index = collection.requests.findIndex(r => r.name === requestName);
      if (index >= 0) {
        collection.requests[index] = updated;
      }
    }

    // Update collection.json to persist the changes
    await fileSystemManager.writeFile(
      getCollectionJsonPath(collectionName),
      JSON.stringify(collection, null, 2)
    );

    set(state => ({
      collections: { ...state.collections, [collectionName]: collection },
    }));
  },

  renameRequest: async (collectionName: string, folderPath: string[] | null, oldName: string, newName: string) => {
    const request = get().getRequest(collectionName, folderPath, oldName);
    if (!request) return;

    const workspaceUtils = await import('../utils/workspace');
    const oldPath = folderPath
      ? workspaceUtils.getFolderRequestPath(collectionName, folderPath, oldName)
      : workspaceUtils.getRequestPath(collectionName, oldName);
    const newPath = folderPath
      ? workspaceUtils.getFolderRequestPath(collectionName, folderPath, newName)
      : workspaceUtils.getRequestPath(collectionName, newName);

    // Read old file
    const oldContent = await fileSystemManager.readFile(oldPath);
    if (!oldContent) return;

    const requestData = JSON.parse(oldContent);
    requestData.name = newName;

    // Write to new path
    await fileSystemManager.writeFile(newPath, JSON.stringify(requestData, null, 2));

    // Delete old file
    await fileSystemManager.deleteFile(oldPath);

    // Update in-memory structure
    const { collections } = get();
    const collection = collections[collectionName];
    if (!collection) return;

    if (folderPath && folderPath.length > 0) {
      let target: Folder | Collection = collection;
      for (const pathPart of folderPath) {
        const folders = 'folders' in target ? target.folders : (target as Collection).folders;
        const found = folders?.find(f => f.name === pathPart);
        if (found) {
          target = found;
        }
      }
      if ('requests' in target) {
        const index = target.requests.findIndex(r => r.name === oldName);
        if (index >= 0) {
          target.requests[index].name = newName;
        }
      }
    } else {
      const index = collection.requests.findIndex(r => r.name === oldName);
      if (index >= 0) {
        collection.requests[index].name = newName;
      }
    }

    // Update collection.json
    await fileSystemManager.writeFile(
      getCollectionJsonPath(collectionName),
      JSON.stringify(collection, null, 2)
    );

    // Reload collections to ensure consistency
    await get().loadCollections();
  },

  deleteRequest: async (collectionName: string, folderPath: string[] | null, requestName: string) => {
    const { collections } = get();
    const collection = collections[collectionName];
    if (!collection) return;

    if (folderPath) {
      let target: Folder | Collection = collection;
      for (const pathPart of folderPath) {
        const found = (target as Collection).folders?.find(f => f.name === pathPart);
        if (found) {
          target = found;
        }
      }
      if ('requests' in target) {
        target.requests = target.requests.filter(r => r.name !== requestName);
      }
    } else {
      collection.requests = collection.requests.filter(r => r.name !== requestName);
    }

    await fileSystemManager.writeFile(
      getCollectionJsonPath(collectionName),
      JSON.stringify(collection, null, 2)
    );

    set(state => ({
      collections: { ...state.collections, [collectionName]: collection },
    }));
  },

  getRequest: (collectionName: string, folderPath: string[] | null, requestName: string) => {
    const { collections } = get();
    const collection = collections[collectionName];
    if (!collection) return null;

    if (folderPath) {
      let target: Folder | Collection = collection;
      for (const pathPart of folderPath) {
        const found = (target as Collection).folders?.find(f => f.name === pathPart);
        if (found) {
          target = found;
        }
      }
      if ('requests' in target) {
        return target.requests.find(r => r.name === requestName) || null;
      }
    } else {
      return collection.requests.find(r => r.name === requestName) || null;
    }

    return null;
  },

  moveRequest: async (fromCollection: string, fromFolder: string[] | null, toCollection: string, toFolder: string[] | null, requestName: string) => {
    const request = get().getRequest(fromCollection, fromFolder, requestName);
    if (!request) return;

    // If moving to the same location, do nothing
    if (fromCollection === toCollection && JSON.stringify(fromFolder) === JSON.stringify(toFolder)) return;

    const workspaceUtils = await import('../utils/workspace');
    
    // Read old file
    const oldPath = fromFolder
      ? workspaceUtils.getFolderRequestPath(fromCollection, fromFolder, requestName)
      : workspaceUtils.getRequestPath(fromCollection, requestName);
    const oldContent = await fileSystemManager.readFile(oldPath);
    if (!oldContent) return;

    // Write to new location
    const newPath = toFolder
      ? workspaceUtils.getFolderRequestPath(toCollection, toFolder, requestName)
      : workspaceUtils.getRequestPath(toCollection, requestName);
    
    // Ensure the target folder's requests directory exists
    if (toFolder) {
      const folderPathFull = workspaceUtils.getFolderPath(toCollection, toFolder);
      try {
        await fileSystemManager.createDirectory(`${folderPathFull}/requests`);
      } catch {
        // Directory might already exist
      }
    }

    await fileSystemManager.writeFile(newPath, oldContent);

    // Delete old file
    await fileSystemManager.deleteFile(oldPath);

    // Update in-memory structure
    const { collections } = get();
    
    // Remove from source collection
    const fromCollectionData = collections[fromCollection];
    if (fromCollectionData) {
      if (fromFolder && fromFolder.length > 0) {
        let target: Folder | Collection = fromCollectionData;
        for (const pathPart of fromFolder) {
          const folders = 'folders' in target ? target.folders : (target as Collection).folders;
          const found = folders?.find(f => f.name === pathPart);
          if (found) {
            target = found;
          }
        }
        if ('requests' in target) {
          target.requests = target.requests.filter(r => r.name !== requestName);
        }
      } else {
        fromCollectionData.requests = fromCollectionData.requests.filter(r => r.name !== requestName);
      }

      // Update source collection.json
      await fileSystemManager.writeFile(
        getCollectionJsonPath(fromCollection),
        JSON.stringify(fromCollectionData, null, 2)
      );
    }

    // Add to target collection
    const toCollectionData = collections[toCollection];
    if (toCollectionData) {
      if (toFolder && toFolder.length > 0) {
        let target: Folder | Collection = toCollectionData;
        for (const pathPart of toFolder) {
          const folders = 'folders' in target ? target.folders : (target as Collection).folders;
          const found = folders?.find(f => f.name === pathPart);
          if (found) {
            target = found;
          }
        }
        if ('requests' in target) {
          target.requests.push(request);
        }
      } else {
        toCollectionData.requests.push(request);
      }

      // Update target collection.json
      await fileSystemManager.writeFile(
        getCollectionJsonPath(toCollection),
        JSON.stringify(toCollectionData, null, 2)
      );
    }

    // Reload collections
    await get().loadCollections();
  },

  moveFolder: async (collectionName: string, fromFolder: string[], toFolder: string[]) => {
    const { collections } = get();
    const collection = collections[collectionName];
    if (!collection) return;

    // Find the folder to move
    let sourceParent: Folder | Collection = collection;
    for (let i = 0; i < fromFolder.length - 1; i++) {
      const folders = 'folders' in sourceParent ? sourceParent.folders : (sourceParent as Collection).folders;
      const found = folders?.find(f => f.name === fromFolder[i]);
      if (found) {
        sourceParent = found;
      }
    }
    
    const folders = 'folders' in sourceParent ? sourceParent.folders : (sourceParent as Collection).folders;
    const folderToMove = folders?.find(f => f.name === fromFolder[fromFolder.length - 1]);
    if (!folderToMove) return;

    // If moving to the same location, do nothing
    if (JSON.stringify(fromFolder) === JSON.stringify(toFolder)) return;

    const workspaceUtils = await import('../utils/workspace');
    const oldFolderPath = workspaceUtils.getFolderPath(collectionName, fromFolder);
    const newFolderPath = workspaceUtils.getFolderPath(collectionName, toFolder);

    // Read all files from old folder
    const allFiles: Array<{ path: string; content: string }> = [];
    
    const folderJson = await fileSystemManager.readFile(workspaceUtils.getFolderJsonPath(collectionName, fromFolder));
    if (folderJson) {
      allFiles.push({ 
        path: workspaceUtils.getFolderJsonPath(collectionName, toFolder), 
        content: folderJson 
      });
    }

    // Read all request files
    try {
      const requestFiles = await fileSystemManager.listDirectory(`${oldFolderPath}/requests`);
      for (const file of requestFiles) {
        const content = await fileSystemManager.readFile(`${oldFolderPath}/requests/${file}`);
        if (content) {
          allFiles.push({ 
            path: `${newFolderPath}/requests/${file}`, 
            content 
          });
        }
      }
    } catch {
      // No requests folder
    }

    // Read all subfolder files recursively
    try {
      const subfolders = await fileSystemManager.listDirectory(`${oldFolderPath}/folders`);
      for (const subfolder of subfolders) {
        const subfolderPath = [...fromFolder, subfolder];
        const subfolderJson = await fileSystemManager.readFile(workspaceUtils.getFolderJsonPath(collectionName, subfolderPath));
        if (subfolderJson) {
          allFiles.push({ 
            path: workspaceUtils.getFolderJsonPath(collectionName, [...toFolder, subfolder]), 
            content: subfolderJson 
          });
        }
        
        // Read subfolder requests
        try {
          const subfolderRequestFiles = await fileSystemManager.listDirectory(`${oldFolderPath}/folders/${subfolder}/requests`);
          for (const reqFile of subfolderRequestFiles) {
            const reqContent = await fileSystemManager.readFile(`${oldFolderPath}/folders/${subfolder}/requests/${reqFile}`);
            if (reqContent) {
              allFiles.push({ 
                path: `${newFolderPath}/folders/${subfolder}/requests/${reqFile}`, 
                content: reqContent 
              });
            }
          }
        } catch {
          // No requests
        }
      }
    } catch {
      // No subfolders
    }

    // Create new folder structure
    await fileSystemManager.createDirectory(newFolderPath);
    await fileSystemManager.createDirectory(`${newFolderPath}/requests`);
    await fileSystemManager.createDirectory(`${newFolderPath}/folders`);

    // Write all files to new location
    for (const file of allFiles) {
      await fileSystemManager.writeFile(file.path, file.content);
    }

    // Delete old folder
    await fileSystemManager.deleteDirectory(oldFolderPath);

    // Update in-memory structure
    // Remove from old location
    if ('folders' in sourceParent) {
      sourceParent.folders = sourceParent.folders.filter(f => f.name !== fromFolder[fromFolder.length - 1]);
    }

    // Add to new location
    let targetParent: Folder | Collection = collection;
    for (const pathPart of toFolder.slice(0, -1)) {
      const folders = 'folders' in targetParent ? targetParent.folders : (targetParent as Collection).folders;
      const found = folders?.find(f => f.name === pathPart);
      if (found) {
        targetParent = found;
      }
    }
    
    if ('folders' in targetParent) {
      targetParent.folders.push(folderToMove);
    }

    // Update collection.json
    await fileSystemManager.writeFile(
      getCollectionJsonPath(collectionName),
      JSON.stringify(collection, null, 2)
    );

    // Reload collections
    await get().loadCollections();
  },

  reorderItems: async (collectionName: string, folderPath: string[] | null, itemType: 'folder' | 'request', fromIndex: number, toIndex: number) => {
    const { collections } = get();
    const collection = collections[collectionName];
    if (!collection) return;

    let target: Folder | Collection = collection;
    if (folderPath && folderPath.length > 0) {
      for (const pathPart of folderPath) {
        const folders = 'folders' in target ? target.folders : (target as Collection).folders;
        const found = folders?.find(f => f.name === pathPart);
        if (found) {
          target = found;
        }
      }
    }

    if (itemType === 'folder') {
      if ('folders' in target) {
        const folders = [...target.folders];
        const [moved] = folders.splice(fromIndex, 1);
        folders.splice(toIndex, 0, moved);
        target.folders = folders;
      }
    } else {
      if ('requests' in target) {
        const requests = [...target.requests];
        const [moved] = requests.splice(fromIndex, 1);
        requests.splice(toIndex, 0, moved);
        target.requests = requests;
      }
    }

    // Update collection.json
    await fileSystemManager.writeFile(
      getCollectionJsonPath(collectionName),
      JSON.stringify(collection, null, 2)
    );

    // Reload collections
    await get().loadCollections();
  },

  setError: (error: string | null) => {
    set({ error });
  },
}));
