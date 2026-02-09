import { useEffect } from 'react';

interface AlertDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  variant?: 'info' | 'error';
  buttonText?: string;
  onClose: () => void;
}

export default function AlertDialog({
  isOpen,
  title,
  message,
  variant = 'info',
  buttonText = 'OK',
  onClose,
}: AlertDialogProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isError = variant === 'error';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-surface rounded-lg shadow-xl p-6 max-w-md w-full mx-4 border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className={`text-lg font-semibold mb-2 ${isError ? 'text-error' : 'text-text-primary'}`}>
          {title}
        </h3>
        <p className="text-text-secondary mb-4 whitespace-pre-wrap break-words">{message}</p>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
              isError
                ? 'bg-error text-white hover:bg-error/90'
                : 'bg-primary text-on-primary hover:bg-primary-hover'
            }`}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
}
