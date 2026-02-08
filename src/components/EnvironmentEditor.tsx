import { useState, useEffect } from 'react';
import { useEnvironmentsStore } from '../stores/environmentsStore';
import type { EnvironmentVariable } from '../types';
import { isSecretLikeKey } from '../utils/secretLikeKey';

export default function EnvironmentEditor() {
  const {
    environments,
    currentEnvironment,
    loadEnvironments,
    createEnvironment,
    renameEnvironment,
    deleteEnvironment,
    setCurrentEnvironment,
    addVariable,
    updateVariable,
    deleteVariable,
  } = useEnvironmentsStore();

  const [showCreate, setShowCreate] = useState(false);
  const [newEnvName, setNewEnvName] = useState('');
  const [envToDelete, setEnvToDelete] = useState<string | null>(null);
  const [renamingEnv, setRenamingEnv] = useState<{ current: string; draft: string } | null>(null);

  useEffect(() => {
    loadEnvironments();
  }, [loadEnvironments]);

  const handleCreateEnvironment = async () => {
    if (newEnvName.trim()) {
      await createEnvironment(newEnvName.trim());
      setCurrentEnvironment(newEnvName.trim());
      setNewEnvName('');
      setShowCreate(false);
    }
  };

  const handleDeleteEnvironment = async (name: string) => {
    setEnvToDelete(null);
    await deleteEnvironment(name);
  };

  const handleStartRename = (name: string) => {
    setRenamingEnv({ current: name, draft: name });
  };

  const handleRenameSubmit = async () => {
    if (!renamingEnv) return;
    const { current, draft } = renamingEnv;
    const trimmed = draft.trim();
    if (trimmed && trimmed !== current) {
      await renameEnvironment(current, trimmed);
    }
    setRenamingEnv(null);
  };

  const handleRenameCancel = () => {
    setRenamingEnv(null);
  };

  const currentEnv = currentEnvironment ? environments[currentEnvironment] : null;

  return (
    <div className="h-full flex flex-col px-6 pb-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-text-primary">Environments</h2>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-primary text-white w-9 h-9 flex items-center justify-center rounded hover:bg-primary-hover font-medium text-lg"
            title="New environment"
          >
            +
          </button>
        </div>

        {showCreate && (
          <div className="mb-4 p-4 bg-surface-secondary rounded border border-border">
            <input
              type="text"
              value={newEnvName}
              onChange={(e) => setNewEnvName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateEnvironment();
                if (e.key === 'Escape') setShowCreate(false);
              }}
              placeholder="Environment name"
              className="w-full border border-input-border rounded px-3 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-primary bg-input-bg"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreateEnvironment}
                className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-hover"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowCreate(false);
                  setNewEnvName('');
                }}
                className="bg-surface border border-border text-text-primary px-4 py-2 rounded hover:bg-surface-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-4 items-center">
          {[...Object.keys(environments)].sort().map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setCurrentEnvironment(name)}
              className={`px-4 py-2 rounded ${
                currentEnvironment === name
                  ? 'bg-primary text-white'
                  : 'bg-surface border border-border text-text-primary hover:bg-surface-secondary'
              }`}
            >
              {name}
            </button>
          ))}
        </div>

        {envToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEnvToDelete(null)}>
            <div
              className="bg-surface border border-border rounded-lg shadow-lg p-6 max-w-sm w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-text-primary mb-2">Delete environment?</h3>
              <p className="text-text-muted mb-4">
                &quot;{envToDelete}&quot; will be permanently deleted. This cannot be undone.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setEnvToDelete(null)}
                  className="px-4 py-2 rounded border border-border text-text-primary hover:bg-surface-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteEnvironment(envToDelete)}
                  className="px-4 py-2 rounded bg-error text-white hover:opacity-90"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {currentEnv ? (
        <div className="flex-1 overflow-auto">
          <div className="bg-surface rounded-lg shadow border border-border max-w-5xl">
            <div className="p-4 border-b border-border flex items-center justify-between gap-2">
              {renamingEnv && renamingEnv.current === currentEnv.name ? (
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <input
                    type="text"
                    value={renamingEnv.draft}
                    onChange={(e) => setRenamingEnv((r) => (r ? { ...r, draft: e.target.value } : null))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameSubmit();
                      if (e.key === 'Escape') handleRenameCancel();
                    }}
                    onBlur={handleRenameSubmit}
                    className="flex-1 min-w-0 text-lg font-semibold border border-input-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary bg-input-bg text-text-primary"
                    autoFocus
                    aria-label="Environment name"
                  />
                </div>
              ) : (
                <>
                  <h3 className="text-lg font-semibold text-text-primary truncate">{currentEnv.name}</h3>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleStartRename(currentEnv.name)}
                      className="flex items-center justify-center text-text-muted hover:text-primary p-2 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                      title="Rename environment"
                      aria-label={`Rename environment ${currentEnv.name}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEnvToDelete(currentEnv.name)}
                      className="flex items-center justify-center text-text-muted hover:text-error p-2 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                      title="Delete environment"
                      aria-label={`Delete environment ${currentEnv.name}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className="p-4">
              <div className="space-y-0">
                <div className="grid grid-cols-[auto_1fr_1fr_auto_auto] gap-2 items-center py-1.5 px-1 text-sm font-medium text-text-muted border-b border-border mb-1">
                  <div className="w-9 h-9 flex items-center justify-center" aria-hidden="true" />
                  <div className="text-left px-2">Variable Name</div>
                  <div className="text-left px-2">Variable Value</div>
                  <div className="w-20 text-left px-2">Visible</div>
                  <div className="w-10" />
                </div>
                {currentEnv.variables.map((variable, index) => (
                  <VariableRow
                    key={`${currentEnv.name}-${variable.key}-${index}`}
                    variable={variable}
                    onUpdate={(updates) => updateVariable(currentEnv.name, variable.key, updates)}
                    onDelete={() => deleteVariable(currentEnv.name, variable.key)}
                  />
                ))}
                {currentEnv.variables.length === 0 && (
                  <div className="text-center text-text-muted py-8">
                    No variables. Add one to get started.
                  </div>
                )}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => {
                    addVariable(currentEnv.name, {
                      key: '',
                      value: '',
                      type: 'string',
                      enabled: true,
                    });
                  }}
                  className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-hover"
                >
                  + Add Variable
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-text-muted">
          {Object.keys(environments).length === 0
            ? 'Create an environment to get started'
            : 'Select an environment to edit'}
        </div>
      )}
    </div>
  );
}

