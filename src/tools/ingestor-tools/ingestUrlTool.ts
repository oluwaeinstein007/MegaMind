import { z } from 'zod';
import { tool } from '@veridex/agents';
import { IngestorService } from '../../services/ingestorService.js';

export const ingestUrlTool = tool({
  name: 'ingest_url',
  guidance: {
    summary: 'Crawls a webpage URL and ingests all discovered content into the SQLite and Qdrant databases.',
    whenToUse: [
      'The user provides a website URL or link and asks to ingest, crawl, or read it.',
      'To update or sync information from a remote webpage or travel guide.',
    ],
    whenNotToUse: [
      'For reading local PDF, DOCX, XLSX, or CSV files — use `ingest_file` instead.',
      'For searching through already ingested content — use `semantic_search` instead.',
    ],
    successExample: 'Ingestion complete for: https://example.com\n  New chunks stored : 15\n  Duplicates skipped: 2\n  Sample chunk IDs  : 550e8400-e29b-41d4-a716-446655440000',
  },
  input: z.object({
    url: z.string().url().describe('The HTTP/HTTPS URL of the webpage to crawl and ingest.'),
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
      .describe('If true, attempt to parse sitemap.xml for URLs first.'),
  }),
  safetyClass: 'network',
  async execute({ input }) {
    console.log(`[ingest_url] Starting ingestion for: ${input.url}`);

    try {
      const service = new IngestorService();
      const result = await service.ingestUrl(input.url, {
        maxDepth: input.maxDepth,
        useSitemap: input.useSitemap,
      });
      await service.close();

      const outputLines = [
        `Ingestion complete for: ${input.url}`,
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
      console.error(`[ingest_url] Error: ${message}`);
      return {
        success: false,
        llmOutput: `Failed to ingest URL: ${message}`,
        error: message,
      };
    }
  },
});
