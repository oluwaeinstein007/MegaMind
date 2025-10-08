
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

        const OpenAIKey = process.env.OPENAI_API_KEY || '';
        if (!OpenAIKey) {
            throw new Error("OPENAI_API_KEY is not set in the environment.");
        }

        console.log(`[INGEST_FILE_TOOL] ingesting file: ${args.filePath}`);

		try {
            const ingestResponse = await new IngestorService(OpenAIKey).ingestFile(args.filePath);

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
