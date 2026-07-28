/**
 * One-off backfill: recover `original_due_at` from follow-up history.
 *
 *   npx tsx scripts/backfill-original-due-at.ts                 # dry run (default)
 *   npx tsx scripts/backfill-original-due-at.ts --apply         # write
 *   npx tsx scripts/backfill-original-due-at.ts --user=a@b.com  # limit to one user
 *
 * Only writes values it can PROVE — see src/lib/services/recoverOriginalDueDate.ts
 * for why a repeated due date inside one follow-up batch pins the task's due date
 * at that moment. Tasks without that proof are left NULL, which already means
 * "history unknown" to `slipVsOriginal` and is skipped by aggregates.
 *
 * Deliberately does NOT touch `dueAtChangeCount`: we can prove *that* a task
 * moved, not *how many times*. Writing 1 would be a floor dressed up as a count.
 * So a backfilled task may show originalDueAt != dueAt with dueAtChangeCount = 0
 * — correct under the fields' definitions ("original commitment" vs "reschedules
 * observed since tracking began").
 *
 * Re-runnable: only considers rows where original_due_at IS NULL.
 */

import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { recoverOriginalDueDate } from '../src/lib/services/recoverOriginalDueDate';

const APPLY = process.argv.includes('--apply');
const userArg = process.argv.find((a) => a.startsWith('--user='));
const USER_EMAIL = userArg ? userArg.slice('--user='.length) : null;
const TZ = process.env.DEFAULT_TIMEZONE || 'America/Denver';
const ROLLBACK_FILE = 'scripts/.backfill-original-due-at.json';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

function daysBetween(fromDay: string, toDay: string): number {
  return Math.round(
    (Date.parse(`${toDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) / 86_400_000
  );
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * The migration that adds these columns is drafted but may not be applied yet —
 * fail with something actionable instead of a Prisma stack trace.
 */
async function assertColumnExists() {
  const rows = await db.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'task' AND column_name = 'original_due_at'
    ) AS exists
  `;

  if (!rows[0]?.exists) {
    console.error(
      '\nThe "original_due_at" column does not exist in this database yet.\n' +
        'Apply the migration first:\n\n' +
        '  npx prisma migrate deploy\n\n' +
        '(needs DIRECT_URL — the pooled DATABASE_URL cannot run migrations)\n'
    );
    process.exit(1);
  }
}

async function main() {
  await assertColumnExists();

  let userId: string | undefined;
  if (USER_EMAIL) {
    const user = await db.user.findFirst({
      where: { email: USER_EMAIL },
      select: { id: true },
    });
    if (!user) throw new Error(`No user with email ${USER_EMAIL}`);
    userId = user.id;
  }

  const tasks = await db.task.findMany({
    where: {
      ...(userId ? { userId } : {}),
      dueAt: { not: null },
      originalDueAt: null, // idempotent: never revisits a row it already filled
    },
    select: {
      id: true,
      title: true,
      dueAt: true,
      followUps: {
        select: { dueAt: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  const recovered: Array<{
    id: string;
    title: string;
    originalDay: string;
    currentDay: string;
    slip: number;
  }> = [];
  let noEvidence = 0;
  let ambiguous = 0;

  for (const task of tasks) {
    const result = recoverOriginalDueDate(task.followUps, TZ);

    if (result.status === 'no_evidence') {
      noEvidence += 1;
      continue;
    }
    if (result.status === 'ambiguous') {
      ambiguous += 1;
      console.warn(
        `  SKIP (ambiguous: ${result.candidates.join(', ')})  ${task.title.slice(0, 50)}`
      );
      continue;
    }

    const currentDay = new Date(task.dueAt!).toISOString().slice(0, 10);
    recovered.push({
      id: task.id,
      title: task.title,
      originalDay: result.originalDay,
      currentDay,
      slip: daysBetween(result.originalDay, currentDay),
    });
  }

  console.log(`\n${APPLY ? 'APPLYING' : 'DRY RUN'} — timezone ${TZ}`);
  console.log(`Scanned ${tasks.length} task(s) with a due date and no original recorded.\n`);

  for (const row of recovered) {
    const label =
      row.slip === 0 ? 'unchanged' : row.slip > 0 ? `+${row.slip}d slip` : `${row.slip}d pulled in`;
    console.log(
      `  ${row.originalDay} -> ${row.currentDay}  ${label.padEnd(14)} ${row.title.slice(0, 52)}`
    );
  }

  const slips = recovered.filter((r) => r.slip !== 0).map((r) => r.slip);
  const sorted = [...slips].sort((a, b) => a - b);

  console.log(`\n  recoverable:   ${recovered.length}`);
  console.log(`  no evidence:   ${noEvidence}  (left NULL — genuinely unknown)`);
  console.log(`  ambiguous:     ${ambiguous}  (left NULL — skipped rather than guessed)`);
  if (slips.length) {
    console.log(
      `  actually moved: ${slips.length}  median ${median(slips)}d  range ${sorted[0]}..${sorted[sorted.length - 1]}`
    );
  }

  if (!APPLY) {
    console.log('\nNothing written. Re-run with --apply to commit these values.\n');
    await db.$disconnect();
    return;
  }

  for (const row of recovered) {
    await db.task.update({
      where: { id: row.id },
      // Midday UTC keeps the value on the intended calendar day in any
      // reasonable timezone; only the day is meaningful here.
      data: { originalDueAt: new Date(`${row.originalDay}T12:00:00Z`) },
    });
  }

  // Without this there is no way to tell a backfilled row from one set
  // organically later, so a rollback would be guesswork.
  writeFileSync(
    ROLLBACK_FILE,
    JSON.stringify(
      { appliedAt: new Date().toISOString(), timezone: TZ, taskIds: recovered.map((r) => r.id) },
      null,
      2
    )
  );

  console.log(`\nUpdated ${recovered.length} task(s).`);
  console.log(`Rollback ids written to ${ROLLBACK_FILE}`);
  console.log(
    `To undo: UPDATE "task" SET "original_due_at" = NULL WHERE "id" IN (<ids from that file>);\n`
  );

  await db.$disconnect();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
