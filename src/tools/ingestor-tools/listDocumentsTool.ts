import { z } from 'zod';
import { tool } from '@veridex/agents';
import { IngestorService } from '../../services/ingestorService.js';

export const listDocumentsTool = tool({
  name: 'list_documents',
  guidance: {
    summary: 'Lists stored document chunks in the database with pagination support.',
    whenToUse: [
      'The user asks to see what files or webpages have been indexed or ingested.',
      'To discover document IDs so they can be retrieved using `get_document`.',
    ],
    whenNotToUse: [
      'To search for semantically related information or answer a direct user query — use `semantic_search` instead.',
      'To retrieve the full text content of a single specific document — use `get_document` instead.',
    ],
    successExample: 'Documents 1–20 of 142 total:\nID      1 | webpage_chunk         | 2026-06-01 12:00:00 | https://thai-embassy.com',
  },
  input: z.object({
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
  }),
  safetyClass: 'read',
  async execute({ input }) {
    const limit = input.limit ?? 20;
    const offset = input.offset ?? 0;

    console.log(`[list_documents] Listing documents (limit=${limit}, offset=${offset})`);

    try {
      const service = new IngestorService();
      const [docs, total] = await Promise.all([
        service.getAllDocuments(limit, offset),
        service.getDocumentCount(),
      ]);
      await service.close();

      if (docs.length === 0) {
        return {
          success: true,
          llmOutput: total > 0
            ? `No documents at offset ${offset}. Total documents in database: ${total}.`
            : 'No documents found. Use `ingest_url` or `ingest_file` to add content.',
        };
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

      return {
        success: true,
        llmOutput: lines.join('\n'),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[list_documents] Error: ${message}`);
      return {
        success: false,
        llmOutput: `Failed to list documents: ${message}`,
        error: message,
      };
    }
  },
});
