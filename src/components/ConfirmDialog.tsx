import { useEffect, useState } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
  /** When set, user must type this exact value to enable the confirm button (e.g. collection name for delete). */
  typeToConfirm?: string;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'OK',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  danger = false,
  typeToConfirm,
}: ConfirmDialogProps) {
  const [typedValue, setTypedValue] = useState('');

  useEffect(() => {
    if (isOpen && typeToConfirm !== undefined) {
      setTypedValue('');
    }
  }, [isOpen, typeToConfirm]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter' && (!typeToConfirm || typedValue.trim() === typeToConfirm)) {
        e.preventDefault();
        onConfirm();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onConfirm, onCancel, typeToConfirm, typedValue]);

  if (!isOpen) return null;

  const confirmDisabled = typeToConfirm !== undefined && typedValue.trim() !== typeToConfirm;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div 
        className="bg-surface rounded-lg shadow-xl p-6 max-w-md w-full mx-4 border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-text-primary mb-2">{title}</h3>
        <p className="text-text-secondary mb-4">{message}</p>
        {typeToConfirm !== undefined && (
          <div className="mb-4">
            <label htmlFor="confirm-type-input" className="block text-sm font-medium text-text-secondary mb-1.5">
              Type <span className="font-semibold text-text-primary">{typeToConfirm}</span> to confirm
            </label>
            <input
              id="confirm-type-input"
              type="text"
              value={typedValue}
              onChange={(e) => setTypedValue(e.target.value)}
              placeholder={typeToConfirm}
              className="w-full border border-input-border rounded px-3 py-2 text-sm bg-input-bg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              autoComplete="off"
            />
          </div>
        )}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-text-secondary bg-surface-secondary hover:bg-secondary-surface rounded border border-border transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={`px-4 py-2 text-sm font-medium text-white rounded transition-colors ${
              confirmDisabled
                ? 'opacity-50 cursor-not-allowed'
                : danger
                  ? 'bg-error hover:bg-error/90'
                  : 'bg-primary hover:bg-primary-hover'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
