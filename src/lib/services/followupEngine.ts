import { db } from '$lib/db';
import { addDays, differenceInDays, startOfDay } from 'date-fns';
import type { Task } from '@prisma/client';

interface FollowUpSpec {
  followUpType: 'self_accountability' | 'executor_checkin' | 'stakeholder_update';
  targetPersonId: string | null;
  dueAt: Date;
}

interface RuleConfig {
  cadenceDays?: number; // For simple recurring rules
  enabled?: boolean;
}

/**
 * Generate follow-ups for a single task
 */
export async function generateForTask(taskId: string, asOf: Date = new Date()): Promise<void> {
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: {
      followUpRules: true,
      stakeholders: true,
    },
  });

  if (!task || task.status === 'completed' || task.status === 'cancelled') {
    return;
  }

  // Delete existing pending follow-ups for this task (idempotency)
  await db.followUp.deleteMany({
    where: {
      taskId: task.id,
      status: 'pending',
      dueAt: {
        gte: asOf,
      },
    },
  });

  // Get or create default rules if none exist
  let rules = task.followUpRules;
  if (rules.length === 0) {
    rules = await createDefaultRules(task);
  }

  // Generate follow-ups based on rules
  const followUpSpecs: FollowUpSpec[] = [];

  for (const rule of rules) {
    if (!rule.isActive) continue;

    const config = rule.configJson as RuleConfig;
    const specs = computeFollowUpsForRule(task, rule.ruleType, config, asOf);
    followUpSpecs.push(...specs);
  }

  // Create follow-ups in database
  if (followUpSpecs.length > 0) {
    await db.followUp.createMany({
      data: followUpSpecs.map((spec) => ({
        taskId: task.id,
        followUpType: spec.followUpType,
        targetPersonId: spec.targetPersonId,
        dueAt: spec.dueAt,
        status: 'pending',
      })),
    });
  }
}

/**
 * Generate follow-ups for all active tasks (not just tasks on a specific board date)
 */
export async function generateForActiveTasks(
  boardDate: Date,
  asOf: Date = new Date()
): Promise<void> {
  // Get ALL active tasks with due dates (not just tasks scheduled for today)
  const tasks = await db.task.findMany({
    where: {
      status: { in: ['not_started', 'in_progress', 'waiting'] },
      dueAt: {
        not: null, // Only tasks with due dates
      },
    },
  });

  for (const task of tasks) {
    await generateForTask(task.id, asOf);
  }
}

/**
 * Compute follow-up instances for a specific rule
 */
function computeFollowUpsForRule(
  task: Task & { stakeholders?: any[] },
  ruleType: string,
  config: RuleConfig,
  asOf: Date
): FollowUpSpec[] {
  const specs: FollowUpSpec[] = [];

  if (!task.dueAt) {
    // No due date, no follow-ups
    return specs;
  }

  const daysUntilDue = differenceInDays(new Date(task.dueAt), startOfDay(asOf));
  
  // Don't create follow-ups for tasks due today or in the past
  // The task itself is already on the board - no need for a follow-up
  if (daysUntilDue <= 0) {
    return specs;
  }

  const cadence = getCadenceForTimeframe(daysUntilDue);

  if (ruleType === 'self_accountability') {
    // Generate self accountability check-ins
    specs.push({
      followUpType: 'self_accountability',
      targetPersonId: task.accountablePersonId,
      dueAt: getNextFollowUpDate(asOf, cadence, task.dueAt),
    });
  } else if (ruleType === 'executor_checkin' && task.executorPersonId) {
    // Only if executor is different from accountable
    if (task.executorPersonId !== task.accountablePersonId) {
      specs.push({
        followUpType: 'executor_checkin',
        targetPersonId: task.executorPersonId,
        dueAt: getNextFollowUpDate(asOf, cadence, task.dueAt),
      });
    }
  } else if (ruleType === 'stakeholder_update' && task.stakeholders) {
    // Generate update for each stakeholder
    for (const stakeholder of task.stakeholders) {
      specs.push({
        followUpType: 'stakeholder_update',
        targetPersonId: stakeholder.personId,
        dueAt: getNextFollowUpDate(asOf, cadence, task.dueAt),
      });
    }
  }

  return specs;
}

/**
 * Get cadence based on time until due date
 */
function getCadenceForTimeframe(daysUntilDue: number): number {
  if (daysUntilDue < 0) {
    return 1; // Overdue: daily
  } else if (daysUntilDue <= 7) {
    return 1; // Due within a week: daily
  } else if (daysUntilDue <= 14) {
    return 3; // Due within 2 weeks: every 3 days
  } else {
    return 7; // Due later: weekly
  }
}

/**
 * Calculate next follow-up date based on cadence
 */
function getNextFollowUpDate(asOf: Date, cadenceDays: number, dueDate: Date): Date {
  const nextDate = addDays(asOf, cadenceDays);
  
  // Don't schedule follow-ups past the due date
  if (nextDate > new Date(dueDate)) {
    return new Date(dueDate);
  }
  
  return nextDate;
}

/**
 * Create default follow-up rules for a task
 */
async function createDefaultRules(task: Task & { stakeholders?: any[] }) {
  const rulesToCreate = [
    {
      taskId: task.id,
      ruleType: 'self_accountability',
      isActive: true,
      configJson: { enabled: true },
    },
  ];

  // Add executor check-in if delegated
  if (task.executorPersonId && task.executorPersonId !== task.accountablePersonId) {
    rulesToCreate.push({
      taskId: task.id,
      ruleType: 'executor_checkin',
      isActive: true,
      configJson: { enabled: true },
    });
  }

  // Add stakeholder updates if there are stakeholders
  if (task.stakeholders && task.stakeholders.length > 0) {
    rulesToCreate.push({
      taskId: task.id,
      ruleType: 'stakeholder_update',
      isActive: true,
      configJson: { enabled: true },
    });
  }

  return await db.followUpRule.createManyAndReturn({
    data: rulesToCreate,
  });
}

