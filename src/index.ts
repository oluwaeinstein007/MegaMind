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
  console.log('Initializing Veridex-Native MegaMind MCP Server...');

  const server = new FastMCP({
    name: 'MegaMind MCP Server',
    version: '1.2.0',
  });

  // Helper to adapt @veridex/agents ToolContract to FastMCP tool
  function registerVeridexTool(veridexTool: any) {
    server.addTool({
      name: veridexTool.name,
      description: veridexTool.description,
      parameters: veridexTool.input,
      execute: async (args: any) => {
        console.log(`[mcp-server] Running tool ${veridexTool.name}`);
        const result = await veridexTool.execute({
          input: args,
          context: {
            runId: `mcp-${Date.now()}`,
            agentId: 'mcp-server',
            turnIndex: 0,
          },
        });

        if (!result.success) {
          throw new Error(result.error || result.llmOutput);
        }
        return result.llmOutput;
      },
    });
  }

  // Register all adapted tools
  registerVeridexTool(getVisaInfoByCountry);
  registerVeridexTool(getImmigrationInfoByCountry);
  registerVeridexTool(ingestUrlTool);
  registerVeridexTool(ingestFileTool);
  registerVeridexTool(ingestAllUrlsTool);
  registerVeridexTool(ingestRssTool);
  registerVeridexTool(searchTool);
  registerVeridexTool(getDocumentTool);
  registerVeridexTool(listDocumentsTool);
  registerVeridexTool(deleteDocumentTool);

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
