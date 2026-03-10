import { z } from 'zod';
import { IngestorService } from '../../services/ingestorService.js';

const schema = z.object({
  query: z.string().min(1).describe('The natural-language query to search for semantically similar content.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .describe('Maximum number of results to return (default: 5).'),
});

export const searchTool = {
  name: 'SEMANTIC_SEARCH_TOOL',
  description:
    'Performs a semantic similarity search over all ingested content. ' +
    'Returns the most relevant chunks ranked by cosine similarity score. ' +
    'Use this to find information related to a user query from the ingested knowledge base.',
  parameters: schema,
  execute: async (args: z.infer<typeof schema>) => {
    console.log(`[SEMANTIC_SEARCH_TOOL] Query: "${args.query}" (limit=${args.limit ?? 5})`);

    try {
      const service = new IngestorService();
      const results = await service.searchSimilar(args.query, args.limit ?? 5);
      await service.close();

      if (results.length === 0) {
        return 'No results found. Make sure content has been ingested first using INGEST_URL_TOOL or INGEST_FILE_TOOL.';
      }

      const lines: string[] = [`Search results for: "${args.query}"`, ''];

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

      return lines.join('\n');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[SEMANTIC_SEARCH_TOOL] Error: ${message}`);
      throw new Error(`Search failed: ${message}`);
    }
  },
};
