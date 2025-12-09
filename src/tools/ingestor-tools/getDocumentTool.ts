
import { z } from "zod";
import bodyParser from 'body-parser';
import { IngestorService } from '../../services/ingestorService.js';
import { id } from "zod/v4/locales";

const getDocumentParamsSchema = z.object({
	id: z.number().describe("The ID of the document to retrieve."),
});

export const getDocumentTool = {
	name: "DOCUMENT_RETRIEVAL_TOOL",
	description: "Retrieves content of a document by its ID.",
	parameters: getDocumentParamsSchema,
	execute: async (args: z.infer<typeof getDocumentParamsSchema>) => {

		const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '';
		if (!apiKey) {
			throw new Error("LLM_API_KEY (or OPENAI_API_KEY) is not set in the environment.");
		}

		try {
			if(args.id){
				console.log(`[DOCUMENT_RETRIEVAL_TOOL] retrieving document ID: ${args.id}`);
				const retrieveResponse = await new IngestorService().getDocument(args.id);
				console.log(`Retrieved: ID=${retrieveResponse.id}, Source=${retrieveResponse.source}, Type=${retrieveResponse.type}`);
				
				return `✅ Retrieval Successful
				The following document was retrieved:
				${retrieveResponse}`;
			  } else {
				const retrieveResponse = await new IngestorService().getAllDocuments();
				console.log(`Found ${retrieveResponse.length} documents:`);
				retrieveResponse.forEach(doc => {
					console.log(`- ID: ${doc.id}, Source: ${doc.source}, Type: ${doc.type}, Metadata: ${JSON.stringify(doc.metadata)}`);
				  });

				return `✅ Retrieval Successful
				The following document IDs were retrieved:
				${retrieveResponse.join('\n')}`;
				}
		} catch (error: unknown) {
			const message =
				error instanceof Error
					? error.message
					: "An unknown error occurred during the retrival.";
			console.log(`[DOCUMENT_RETRIEVAL_TOOL] Error: ${message}`);
			throw new Error(`Failed to retrival url: ${message}`);
		}
	},
};
