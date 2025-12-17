/**
 * Utilities for parsing @mentions and extracting people from text
 */

export interface ParsedMentions {
  stakeholders: string[]; // @mention handles
  executor: string | null; // → @handle or > @handle
}

/**
 * Parse text to extract stakeholder mentions and executor
 * 
 * Examples:
 * - "@gwenith and @suzan" → stakeholders: ['gwenith', 'suzan']
 * - "→ @jeff" or "> @jeff" → executor: 'jeff'
 * - "delegate to @bob" → executor: 'bob'
 * - "assigned to @alice" → executor: 'alice'
 */
export function parseMentions(text: string): ParsedMentions {
  if (!text) {
    return { stakeholders: [], executor: null };
  }

  // Find all @mentions
  const mentionRegex = /@(\w+)/g;
  const allMentions = Array.from(text.matchAll(mentionRegex)).map(m => m[1].toLowerCase());

  // Find executor patterns: → @name, > @name, "delegate to @name", "assigned to @name"
  let executor: string | null = null;
  
  // Pattern 1: → @name or > @name
  const arrowMatch = text.match(/[→>]\s*@(\w+)/);
  if (arrowMatch) {
    executor = arrowMatch[1].toLowerCase();
  }
  
  // Pattern 2: "delegate to @name" or "delegated to @name"
  const delegateMatch = text.match(/delegat(?:e|ed)\s+to\s+@(\w+)/i);
  if (delegateMatch) {
    executor = delegateMatch[1].toLowerCase();
  }
  
  // Pattern 3: "assign to @name" or "assigned to @name"
  const assignMatch = text.match(/assign(?:ed)?\s+to\s+@(\w+)/i);
  if (assignMatch) {
    executor = assignMatch[1].toLowerCase();
  }

  // Remove executor from stakeholders list
  const stakeholders = allMentions.filter(handle => handle !== executor);
  
  // Remove duplicates
  const uniqueStakeholders = Array.from(new Set(stakeholders));

  return {
    stakeholders: uniqueStakeholders,
    executor,
  };
}

/**
 * Extract all unique @mentions from text (for autocomplete)
 */
export function extractMentions(text: string): string[] {
  if (!text) return [];
  const mentionRegex = /@(\w+)/g;
  const mentions = Array.from(text.matchAll(mentionRegex)).map(m => m[1].toLowerCase());
  return Array.from(new Set(mentions));
}

/**
 * Get the current word being typed (for autocomplete)
 * Returns null if not typing a mention, or the partial handle
 */
export function getCurrentMention(text: string, cursorPosition: number): string | null {
  if (!text || cursorPosition === 0) return null;
  
  // Look backwards from cursor to find @
  let startPos = cursorPosition - 1;
  let foundAt = false;
  
  while (startPos >= 0) {
    const char = text[startPos];
    
    if (char === '@') {
      foundAt = true;
      break;
    }
    
    // Stop if we hit whitespace or special chars
    if (/[\s,;.!?]/.test(char)) {
      break;
    }
    
    startPos--;
  }
  
  if (!foundAt) return null;
  
  // Extract the partial mention
  const partial = text.substring(startPos + 1, cursorPosition);
  
  // Only return if it looks like a valid handle (alphanumeric)
  if (/^\w*$/.test(partial)) {
    return partial.toLowerCase();
  }
  
  return null;
}

/**
 * Replace a partial mention with a complete one
 */
export function replaceMention(
  text: string,
  cursorPosition: number,
  newHandle: string
): { newText: string; newCursorPosition: number } {
  // Find the @ before cursor
  let startPos = cursorPosition - 1;
  
  while (startPos >= 0 && text[startPos] !== '@') {
    startPos--;
  }
  
  if (startPos < 0 || text[startPos] !== '@') {
    return { newText: text, newCursorPosition: cursorPosition };
  }
  
  // Replace from @ to cursor with @newHandle
  const before = text.substring(0, startPos);
  const after = text.substring(cursorPosition);
  const newText = `${before}@${newHandle}${after}`;
  const newCursorPosition = startPos + newHandle.length + 1;
  
  return { newText, newCursorPosition };
}

/**
 * Highlight @mentions in text (for display)
 */
export function highlightMentions(text: string): string {
  return text.replace(
    /@(\w+)/g,
    '<span class="text-blue-600 font-medium">@$1</span>'
  );
}

/**
 * Highlight executor arrow patterns
 */
export function highlightExecutor(text: string): string {
  return text.replace(
    /([→>]\s*@\w+)/g,
    '<span class="text-purple-600 font-medium">$1</span>'
  );
}

