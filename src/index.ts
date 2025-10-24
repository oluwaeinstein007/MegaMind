import { FastMCP } from "fastmcp";
import { getImmigrationInfoByCountry } from "./tools/immigration-tools/getimmigrationByCountry.js";
import { getVisaInfoByCountry } from "./tools/visa-tools/getVisaInfoByCountry.js";
import { ingestUrlTool } from "./tools/ingestor-tools/ingestUrlTool.js";
import { ingestFileTool } from "./tools/ingestor-tools/ingestFileTool.js";
import { getDocumentTool } from "./tools/ingestor-tools/getDocumentTool.js";
import { ingestAllUrlsTool } from "./tools/ingestor-tools/ingestAllUrlsTool.js";

async function main() {
	console.log("Initializing MCP MegaMind Server...");

	const server = new FastMCP({
		name: "IQAI MegaMind MCP Server",
		version: "0.0.1",
	});

	// Add Visa tools
	server.addTool(getVisaInfoByCountry);
	//Add Immigration tools
	server.addTool(getImmigrationInfoByCountry);

	//Add Ingestor tools
	server.addTool(ingestUrlTool);
	server.addTool(ingestFileTool);
	server.addTool(getDocumentTool);
	server.addTool(ingestAllUrlsTool);


	try {
		await server.start({
			transportType: "stdio",
		});
		console.log("✅ MegaMind MCP Server started successfully over stdio.");
		console.log("You can now connect to it using an MCP client.");
		//list all tools
		console.log("Available tools:");
	} catch (error) {
		console.error("❌ Failed to start MegaMind MCP Server:", error);
		process.exit(1);
	}
}

main().catch((error) => {
	console.error("❌ An unexpected error occurred:", error);
	process.exit(1);
});
