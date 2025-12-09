
import { z } from "zod";
import { IngestorService } from '../../services/ingestorService.js';

const ingestFileParamsSchema = z.object({
	file: z.any().describe("The file to ingest content from."),
	filePath: z.string().describe("The path of the file to ingest content from."),
});

export const ingestFileTool = {
	name: "INGEST_FILE_TOOL",
	description: "Ingests content from a given file.",
	parameters: ingestFileParamsSchema,
	execute: async (args: z.infer<typeof ingestFileParamsSchema>) => {

		const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '';
		if (!apiKey) {
			throw new Error("LLM_API_KEY (or OPENAI_API_KEY) is not set in the environment.");
		}

        console.log(`[INGEST_FILE_TOOL] ingesting file: ${args.filePath}`);

		try {
			const ingestResponse = await new IngestorService().ingestFile(args.filePath);

            return `✅ Ingestion Successful

            The following document IDs were ingested:
            Ingested File ID: ${ingestResponse}
            `;
		} catch (error: unknown) {
			const message =
				error instanceof Error
					? error.message
					: "An unknown error occurred during the ingestion.";
			console.log(`[INGEST_FILE_TOOL] Error: ${message}`);
			throw new Error(`Failed to ingest file: ${message}`);
		}
	},
};
