import OpenAI from 'openai';
import { z } from 'zod';

// Initialize OpenAI (optional - will only work if API key is set)
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

// Response schema for task suggestions
const TaskSuggestionSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
  dueDate: z.string().nullable(), // ISO date string
  priority: z.enum(['low', 'medium', 'high']).nullable(),
  // Analytics dimensions — classified here so nothing has to be typed by hand
  taskType: z
    .enum(['admin', 'deep_work', 'followup', 'meeting', 'errand', 'other'])
    .nullable()
    .default(null),
  estimatedMinutes: z.number().int().positive().nullable().default(null),
  suggestedExecutor: z.string().nullable(),
  suggestedStakeholders: z.array(z.string()).default([]),
  suggestedProject: z.string().nullable(),
  followUpCadenceDays: z.number().nullable(),
  reasoning: z.string().optional(),
});

export type TaskSuggestion = z.infer<typeof TaskSuggestionSchema>;

interface SuggestTaskOptions {
  inputText: string;
  currentDate: Date;
  userId: string; // For multi-tenant context
  knownPeople?: Array<{ handle: string; displayName: string }>;
  knownProjects?: Array<{ id: string; name: string }>;
}

/**
 * Use AI to parse free-text input and suggest task fields
 */
export async function suggestTask(options: SuggestTaskOptions): Promise<TaskSuggestion | null> {
  if (!openai) {
    console.warn('OpenAI API key not configured. AI suggestions disabled.');
    return null;
  }

  const { inputText, currentDate, userId, knownPeople = [], knownProjects = [] } = options;

  const systemPrompt = `You are an AI assistant that helps parse task descriptions and suggest structured task data.

Today's date is ${currentDate.toISOString().split('T')[0]}.

Known people: ${knownPeople.map((p) => `@${p.handle} (${p.displayName})`).join(', ') || 'None'}
Known projects: ${knownProjects.map((p) => p.name).join(', ') || 'None'}

Parse the user's input and extract:
- A clear, actionable task title
- Additional description/context (if any)
- Due date (if mentioned, in YYYY-MM-DD format)
- Priority (low/medium/high)
- Task type: one of admin, deep_work, followup, meeting, errand, other
- Estimated effort in minutes (a realistic working estimate, not elapsed time)
- Suggested executor (if delegated, use @handle format)
- Suggested stakeholders (people who should be kept updated, use @handle format)
- Suggested project (if it matches an existing project)
- Follow-up cadence in days (based on urgency and due date)

Return your response as JSON matching this schema:
{
  "title": "string",
  "description": "string | null",
  "dueDate": "YYYY-MM-DD | null",
  "priority": "low | medium | high | null",
  "taskType": "admin | deep_work | followup | meeting | errand | other | null",
  "estimatedMinutes": number | null,
  "suggestedExecutor": "@handle | null",
  "suggestedStakeholders": ["@handle"],
  "suggestedProject": "project name | null",
  "followUpCadenceDays": number | null,
  "reasoning": "brief explanation of suggestions"
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: inputText },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return null;
    }

    const parsed = JSON.parse(content);
    return TaskSuggestionSchema.parse(parsed);
  } catch (error) {
    console.error('AI suggestion failed:', error);
    return null;
  }
}

interface DraftMessageOptions {
  taskTitle: string;
  taskDescription?: string;
  projectName?: string;
  targetPersonName: string;
  targetPersonHandle: string;
  intent: 'stakeholder_update' | 'executor_checkin';
  channel: 'email' | 'teams';
  dueDate?: Date;
}

/**
 * Draft a message for stakeholder update or executor check-in
 */
export async function draftMessage(
  options: DraftMessageOptions
): Promise<{ subject?: string; body: string } | null> {
  if (!openai) {
    return null;
  }

  const {
    taskTitle,
    taskDescription,
    projectName,
    targetPersonName,
    targetPersonHandle,
    intent,
    channel,
    dueDate,
  } = options;

  const systemPrompt = `You are an AI assistant that drafts professional, friendly messages for task follow-ups.

The user (accountable person) wants to ${
    intent === 'stakeholder_update'
      ? 'provide an update to a stakeholder'
      : 'check in with the executor'
  }.

Task: "${taskTitle}"
${taskDescription ? `Description: ${taskDescription}` : ''}
${projectName ? `Project: ${projectName}` : ''}
Target: ${targetPersonName} (@${targetPersonHandle})
${dueDate ? `Due: ${dueDate.toISOString().split('T')[0]}` : ''}

Draft a ${channel === 'email' ? 'short email' : 'Teams message'} that is:
- Professional but friendly
- Concise (2-3 sentences)
- Clear about next steps or information needed
${intent === 'executor_checkin' ? '- Asks for progress update' : '- Provides status update'}

Return JSON with:
${channel === 'email' ? '{ "subject": "...", "body": "..." }' : '{ "body": "..." }'}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: systemPrompt }],
      response_format: { type: 'json_object' },
      temperature: 0.8,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return null;
    }

    return JSON.parse(content);
  } catch (error) {
    console.error('Message draft failed:', error);
    return null;
  }
}

