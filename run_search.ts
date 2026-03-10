#!/usr/bin/env tsx
/**
 * CLI script to perform a semantic search over the ingested knowledge base.
 *
 * Usage:
 *   npx tsx run_search.ts "<query>" [options]
 *
 * Options:
 *   --limit <n>    Max number of results to return (default: 5)
 *
 * Examples:
 *   npx tsx run_search.ts "what is the visa application process?"
 *   npx tsx run_search.ts "immigration requirements" --limit 10
 */

// Load .env before any other imports so env vars are available
try { (process as any).loadEnvFile('.env'); } catch {}

import { IngestorService } from './src/services/ingestorService.js';

function parseArgs(argv: string[]): { query: string; limit: number } {
  const args = argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npx tsx run_search.ts "<query>" [--limit N]');
    process.exit(1);
  }

  const query = args[0];
  let limit = 5;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[++i], 10);
    }
  }

  return { query, limit };
}

async function main() {
  const { query, limit } = parseArgs(process.argv);

  console.log(`Searching for: "${query}" (limit=${limit})\n`);

  const service = new IngestorService();

  try {
    const results = await service.searchSimilar(query, limit);

    if (results.length === 0) {
      console.log('No results found. Make sure content has been ingested first.');
      return;
    }

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const score = (r.score * 100).toFixed(1);
      console.log(`--- Result ${i + 1} (score: ${score}%) ---`);
      console.log(`Source : ${r.source}`);
      if (r.metadata?.originalUrl && r.metadata.originalUrl !== r.source) {
        console.log(`URL    : ${r.metadata.originalUrl}`);
      }
      if (r.metadata?.pubDate) {
        console.log(`Date   : ${r.metadata.pubDate}`);
      }
      console.log('');
      const preview = r.text.length > 600 ? r.text.slice(0, 600) + ' ...' : r.text;
      console.log(preview);
      console.log('');
    }
  } finally {
    await service.close();
  }
}

main().catch(err => {
  console.error('Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
