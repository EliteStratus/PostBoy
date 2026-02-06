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
    
    // Check environment variables first
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
  
  // Check environment variables first
  if (context.environment) {
    const envVar = context.environment.variables.find(
      v => v.key === trimmed && v.enabled
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
