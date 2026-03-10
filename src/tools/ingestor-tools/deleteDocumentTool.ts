import { z } from 'zod';
import { IngestorService } from '../../services/ingestorService.js';

const schema = z.union([
  z.object({
    id: z
      .number()
      .int()
      .positive()
      .describe('Delete a single chunk by its database integer ID.'),
    source: z.undefined().optional(),
  }),
  z.object({
    source: z
      .string()
      .min(1)
      .describe(
        'Delete ALL chunks sharing this source identifier (URL title or file name). ' +
          'Use this to purge a full document or webpage.'
      ),
    id: z.undefined().optional(),
  }),
]);

export const deleteDocumentTool = {
  name: 'DOCUMENT_DELETE_TOOL',
  description:
    'Deletes one or more document chunks from both the SQLite database and the Qdrant vector store. ' +
    'Supply either `id` (single chunk) or `source` (all chunks from that source).',
  parameters: schema,
  execute: async (args: z.infer<typeof schema>) => {
    try {
      const service = new IngestorService();

      if (args.id !== undefined) {
        console.log(`[DOCUMENT_DELETE_TOOL] Deleting document ID: ${args.id}`);
        const deleted = await service.deleteDocument(args.id);
        await service.close();
        return deleted
          ? `Deleted document ID ${args.id} from database and vector store.`
          : `No document found with ID ${args.id}.`;
      }

      if (args.source !== undefined) {
        console.log(`[DOCUMENT_DELETE_TOOL] Deleting all chunks for source: ${args.source}`);
        const result = await service.deleteBySource(args.source);
        await service.close();
        return result.count > 0
          ? `Deleted ${result.count} chunk(s) for source: ${args.source}`
          : `No chunks found for source: ${args.source}`;
      }

      return 'Provide either `id` or `source` to specify what to delete.';
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[DOCUMENT_DELETE_TOOL] Error: ${message}`);
      throw new Error(`Delete failed: ${message}`);
    }
  },
};
