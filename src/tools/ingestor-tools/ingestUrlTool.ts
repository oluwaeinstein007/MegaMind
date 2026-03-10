import { z } from 'zod';
import { IngestorService } from '../../services/ingestorService.js';

const schema = z.object({
  url: z.string().url().describe('The URL of the webpage to ingest content from.'),
  maxDepth: z
    .number()
    .int()
    .min(0)
    .max(5)
    .optional()
    .describe('How many link levels deep to crawl (default: 2).'),
  useSitemap: z
    .boolean()
    .optional()
    .describe('If true, attempt sitemap.xml-based URL discovery before crawling.'),
});

export const ingestUrlTool = {
  name: 'INGEST_URL_TOOL',
  description:
    'Crawls a URL and ingests all discovered content into the vector database. ' +
    'Automatically deduplicates content so re-ingesting the same URL is safe.',
  parameters: schema,
  execute: async (args: z.infer<typeof schema>) => {
    console.log(`[INGEST_URL_TOOL] Starting ingestion for: ${args.url}`);

    try {
      const service = new IngestorService();
      const result = await service.ingestUrl(args.url, {
        maxDepth: args.maxDepth,
        useSitemap: args.useSitemap,
      });
      await service.close();

      return [
        `Ingestion complete for: ${args.url}`,
        `  New chunks stored : ${result.ingestedCount}`,
        `  Duplicates skipped: ${result.skippedCount}`,
        result.chunkIds.length > 0
          ? `  Sample chunk IDs  : ${result.chunkIds.slice(0, 3).join(', ')}${result.chunkIds.length > 3 ? ' ...' : ''}`
          : '',
      ]
        .filter(Boolean)
        .join('\n');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[INGEST_URL_TOOL] Error: ${message}`);
      throw new Error(`Failed to ingest URL: ${message}`);
    }
  },
};
