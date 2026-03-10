#!/usr/bin/env tsx
/**
 * CLI script to ingest a URL or local file into the vector database.
 *
 * Usage:
 *   npx tsx run_ingest.ts <url-or-file-path> [options]
 *
 * Options:
 *   --depth <n>    Max crawl depth for URLs (default: 2)
 *   --sitemap      Use sitemap.xml discovery for URLs
 *
 * Examples:
 *   npx tsx run_ingest.ts https://example.com --depth 3 --sitemap
 *   npx tsx run_ingest.ts ./docs/manual.pdf
 */

// Load .env before any other imports so env vars are available
try { (process as any).loadEnvFile('.env'); } catch {}

import { IngestorService } from './src/services/ingestorService.js';

function parseArgs(argv: string[]): {
  target: string;
  depth?: number;
  sitemap: boolean;
} {
  const args = argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npx tsx run_ingest.ts <url-or-file-path> [--depth N] [--sitemap]');
    process.exit(1);
  }

  const target = args[0];
  let depth: number | undefined;
  let sitemap = false;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--depth' && args[i + 1]) {
      depth = parseInt(args[++i], 10);
    } else if (args[i] === '--sitemap') {
      sitemap = true;
    }
  }

  return { target, depth, sitemap };
}

async function main() {
  const { target, depth, sitemap } = parseArgs(process.argv);

  const isUrl = /^https?:\/\//i.test(target);
  const service = new IngestorService();

  try {
    let result;

    if (isUrl) {
      console.log(`Ingesting URL: ${target}`);
      result = await service.ingestUrl(target, { maxDepth: depth, useSitemap: sitemap });
    } else {
      console.log(`Ingesting file: ${target}`);
      result = await service.ingestFile(target);
    }

    console.log('\nDone.');
    console.log(`  New chunks stored : ${result.ingestedCount}`);
    console.log(`  Duplicates skipped: ${result.skippedCount}`);
    if (result.chunkIds.length > 0) {
      const sample = result.chunkIds.slice(0, 3).join(', ');
      const more = result.chunkIds.length > 3 ? ' ...' : '';
      console.log(`  Sample chunk IDs  : ${sample}${more}`);
    }
  } finally {
    await service.close();
  }
}

main().catch(err => {
  console.error('Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
