#!/usr/bin/env node
/**
 * JournVibe Social Media Manager — CLI entry point
 *
 * Starts:
 *   • Interactive REPL (always)
 *   • Telegram command bot (polling, if TELEGRAM_BOT_TOKEN set)
 *   • Webhook server     (Slack/Discord/WhatsApp, if WEBHOOK_ENABLED=true)
 *   • Cron scheduler     (if SCHEDULER_ENABLED=true)
 *   • Twitter monitor    (if TWITTER_MONITOR_HANDLE set)
 *
 * Usage:
 *   pnpm dev                                       # interactive REPL
 *   pnpm dev -- "Post about Bali on Twitter"       # single-shot
 *   pnpm dev -- --verbose "..."                    # verbose tool tracing
 *   pnpm dev -- --trigger-now                      # fire scheduler and exit
 */

import 'dotenv/config';
import readline from 'readline';
import { runAgent }                                          from './agent.js';
import { printCredentialReport, hasMinimumCredentials, readyPlatforms } from './lib/credentials.js';
import { createSession, listSessions, clearSession }        from './lib/memory.js';
import { getTravelContentCount }                            from './lib/megamind.js';
import { startScheduler, stopScheduler, triggerNow }        from './lib/scheduler.js';
import { startWebhookServer }                               from './lib/webhook.js';
import { startMonitoring, stopMonitoring }                  from './lib/monitoring.js';
import { TelegramBot }                                      from './lib/telegram-bot.js';

// ── Banner ────────────────────────────────────────────────────────────────────

function travelDbStatus(): string {
  try {
    const n = getTravelContentCount();
    return n > 0 ? `${n.toLocaleString()} chunks indexed` : 'empty — run the ingestor';
  } catch {
    return 'not found (set MEGAMIND_DB_PATH)';
  }
}

function printBanner(verbose: boolean): void {
  const model     = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
  const db        = travelDbStatus();
  const platforms = readyPlatforms();
  const platformStr = platforms.length > 0 ? platforms.join(' · ') : 'none configured';

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║         JournVibe Social Media Manager  v1.0                 ║
╠══════════════════════════════════════════════════════════════╣
║  AI Model  : ${model.padEnd(46)}║
║  Travel DB : ${db.padEnd(46)}║
║  Platforms : ${platformStr.padEnd(46)}║
╚══════════════════════════════════════════════════════════════╝
${verbose ? '\n[verbose mode — tool calls print to stderr]' : ''}
Commands:
  /history          List recent conversation sessions
  /session <id>     Switch to a previous session
  /clear            Clear current session memory
  /trigger          Fire scheduled travel post now
  /creds            Show credential status
  /exit             Quit

Example prompts:
  Post a travel tip about Portugal on Twitter
  Broadcast a Bali budget guide to twitter,telegram,discord
  Generate an Instagram post about Japan cherry blossoms
  Reply to tweet 1837291827456 with a helpful travel tip
`);
}

// ── Special REPL commands ─────────────────────────────────────────────────────

async function handleCommand(
  cmd: string,
  state: { sessionId: string; verbose: boolean }
): Promise<boolean> {
  const [command, ...rest] = cmd.trim().split(/\s+/);

  switch (command) {
    case '/history': {
      const sessions = listSessions(10);
      if (sessions.length === 0) { console.log('No sessions found.'); break; }
      console.log('\nRecent sessions:');
      sessions.forEach((s) => console.log(`  ${s.id}  ${s.created_at}`));
      break;
    }
    case '/session': {
      const id = rest[0];
      if (!id) { console.log('Usage: /session <session_id>'); break; }
      state.sessionId = id;
      console.log(`Switched to session: ${id}`);
      break;
    }
    case '/clear': {
      clearSession(state.sessionId);
      state.sessionId = createSession();
      console.log(`Session cleared. New session: ${state.sessionId}`);
      break;
    }
    case '/trigger': {
      console.log('[trigger] Firing scheduled travel post…');
      try {
        const result = await triggerNow((p) => runAgent(p, { verbose: state.verbose }).then((r) => r.text));
        console.log(result);
      } catch (err) {
        console.error('[trigger] Error:', (err as Error).message);
      }
      break;
    }
    case '/creds': {
      printCredentialReport();
      break;
    }
    case '/exit':
    case '/quit': {
      console.log('Goodbye!');
      process.exit(0);
    }
    default:
      return false;
  }
  return true;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args        = process.argv.slice(2);
  const verbose     = args.includes('--verbose');
  const triggerNow_ = args.includes('--trigger-now');
  const promptArgs  = args.filter((a) => !a.startsWith('--'));

  printCredentialReport();
  if (!hasMinimumCredentials()) {
    console.error('GEMINI_API_KEY is required. Set it in your .env file and restart.');
    process.exit(1);
  }

  const agentRunner = (prompt: string, sessionId?: string): Promise<string> =>
    runAgent(prompt, { verbose, sessionId }).then((r) => r.text);

  // ── Optional background services ──────────────────────────────────────────

  let telegramBot: TelegramBot | null = null;
  if (process.env.TELEGRAM_BOT_TOKEN) {
    telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, agentRunner);
    telegramBot.start().catch((err) => {
      console.error('[telegram-bot] Failed to start:', (err as Error).message);
    });
  }

  if (process.env.WEBHOOK_ENABLED === 'true') {
    startWebhookServer(agentRunner);
  }

  if (process.env.SCHEDULER_ENABLED === 'true') {
    startScheduler(agentRunner);
  }

  if (process.env.TWITTER_MONITOR_HANDLE) {
    startMonitoring(agentRunner);
  }

  process.on('SIGINT',  () => { telegramBot?.stop(); stopScheduler(); stopMonitoring(); console.log('\nGoodbye!'); process.exit(0); });
  process.on('SIGTERM', () => { telegramBot?.stop(); stopScheduler(); stopMonitoring(); process.exit(0); });

  // ── --trigger-now: fire once and exit ─────────────────────────────────────
  if (triggerNow_) {
    console.log('[trigger-now] Firing scheduled post…');
    const result = await triggerNow(agentRunner);
    console.log(result);
    process.exit(0);
  }

  // ── Single-shot mode ──────────────────────────────────────────────────────
  if (promptArgs.length > 0) {
    const prompt = promptArgs.join(' ');
    if (verbose) console.error(`[agent] prompt: ${prompt}\n`);
    const { text, sessionId } = await runAgent(prompt, { verbose });
    console.log('\n' + text);
    if (verbose) console.error(`[session] ${sessionId}`);
    process.exit(0);
  }

  // ── Interactive REPL ──────────────────────────────────────────────────────
  printBanner(verbose);

  const state = { sessionId: createSession(), verbose };
  console.log(`Session: ${state.sessionId}\n`);

  const rl = readline.createInterface({
    input:  process.stdin,
    output: process.stdout,
    prompt: 'social> ',
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) { rl.prompt(); return; }

    if (input.startsWith('/')) {
      await handleCommand(input, state);
      rl.prompt();
      return;
    }

    if (input === 'exit' || input === 'quit') {
      console.log('Goodbye!');
      process.exit(0);
    }

    try {
      console.log('\n[thinking…]\n');
      const { text, sessionId } = await runAgent(input, { verbose, sessionId: state.sessionId });
      state.sessionId = sessionId;
      console.log(text);
      console.log('\n' + '─'.repeat(64) + '\n');
    } catch (err) {
      console.error('\n[error]', (err as Error).message);
    }

    rl.prompt();
  });

  rl.on('close', () => { console.log('\nGoodbye!'); process.exit(0); });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
