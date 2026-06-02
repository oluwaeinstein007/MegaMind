import { z } from 'zod';
import { tool } from '@veridex/agents';
import { IngestorService } from '../../services/ingestorService.js';

export const searchTool = tool({
  name: 'semantic_search',
  guidance: {
    summary: 'Performs a semantic similarity search over all ingested travel and visa content.',
    whenToUse: [
      'The user asks a factual question about visas, entry requirements, destinations, budgets, or travel advice.',
      'To retrieve contextually relevant groundings before drafting any travel advisory post or advice.',
    ],
    whenNotToUse: [
      'To list every raw document or paginated chunk in the database — use `list_documents` instead.',
      'To fetch a single document chunk by its integer database ID — use `get_document` instead.',
    ],
    successExample: 'Search results for: "Thailand tourist visa"\n--- Result 1 (score: 92.4%) ---\nSource : https://thai-embassy.com\nContent: Tourist visas allow stays of up to 60 days...',
  },
  input: z.object({
    query: z.string().min(1).describe('The natural-language query to search for semantically similar content.'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .describe('Maximum number of results to return (default: 5).'),
  }),
  safetyClass: 'read',
  async execute({ input }) {
    console.log(`[semantic_search] Query: "${input.query}" (limit=${input.limit ?? 5})`);

    try {
      const service = new IngestorService();
      const results = await service.searchSimilar(input.query, input.limit ?? 5);
      await service.close();

      if (results.length === 0) {
        return {
          success: true,
          llmOutput: 'No results found. Make sure content has been ingested first using `ingest_url` or `ingest_file`.',
        };
      }

      const lines: string[] = [`Search results for: "${input.query}"`, ''];

      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const score = (r.score * 100).toFixed(1);
        lines.push(`--- Result ${i + 1} (score: ${score}%) ---`);
        lines.push(`Source : ${r.source}`);
        if (r.metadata?.originalUrl && r.metadata.originalUrl !== r.source) {
          lines.push(`URL    : ${r.metadata.originalUrl}`);
        }
        if (r.metadata?.pubDate) {
          lines.push(`Date   : ${r.metadata.pubDate}`);
        }
        lines.push('');
        // Trim text to a readable length
        const preview = r.text.length > 600 ? r.text.slice(0, 600) + ' ...' : r.text;
        lines.push(preview);
        lines.push('');
      }

      return {
        success: true,
        llmOutput: lines.join('\n'),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[semantic_search] Error: ${message}`);
      return {
        success: false,
        llmOutput: `Search failed: ${message}`,
        error: message,
      };
    }
  },
});
