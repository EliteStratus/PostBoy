import { useState, useRef, useCallback } from 'react';
import { useCollectionsStore } from '../stores/collectionsStore';
import { useEnvironmentsStore } from '../stores/environmentsStore';
import { importPostmanCollection, importPostmanEnvironment } from '../utils/postmanImport';

export default function PostmanImport() {
  const { createCollection, loadCollections, createRequest, createFolder } = useCollectionsStore();
  const { createEnvironment, loadEnvironments } = useEnvironmentsStore();
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [dragType, setDragType] = useState<'collection' | 'environment' | null>(null);
  const collectionInputRef = useRef<HTMLInputElement>(null);
  const environmentInputRef = useRef<HTMLInputElement>(null);

  const processCollectionFile = async (file: File) => {
    setImporting(true);
    setError(null);
    setSuccess(null);

    try {
      const collection = await importPostmanCollection(file);
      await createCollection(collection.name, collection.description);
      
      // Import folders recursively
      const importFolders = async (folders: typeof collection.folders, folderPath: string[] = []) => {
        for (const folder of folders) {
          await createFolder(collection.name, folderPath, folder.name);
          
          // Import requests in this folder
          for (const request of folder.requests) {
            await createRequest(collection.name, [...folderPath, folder.name], request);
          }
          
          // Recursively import nested folders
          if (folder.folders.length > 0) {
            await importFolders(folder.folders, [...folderPath, folder.name]);
          }
        }
      };
      
      // Import top-level requests
      for (const request of collection.requests) {
        await createRequest(collection.name, null, request);
      }
      
      // Import folders and their requests
      if (collection.folders.length > 0) {
        await importFolders(collection.folders);
      }
      
      await loadCollections();
      
      const requestCount = collection.requests.length + 
        collection.folders.reduce((sum, f) => sum + f.requests.length, 0);
      setSuccess(`Collection "${collection.name}" imported successfully! (${requestCount} request${requestCount !== 1 ? 's' : ''})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import collection');
    } finally {
      setImporting(false);
    }
  };

  const processEnvironmentFile = async (file: File) => {
    setImporting(true);
    setError(null);
    setSuccess(null);

    try {
      const environment = await importPostmanEnvironment(file);
      await createEnvironment(environment.name);
      
      // Import variables
      const envStore = useEnvironmentsStore.getState();
      for (const variable of environment.variables) {
        await envStore.addVariable(environment.name, variable);
      }
      
      await loadEnvironments();
      
      setSuccess(`Environment "${environment.name}" imported successfully!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import environment');
    } finally {
      setImporting(false);
    }
  };

  const handleCollectionImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await processCollectionFile(file);
  };

  const handleEnvironmentImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await processEnvironmentFile(file);
  };

  const handleDrag = useCallback((e: React.DragEvent, type: 'collection' | 'environment') => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
      setDragType(type);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
      setDragType(null);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, type: 'collection' | 'environment') => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setDragType(null);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      
      // Check file type
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        if (type === 'collection') {
          await processCollectionFile(file);
        } else {
          await processEnvironmentFile(file);
        }
      } else {
        setError('Please drop a JSON file');
      }
    }
  }, []);

  return (
    <div className="px-6 pb-6">
      <h2 className="text-xl font-bold mb-4">Import from Postman</h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700">
          {success}
        </div>
      )}

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Import Collection (Postman v2.1)
          </label>
          <div
            onDragEnter={(e) => handleDrag(e, 'collection')}
            onDragLeave={(e) => handleDrag(e, 'collection')}
            onDragOver={(e) => handleDrag(e, 'collection')}
            onDrop={(e) => handleDrop(e, 'collection')}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-colors
              ${dragActive && dragType === 'collection'
                ? 'border-primary bg-primary-soft'
                : 'border-border hover:border-primary hover:bg-surface-secondary'
              }
              ${importing ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
            `}
            onClick={() => collectionInputRef.current?.click()}
          >
            <input
              ref={collectionInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleCollectionImport}
              disabled={importing}
              className="hidden"
            />
            <div className="space-y-2">
              <svg
                className="mx-auto h-12 w-12 text-text-muted"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
                aria-hidden="true"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="text-sm text-text-secondary">
                <span className="font-medium text-primary hover:text-primary-hover">
                  Click to upload
                </span>{' '}
                or drag and drop
              </div>
              <p className="text-xs text-text-muted">JSON file (Postman v2.1 collection)</p>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Import Environment
          </label>
          <div
            onDragEnter={(e) => handleDrag(e, 'environment')}
            onDragLeave={(e) => handleDrag(e, 'environment')}
            onDragOver={(e) => handleDrag(e, 'environment')}
            onDrop={(e) => handleDrop(e, 'environment')}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-colors
              ${dragActive && dragType === 'environment'
                ? 'border-primary bg-primary-soft'
                : 'border-border hover:border-primary hover:bg-surface-secondary'
              }
              ${importing ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
            `}
            onClick={() => environmentInputRef.current?.click()}
          >
            <input
              ref={environmentInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleEnvironmentImport}
              disabled={importing}
              className="hidden"
            />
            <div className="space-y-2">
              <svg
                className="mx-auto h-12 w-12 text-text-muted"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
                aria-hidden="true"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="text-sm text-text-secondary">
                <span className="font-medium text-primary hover:text-primary-hover">
                  Click to upload
                </span>{' '}
                or drag and drop
              </div>
              <p className="text-xs text-text-muted">JSON file (Postman environment)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
