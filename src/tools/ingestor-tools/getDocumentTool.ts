import { z } from 'zod';
import { tool } from '@veridex/agents';
import { IngestorService } from '../../services/ingestorService.js';

export const getDocumentTool = tool({
  name: 'get_document',
  guidance: {
    summary: 'Retrieves a single stored document chunk from the database by its integer ID.',
    whenToUse: [
      'The user asks for the full content of a specific chunk or document after seeing its ID.',
      'To fetch specific metadata or the full text block for a known index ID.',
    ],
    whenNotToUse: [
      'For semantic search or keyword queries — use `semantic_search` instead.',
      'To list available documents — use `list_documents` instead.',
    ],
    successExample: 'Document ID   : 42\nSource        : https://example.com\nType          : webpage_chunk\nContent:\n...\n',
  },
  input: z.object({
    id: z.number().int().positive().describe('The integer database ID of the document chunk to retrieve.'),
  }),
  safetyClass: 'read',
  async execute({ input }) {
    console.log(`[get_document] Retrieving document ID: ${input.id}`);

    try {
      const service = new IngestorService();
      const doc = await service.getDocument(input.id);
      await service.close();

      if (!doc) {
        return {
          success: true,
          llmOutput: `No document found with ID ${input.id}.`,
        };
      }

      const output = [
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

      return {
        success: true,
        llmOutput: output,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[get_document] Error: ${message}`);
      return {
        success: false,
        llmOutput: `Failed to retrieve document: ${message}`,
        error: message,
      };
    }
  },
});