interface VariableRowProps {
  variable: EnvironmentVariable;
  onUpdate: (updates: Partial<EnvironmentVariable>) => void;
  onDelete: () => void;
}

function VariableRow({ variable, onUpdate, onDelete }: VariableRowProps) {
  const [key, setKey] = useState(variable.key);
  const [value, setValue] = useState(variable.value);
  const [type, setType] = useState(variable.type);
  const [enabled, setEnabled] = useState(variable.enabled);

  // Sync state when variable prop changes (e.g., when switching environments)
  useEffect(() => {
    setKey(variable.key);
    setValue(variable.value);
    setType(variable.type);
    setEnabled(variable.enabled);
  }, [variable]);

  // Debounce updates to avoid excessive re-renders and allow typing.
  // Default to Hide (secret, masked) when the key looks like a secret (type only; enabled stays independent).
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      let updateType = type;
      if (isSecretLikeKey(key)) {
        updateType = 'secret';
        setType('secret');
      }
      const hasChanges =
        key !== variable.key ||
        value !== variable.value ||
        updateType !== variable.type ||
        enabled !== variable.enabled;

      if (hasChanges) {
        onUpdate({ key, value, type: updateType, enabled });
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [key, value, type, enabled, variable.key, variable.value, variable.type, variable.enabled, onUpdate]);

  const visibleValue = type === 'secret' ? 'Hide' : 'See';

  return (
    <div className="grid grid-cols-[auto_1fr_1fr_auto_auto] gap-2 items-center py-1 px-1 rounded hover:bg-surface-secondary/50">
      <label className="flex items-center justify-center w-9 h-9 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            onUpdate({ enabled: e.target.checked });
          }}
          title="Use this variable in requests"
          className="w-5 h-5 rounded border-input-border"
        />
      </label>
      <input
        type="text"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="Variable name"
        className="border border-input-border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-input-bg"
      />
      <input
        type={type === 'secret' ? 'password' : 'text'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Variable value"
        className="border border-input-border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-input-bg"
      />
      <select
        value={visibleValue}
        onChange={(e) => {
          const isSee = e.target.value === 'See';
          setType(isSee ? 'string' : 'secret');
          onUpdate({ type: isSee ? 'string' : 'secret' });
        }}
        className="border border-input-border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-input-bg w-20"
      >
        <option value="See">See</option>
        <option value="Hide">Hide</option>
      </select>
      <button
        type="button"
        onClick={onDelete}
        className="flex items-center justify-center text-error hover:text-error/80 p-1.5 font-medium text-sm"
        title="Delete variable"
      >
        X
      </button>
    </div>
  );
}
