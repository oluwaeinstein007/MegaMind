import { z } from 'zod';
import { IngestorService } from '../../services/ingestorService.js';

const schema = z.object({
  id: z
    .number()
    .int()
    .positive()
    .describe('The integer ID of the document chunk to retrieve from the database.'),
});

export const getDocumentTool = {
  name: 'DOCUMENT_RETRIEVAL_TOOL',
  description:
    'Retrieves a stored document chunk by its database integer ID. ' +
    'Use DOCUMENT_LIST_TOOL first to discover available document IDs.',
  parameters: schema,
  execute: async (args: z.infer<typeof schema>) => {
    console.log(`[DOCUMENT_RETRIEVAL_TOOL] Retrieving document ID: ${args.id}`);

    try {
      const service = new IngestorService();
      const doc = await service.getDocument(args.id);
      await service.close();

      if (!doc) {
        return `No document found with ID ${args.id}.`;
      }

      return [
        `Document ID   : ${doc.id}`,
        `Chunk ID      : ${doc.chunkId ?? 'n/a'}`,
        `Source        : ${doc.source}`,
        `Type          : ${doc.type}`,
        `Ingested at   : ${doc.ingested_at}`,
        `Metadata      : ${JSON.stringify(doc.metadata, null, 2)}`,
        ``,
        `Content:`,
        doc.content ?? '(no content)',
      ].join('\n');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[DOCUMENT_RETRIEVAL_TOOL] Error: ${message}`);
      throw new Error(`Failed to retrieve document: ${message}`);
    }
  },
};
