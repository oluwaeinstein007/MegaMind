#!/usr/bin/env tsx
/**
 * Bulk ingest all URLs from the travel-urls-dataset into the knowledge base.
 *
 * Usage:
 *   pnpm tsx run_ingest_dataset.ts [options]
 *
 * Options:
 *   --category <name>   Only ingest URLs from one category (e.g. visa, flights)
 *   --depth <n>         Max crawl depth per URL (default: 1)
 *   --concurrency <n>   How many URLs to ingest in parallel (default: 3)
 *   --dry-run           Print URLs that would be ingested, without actually ingesting
 *
 * Examples:
 *   pnpm tsx run_ingest_dataset.ts
 *   pnpm tsx run_ingest_dataset.ts --category visa
 *   pnpm tsx run_ingest_dataset.ts --category immigration --depth 2
 *   pnpm tsx run_ingest_dataset.ts --dry-run
 */

// Load .env before any other imports so env vars are available
try { (process as any).loadEnvFile('.env'); } catch {}

import { IngestorService } from './src/services/ingestorService.js';
import { travelUrls, getCategories } from './src/data/travel-urls-dataset.js';

interface Args {
  category?: string;
  depth: number;
  concurrency: number;
  dryRun: boolean;
  refresh: boolean;
  sitemap: boolean;
}

function parseArgs(argv: string[]): Args {
  const args = argv.slice(2);
  let category: string | undefined;
  let depth = 2;
  let concurrency = 5;
  let dryRun = false;
  let refresh = false;
  let sitemap = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--category' && args[i + 1]) {
      category = args[++i];
    } else if (args[i] === '--depth' && args[i + 1]) {
      depth = parseInt(args[++i], 10);
    } else if (args[i] === '--concurrency' && args[i + 1]) {
      concurrency = parseInt(args[++i], 10);
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--refresh') {
      refresh = true;
    } else if (args[i] === '--sitemap') {
      sitemap = true;
    }
  }

  return { category, depth, concurrency, dryRun, refresh, sitemap };
}

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

async function main() {
  const { category, depth, concurrency, dryRun, refresh, sitemap } = parseArgs(process.argv);

  const categories = getCategories();

  if (category && !categories.includes(category)) {
    console.error(`Unknown category "${category}". Available: ${categories.join(', ')}`);
    process.exit(1);
  }

  const entries = category
    ? travelUrls[category]
    : Object.values(travelUrls).flat();

  console.log(`Travel URL Dataset Ingestor`);
  console.log(`  Category   : ${category ?? 'all'}`);
  console.log(`  URLs       : ${entries.length}`);
  console.log(`  Depth      : ${depth}`);
  console.log(`  Concurrency: ${concurrency}`);
  console.log(`  Refresh    : ${refresh}`);
  console.log(`  Sitemap    : ${sitemap}`);
  if (dryRun) console.log(`  Mode       : DRY RUN`);
  console.log('');

  if (dryRun) {
    entries.forEach((e, i) => console.log(`  ${i + 1}. [${e.description}] ${e.url}`));
    return;
  }

  const service = new IngestorService();
  let totalIngested = 0;
  let totalSkipped = 0;
  let failed = 0;

  try {
    const tasks = entries.map((entry, i) => async () => {
      const label = `[${i + 1}/${entries.length}] ${entry.description}`;
      process.stdout.write(`${label} ... `);
      try {
        const result = await service.ingestUrl(entry.url, { maxDepth: depth, refresh, useSitemap: sitemap });
        process.stdout.write(`+${result.ingestedCount} (skip ${result.skippedCount})\n`);
        totalIngested += result.ingestedCount;
        totalSkipped += result.skippedCount;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        process.stdout.write(`FAIL ${msg}\n`);
        failed++;
      }
    });

    await runWithConcurrency(tasks, concurrency);
  } finally {
    await service.close();
  }

  console.log('');
  console.log('Summary');
  console.log(`  New chunks stored : ${totalIngested}`);
  console.log(`  Duplicates skipped: ${totalSkipped}`);
  console.log(`  Failed URLs       : ${failed}`);
}

main().catch(err => {
  console.error('Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
