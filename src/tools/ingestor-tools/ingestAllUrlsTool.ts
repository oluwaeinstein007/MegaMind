import { z } from "zod";
import { IngestorService } from "../../services/ingestorService.js"; // Import IngestorService
import { travelUrls, getUrlsByCategory, getCategories, getAllUrls, TravelUrlsDataset } from "../../data/travel-urls-dataset.js";

// Define schema for parameters
const ingestAllUrlsParamsSchema = z.object({
    category: z.string().optional().describe("Optional: The category of URLs to ingest (e.g., 'visa', 'flights'). If not provided, all URLs will be ingested."),
});

export const ingestAllUrlsTool = {
    name: "INGEST_ALL_URLS_TOOL",
    description: "Ingests content from multiple URLs based on a category or all available URLs from the travel dataset.",
    parameters: ingestAllUrlsParamsSchema,
    execute: async (args: z.infer<typeof ingestAllUrlsParamsSchema>) => {
        const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '';
        if (!apiKey) {
            throw new Error("LLM_API_KEY (or OPENAI_API_KEY) is not set in the environment.");
        }

        const ingestorService = new IngestorService();
        await ingestorService.initialize(); // Ensure initialization

        let urlsToIngest: string[] = [];
        let categoryDescription = "all URLs";

        if (args.category) {
            const category = args.category.toLowerCase();
            const availableCategories = getCategories();
            if (availableCategories.includes(category)) {
                urlsToIngest = getUrlsByCategory(category as keyof TravelUrlsDataset).map(item => item.url.trim());
                categoryDescription = `URLs in the '${category}' category`;
            } else {
                throw new Error(`Invalid category: ${args.category}. Available categories are: ${availableCategories.join(', ')}`);
            }
        } else {
            urlsToIngest = getAllUrls().map(u => u.trim());
            categoryDescription = "all URLs";
        }

        if (urlsToIngest.length === 0) {
            return `No URLs found to ingest for ${categoryDescription}.`;
        }

        console.log(`Starting ingestion for ${urlsToIngest.length} URLs in ${categoryDescription}...`);

        const results: string[] = [];
        let successfulIngestions = 0;
        let failedIngestions = 0;

        for (const url of urlsToIngest) {
            try {
                console.log(`Ingesting URL: ${url}`);
                // Log normalized preview for debugging
                const preview = url.length > 100 ? url.slice(0, 100) + '...' : url;
                console.debug(`[INGEST_ALL_URLS_TOOL] URL preview before ingest: ${preview}`);
                const ingestResponse = await ingestorService.ingestUrl(url);
                results.push(`✅ Successfully ingested ${url}. Ingested IDs: ${ingestResponse.join(', ')}`);
                successfulIngestions++;
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : "An unknown error occurred";
                console.error(`[INGEST_ALL_URLS_TOOL] Error ingesting ${url}: ${message}`);
                results.push(`❌ Failed to ingest ${url}: ${message}`);
                failedIngestions++;
            }
        }

        console.log(`Finished ingestion for ${categoryDescription}. Successful: ${successfulIngestions}, Failed: ${failedIngestions}`);
        return `Ingestion complete for ${categoryDescription}.\nSuccessful: ${successfulIngestions}\nFailed: ${failedIngestions}\n\nDetails:\n${results.join('\n')}`;
    },
};
