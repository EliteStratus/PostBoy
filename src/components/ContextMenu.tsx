import { useEffect, useRef } from 'react';

export type ContextMenuOption = 
  | {
      label: string;
      action: () => void;
      shortcut?: string;
      danger?: boolean;
      disabled?: boolean;
    }
  | {
      separator: true;
    };

interface ContextMenuProps {
  options: ContextMenuOption[];
  position: { x: number; y: number };
  onClose: () => void;
}

export default function ContextMenu({ options, position, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[200px]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      {options.map((option, index) => {
        if ('separator' in option && option.separator) {
          return <div key={index} className="border-t border-gray-200 my-1" />;
        }

        const menuOption = option as Exclude<ContextMenuOption, { separator: true }>;

        return (
          <button
            key={index}
            onClick={() => {
              if (!menuOption.disabled) {
                menuOption.action();
                onClose();
              }
            }}
            disabled={menuOption.disabled}
            className={`
              w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center justify-between
              ${menuOption.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700'}
              ${menuOption.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <span>{menuOption.label}</span>
            {menuOption.shortcut && (
              <span className="text-xs text-gray-400 ml-4">{menuOption.shortcut}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
