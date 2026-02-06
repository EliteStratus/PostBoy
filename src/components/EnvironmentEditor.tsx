import { useState, useEffect } from 'react';
import { useEnvironmentsStore } from '../stores/environmentsStore';
import type { EnvironmentVariable } from '../types';

export default function EnvironmentEditor() {
  const {
    environments,
    currentEnvironment,
    loadEnvironments,
    createEnvironment,
    setCurrentEnvironment,
    addVariable,
    updateVariable,
    deleteVariable,
  } = useEnvironmentsStore();

  const [showCreate, setShowCreate] = useState(false);
  const [newEnvName, setNewEnvName] = useState('');

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

  const currentEnv = currentEnvironment ? environments[currentEnvironment] : null;

  return (
    <div className="h-full flex flex-col px-6 pb-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-text-primary">Environments</h2>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-hover"
          >
            + New Environment
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

        <div className="flex gap-2 mb-4">
          {Object.keys(environments).map((name) => (
            <button
              key={name}
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
      </div>

      {currentEnv ? (
        <div className="flex-1 overflow-auto">
          <div className="bg-surface rounded-lg shadow border border-border max-w-5xl">
            <div className="p-4 border-b border-border">
              <h3 className="text-lg font-semibold text-text-primary">{currentEnv.name}</h3>
            </div>
            <div className="p-4">
              <div className="space-y-2">
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

  // Debounce updates to avoid excessive re-renders and allow typing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const hasChanges = 
        key !== variable.key ||
        value !== variable.value ||
        type !== variable.type ||
        enabled !== variable.enabled;
      
      if (hasChanges) {
        onUpdate({ key, value, type, enabled });
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [key, value, type, enabled, variable.key, variable.value, variable.type, variable.enabled, onUpdate]);

  return (
    <div className="flex items-center gap-2 p-3 border border-border rounded hover:bg-surface-secondary">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => setEnabled(e.target.checked)}
        className="mr-2"
      />
      <input
        type="text"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="Variable name"
        className="flex-1 border border-input-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary bg-input-bg"
      />
      <input
        type={type === 'secret' ? 'password' : 'text'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Variable value"
        className="flex-1 border border-input-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary bg-input-bg"
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value as 'string' | 'secret')}
        className="border border-input-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary bg-input-bg"
      >
        <option value="string">String</option>
        <option value="secret">Secret</option>
      </select>
      <button
        type="button"
        onClick={onDelete}
        className="flex items-center justify-center text-error hover:text-error/80 p-2"
        title="Delete variable"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
        </svg>
      </button>
    </div>
  );
}
