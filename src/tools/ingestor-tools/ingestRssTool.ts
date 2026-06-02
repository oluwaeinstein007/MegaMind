import { z } from 'zod';
import { tool } from '@veridex/agents';
import { IngestorService } from '../../services/ingestorService.js';

export const ingestRssTool = tool({
  name: 'ingest_rss',
  guidance: {
    summary: 'Fetches an RSS or Atom feed and ingests each article as chunked, embedded content.',
    whenToUse: [
      'The user asks to import or subscribe to a news feed, RSS feed, or Atom feed URL.',
      'To regularly pull in fresh articles or updates from a travel blog feed.',
    ],
    whenNotToUse: [
      'For loading a single HTML webpage — use `ingest_url` instead.',
      'For reading local PDF, DOCX, or CSV files — use `ingest_file` instead.',
    ],
    successExample: 'RSS ingestion complete for: https://example.com/feed.xml\n  New chunks stored : 24\n  Duplicates skipped: 12',
  },
  input: z.object({
    feedUrl: z.string().url().describe('The URL of the RSS 2.0 or Atom feed to fetch and ingest.'),
  }),
  safetyClass: 'network',
  async execute({ input }) {
    console.log(`[ingest_rss] Fetching feed: ${input.feedUrl}`);

    try {
      const service = new IngestorService();
      const result = await service.ingestRss(input.feedUrl);
      await service.close();

      if (result.ingestedCount === 0 && result.skippedCount === 0) {
        return {
          success: true,
          llmOutput: `Feed parsed but contained no usable content: ${input.feedUrl}`,
        };
      }

      const outputLines = [
        `RSS Ingestion complete for: ${input.feedUrl}`,
        `  New chunks stored : ${result.ingestedCount}`,
        `  Duplicates skipped: ${result.skippedCount}`,
      ];
      if (result.chunkIds.length > 0) {
        outputLines.push(
          `  Sample chunk IDs  : ${result.chunkIds.slice(0, 3).join(', ')}${result.chunkIds.length > 3 ? ' ...' : ''}`
        );
      }

      return {
        success: true,
        llmOutput: outputLines.join('\n'),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[ingest_rss] Error: ${message}`);
      return {
        success: false,
        llmOutput: `Failed to ingest RSS feed: ${message}`,
        error: message,
      };
    }
  },
});
