import { z } from 'zod';
import { IngestorService } from '../../services/ingestorService.js';

const schema = z.object({
  feedUrl: z
    .string()
    .url()
    .describe(
      'URL of the RSS 2.0 or Atom feed to ingest. ' +
        'Each article is chunked and embedded individually.'
    ),
});

export const ingestRssTool = {
  name: 'INGEST_RSS_TOOL',
  description:
    'Fetches an RSS or Atom feed and ingests each article as chunked, embedded content. ' +
    'Supports RSS 2.0 and Atom 1.0 formats. ' +
    'Duplicate articles are automatically skipped on re-ingestion.',
  parameters: schema,
  execute: async (args: z.infer<typeof schema>) => {
    console.log(`[INGEST_RSS_TOOL] Fetching feed: ${args.feedUrl}`);

    try {
      const service = new IngestorService();
      const result = await service.ingestRss(args.feedUrl);
      await service.close();

      if (result.ingestedCount === 0 && result.skippedCount === 0) {
        return `Feed parsed but contained no usable content: ${args.feedUrl}`;
      }

      return [
        `RSS ingestion complete for: ${args.feedUrl}`,
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
      console.error(`[INGEST_RSS_TOOL] Error: ${message}`);
      throw new Error(`Failed to ingest RSS feed: ${message}`);
    }
  },
};
