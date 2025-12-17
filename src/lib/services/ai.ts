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

  const { inputText, currentDate, knownPeople = [], knownProjects = [] } = options;

  const systemPrompt = `You are an AI assistant that helps parse task descriptions and suggest structured task data.

Today's date is ${currentDate.toISOString().split('T')[0]}.

Known people: ${knownPeople.map((p) => `@${p.handle} (${p.displayName})`).join(', ') || 'None'}
Known projects: ${knownProjects.map((p) => p.name).join(', ') || 'None'}

Parse the user's input and extract:
- A clear, actionable task title
- Additional description/context (if any)
- Due date (if mentioned, in YYYY-MM-DD format)
- Priority (low/medium/high)
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

/**
 * Check if AI is available
 */
export function isAIAvailable(): boolean {
  return openai !== null;
}

