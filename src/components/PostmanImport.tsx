import { useState, useRef, useCallback } from 'react';
import { useCollectionsStore } from '../stores/collectionsStore';
import { useEnvironmentsStore } from '../stores/environmentsStore';
import { importPostmanCollection, importPostmanEnvironment } from '../utils/postmanImport';

export default function PostmanImport() {
  const { createCollection, loadCollections, createRequest, createFolder } = useCollectionsStore();
  const { createEnvironmentWithVariables, loadEnvironments } = useEnvironmentsStore();
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [dragType, setDragType] = useState<'collection' | 'environment' | null>(null);
  const collectionInputRef = useRef<HTMLInputElement>(null);
  const environmentInputRef = useRef<HTMLInputElement>(null);

  const importOneCollection = async (file: File): Promise<{ name: string; requests: number }> => {
    const collection = await importPostmanCollection(file);
    await createCollection(collection.name, collection.description);

    const importFolders = async (folders: typeof collection.folders, folderPath: string[] = []) => {
      for (const folder of folders) {
        await createFolder(collection.name, folderPath, folder.name);
        for (const request of folder.requests) {
          await createRequest(collection.name, [...folderPath, folder.name], request);
        }
        if (folder.folders.length > 0) {
          await importFolders(folder.folders, [...folderPath, folder.name]);
        }
      }
    };

    for (const request of collection.requests) {
      await createRequest(collection.name, null, request);
    }
    if (collection.folders.length > 0) {
      await importFolders(collection.folders);
    }

    const requestCount =
      collection.requests.length +
      collection.folders.reduce((sum, f) => sum + f.requests.length, 0);
    return { name: collection.name, requests: requestCount };
  };

  const processCollectionFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(
      (f) => f.type === 'application/json' || f.name.endsWith('.json')
    );
    if (fileArray.length === 0) {
      setError('No JSON files selected');
      return;
    }
    setImporting(true);
    setError(null);
    setSuccess(null);
    const succeeded: { name: string; requests: number }[] = [];
    const failed: { file: string; message: string }[] = [];

    try {
      for (const file of fileArray) {
        try {
          const result = await importOneCollection(file);
          succeeded.push(result);
        } catch (err) {
          failed.push({
            file: file.name,
            message: err instanceof Error ? err.message : 'Failed to import',
          });
        }
      }
      await loadCollections();
      if (succeeded.length > 0) {
        const msg =
          succeeded.length === 1
            ? `Collection "${succeeded[0].name}" imported (${succeeded[0].requests} request${succeeded[0].requests !== 1 ? 's' : ''}).`
            : `${succeeded.length} collections imported: ${succeeded.map((s) => s.name).join(', ')}.`;
        setSuccess(
          failed.length > 0
            ? `${msg} Failed: ${failed.map((f) => `${f.file} (${f.message})`).join('; ')}`
            : msg
        );
      }
      if (failed.length > 0 && succeeded.length === 0) {
        setError(failed.map((f) => `${f.file}: ${f.message}`).join('; '));
      }
    } finally {
      setImporting(false);
    }
  };

  const importOneEnvironment = async (file: File): Promise<string> => {
    const environment = await importPostmanEnvironment(file);
    await createEnvironmentWithVariables(environment.name, environment.variables);
    return environment.name;
  };

  const processEnvironmentFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(
      (f) => f.type === 'application/json' || f.name.endsWith('.json')
    );
    if (fileArray.length === 0) {
      setError('No JSON files selected');
      return;
    }
    setImporting(true);
    setError(null);
    setSuccess(null);
    const succeeded: string[] = [];
    const failed: { file: string; message: string }[] = [];

    try {
      for (const file of fileArray) {
        try {
          const name = await importOneEnvironment(file);
          succeeded.push(name);
        } catch (err) {
          failed.push({
            file: file.name,
            message: err instanceof Error ? err.message : 'Failed to import',
          });
        }
      }
      await loadEnvironments();
      if (succeeded.length > 0) {
        const msg =
          succeeded.length === 1
            ? `Environment "${succeeded[0]}" imported.`
            : `${succeeded.length} environments imported: ${succeeded.join(', ')}.`;
        setSuccess(
          failed.length > 0
            ? `${msg} Failed: ${failed.map((f) => `${f.file} (${f.message})`).join('; ')}`
            : msg
        );
      }
      if (failed.length > 0 && succeeded.length === 0) {
        setError(failed.map((f) => `${f.file}: ${f.message}`).join('; '));
      }
    } finally {
      setImporting(false);
    }
  };

  const handleCollectionImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;
    await processCollectionFiles(files);
    event.target.value = '';
  };

  const handleEnvironmentImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;
    await processEnvironmentFiles(files);
    event.target.value = '';
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

  const handleDrop = useCallback(
    async (e: React.DragEvent, type: 'collection' | 'environment') => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      setDragType(null);

      const files = e.dataTransfer.files;
      if (!files?.length) return;

      const jsonFiles = Array.from(files).filter(
        (f) => f.type === 'application/json' || f.name.endsWith('.json')
      );
      if (jsonFiles.length === 0) {
        setError('Please drop JSON file(s)');
        return;
      }
      if (type === 'collection') {
        await processCollectionFiles(jsonFiles);
      } else {
        await processEnvironmentFiles(jsonFiles);
      }
    },
    []
  );

  const dropBoxClass = `
    bg-surface rounded-lg shadow border border-border
    border-dashed p-4 text-center transition-colors
    ${importing ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:border-primary hover:bg-surface-secondary'}
  `;
  const dropBoxActiveClass = 'border-primary bg-primary-soft';

  return (
    <div className="h-full flex flex-col items-center px-6 pb-6">
      <h2 className="text-2xl font-bold text-text-primary mb-6">Import</h2>

      {error && (
        <div className="mb-4 max-w-md w-full p-3 bg-surface border border-error rounded-lg text-error text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 max-w-md w-full p-3 bg-primary-soft border border-primary rounded-lg text-primary text-sm">
          {success}
        </div>
      )}

      <div className="space-y-12 max-w-md w-full">
        <div className="bg-surface rounded-lg shadow border border-border p-4">
          <label className="block text-sm font-bold text-text-primary mb-2">
            Import Collection (v2.1)
          </label>
          <div
            onDragEnter={(e) => handleDrag(e, 'collection')}
            onDragLeave={(e) => handleDrag(e, 'collection')}
            onDragOver={(e) => handleDrag(e, 'collection')}
            onDrop={(e) => handleDrop(e, 'collection')}
            className={`${dropBoxClass} ${dragActive && dragType === 'collection' ? dropBoxActiveClass : ''}`}
            onClick={() => collectionInputRef.current?.click()}
          >
            <input
              ref={collectionInputRef}
              type="file"
              accept=".json,application/json"
              multiple
              onChange={handleCollectionImport}
              disabled={importing}
              className="hidden"
            />
            <div className="space-y-1.5">
              <svg
                className="mx-auto h-8 w-8 text-text-muted"
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
                <span className="font-medium text-primary hover:text-primary-hover">Click to upload</span> or drag and drop
              </div>
              <p className="text-xs text-text-muted">JSON file(s) (v2.1 collection)</p>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-lg shadow border border-border p-4">
          <label className="block text-sm font-bold text-text-primary mb-2">
            Import Environment
          </label>
          <div
            onDragEnter={(e) => handleDrag(e, 'environment')}
            onDragLeave={(e) => handleDrag(e, 'environment')}
            onDragOver={(e) => handleDrag(e, 'environment')}
            onDrop={(e) => handleDrop(e, 'environment')}
            className={`${dropBoxClass} ${dragActive && dragType === 'environment' ? dropBoxActiveClass : ''}`}
            onClick={() => environmentInputRef.current?.click()}
          >
            <input
              ref={environmentInputRef}
              type="file"
              accept=".json,application/json"
              multiple
              onChange={handleEnvironmentImport}
              disabled={importing}
              className="hidden"
            />
            <div className="space-y-1.5">
              <svg
                className="mx-auto h-8 w-8 text-text-muted"
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
                <span className="font-medium text-primary hover:text-primary-hover">Click to upload</span> or drag and drop
              </div>
              <p className="text-xs text-text-muted">JSON file(s) (environment)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
