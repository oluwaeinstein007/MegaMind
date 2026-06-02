import { z } from 'zod';
import { tool } from '@veridex/agents';
import { IngestorService } from '../../services/ingestorService.js';

export const deleteDocumentTool = tool({
  name: 'delete_document',
  guidance: {
    summary: 'Deletes one or more stored document chunks from both the SQLite database and the Qdrant vector store.',
    whenToUse: [
      'The user asks to delete, purge, or remove a specific document (by source name/URL) or a specific chunk ID.',
      'To clean up stale content or clear out incorrect groundings.',
    ],
    whenNotToUse: [
      'To list documents — use `list_documents` instead.',
      'To search or read documents — use `semantic_search` or `get_document` instead.',
    ],
    successExample: 'Deleted 12 chunk(s) for source: https://example.com/guide.pdf',
  },
  input: z.object({
    id: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Delete a single chunk by its database integer ID.'),
    source: z
      .string()
      .min(1)
      .optional()
      .describe(
        'Delete ALL chunks sharing this source identifier (URL title or file name). ' +
          'Use this to purge a full document or webpage.'
      ),
  }),
  safetyClass: 'destructive',
  async execute({ input }) {
    if (input.id === undefined && input.source === undefined) {
      return {
        success: false,
        llmOutput: 'Provide either `id` or `source` to specify what to delete.',
        error: 'Missing arguments',
      };
    }

    try {
      const service = new IngestorService();

      if (input.id !== undefined) {
        console.log(`[delete_document] Deleting document ID: ${input.id}`);
        const deleted = await service.deleteDocument(input.id);
        await service.close();
        return {
          success: true,
          llmOutput: deleted
            ? `Deleted document ID ${input.id} from database and vector store.`
            : `No document found with ID ${input.id}.`,
        };
      }

      if (input.source !== undefined) {
        console.log(`[delete_document] Deleting all chunks for source: ${input.source}`);
        const result = await service.deleteBySource(input.source);
        await service.close();
        return {
          success: true,
          llmOutput: result.count > 0
            ? `Deleted ${result.count} chunk(s) for source: ${input.source}`
            : `No chunks found for source: ${input.source}`,
        };
      }

      return {
        success: false,
        llmOutput: 'Invalid request configuration.',
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[delete_document] Error: ${message}`);
      return {
        success: false,
        llmOutput: `Delete failed: ${message}`,
        error: message,
      };
    }
  },
});
