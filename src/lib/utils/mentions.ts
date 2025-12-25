/**
 * Utilities for parsing @mentions and extracting people from text
 * Also includes utilities for parsing #project tags
 */

export interface ParsedMentions {
  stakeholders: string[]; // @mention handles
  executor: string | null; // → @handle or > @handle
}

export interface ParsedProjects {
  projects: string[]; // #project names
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
  const allMentions = Array.from(text.matchAll(mentionRegex)).map((m) =>
    m[1].toLowerCase()
  );

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
  const stakeholders = allMentions.filter((handle) => handle !== executor);

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
  const mentions = Array.from(text.matchAll(mentionRegex)).map((m) =>
    m[1].toLowerCase()
  );
  return Array.from(new Set(mentions));
}

/**
 * Get the current word being typed (for autocomplete)
 * Returns null if not typing a mention, or the partial handle
 */
export function getCurrentMention(
  text: string,
  cursorPosition: number
): string | null {
  if (!text || cursorPosition === 0) return null;

  // Look backwards from cursor to find @
  let startPos = cursorPosition - 1;
  let foundAt = false;

  while (startPos >= 0) {
    const char = text[startPos];

    if (char === "@") {
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

  while (startPos >= 0 && text[startPos] !== "@") {
    startPos--;
  }

  if (startPos < 0 || text[startPos] !== "@") {
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

/**
 * Parse text to extract project tags (#project)
 *
 * Examples:
 * - "follow up with @steen tomorrow #Website" → projects: ['Website']
 * - "Fix bug #Frontend #Urgent" → projects: ['Frontend', 'Urgent']
 * - 'Use #"Project Name" for spaces' → projects: ['Project Name']
 * - 'Use #"Project/Path" for special chars' → projects: ['Project/Path']
 *
 * Note:
 * - Unquoted tags (#project) only match word characters (no spaces or special chars)
 * - Quoted tags (#"project name") support spaces and special characters like /
 * - Preserves exact casing from user input, but comparisons should be case-insensitive
 */
export function parseProjects(text: string): ParsedProjects {
  if (!text) {
    return { projects: [] };
  }

  const projects: string[] = [];
  const processedRanges: Array<[number, number]> = [];

  // Pattern 1: Quoted project names: #"Project Name" or #'Project Name'
  // Supports spaces and special characters like /, -, etc.
  const quotedRegex = /#(["'])([^"']+)\1/g;
  let match;
  while ((match = quotedRegex.exec(text)) !== null) {
    const projectName = match[2].trim();
    if (projectName) {
      projects.push(projectName);
      processedRanges.push([match.index, match.index + match[0].length]);
    }
  }

  // Pattern 2: Unquoted project names: #Project
  // Only matches word characters (alphanumeric + underscore), no spaces
  // Stops at whitespace, #, @, or end of string
  const unquotedRegex = /#(\w+)/g;
  while ((match = unquotedRegex.exec(text)) !== null) {
    // Check if this range was already processed by quoted regex
    const matchStart = match.index;
    const isAlreadyProcessed = processedRanges.some(
      ([start, end]) => matchStart >= start && matchStart < end
    );

    if (!isAlreadyProcessed) {
      const projectName = match[1];
      if (projectName) {
        projects.push(projectName);
      }
    }
  }

  // Remove duplicates (case-insensitive)
  const seen = new Set<string>();
  const uniqueProjects: string[] = [];
  for (const project of projects) {
    const lower = project.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      uniqueProjects.push(project);
    }
  }

  return {
    projects: uniqueProjects,
  };
}

/**
 * Extract all unique #project tags from text (for autocomplete)
 */
export function extractProjects(text: string): string[] {
  if (!text) return [];

  const parsed = parseProjects(text);
  return parsed.projects;
}

/**
 * Highlight #project tags in text (for display)
 */
export function highlightProjects(text: string): string {
  const processedRanges: Array<[number, number]> = [];
  let highlighted = text;

  // First handle quoted projects
  const quotedRegex = /#(["'])([^"']+)\1/g;
  let match;
  while ((match = quotedRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    highlighted = highlighted.replace(
      fullMatch,
      `<span class="text-green-600 font-medium">${fullMatch}</span>`
    );
    processedRanges.push([match.index, match.index + fullMatch.length]);
  }

  // Then handle unquoted projects (but skip if already highlighted/quoted)
  const unquotedRegex = /#(\w+)/g;
  while ((match = unquotedRegex.exec(text)) !== null) {
    const matchStart = match.index;
    const isAlreadyProcessed = processedRanges.some(
      ([start, end]) => matchStart >= start && matchStart < end
    );

    if (!isAlreadyProcessed) {
      const fullMatch = match[0];
      highlighted = highlighted.replace(
        fullMatch,
        `<span class="text-green-600 font-medium">${fullMatch}</span>`
      );
    }
  }

  return highlighted;
}

/**
 * Clean task title by removing or transforming parsed elements
 * - Transforms #project tags to capitalized project names (e.g., #Website → Website)
 * - Removes date phrases (they become task.dueAt)
 * - Removes executor arrows → @person (they become task.executor)
 * - Transforms @mentions to capitalized names
 *
 * @param text - The raw task title text
 * @param parsedDateText - Optional matched date text from parseDate()
 * @returns Cleaned title string
 *
 * @example
 * cleanTaskTitle("Follow up with @steen and @sara tomorrow #Website", "tomorrow")
 * // Returns: "Follow up with Steen and Sara Website"
 *
 * cleanTaskTitle("Fix bug Dec 25 → @jeff #Frontend", "Dec 25")
 * // Returns: "Fix bug Frontend"
 */
export function cleanTaskTitle(
  text: string,
  parsedDateText?: string | null
): string {
  if (!text) return "";

  let cleaned = text;

  // Step 1: Transform project tags (#project or #"Project Name")
  // Transform quoted projects: #"Project Name" → Project Name (preserve casing)
  cleaned = cleaned.replace(/#["']([^"']+)["']/g, "$1");
  // Transform unquoted projects: #ProjectName → Projectname (capitalize first letter)
  cleaned = cleaned.replace(/#(\w+)/g, (match, projectName) => {
    return (
      projectName.charAt(0).toUpperCase() + projectName.slice(1).toLowerCase()
    );
  });

  // Step 2: Remove date phrases
  if (parsedDateText) {
    // Create a case-insensitive regex to remove the matched date text
    const dateRegex = new RegExp(
      "\\b" + parsedDateText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b",
      "gi"
    );
    cleaned = cleaned.replace(dateRegex, "");
  }

  // Step 3: Remove executor arrows and patterns
  // Remove: → @person or > @person
  cleaned = cleaned.replace(/[→>]\s*@\w+/g, "");
  // Remove: "delegate to @person" or "delegated to @person"
  cleaned = cleaned.replace(/delegat(?:e|ed)\s+to\s+@\w+/gi, "");
  // Remove: "assign to @person" or "assigned to @person"
  cleaned = cleaned.replace(/assign(?:ed)?\s+to\s+@\w+/gi, "");

  // Step 4: Transform remaining @mentions to capitalized names
  cleaned = cleaned.replace(/@(\w+)/g, (match, handle) => {
    // Capitalize first letter, lowercase the rest
    return handle.charAt(0).toUpperCase() + handle.slice(1).toLowerCase();
  });

  // Step 5: Clean up extra whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned;
}
