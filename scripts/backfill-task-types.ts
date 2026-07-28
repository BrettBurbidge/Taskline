/**
 * One-off backfill: AI-classify `task_type` and `estimated_minutes` for tasks
 * captured before (or without) AI classification.
 *
 *   npx tsx scripts/backfill-task-types.ts                  # dry run (default)
 *   npx tsx scripts/backfill-task-types.ts --apply          # write
 *   npx tsx scripts/backfill-task-types.ts --user=a@b.com   # limit to one user
 *   npx tsx scripts/backfill-task-types.ts --limit=25       # cap rows this run
 *   npx tsx scripts/backfill-task-types.ts --batch-size=20  # tasks per OpenAI call
 *
 * Includes completed and cancelled tasks — history is the point. Only ever
 * fills NULLs, never overwrites a real value, so it is re-runnable and safe to
 * combine with the edit-form UI. Entries the model returns malformed are logged
 * and skipped, never guessed.
 *
 * Needs ANTHROPIC_API_KEY and DATABASE_URL (prefix a prod URL to run against
 * prod). Cost: one Claude call per batch of 20 tasks — cents at most.
 */

import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { TASK_TYPES } from '../src/lib/services/taskMix';

const APPLY = process.argv.includes('--apply');
const userArg = process.argv.find((a) => a.startsWith('--user='));
const USER_EMAIL = userArg ? userArg.slice('--user='.length) : null;
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.slice('--limit='.length), 10) : undefined;
const batchArg = process.argv.find((a) => a.startsWith('--batch-size='));
const BATCH_SIZE = batchArg ? parseInt(batchArg.slice('--batch-size='.length), 10) : 20;
const ROLLBACK_FILE = 'scripts/.backfill-task-types.json';

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('\nANTHROPIC_API_KEY is not set — this backfill needs the Anthropic API.\n');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SuggestionSchema = z.object({
  id: z.string(),
  taskType: z.enum(TASK_TYPES),
  estimatedMinutes: z.number().int().positive(),
});

const ResponseSchema = z.object({ results: z.array(SuggestionSchema) });

const SYSTEM_PROMPT = `You classify personal work tasks. For each task you receive, return:
- taskType, exactly one of:
  - deep_work: focused creative/analytical work — writing, coding, designing, planning a strategy
  - meeting: attending or running a meeting, call, or 1:1
  - followup: chasing, checking in on, or nudging another person's work
  - admin: paperwork, expenses, scheduling, email triage, filing, routine upkeep
  - errand: physical-world chores — pick up, drop off, buy, fix
  - other: genuinely none of the above
- estimatedMinutes: a realistic estimate of working minutes for the task (integer > 0).

Respond with JSON: {"results": [{"id": "...", "taskType": "...", "estimatedMinutes": N}, ...]}
Include every task exactly once, keyed by its id.`;

interface Row {
  id: string;
  title: string;
  description: string | null;
  taskType: string | null;
  estimatedMinutes: number | null;
}

async function classifyBatch(rows: Row[]): Promise<Map<string, z.infer<typeof SuggestionSchema>>> {
  const response = await anthropic.messages.parse({
    model: 'claude-opus-5',
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: JSON.stringify(
          rows.map((r) => ({
            id: r.id,
            title: r.title,
            description: r.description?.slice(0, 500) ?? null,
          }))
        ),
      },
    ],
    output_config: { format: zodOutputFormat(ResponseSchema) },
  });

  const suggestions = new Map<string, z.infer<typeof SuggestionSchema>>();
  const parsed = response.parsed_output;
  if (!parsed) {
    console.warn('  batch response missing or unparseable — skipping batch');
    return suggestions;
  }

  const validIds = new Set(rows.map((r) => r.id));
  for (const entry of parsed.results) {
    if (!validIds.has(entry.id)) {
      console.warn(`  SKIP (unknown id) ${JSON.stringify(entry).slice(0, 80)}`);
      continue;
    }
    suggestions.set(entry.id, entry);
  }

  return suggestions;
}

async function main() {
  let userId: string | undefined;
  if (USER_EMAIL) {
    const user = await db.user.findFirst({
      where: { email: USER_EMAIL },
      select: { id: true },
    });
    if (!user) throw new Error(`No user with email ${USER_EMAIL}`);
    userId = user.id;
  }

  const rows: Row[] = await db.task.findMany({
    where: {
      ...(userId ? { userId } : {}),
      OR: [{ taskType: null }, { estimatedMinutes: null }],
    },
    select: {
      id: true,
      title: true,
      description: true,
      taskType: true,
      estimatedMinutes: true,
    },
    orderBy: { createdAt: 'asc' },
    ...(LIMIT ? { take: LIMIT } : {}),
  });

  console.log(`\n${APPLY ? 'APPLYING' : 'DRY RUN'}`);
  console.log(`Found ${rows.length} task(s) missing a type or estimate.\n`);

  const applied: Array<{ id: string; wroteTaskType: boolean; wroteEstimatedMinutes: boolean }> = [];
  const histogram = new Map<string, number>();

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const suggestions = await classifyBatch(batch);

    for (const row of batch) {
      const suggestion = suggestions.get(row.id);
      if (!suggestion) continue;

      // Only ever fill NULLs — a real value always wins over a guess.
      const wroteTaskType = row.taskType === null;
      const wroteEstimatedMinutes = row.estimatedMinutes === null;
      if (!wroteTaskType && !wroteEstimatedMinutes) continue;

      const typeLabel = wroteTaskType ? suggestion.taskType : `(kept ${row.taskType})`;
      const minutesLabel = wroteEstimatedMinutes
        ? `${suggestion.estimatedMinutes}m`
        : `(kept ${row.estimatedMinutes}m)`;
      console.log(`  ${typeLabel.padEnd(12)} ${minutesLabel.padEnd(12)} ${row.title.slice(0, 52)}`);

      if (wroteTaskType) {
        histogram.set(suggestion.taskType, (histogram.get(suggestion.taskType) ?? 0) + 1);
      }

      if (APPLY) {
        await db.task.update({
          where: { id: row.id },
          data: {
            ...(wroteTaskType ? { taskType: suggestion.taskType } : {}),
            ...(wroteEstimatedMinutes ? { estimatedMinutes: suggestion.estimatedMinutes } : {}),
          },
        });
      }
      applied.push({ id: row.id, wroteTaskType, wroteEstimatedMinutes });
    }
  }

  console.log(`\n  classified: ${applied.length} of ${rows.length}`);
  for (const type of TASK_TYPES) {
    const count = histogram.get(type);
    if (count) console.log(`    ${type.padEnd(12)} ${count}`);
  }

  if (!APPLY) {
    console.log('\nNothing written. Re-run with --apply to commit these values.\n');
    await db.$disconnect();
    return;
  }

  // Record exactly which fields were filled so a rollback isn't guesswork —
  // setting these back to NULL is safe because only NULLs were ever filled.
  writeFileSync(
    ROLLBACK_FILE,
    JSON.stringify({ appliedAt: new Date().toISOString(), entries: applied }, null, 2)
  );

  console.log(`\nUpdated ${applied.length} task(s).`);
  console.log(`Rollback info written to ${ROLLBACK_FILE}`);
  console.log(
    'To undo: UPDATE "task" SET "task_type" = NULL / "estimated_minutes" = NULL for the ids in that file (respecting which fields were written).\n'
  );

  await db.$disconnect();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
