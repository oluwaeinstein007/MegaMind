import { z } from 'zod';
import { IngestorService } from '../../services/ingestorService.js';

const schema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Maximum number of documents to return (default: 20).'),
  offset: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Number of documents to skip for pagination (default: 0).'),
});

export const listDocumentsTool = {
  name: 'DOCUMENT_LIST_TOOL',
  description:
    'Lists document chunks stored in the database with pagination support. ' +
    'Returns document IDs, sources, types, and ingestion timestamps. ' +
    'Use DOCUMENT_RETRIEVAL_TOOL to get the full content of a specific chunk.',
  parameters: schema,
  execute: async (args: z.infer<typeof schema>) => {
    const limit = args.limit ?? 20;
    const offset = args.offset ?? 0;

    console.log(`[DOCUMENT_LIST_TOOL] Listing documents (limit=${limit}, offset=${offset})`);

    try {
      const service = new IngestorService();
      const [docs, total] = await Promise.all([
        service.getAllDocuments(limit, offset),
        service.getDocumentCount(),
      ]);
      await service.close();

      if (docs.length === 0) {
        return total > 0
          ? `No documents at offset ${offset}. Total documents in database: ${total}.`
          : 'No documents found. Use INGEST_URL_TOOL or INGEST_FILE_TOOL to add content.';
      }

      const lines: string[] = [
        `Documents ${offset + 1}–${offset + docs.length} of ${total} total:`,
        '',
      ];

      for (const doc of docs) {
        lines.push(
          `ID ${String(doc.id).padStart(6)} | ${doc.type.padEnd(20)} | ${doc.ingested_at.slice(0, 19)} | ${doc.source}`
        );
      }

      if (offset + docs.length < total) {
        lines.push('');
        lines.push(`Next page: use offset=${offset + limit}`);
      }

      return lines.join('\n');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[DOCUMENT_LIST_TOOL] Error: ${message}`);
      throw new Error(`Failed to list documents: ${message}`);
    }
  },
};
