import { isVariableResolved, type VariableContext } from '../utils/variableSubstitution';

interface VariableHighlightProps {
  text: string;
  context: VariableContext;
  className?: string;
}

export function VariableHighlight({ text, context, className = '' }: VariableHighlightProps) {
  if (!text) return null;

  const variableRegex = /\{\{([^}]+)\}\}/g;
  const parts: Array<{ text: string; isVariable: boolean; variableName?: string }> = [];
  let lastIndex = 0;
  let match;

  while ((match = variableRegex.exec(text)) !== null) {
    // Add text before the variable
    if (match.index > lastIndex) {
      parts.push({ text: text.substring(lastIndex, match.index), isVariable: false });
    }

    // Add the variable
    const variableName = match[1].trim();
    parts.push({ text: match[0], isVariable: true, variableName });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({ text: text.substring(lastIndex), isVariable: false });
  }

  // If no variables found, return plain text with proper color
  if (parts.length === 0) {
    return <span className={`${className} text-text-primary`} style={{ color: 'var(--color-text-primary)' }}>{text}</span>;
  }

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.isVariable && part.variableName) {
          const isResolved = isVariableResolved(part.variableName, context);
          return (
            <span
              key={index}
              className={isResolved ? 'text-info font-medium' : 'text-error font-medium'}
            >
              {part.text}
            </span>
          );
        }
        return <span key={index} className="text-text-primary" style={{ color: 'var(--color-text-primary)' }}>{part.text}</span>;
      })}
    </span>
  );
}

interface VariableInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  context: VariableContext;
  type?: 'text' | 'password';
}

export function VariableInput({ value, onChange, placeholder, className = '', context, type = 'text' }: VariableInputProps) {
  return (
    <div className="relative flex-1">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full border border-input-border rounded px-2 py-1 bg-transparent ${className}`}
      />
      {value && (
        <div className="absolute inset-0 pointer-events-none px-2 py-1 flex items-center overflow-hidden">
          <VariableHighlight
            text={value}
            context={context}
            className="whitespace-nowrap"
          />
        </div>
      )}
    </div>
  );
}
