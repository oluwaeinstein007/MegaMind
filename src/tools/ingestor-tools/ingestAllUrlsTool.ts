import { z } from 'zod';
import { tool } from '@veridex/agents';
import { IngestorService } from '../../services/ingestorService.js';
import {
  getUrlsByCategory,
  getCategories,
  getAllUrls,
  TravelUrlsDataset,
} from '../../data/travel-urls-dataset.js';

export const ingestAllUrlsTool = tool({
  name: 'ingest_all_urls',
  guidance: {
    summary: 'Ingests content from the built-in travel URL dataset, either for a specific category or all available categories.',
    whenToUse: [
      'The user asks to seed the database, load preset travel sites, or crawl predefined directories (like visa or flights preset categories).',
      'During initialization or bulk ingestion setups.',
    ],
    whenNotToUse: [
      'For crawling arbitrary new URLs — use `ingest_url` instead.',
      'For ingesting single uploaded or local files — use `ingest_file` instead.',
    ],
    successExample: 'Ingestion summary for flights category:\n  URLs processed    : 10\n  Total new chunks  : 50\n  Total skipped     : 10\n  Failed URLs       : 0',
  },
  input: z.object({
    category: z
      .string()
      .optional()
      .describe("Optional category to ingest (e.g. 'visa', 'flights'). Omit to ingest all available categories."),
  }),
  safetyClass: 'network',
  async execute({ input }) {
    const service = new IngestorService();
    await service.initialize();

    let urlsToIngest: string[];
    let label: string;

    if (input.category) {
      const category = input.category.toLowerCase();
      const available = getCategories();
      if (!available.includes(category)) {
        return {
          success: false,
          llmOutput: `Unknown category '${input.category}'. Available: ${available.join(', ')}`,
          error: 'Invalid category',
        };
      }
      urlsToIngest = getUrlsByCategory(category as keyof TravelUrlsDataset).map(item =>
        item.url.trim()
      );
      label = `'${category}' category`;
    } else {
      urlsToIngest = getAllUrls().map(u => u.trim());
      label = 'all categories';
    }

    if (urlsToIngest.length === 0) {
      await service.close();
      return {
        success: true,
        llmOutput: `No URLs found for ${label}.`,
      };
    }

    console.log(`[ingest_all_urls] Processing ${urlsToIngest.length} URL(s) in ${label}`);

    const details: string[] = [];
    let totalIngested = 0;
    let totalSkipped = 0;
    let failed = 0;

    for (const url of urlsToIngest) {
      try {
        const result = await service.ingestUrl(url);
        totalIngested += result.ingestedCount;
        totalSkipped += result.skippedCount;
        details.push(`  OK  ${url} — ${result.ingestedCount} new, ${result.skippedCount} skipped`);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[ingest_all_urls] Failed: ${url} — ${message}`);
        details.push(`  ERR ${url} — ${message}`);
        failed++;
      }
    }

    await service.close();

    const output = [
      `Ingestion summary for ${label}:`,
      `  URLs processed    : ${urlsToIngest.length}`,
      `  Total new chunks  : ${totalIngested}`,
      `  Total skipped     : ${totalSkipped}`,
      `  Failed URLs       : ${failed}`,
      '',
      'Details:',
      ...details,
    ].join('\n');

    return {
      success: true,
      llmOutput: output,
    };
  },
});
