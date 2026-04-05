#!/usr/bin/env node
/**
 * MegaMind Social Agent — CLI entry point (v2)
 *
 * Usage – interactive REPL:
 *   pnpm dev
 *
 * Usage – single prompt:
 *   pnpm dev -- "Post a travel tip about Bali on Twitter"
 *   pnpm dev -- "Auto-post one travel topic to the default Telegram channel"
 *   pnpm dev -- --verbose "Reply to tweet 1234567890 with an encouraging message"
 *
 * Flags:
 *   --verbose   Print tool routing and raw results to stderr
 */

import 'dotenv/config';
import readline from 'readline';
import { runAgent } from './agent.js';
import { getTravelContentCount } from './lib/megamind.js';

// ── Startup banner ────────────────────────────────────────────────────────────

function travelDbStatus(): string {
  try {
    const n = getTravelContentCount();
    return n > 0 ? `${n} chunks` : 'empty — run MegaMind ingestor first';
  } catch {
    return 'not connected (set MEGAMIND_DB_PATH)';
  }
}

function printBanner(verbose: boolean): void {
  const apiOk = !!process.env.ANTHROPIC_API_KEY;
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║         MegaMind Social Agent  v2.0  (social-mcp)           ║
╠══════════════════════════════════════════════════════════════╣
║  Claude API  : ${apiOk ? 'connected   ✓' : 'ANTHROPIC_API_KEY missing ✗'}                       ║
║  social-mcp  : tools loaded at runtime via MCP stdio         ║
║  Travel DB   : ${travelDbStatus().padEnd(44)}║
╚══════════════════════════════════════════════════════════════╝

Supported platforms (via social-mcp):
  Twitter/X · Telegram · Discord · Slack · WhatsApp · Facebook · Instagram

Example prompts:
  • Post a travel tip about Portugal on Twitter
  • Send a Bali budget guide to Telegram channel -1001234567890
  • Post a random travel fact on Discord channel 987654321
  • Reply to tweet 1837291827456 with a helpful travel tip
  • Auto-post one interesting visa fact across Twitter and Slack
  • Search travel content about "Japan cherry blossom season"

${verbose ? '[verbose mode on — tool calls will print to stderr]\n' : ''}Type your instruction and press Enter. Ctrl+C to exit.
`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose');
  const promptArgs = args.filter((a) => a !== '--verbose');

  // ── Single-shot mode ──────────────────────────────────────────────────
  if (promptArgs.length > 0) {
    const prompt = promptArgs.join(' ');
    if (verbose) console.error(`[agent] prompt: ${prompt}\n`);
    try {
      const result = await runAgent(prompt, { verbose });
      console.log(result);
    } catch (err) {
      console.error('[fatal]', err instanceof Error ? err.message : err);
      process.exit(1);
    }
    process.exit(0);
  }

  // ── Interactive REPL ──────────────────────────────────────────────────
  printBanner(verbose);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'agent> ',
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) { rl.prompt(); return; }
    if (input === 'exit' || input === 'quit') { console.log('Goodbye!'); process.exit(0); }

    try {
      console.log('\n[agent] Connecting to social-mcp and thinking…\n');
      const result = await runAgent(input, { verbose });
      console.log(result);
    } catch (err) {
      console.error('\n[error]', err instanceof Error ? err.message : err);
    }

    rl.prompt();
  });

  rl.on('close', () => { console.log('\nGoodbye!'); process.exit(0); });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
