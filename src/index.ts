import { FastMCP } from 'fastmcp';
import { getImmigrationInfoByCountry } from './tools/immigration-tools/getimmigrationByCountry.js';
import { getVisaInfoByCountry } from './tools/visa-tools/getVisaInfoByCountry.js';
import { ingestUrlTool } from './tools/ingestor-tools/ingestUrlTool.js';
import { ingestFileTool } from './tools/ingestor-tools/ingestFileTool.js';
import { getDocumentTool } from './tools/ingestor-tools/getDocumentTool.js';
import { ingestAllUrlsTool } from './tools/ingestor-tools/ingestAllUrlsTool.js';
import { searchTool } from './tools/ingestor-tools/searchTool.js';
import { deleteDocumentTool } from './tools/ingestor-tools/deleteDocumentTool.js';
import { listDocumentsTool } from './tools/ingestor-tools/listDocumentsTool.js';
import { ingestRssTool } from './tools/ingestor-tools/ingestRssTool.js';

async function main() {
  console.log('Initializing MegaMind MCP Server...');

  const server = new FastMCP({
    name: 'MegaMind MCP Server',
    version: '1.1.0',
  });

  // Domain-specific tools
  server.addTool(getVisaInfoByCountry);
  server.addTool(getImmigrationInfoByCountry);

  // Ingestion tools
  server.addTool(ingestUrlTool);
  server.addTool(ingestFileTool);
  server.addTool(ingestAllUrlsTool);
  server.addTool(ingestRssTool);

  // Retrieval and search tools
  server.addTool(searchTool);
  server.addTool(getDocumentTool);
  server.addTool(listDocumentsTool);

  // Management tools
  server.addTool(deleteDocumentTool);

  try {
    await server.start({ transportType: 'stdio' });
    console.log('MegaMind MCP Server started successfully over stdio.');
  } catch (error) {
    console.error('Failed to start MegaMind MCP Server:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
