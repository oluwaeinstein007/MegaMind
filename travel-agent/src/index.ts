#!/usr/bin/env node
/**
 * NomadSage Travel Advisor — CLI entry point
 *
 * Starts:
 *   • Interactive REPL      (always)
 *   • Telegram Q&A bot      (polling via Telegraf, if TELEGRAM_BOT_TOKEN set)
 *   • Webhook server        (Telegram/Slack/Discord/WhatsApp inbound, if WEBHOOK_ENABLED=true)
 *   • Twitter monitor       (if TWITTER_MONITOR_HANDLE set)
 *
 * All platform replies go through social-mcp — no custom platform clients are built here.
 *
 * Usage:
 *   pnpm dev                        # interactive REPL
 *   pnpm dev -- "Do I need a visa?" # single-shot query
 *   pnpm dev -- --verbose "..."     # verbose tool tracing
 */

import 'dotenv/config';
import readline from 'readline';
import { runAgent }                                       from './agent.js';
import { printCredentialReport, hasMinimumCredentials }  from './lib/credentials.js';
import { createSession, listSessions, clearSession }     from './lib/memory.js';
import { getTravelContentCount }                         from './lib/megamind.js';
import { startWebhookServer }                            from './lib/webhook.js';
import { startMonitoring, stopMonitoring }               from './lib/monitoring.js';
import { TelegramBot }                                   from './lib/telegram-bot.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function travelDbStatus(): string {
  try {
    const n = getTravelContentCount();
    return n > 0 ? `${n.toLocaleString()} chunks indexed` : 'empty — run the ingestor';
  } catch {
    return 'not found (set MEGAMIND_DB_PATH)';
  }
}

function printBanner(verbose: boolean): void {
  const model   = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
  const db      = travelDbStatus();
  const webhook = process.env.WEBHOOK_ENABLED === 'true' ? `port ${process.env.WEBHOOK_PORT ?? '3456'}` : 'disabled';
  const twitter = process.env.TWITTER_MONITOR_HANDLE ?? 'not watching';

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           NomadSage Travel Advisor  v1.0                     ║
╠══════════════════════════════════════════════════════════════╣
║  AI Model  : ${model.padEnd(46)}║
║  Travel DB : ${db.padEnd(46)}║
║  Webhook   : ${webhook.padEnd(46)}║
║  Twitter   : ${twitter.padEnd(46)}║
╚══════════════════════════════════════════════════════════════╝
${verbose ? '\n[verbose mode — tool calls print to stderr]' : ''}
Receives travel questions from Telegram, Twitter/X, Discord, Slack,
and WhatsApp. Replies via social-mcp on the originating platform.

Commands:
  /history          List recent conversation sessions
  /session <id>     Switch to a previous session
  /clear            Clear current session memory
  /creds            Show credential status
  /exit             Quit

Example questions:
  Do I need a visa to travel from Nigeria to Canada?
  What are the cheapest destinations in Southeast Asia?
  How long can I stay in the Schengen Area on a tourist visa?
  Best time to visit Japan for cherry blossoms?
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
    case '/creds': {
      printCredentialReport();
      break;
    }
    case '/exit':
    case '/quit': {
      console.log('Safe travels!');
      process.exit(0);
    }
    default:
      return false;
  }
  return true;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args       = process.argv.slice(2);
  const verbose    = args.includes('--verbose');
  const promptArgs = args.filter((a) => !a.startsWith('--'));

  printCredentialReport();
  if (!hasMinimumCredentials()) {
    console.error('GEMINI_API_KEY is required. Set it in your .env file and restart.');
    process.exit(1);
  }

  const agentRunner = (prompt: string, sessionId?: string): Promise<string> =>
    runAgent(prompt, { verbose, sessionId }).then((r) => r.text);

  // ── Optional: Telegram Q&A bot (polling) ──────────────────────────────────
  let telegramBot: TelegramBot | null = null;
  if (process.env.TELEGRAM_BOT_TOKEN) {
    telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, agentRunner);
    telegramBot.start().catch((err) => {
      console.error('[telegram-bot] Failed to start:', (err as Error).message);
    });
  }

  // ── Optional: Webhook server (receives inbound messages from platforms) ────
  if (process.env.WEBHOOK_ENABLED === 'true') {
    startWebhookServer(agentRunner);
  }

  // ── Optional: Twitter mention monitor ─────────────────────────────────────
  if (process.env.TWITTER_MONITOR_HANDLE) {
    startMonitoring(agentRunner);
  }

  // Graceful shutdown
  process.on('SIGINT',  () => { telegramBot?.stop(); stopMonitoring(); console.log('\nSafe travels!'); process.exit(0); });
  process.on('SIGTERM', () => { telegramBot?.stop(); stopMonitoring(); process.exit(0); });

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
    prompt: 'nomadsage> ',
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
      console.log('Safe travels!');
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

  rl.on('close', () => { console.log('\nSafe travels!'); process.exit(0); });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
