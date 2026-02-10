import type { Environment } from '../types';

export interface VariableContext {
  environment?: Environment;
  collection?: Record<string, string>;
  global?: Record<string, string>;
}

export function substituteVariables(
  text: string,
  context: VariableContext
): string {
  if (!text) return text;

  const variableRegex = /\{\{([^}]+)\}\}/g;
  
  return text.replace(variableRegex, (match, varName) => {
    const trimmed = varName.trim();
    
    // Check environment variables first (only enabled variables are used in requests)
    if (context.environment) {
      const envVar = context.environment.variables.find(
        v => v.key === trimmed && v.enabled
      );
      if (envVar) {
        return envVar.value;
      }
    }
    
    // Check collection variables
    if (context.collection && context.collection[trimmed]) {
      return context.collection[trimmed];
    }
    
    // Check global variables
    if (context.global && context.global[trimmed]) {
      return context.global[trimmed];
    }
    
    // Return original if not found
    return match;
  });
}

export function extractVariables(text: string): string[] {
  if (!text) return [];
  
  const variableRegex = /\{\{([^}]+)\}\}/g;
  const variables: string[] = [];
  let match;
  
  while ((match = variableRegex.exec(text)) !== null) {
    const varName = match[1].trim();
    if (!variables.includes(varName)) {
      variables.push(varName);
    }
  }
  
  return variables;
}

export function isVariableResolved(variableName: string, context: VariableContext): boolean {
  const trimmed = variableName.trim();
  
  // Environment: only enabled variables with a non-empty value count as resolved (blue in UI)
  if (context.environment) {
    const envVar = context.environment.variables.find(
      v => v.key === trimmed && v.enabled && v.value.trim() !== ''
    );
    if (envVar) {
      return true;
    }
  }
  
  // Check collection variables
  if (context.collection && context.collection[trimmed]) {
    return true;
  }
  
  // Check global variables
  if (context.global && context.global[trimmed]) {
    return true;
  }
  
  return false;
}

/** Used by Monaco editors to style {{variable}} ranges (resolved vs unresolved). */
export function getVariableRanges(
  text: string,
  context: VariableContext
): Array<{ startOffset: number; endOffset: number; resolved: boolean }> {
  if (!text) return [];
  const variableRegex = /\{\{([^}]+)\}\}/g;
  const ranges: Array<{ startOffset: number; endOffset: number; resolved: boolean }> = [];
  let match;
  while ((match = variableRegex.exec(text)) !== null) {
    const varName = match[1].trim();
    ranges.push({
      startOffset: match.index,
      endOffset: match.index + match[0].length,
      resolved: isVariableResolved(varName, context),
    });
  }
  return ranges;
}
