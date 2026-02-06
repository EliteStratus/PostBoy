import { useState, useRef, useEffect } from 'react';
import { useCollectionsStore } from '../stores/collectionsStore';
import { useRunnerStore } from '../stores/runnerStore';
import type { Folder, Request } from '../types';
import ContextMenu, { type ContextMenuOption } from './ContextMenu';
import ConfirmDialog from './ConfirmDialog';

interface SidebarProps {
  onSelectRequest: (collection: string, folder: string[] | null, request: string) => void;
}

export default function Sidebar({ onSelectRequest }: SidebarProps) {
  const { 
    collections, 
    createCollection, 
    deleteCollection,
    updateCollection,
    createFolder,
    createRequest,
    renameFolder,
    renameRequest,
    deleteFolder,
    deleteRequest,
    getRequest,
    moveRequest,
    moveFolder,
    reorderItems,
  } = useCollectionsStore();
  const { startRun } = useRunnerStore();
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    options: ContextMenuOption[];
    position: { x: number; y: number };
  } | null>(null);
  const [copiedItem, setCopiedItem] = useState<{ type: 'request' | 'folder'; data: any; collection: string; folder?: string[] } | null>(null);
  const [renamingItem, setRenamingItem] = useState<{
    type: 'collection' | 'folder' | 'request';
    collection: string;
    folder?: string[];
    name: string;
  } | null>(null);
  const [draggedItem, setDraggedItem] = useState<{
    type: 'folder' | 'request';
    collection: string;
    folder: string[] | null;
    name: string;
    index: number;
  } | null>(null);
  const [dragOverItem, setDragOverItem] = useState<{
    type: 'folder' | 'request';
    collection: string;
    folder: string[] | null;
    index: number;
    position?: 'above' | 'below'; // for request: drop above or below this item
  } | null>(null);
  const folderRenameInputRef = useRef<HTMLInputElement>(null);
  // Store folder rename target when opening context menu so Rename action always has correct path
  const pendingFolderRenameRef = useRef<{ collection: string; folderPath: string[]; name: string } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Focus folder rename input when entering rename mode (autoFocus can fail after context menu)
  useEffect(() => {
    if (renamingItem?.type === 'folder') {
      const id = requestAnimationFrame(() => {
        folderRenameInputRef.current?.focus();
        folderRenameInputRef.current?.select();
      });
      return () => cancelAnimationFrame(id);
    }
  }, [renamingItem?.type, renamingItem?.collection, renamingItem?.folder]);

  const toggleCollection = (name: string) => {
    const newExpanded = new Set(expandedCollections);
    if (newExpanded.has(name)) {
      newExpanded.delete(name);
    } else {
      newExpanded.add(name);
    }
    setExpandedCollections(newExpanded);
  };

  const handleCreateCollection = async () => {
    if (newCollectionName.trim()) {
      await createCollection(newCollectionName.trim());
      setNewCollectionName('');
      setShowCreateCollection(false);
    }
  };

  const showContextMenu = (
    e: React.MouseEvent,
    type: 'collection' | 'folder' | 'request',
    collection: string,
    folder?: string[],
    request?: string
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const options: ContextMenuOption[] = [];

    if (type === 'collection') {
      options.push(
        { label: 'Add Request', action: () => handleAddRequest(collection, null) },
        { label: 'Add Folder', action: () => handleAddFolder(collection, null) },
        { separator: true },
        { label: 'Run', action: () => handleRun(collection) },
        { separator: true },
        { label: 'Rename', action: () => { setContextMenu(null); setTimeout(() => handleRename(type, collection, undefined, collections[collection].name), 0); }, shortcut: '⌘E' },
        { label: 'Duplicate', action: () => handleDuplicateCollection(collection), shortcut: '⌘D' },
        { separator: true },
        { label: 'Delete', action: () => handleDelete(type, collection), danger: true, shortcut: '⌘⌫' }
      );
    } else if (type === 'folder' && folder && folder.length > 0) {
      const folderPath = [...folder];
      const folderName = folderPath[folderPath.length - 1];
      pendingFolderRenameRef.current = { collection, folderPath, name: folderName };
      options.push(
        { label: 'Add Request', action: () => handleAddRequest(collection, folder!) },
        { label: 'Add Folder', action: () => handleAddFolder(collection, folder!) },
        { separator: true },
        { label: 'Run', action: () => handleRun(collection) },
        { separator: true },
        { label: 'Rename', action: () => {
          const target = pendingFolderRenameRef.current;
          if (target) {
            handleRename('folder', target.collection, target.folderPath, target.name);
            pendingFolderRenameRef.current = null;
          }
          setContextMenu(null);
        }, shortcut: '⌘E' },
        { label: 'Copy', action: () => handleCopy('folder', collection, folder!) },
        { label: 'Paste', action: () => handlePaste(collection, folder), disabled: !copiedItem },
        { label: 'Duplicate', action: () => handleDuplicateFolder(collection, folder!), shortcut: '⌘D' },
        { separator: true },
        { label: 'Delete', action: () => handleDelete(type, collection, folder), danger: true, shortcut: '⌘⌫' }
      );
    } else if (type === 'request') {
      options.push(
        { label: 'Rename', action: () => { setContextMenu(null); setTimeout(() => handleRename(type, collection, folder, request!), 0); }, shortcut: '⌘E' },
        { label: 'Copy', action: () => handleCopy('request', collection, folder, request!) },
        { label: 'Paste', action: () => handlePaste(collection, folder), disabled: !copiedItem },
        { label: 'Duplicate', action: () => handleDuplicateRequest(collection, folder, request!), shortcut: '⌘D' },
        { separator: true },
        { label: 'Delete', action: () => handleDelete(type, collection, folder, request), danger: true, shortcut: '⌘⌫' }
      );
    }

    setContextMenu({
      options,
      position: { x: e.clientX, y: e.clientY },
    });
  };

  const handleAddRequest = async (collection: string, folder: string[] | null) => {
    const newRequest: Request = {
      name: 'New Request',
      method: 'GET',
      url: '',
      headers: [],
      queryParams: [],
    };
    await createRequest(collection, folder, newRequest);
    // Reload collections to get the new request
    await useCollectionsStore.getState().loadCollections();
    // Set it to edit mode
    setRenamingItem({ type: 'request', collection, folder: folder || undefined, name: 'New Request' });
  };

  const handleAddFolder = async (collection: string, folder: string[] | null | undefined) => {
    await createFolder(collection, folder || [], 'New Folder');
    // Reload collections to get the new folder
    await useCollectionsStore.getState().loadCollections();
    // Set it to edit mode
    const folderPath = folder ? [...folder, 'New Folder'] : ['New Folder'];
    setRenamingItem({ type: 'folder', collection, folder: folderPath, name: 'New Folder' });
  };

  const handleRun = (collection: string) => {
    startRun(collection);
  };

  const handleRename = (type: 'collection' | 'folder' | 'request', collection: string, folder?: string[], name?: string) => {
    setRenamingItem({
      type,
      collection,
      folder: Array.isArray(folder) ? [...folder] : undefined,
      name: name ?? '',
    });
  };

  const folderPathEqual = (a: string[] | undefined | null, b: string[] | null) => {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a.length === b.length && a.every((v, i) => v === b[i]);
  };

  const handleCopy = (type: 'request' | 'folder', collection: string, folder?: string[], request?: string) => {
    if (type === 'request' && request) {
      const req = getRequest(collection, folder || null, request);
      if (req) {
        setCopiedItem({ type: 'request', data: req, collection, folder });
      }
    } else if (type === 'folder' && folder) {
      // Copy folder structure
      const collectionData = collections[collection];
      // Find folder in structure
      let target: Folder | undefined;
      let current: Folder[] | typeof collectionData = collectionData;
      for (const pathPart of folder) {
        if ('folders' in current) {
          target = current.folders.find(f => f.name === pathPart);
          if (target) current = target;
        }
      }
      if (target) {
        setCopiedItem({ type: 'folder', data: target, collection, folder: folder.slice(0, -1) });
      }
    }
  };

  const handlePaste = async (collection: string, folder: string[] | null | undefined) => {
    if (!copiedItem) return;

    if (copiedItem.type === 'request') {
      const newRequest = { ...copiedItem.data, name: `${copiedItem.data.name} (Copy)` };
      await createRequest(collection, folder ?? null, newRequest);
    } else if (copiedItem.type === 'folder') {
      // Paste folder (simplified - would need recursive copy)
      await createFolder(collection, folder ?? [], `${copiedItem.data.name} (Copy)`);
    }
  };

  const handleDuplicateCollection = async (collection: string) => {
    const coll = collections[collection];
    const newName = `${coll.name} (Copy)`;
    await createCollection(newName, coll.description);
    // Copy all requests and folders
    for (const req of coll.requests) {
      await createRequest(newName, null, { ...req, name: `${req.name} (Copy)` });
    }
    // Note: Nested folders are not duplicated; only top-level requests are copied.
  };

  const handleDuplicateFolder = async (collection: string, folder: string[]) => {
    // Find and duplicate folder
    const collectionData = collections[collection];
    let target: Folder | undefined;
    let current: Folder[] | typeof collectionData = collectionData;
    for (const pathPart of folder) {
      if ('folders' in current) {
        target = current.folders.find(f => f.name === pathPart);
        if (target) current = target;
      }
    }
    if (target) {
      await createFolder(collection, folder.slice(0, -1), `${target.name} (Copy)`);
    }
  };

  const handleDuplicateRequest = async (collection: string, folder: string[] | null | undefined, request: string) => {
    const req = getRequest(collection, folder ?? null, request);
    if (req) {
      await createRequest(collection, folder ?? null, { ...req, name: `${req.name} (Copy)` });
    }
  };

  const handleDelete = async (type: 'collection' | 'folder' | 'request', collection: string, folder?: string[], request?: string) => {
    const itemName = type === 'collection' 
      ? collections[collection]?.name || collection
      : type === 'folder'
      ? folder?.[folder.length - 1] || 'folder'
      : request || 'request';
    
    setConfirmDialog({
      isOpen: true,
      title: `Delete ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      message: `Are you sure you want to delete "${itemName}"? This action cannot be undone.`,
      onConfirm: async () => {
        setConfirmDialog(null);
        if (type === 'collection') {
          await deleteCollection(collection);
        } else if (type === 'folder') {
          await deleteFolder(collection, folder!);
        } else if (type === 'request') {
          await deleteRequest(collection, folder || null, request!);
        }
      },
    });
  };

  const handleRenameSubmit = async (newName: string) => {
    if (!renamingItem || !newName.trim() || newName.trim() === renamingItem.name) {
      setRenamingItem(null);
      return;
    }

    const trimmedName = newName.trim();

    if (renamingItem.type === 'collection') {
      await updateCollection(renamingItem.collection, { name: trimmedName });
      // Reload collections to reflect the rename
      await useCollectionsStore.getState().loadCollections();
    } else if (renamingItem.type === 'folder') {
      const folderPath = renamingItem.folder ?? [];
      if (folderPath.length > 0) {
        await renameFolder(renamingItem.collection, folderPath, trimmedName);
        await useCollectionsStore.getState().loadCollections();
      }
    } else if (renamingItem.type === 'request') {
      await renameRequest(renamingItem.collection, renamingItem.folder || null, renamingItem.name, trimmedName);
      await useCollectionsStore.getState().loadCollections();
    }

    setRenamingItem(null);
  };

  const handleDragStart = (e: React.DragEvent, type: 'folder' | 'request', collection: string, folder: string[] | null, name: string, index: number) => {
    setDraggedItem({ type, collection, folder, name, index });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', ''); // Required for Firefox
  };

  const handleDragOver = (e: React.DragEvent, type: 'folder' | 'request', collection: string, folder: string[] | null, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (type === 'request' && draggedItem?.type === 'request') {
      const rect = e.currentTarget.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      const position = e.clientY < mid ? 'above' : 'below';
      setDragOverItem({ type, collection, folder, index, position });
    } else {
      setDragOverItem({ type, collection, folder, index });
    }
  };

  const handleDragLeave = () => {
    setDragOverItem(null);
  };

  const handleDrop = async (
    e: React.DragEvent,
    targetType: 'folder' | 'request',
    targetCollection: string,
    targetFolder: string[] | null,
    targetIndex: number,
    targetFolderName?: string,
    dropPosition?: 'above' | 'below'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverItem(null);

    if (!draggedItem) return;

    const { type, collection, folder, name, index } = draggedItem;

    // Drop above/below a request: insert at a specific index
    if (type === 'request' && targetType === 'request' && (dropPosition === 'above' || dropPosition === 'below')) {
      const dropIndex = dropPosition === 'above' ? targetIndex : targetIndex + 1;
      const sameFolder = collection === targetCollection && JSON.stringify(folder) === JSON.stringify(targetFolder);
      if (sameFolder) {
        if (index === dropIndex || index === dropIndex - 1) {
          setDraggedItem(null);
          return;
        }
        const toIndex = index < dropIndex ? dropIndex - 1 : dropIndex;
        await reorderItems(collection, folder, 'request', index, toIndex);
      } else {
        await moveRequest(collection, folder, targetCollection, targetFolder, name);
        const { collections: cols } = useCollectionsStore.getState();
        const col = cols[targetCollection];
        let target: Folder | typeof col = col;
        if (targetFolder && targetFolder.length > 0) {
          for (const part of targetFolder) {
            const folders = 'folders' in target ? target.folders : (target as any).folders;
            const found = folders?.find((f: Folder) => f.name === part);
            if (found) target = found;
          }
        }
        const requests = 'requests' in target ? target.requests : (target as any).requests;
        const fromIndex = requests.findIndex((r: Request) => r.name === name);
        if (fromIndex >= 0 && fromIndex !== dropIndex) {
          await reorderItems(targetCollection, targetFolder, 'request', fromIndex, dropIndex);
        }
      }
      setDraggedItem(null);
      return;
    }

    // Same item, do nothing
    if (collection === targetCollection && 
        JSON.stringify(folder) === JSON.stringify(targetFolder) && 
        index === targetIndex && 
        type === targetType) {
      setDraggedItem(null);
      return;
    }

    // Reordering within the same parent (drag onto same type without position)
    if (collection === targetCollection && 
        JSON.stringify(folder) === JSON.stringify(targetFolder) && 
        type === targetType) {
      await reorderItems(collection, folder!, type, index, targetIndex);
    } else if (type === 'request') {
      // Dropped on a folder row: move request into that folder
      if (targetType === 'folder' && targetFolderName) {
        const targetFolderPath = targetFolder ? [...targetFolder, targetFolderName] : [targetFolderName];
        await moveRequest(collection, folder, targetCollection, targetFolderPath, name);
      }
      // Dropping directly on a request (no position) is no-op; use above/below instead
    } else if (type === 'folder') {
      // Moving folder to different location
      const fromPath = folder || [];
      // If dropped on a folder, move into that folder
      let toPath: string[];
      if (targetType === 'folder' && targetFolderName) {
        toPath = targetFolder ? [...targetFolder, targetFolderName] : [targetFolderName];
      } else {
        toPath = targetFolder || [];
      }
      // Don't allow moving folder into itself or its children
      if (toPath.length > 0 && fromPath.length > 0) {
        const fromPathStr = fromPath.join('/');
        const toPathStr = toPath.join('/');
        if (toPathStr.startsWith(fromPathStr + '/')) {
          setDraggedItem(null);
          return;
        }
      }
      await moveFolder(collection, fromPath, toPath);
    }

    setDraggedItem(null);
  };

  const renderFolder = (folder: Folder, collectionName: string, folderPath: string[] = [], folderIndex: number = 0) => {
    // Include folderIndex so siblings have unique keys and expand/collapse state is independent
    const folderKey = `${collectionName}/${folderPath.join('/')}/${folderIndex}/${folder.name}`;
    const isExpanded = expandedFolders.has(folderKey);
    const currentFolderPath = [...folderPath, folder.name];
    const isRenaming = renamingItem?.type === 'folder' &&
      renamingItem.collection === collectionName &&
      folderPathEqual(renamingItem.folder, currentFolderPath);

    return (
      <div key={folderKey} className="ml-4">
        <div
          draggable
          onDragStart={(e) => handleDragStart(e, 'folder', collectionName, folderPath.length > 0 ? folderPath : null, folder.name, folderIndex)}
          onDragOver={(e) => handleDragOver(e, 'folder', collectionName, folderPath.length > 0 ? folderPath : null, folderIndex)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'folder', collectionName, folderPath.length > 0 ? folderPath : null, folderIndex, folder.name)}
          className={`flex items-center gap-2 py-1.5 px-2 hover:bg-primary-soft cursor-pointer group ${
            dragOverItem?.collection === collectionName && 
            dragOverItem.index === folderIndex &&
            ((dragOverItem.type === 'folder' && JSON.stringify(dragOverItem.folder) === JSON.stringify(folderPath.length > 0 ? folderPath : null)) ||
             (draggedItem?.type === 'request' && dragOverItem.type === 'folder'))
              ? 'bg-primary-soft border-2 border-primary' 
              : ''
          }`}
          onClick={() => {
            if (!isRenaming) {
              const newExpanded = new Set(expandedFolders);
              if (newExpanded.has(folderKey)) {
                newExpanded.delete(folderKey);
              } else {
                newExpanded.add(folderKey);
              }
              setExpandedFolders(newExpanded);
            }
          }}
          onContextMenu={(e) => showContextMenu(e, 'folder', collectionName, [...folderPath, folder.name])}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
            <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" fill="#374151" />
            <path d="M3 7l2-2h6l2 2H3z" fill="#0369A1" />
          </svg>
          <span className="text-text-secondary text-xs">{isExpanded ? '▼' : '▶'}</span>
          {isRenaming ? (
            <input
              key={`folder-rename-${collectionName}-${currentFolderPath.join('/')}`}
              ref={folderRenameInputRef}
              type="text"
              defaultValue={folder.name}
              onBlur={(e) => handleRenameSubmit(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit(e.currentTarget.value);
                if (e.key === 'Escape') setRenamingItem(null);
              }}
              className="flex-1 border border-primary rounded px-1 text-sm"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <>
              <span
                className="text-sm text-text-primary font-medium flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
                title={folder.name}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  handleRename('folder', collectionName, currentFolderPath, folder.name);
                }}
              >
                {folder.name}
              </span>
              <button
                className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-text-primary px-1"
                onClick={(e) => {
                  e.stopPropagation();
                  showContextMenu(e, 'folder', collectionName, [...folderPath, folder.name]);
                }}
              >
                ⋯
              </button>
            </>
          )}
        </div>
        {isExpanded && (
          <div>
            {folder.folders.map((f, idx) => renderFolder(f, collectionName, [...folderPath, folder.name], idx))}
            {folder.requests.map((req, idx) => {
              const requestFolderPath = [...folderPath, folder.name];
              const isRenamingReq = renamingItem?.type === 'request' && 
                renamingItem.collection === collectionName && 
                folderPathEqual(renamingItem.folder, requestFolderPath) &&
                renamingItem.name === req.name;
              const isDragOverThis = dragOverItem?.type === 'request' &&
                dragOverItem.collection === collectionName &&
                JSON.stringify(dragOverItem.folder) === JSON.stringify(requestFolderPath) &&
                dragOverItem.index === idx;
              const dropLineAbove = isDragOverThis && dragOverItem?.position === 'above';
              const dropLineBelow = isDragOverThis && dragOverItem?.position === 'below';

              return (
                <div key={req.name} className="relative">
                  {dropLineAbove && (
                    <div className="absolute left-0 right-0 top-0 h-0.5 bg-primary z-10 rounded-full shadow-sm" style={{ marginLeft: '1.5rem' }} aria-hidden />
                  )}
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, 'request', collectionName, [...folderPath, folder.name], req.name, idx)}
                    onDragOver={(e) => handleDragOver(e, 'request', collectionName, [...folderPath, folder.name], idx)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, 'request', collectionName, [...folderPath, folder.name], idx, undefined, isDragOverThis ? dragOverItem?.position : undefined)}
                    className={`ml-6 py-1.5 px-2 hover:bg-primary-soft cursor-pointer text-xs text-text-primary group flex items-center gap-2 ${
                      isDragOverThis && !dragOverItem?.position ? 'bg-primary-soft border-2 border-primary' : ''
                    }`}
                  onClick={() => {
                    if (!isRenamingReq) {
                      onSelectRequest(collectionName, [...folderPath, folder.name], req.name);
                    }
                  }}
                  onContextMenu={(e) => showContextMenu(e, 'request', collectionName, [...folderPath, folder.name], req.name)}
                >
                  {isRenamingReq ? (
                    <input
                      type="text"
                      defaultValue={req.name}
                      onBlur={(e) => handleRenameSubmit(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameSubmit(e.currentTarget.value);
                        if (e.key === 'Escape') setRenamingItem(null);
                      }}
                      className="flex-1 border border-primary rounded px-1 text-xs"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      <span className={`font-semibold text-xs ${
                        req.method === 'GET' ? 'text-method-get' :
                        req.method === 'POST' ? 'text-method-post' :
                        req.method === 'PUT' ? 'text-method-put' :
                        req.method === 'PATCH' ? 'text-method-patch' :
                        req.method === 'DELETE' ? 'text-method-delete' :
                        'text-text-secondary'
                      }`}>{req.method}</span>
                      <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-text-primary" title={req.name}>{req.name}</span>
                      <button
                        className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-text-primary px-1 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          showContextMenu(e, 'request', collectionName, [...folderPath, folder.name], req.name);
                        }}
                              >
                                ⋯
                              </button>
                            </>
                          )}
                  </div>
                  {dropLineBelow && (
                    <div className="absolute left-0 right-0 top-full h-0.5 bg-primary z-10 rounded-full shadow-sm" style={{ marginLeft: '1.5rem' }} aria-hidden />
                  )}
                </div>
                      );
                    })}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <ConfirmDialog
        isOpen={confirmDialog?.isOpen || false}
        title={confirmDialog?.title || ''}
        message={confirmDialog?.message || ''}
        onConfirm={confirmDialog?.onConfirm || (() => {})}
        onCancel={() => setConfirmDialog(null)}
        danger={true}
        confirmText="Delete"
      />
      <div className="w-[276px] bg-bg-sidebar border-r border-border flex flex-col h-full shrink-0">
        <div className="p-4 border-b border-border bg-surface-secondary">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-text-primary text-lg">Collections</h2>
            <button
              onClick={() => setShowCreateCollection(true)}
              className="text-primary hover:text-primary-hover text-sm font-medium"
            >
              + New
            </button>
          </div>
          {showCreateCollection && (
            <div className="mt-2">
              <input
                type="text"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateCollection();
                  if (e.key === 'Escape') setShowCreateCollection(false);
                }}
                placeholder="Collection name"
                className="w-full border border-input-border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleCreateCollection}
                  className="flex-1 bg-primary text-white text-xs py-1 px-2 rounded hover:bg-primary-hover"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setShowCreateCollection(false);
                    setNewCollectionName('');
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 text-xs py-1 px-2 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {Object.entries(collections).map(([name, collection]) => {
            const isRenaming = renamingItem?.type === 'collection' && renamingItem.collection === name;

            return (
              <div key={name}>
                <div
                  className="flex items-center gap-2 py-2 px-4 hover:bg-primary-soft cursor-pointer font-semibold text-text-primary group"
                  onClick={() => {
                    if (!isRenaming) {
                      toggleCollection(name);
                    }
                  }}
                  onContextMenu={(e) => showContextMenu(e, 'collection', name)}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" fill="#15803D" />
                    <path d="M5 9h14v2H5V9z" fill="#14532D" />
                    <path d="M7 5h6v2H7V5z" fill="#0F5132" />
                  </svg>
                  <span className="text-text-secondary">
                    {expandedCollections.has(name) ? '▼' : '▶'}
                  </span>
                  {isRenaming ? (
                    <input
                      type="text"
                      defaultValue={collection.name}
                      onBlur={(e) => handleRenameSubmit(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameSubmit(e.currentTarget.value);
                        if (e.key === 'Escape') setRenamingItem(null);
                      }}
                      className="flex-1 border border-primary rounded px-1 text-sm"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[16px] text-emerald-600" title={name}>{collection.name}</span>
                      <button
                        className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-text-primary px-1 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          showContextMenu(e, 'collection', name);
                        }}
                      >
                        ⋯
                      </button>
                    </>
                  )}
                </div>
                {expandedCollections.has(name) && (
                  <div>
                    {collection.folders.map((folder, idx) => renderFolder(folder, name, [], idx))}
                    {collection.requests.map((req, idx) => {
                      const isRenamingReq = renamingItem?.type === 'request' && 
                        renamingItem.collection === name && 
                        folderPathEqual(renamingItem.folder, null) &&
                        renamingItem.name === req.name;
                      const isDragOverThis = dragOverItem?.type === 'request' &&
                        dragOverItem.collection === name &&
                        dragOverItem.folder === null &&
                        dragOverItem.index === idx;
                      const dropLineAbove = isDragOverThis && dragOverItem?.position === 'above';
                      const dropLineBelow = isDragOverThis && dragOverItem?.position === 'below';

                      return (
                        <div key={req.name} className="relative">
                          {dropLineAbove && (
                            <div className="absolute left-0 right-0 top-0 h-0.5 bg-primary z-10 rounded-full shadow-sm ml-4" aria-hidden />
                          )}
                          <div
                            draggable
                            onDragStart={(e) => handleDragStart(e, 'request', name, null, req.name, idx)}
                            onDragOver={(e) => handleDragOver(e, 'request', name, null, idx)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, 'request', name, null, idx, undefined, isDragOverThis ? dragOverItem?.position : undefined)}
                            className={`ml-4 py-1.5 px-2 hover:bg-primary-soft cursor-pointer text-xs text-text-primary group flex items-center gap-2 ${
                              isDragOverThis && !dragOverItem?.position ? 'bg-primary-soft border-2 border-primary' : ''
                            }`}
                          onClick={() => {
                            if (!isRenamingReq) {
                              onSelectRequest(name, null, req.name);
                            }
                          }}
                          onContextMenu={(e) => showContextMenu(e, 'request', name, undefined, req.name)}
                        >
                          {isRenamingReq ? (
                            <input
                              type="text"
                              defaultValue={req.name}
                              onBlur={(e) => handleRenameSubmit(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameSubmit(e.currentTarget.value);
                                if (e.key === 'Escape') setRenamingItem(null);
                              }}
                              className="flex-1 border border-primary rounded px-1 text-xs"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <>
                              <span className={`font-semibold text-xs ${
                                req.method === 'GET' ? 'text-method-get' :
                                req.method === 'POST' ? 'text-method-post' :
                                req.method === 'PUT' ? 'text-method-put' :
                                req.method === 'PATCH' ? 'text-method-patch' :
                                req.method === 'DELETE' ? 'text-method-delete' :
                                'text-text-secondary'
                              }`}>{req.method}</span>
                              <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-text-primary" title={req.name}>{req.name}</span>
                              <button
                                className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-text-primary px-1 shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  showContextMenu(e, 'request', name, undefined, req.name);
                                }}
                              >
                                ⋯
                              </button>
                            </>
                          )}
                          </div>
                          {dropLineBelow && (
                            <div className="absolute left-0 right-0 top-full h-0.5 bg-primary z-10 rounded-full shadow-sm ml-4" aria-hidden />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {Object.keys(collections).length === 0 && (
            <div className="p-4 text-sm text-gray-500 text-center">
              No collections. Create one to get started.
            </div>
          )}
        </div>
      </div>
      {contextMenu && (
        <ContextMenu
          options={contextMenu.options}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}