interface DraftTaskEmailOptions {
  taskTitle: string;
  taskDescription?: string;
  projectName?: string;
  accountablePersonName: string;
  executorPersonName?: string;
  stakeholderNames?: string[];
  status: string;
  dueDate?: Date;
  recentActivitySummary?: string;
}

/**
 * Draft a summary email about a task
 */
export async function draftTaskEmail(
  options: DraftTaskEmailOptions
): Promise<{ subject: string; body: string } | null> {
  if (!openai) {
    return null;
  }

  const {
    taskTitle,
    taskDescription,
    projectName,
    accountablePersonName,
    executorPersonName,
    stakeholderNames = [],
    status,
    dueDate,
    recentActivitySummary,
  } = options;

  const systemPrompt = `You are an AI assistant that drafts professional, friendly emails summarizing task status.

Draft an email that provides a clear summary of this task's current state.

Task: "${taskTitle}"
${taskDescription ? `Description: ${taskDescription}` : ''}
${projectName ? `Project: ${projectName}` : ''}
Status: ${status.replace(/_/g, ' ')}
Accountable: ${accountablePersonName}
${executorPersonName ? `Executor: ${executorPersonName}` : ''}
${stakeholderNames.length > 0 ? `Stakeholders: ${stakeholderNames.join(', ')}` : ''}
${dueDate ? `Due: ${dueDate.toISOString().split('T')[0]}` : ''}
${recentActivitySummary ? `\nRecent Activity:\n${recentActivitySummary}` : ''}

The email should be:
- Professional but friendly
- Clear and concise
- Include current status, key details, and any next steps
- Suitable for sending to a stakeholder or manager

Return JSON with:
{ "subject": "...", "body": "..." }`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: systemPrompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return null;
    }

    return JSON.parse(content);
  } catch (error) {
    console.error('Task email draft failed:', error);
    return null;
  }
}

interface RewriteDraftOptions {
  currentSubject: string;
  currentBody: string;
  instruction: string;
}

/**
 * Rewrite an email draft based on user instruction
 */
export async function rewriteDraft(
  options: RewriteDraftOptions
): Promise<{ subject: string; body: string } | null> {
  if (!openai) {
    return null;
  }

  const { currentSubject, currentBody, instruction } = options;

  const systemPrompt = `You are an AI writing assistant. The user has an email draft and wants you to modify it based on their instruction.

Current email:
Subject: ${currentSubject}

${currentBody}

Apply the user's instruction to improve the draft. Keep the email professional and well-structured.

Return JSON with:
{ "subject": "...", "body": "..." }`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: instruction },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return null;
    }

    return JSON.parse(content);
  } catch (error) {
    console.error('Draft rewrite failed:', error);
    return null;
  }
}

/**
 * Check if AI is available
 */
export function isAIAvailable(): boolean {
  return openai !== null;
}

// Schema for extracted tasks from audio
const ExtractedTaskSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
  dueDate: z.string().nullable(), // ISO date string
  executor: z.string().nullable(), // @handle format
  stakeholders: z.array(z.string()).default([]), // @handle format
  project: z.string().nullable(), // #project format or project name
});

