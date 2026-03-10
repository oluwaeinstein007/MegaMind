import { z } from 'zod';
import { IngestorService } from '../../services/ingestorService.js';
import {
  getUrlsByCategory,
  getCategories,
  getAllUrls,
  TravelUrlsDataset,
} from '../../data/travel-urls-dataset.js';

const schema = z.object({
  category: z
    .string()
    .optional()
    .describe(
      "Optional category to ingest (e.g. 'visa', 'flights'). Omit to ingest all available URLs."
    ),
});

export const ingestAllUrlsTool = {
  name: 'INGEST_ALL_URLS_TOOL',
  description:
    'Ingests content from the built-in travel URL dataset, either for a specific category or all 200+ URLs. ' +
    'Duplicate content is automatically skipped.',
  parameters: schema,
  execute: async (args: z.infer<typeof schema>) => {
    const service = new IngestorService();
    await service.initialize();

    let urlsToIngest: string[];
    let label: string;

    if (args.category) {
      const category = args.category.toLowerCase();
      const available = getCategories();
      if (!available.includes(category)) {
        throw new Error(
          `Unknown category '${args.category}'. Available: ${available.join(', ')}`
        );
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
      return `No URLs found for ${label}.`;
    }

    console.log(`[INGEST_ALL_URLS_TOOL] Processing ${urlsToIngest.length} URL(s) in ${label}`);

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
        console.error(`[INGEST_ALL_URLS_TOOL] Failed: ${url} — ${message}`);
        details.push(`  ERR ${url} — ${message}`);
        failed++;
      }
    }

    await service.close();

    return [
      `Ingestion summary for ${label}:`,
      `  URLs processed    : ${urlsToIngest.length}`,
      `  Total new chunks  : ${totalIngested}`,
      `  Total skipped     : ${totalSkipped}`,
      `  Failed URLs       : ${failed}`,
      '',
      'Details:',
      ...details,
    ].join('\n');
  },
};
