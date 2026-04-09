/**
 * Cron scheduler — fires a travel post at a configurable interval.
 *
 * Config (env vars):
 *   SCHEDULER_CRON      cron expression (default: "0 9 * * *" = 9am daily)
 *   SCHEDULER_PLATFORMS comma-separated platforms (default: "twitter")
 *   SCHEDULER_ENABLED   set to "true" to activate on startup
 */

import cron from 'node-cron';

export type AgentRunner = (prompt: string) => Promise<string>;

let scheduledTask: cron.ScheduledTask | null = null;

const DEFAULT_CRON      = '0 9 * * *';
const DEFAULT_PLATFORMS = 'twitter';

function buildScheduledPrompt(): string {
  const platforms = (process.env.SCHEDULER_PLATFORMS ?? DEFAULT_PLATFORMS)
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .join(' and ');

  return (
    `Sample a random piece of travel content from the knowledge base, ` +
    `write an engaging, platform-native post based on it, and publish it to ${platforms}. ` +
    `Use platform-appropriate tone and formatting.`
  );
}

export function startScheduler(runAgent: AgentRunner, cronExpr?: string): void {
  const expr = cronExpr ?? process.env.SCHEDULER_CRON ?? DEFAULT_CRON;

  if (!cron.validate(expr)) {
    console.error(`[scheduler] Invalid cron expression: "${expr}". Scheduler not started.`);
    return;
  }

  scheduledTask = cron.schedule(expr, async () => {
    const prompt = buildScheduledPrompt();
    console.log(`\n[scheduler] ${new Date().toISOString()} — firing travel post`);
    try {
      const result = await runAgent(prompt);
      console.log('[scheduler] result:', result);
    } catch (err) {
      console.error('[scheduler] error:', (err as Error).message);
    }
  });

  console.log(`[scheduler] Started — cron: "${expr}" | platforms: ${process.env.SCHEDULER_PLATFORMS ?? DEFAULT_PLATFORMS}`);
}

export function stopScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('[scheduler] Stopped.');
  }
}

export async function triggerNow(runAgent: AgentRunner): Promise<string> {
  const prompt = buildScheduledPrompt();
  console.log(`[scheduler] Manual trigger — prompt: ${prompt}`);
  return runAgent(prompt);
}
