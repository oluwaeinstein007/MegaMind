
import { z } from "zod";
import bodyParser from 'body-parser';
import { IngestorService } from '../../services/ingestorService.js';

const ingestUrlParamsSchema = z.object({
    url: z.string().url().describe("The URL of the webpage to ingest content from."),
});

export const ingestUrlTool = {
	name: "INGEST_URL_TOOL",
	description: "Ingests content from a given URL.",
	parameters: ingestUrlParamsSchema,
	execute: async (args: z.infer<typeof ingestUrlParamsSchema>) => {

        const OpenAIKey = process.env.OPENAI_API_KEY || '';
        if (!OpenAIKey) {
            throw new Error("OPENAI_API_KEY is not set in the environment.");
        }

        console.log(`[INGEST_URL_TOOL] ingesting URL: ${args.url}`);

		try {
            const ingestResponse = await new IngestorService(OpenAIKey).ingestUrl(args.url);

            return `✅ Ingestion Successful

            The following document IDs were ingested:
            ${ingestResponse.join('\n')}
            `;
		} catch (error: unknown) {
			const message =
				error instanceof Error
					? error.message
					: "An unknown error occurred during the ingestion.";
			console.log(`[INGEST_URL_TOOL] Error: ${message}`);
			throw new Error(`Failed to ingest url: ${message}`);
		}
	},
};