const AudioTranscriptionSchema = z.object({
  transcription: z.string(),
  tasks: z.array(ExtractedTaskSchema),
  newPeople: z.array(z.object({
    handle: z.string(),
    displayName: z.string(),
  })).optional(),
});

export type ExtractedTask = z.infer<typeof ExtractedTaskSchema>;
export type AudioTranscriptionResult = z.infer<typeof AudioTranscriptionSchema>;

interface TranscribeAudioOptions {
  audioFile: File;
  currentDate: Date;
  userId: string; // For multi-tenant context
  knownPeople?: Array<{ handle: string; displayName: string }>;
  knownProjects?: Array<{ id: string; name: string }>;
}

/**
 * Transcribe audio and extract multiple tasks from it
 */
export async function transcribeAudioAndExtractTasks(
  options: TranscribeAudioOptions
): Promise<AudioTranscriptionResult | null> {
  if (!openai) {
    console.warn('OpenAI API key not configured. Audio transcription disabled.');
    return null;
  }

  const { audioFile, currentDate, userId, knownPeople = [], knownProjects = [] } = options;

  try {
    // Step 1: Transcribe audio using Whisper API
    // OpenAI Whisper API expects a File object
    const transcriptionResponse = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en',
    });

    const transcription = transcriptionResponse.text;
    if (!transcription || transcription.trim().length === 0) {
      return null;
    }

    // Step 2: Extract tasks from transcription using GPT
    // Build a comprehensive list of people with name variations
    const peopleList = knownPeople.map((p) => {
      const variations = [
        p.displayName,
        p.handle,
        p.displayName.toLowerCase(),
        p.handle.toLowerCase(),
        // Add first name only
        p.displayName.split(' ')[0],
        // Add last name only if exists
        p.displayName.split(' ').length > 1 ? p.displayName.split(' ').slice(1).join(' ') : null,
      ].filter(Boolean);
      return `@${p.handle} (${p.displayName}) - also known as: ${variations.join(', ')}`;
    }).join('\n');

    const systemPrompt = `You are an AI assistant that extracts multiple tasks from transcribed audio.

Today's date is ${currentDate.toISOString().split('T')[0]}.

Known people (match ANY variation of their name):
${peopleList || 'None'}

Known projects: ${knownProjects.map((p) => p.name).join(', ') || 'None'}

The user has recorded audio that contains one or more tasks. Extract ALL tasks mentioned in the transcription.

CRITICAL: Be VERY aggressive about finding people's names in the transcription:
- Look for ANY mention of a person's name (first name, last name, full name, or handle)
- Match names even if they're not explicitly tagged with @
- If someone is mentioned in relation to a task, they should be tagged as a stakeholder
- If someone is assigned/delegated to do something, tag them as executor
- Use the @handle format matching the known people list above
- If a name sounds similar to a known person, match it (e.g., "John" matches "@john", "Sarah Smith" matches "@sarah" if Sarah's display name is "Sarah Smith")

For each task, extract:
- A clear, actionable task title (keep it simple and concise)
- Additional description/context (if any)
- Due date (if mentioned, in YYYY-MM-DD format)
- Executor (if delegated/assigned, use @handle format matching known people - be aggressive about finding this)
- Stakeholders (ALL people mentioned in relation to this task, use @handle format - include anyone whose name appears)
- Project (if mentioned, use #projectname format or match existing project names)

IMPORTANT:
- Extract ALL tasks mentioned, even if there are multiple
- Keep task titles simple and actionable
- Use @mentions for people (e.g., @john, @sarah)
- Use #projectname for projects (e.g., #Website, #"Project Name" for spaces)
- Match people and projects to known ones when possible
- If a person/project doesn't exist, still include it - it will be auto-created
- When in doubt about whether someone should be tagged, include them as a stakeholder

Return your response as JSON matching this schema:
{
  "transcription": "the full transcription text",
  "tasks": [
    {
      "title": "string",
      "description": "string | null",
      "dueDate": "YYYY-MM-DD | null",
      "executor": "@handle | null",
      "stakeholders": ["@handle"],
      "project": "#projectname | project name | null"
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Transcription: ${transcription}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return null;
    }

    const parsed = JSON.parse(content);
    const result = AudioTranscriptionSchema.parse(parsed);
    
    // Step 3: Post-process to find additional people mentioned in transcription
    // This catches names that the AI might have missed and tags them appropriately
    // Also detects new people not in the system
    
    // First, extract potential names from transcription that aren't in known people
    const transcriptionLower = transcription.toLowerCase();
    const knownNamesSet = new Set<string>();
    knownPeople.forEach(p => {
      knownNamesSet.add(p.displayName.toLowerCase());
      knownNamesSet.add(p.handle.toLowerCase());
      knownNamesSet.add(p.displayName.split(' ')[0].toLowerCase());
    });
    
    // Extract potential person names (capitalized words that could be names)
    // Look for patterns like "John", "John Smith", "with John", "tell John", etc.
    const potentialNames = new Set<string>();
    
    // Pattern 1: Capitalized words that appear after common verbs/prepositions
    const nameContextPattern = /\b(?:tell|ask|email|call|meet|with|from|to|about|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g;
    let match;
    while ((match = nameContextPattern.exec(transcription)) !== null) {
      const potentialName = match[1];
      const nameLower = potentialName.toLowerCase();
      
      // Skip if it's a known name or common words
      const commonWords = ['the', 'and', 'for', 'with', 'this', 'that', 'from', 'have', 'will', 'should', 'today', 'tomorrow', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
      
      if (!knownNamesSet.has(nameLower) && 
          !commonWords.includes(nameLower) && 
          potentialName.length >= 2 &&
          potentialName.split(' ').every(word => word.length >= 2)) {
        potentialNames.add(potentialName);
      }
    }
    
    // Pattern 2: Standalone capitalized words (first word of sentence or after punctuation)
    const standaloneNamePattern = /(?:^|\.\s+|,\s+|\?\s+|\!\s+)([A-Z][a-z]+)\b/g;
    while ((match = standaloneNamePattern.exec(transcription)) !== null) {
      const potentialName = match[1];
      const nameLower = potentialName.toLowerCase();
      
      const commonWords = ['the', 'and', 'for', 'with', 'this', 'that', 'from', 'have', 'will', 'should', 'today', 'tomorrow', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december', 'follow', 'review', 'update', 'create', 'send', 'check'];
      
      if (!knownNamesSet.has(nameLower) && 
          !commonWords.includes(nameLower) && 
          potentialName.length >= 2) {
        potentialNames.add(potentialName);
      }
    }
    
    // Create handles for new people (use first name lowercase as handle)
    const newPeopleToCreate = Array.from(potentialNames).map(name => {
      const firstName = name.split(' ')[0];
      const handle = firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
      return {
        name: name,
        handle: handle,
        displayName: name,
      };
    }).filter(p => p.handle.length >= 2);
    
    const enhancedTasks = result.tasks.map((task, taskIndex) => {
      const enhancedTask = { ...task };
      
      // Build a context string for this task (title + description)
      const taskContext = `${task.title} ${task.description || ''}`.toLowerCase();
      
      // Try to find which part of the transcription relates to this task
      // Look for the task title in the transcription to get context
      const titleWords = task.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      let taskContextStart = -1;
      if (titleWords.length > 0) {
        const firstSignificantWord = titleWords[0];
        taskContextStart = transcriptionLower.indexOf(firstSignificantWord);
      }
      
      // First, check known people
      for (const person of knownPeople) {
        const nameVariations = [
          person.displayName,
          person.displayName.toLowerCase(),
          person.handle,
          person.handle.toLowerCase(),
          person.displayName.split(' ')[0], // First name
          person.displayName.split(' ')[0].toLowerCase(),
        ].filter(Boolean) as string[];
        
        // Check if any variation appears in the transcription
        for (const variation of nameVariations) {
          if (!variation) continue;
          
          // Look for the name as a whole word (not part of another word)
          const regex = new RegExp(`\\b${variation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          const nameMatch = regex.exec(transcriptionLower);
          
          if (nameMatch) {
            const handle = `@${person.handle}`;
            
            // Check if already tagged
            const isExecutor = enhancedTask.executor?.toLowerCase() === handle.toLowerCase();
            const isStakeholder = enhancedTask.stakeholders?.some(
              (s) => s.toLowerCase() === handle.toLowerCase()
            );
            
            if (!isExecutor && !isStakeholder) {
              // Check context around the name mention for delegation keywords
              const matchIndex = nameMatch.index || 0;
              const contextBefore = transcriptionLower.substring(Math.max(0, matchIndex - 50), matchIndex);
              const contextAfter = transcriptionLower.substring(matchIndex, Math.min(transcriptionLower.length, matchIndex + 50));
              const fullContext = contextBefore + ' ' + contextAfter;
              
              // Check for executor keywords
              const executorKeywords = [
                'assign to', 'assigned to', 'delegate to', 'delegated to',
                'give to', 'hand to', 'send to', 'ask', 'tell', 'have',
                'will do', 'should do', 'needs to', 'responsible for'
              ];
              
              const isExecutorContext = executorKeywords.some(keyword => 
                fullContext.includes(keyword)
              );
              
              if (isExecutorContext && !enhancedTask.executor) {
                // Tag as executor if context suggests delegation
                enhancedTask.executor = handle;
              } else {
                // Otherwise add as stakeholder
                enhancedTask.stakeholders = enhancedTask.stakeholders || [];
                if (!enhancedTask.stakeholders.includes(handle)) {
                  enhancedTask.stakeholders.push(handle);
                }
              }
            }
            
            // Break after first match found
            break;
          }
        }
      }
      
      // Second, check for new people mentioned
      for (const newPerson of newPeopleToCreate) {
        const nameVariations = [
          newPerson.name,
          newPerson.name.toLowerCase(),
          newPerson.displayName,
          newPerson.displayName.toLowerCase(),
          newPerson.name.split(' ')[0], // First name
          newPerson.name.split(' ')[0].toLowerCase(),
        ].filter(Boolean) as string[];
        
        // Check if any variation appears in the transcription
        for (const variation of nameVariations) {
          if (!variation) continue;
          
          // Look for the name as a whole word
          const regex = new RegExp(`\\b${variation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          const nameMatch = regex.exec(transcriptionLower);
          
          if (nameMatch) {
            const handle = `@${newPerson.handle}`;
            
            // Check if already tagged
            const isExecutor = enhancedTask.executor?.toLowerCase() === handle.toLowerCase();
            const isStakeholder = enhancedTask.stakeholders?.some(
              (s) => s.toLowerCase() === handle.toLowerCase()
            );
            
            if (!isExecutor && !isStakeholder) {
              // Check context around the name mention for delegation keywords
              const matchIndex = nameMatch.index || 0;
              const contextBefore = transcriptionLower.substring(Math.max(0, matchIndex - 50), matchIndex);
              const contextAfter = transcriptionLower.substring(matchIndex, Math.min(transcriptionLower.length, matchIndex + 50));
              const fullContext = contextBefore + ' ' + contextAfter;
              
              // Check for executor keywords
              const executorKeywords = [
                'assign to', 'assigned to', 'delegate to', 'delegated to',
                'give to', 'hand to', 'send to', 'ask', 'tell', 'have',
                'will do', 'should do', 'needs to', 'responsible for'
              ];
              
              const isExecutorContext = executorKeywords.some(keyword => 
                fullContext.includes(keyword)
              );
              
              if (isExecutorContext && !enhancedTask.executor) {
                // Tag as executor if context suggests delegation
                enhancedTask.executor = handle;
              } else {
                // Otherwise add as stakeholder
                enhancedTask.stakeholders = enhancedTask.stakeholders || [];
                if (!enhancedTask.stakeholders.includes(handle)) {
                  enhancedTask.stakeholders.push(handle);
                }
              }
            }
            
            // Break after first match found
            break;
          }
        }
      }
      
      return enhancedTask;
    });
    
    // Add new people to the result so they can be created
    const newPeopleList = newPeopleToCreate.map(p => ({
      handle: p.handle,
      displayName: p.displayName,
    }));
    
    // Ensure transcription is included
    return {
      ...result,
      transcription,
      tasks: enhancedTasks,
      newPeople: newPeopleList,
    };
  } catch (error) {
    console.error('Audio transcription failed:', error);
    return null;
  }
}

