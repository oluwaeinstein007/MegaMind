 import { z } from 'zod';
import { tool } from '@veridex/agents';
import { IngestorService } from '../../services/ingestorService.js';
import path from 'path';

export const ingestFileTool = tool({
  name: 'ingest_file',
  guidance: {
    summary: 'Reads a local file (PDF, CSV, TXT, DOCX, XLSX, RTF, JSON, XML) and ingests its chunked contents into the databases.',
    whenToUse: [
      'The user asks to import, load, parse, or index a local document or data file.',
      'To ingest tourist guides or visa requirement sheets stored on disk.',
    ],
    whenNotToUse: [
      'For crawling or fetching public websites/URLs — use `ingest_url` instead.',
      'For searching through already ingested files — use `semantic_search` instead.',
    ],
    successExample: 'Ingestion complete for file: /workspace/rules.pdf\n  New chunks stored : 10\n  Duplicates skipped: 0',
  },
  input: z.object({
    filePath: z.string().describe('The relative or absolute local filesystem path to the file to ingest.'),
  }),
  safetyClass: 'read',
  async execute({ input }) {
    console.log(`[ingest_file] Starting file ingestion: ${input.filePath}`);

    try {
      const absolutePath = path.resolve(input.filePath);
      const workspaceRoot = '/Users/mannyuncharted/Documents/gigs/veridex';

      // Security boundary check to prevent directory traversal outside the allowed workspace root
      if (!absolutePath.startsWith(workspaceRoot)) {
        return {
          success: false,
          llmOutput: `Security boundary violation: File path lies outside the allowed workspace.`,
          error: 'Directory traversal blocked.',
        };
      }

      const service = new IngestorService();
      const result = await service.ingestFile(absolutePath);
      await service.close();

      const outputLines = [
        `Ingestion complete for file: ${input.filePath}`,
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
      console.error(`[ingest_file] Error: ${message}`);
      return {
        success: false,
        llmOutput: `Failed to ingest file: ${message}`,
        error: message,
      };
    }
  },
});
