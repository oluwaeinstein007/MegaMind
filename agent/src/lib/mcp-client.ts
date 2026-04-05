/**
 * SocialMCPClient
 *
 * Spawns the `social-mcp` package as a stdio sub-process and connects to it
 * using the Model Context Protocol SDK client.
 *
 * social-mcp exposes these MCP tools (as of v1.3.x):
 *   Telegram : SEND_MESSAGE, GET_CHANNEL_INFO, FORWARD_MESSAGE,
 *              PIN_MESSAGE, GET_CHANNEL_MEMBERS
 *   Twitter  : SEND_TWEET, GET_USER_INFO, SEARCH_TWEETS
 *   Discord  : SEND_DISCORD_MESSAGE
 *   WhatsApp : SEND_WHATSAPP_MESSAGE, GET_WHATSAPP_MESSAGES
 *   Facebook : CREATE_FACEBOOK_POST
 *   Instagram: CREATE_INSTAGRAM_POST
 *   Slack    : SEND_SLACK_MESSAGE
 *
 * All platform credentials are forwarded from process.env to the child process.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type Anthropic from '@anthropic-ai/sdk';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MCPTool {
  name: string;
  description: string;
  // JSON Schema object as returned by MCP list_tools
  inputSchema: Record<string, unknown>;
}

export type ToolCallResult =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'resource'; uri: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveSocialMCPBin(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // When installed as a dep: <agent>/node_modules/social-mcp/dist/index.js
  return path.resolve(__dirname, '..', '..', 'node_modules', 'social-mcp', 'dist', 'index.js');
}

/** Convert an MCP tool list entry → Anthropic Tool definition */
export function mcpToolToAnthropic(tool: MCPTool): Anthropic.Tool {
  return {
    name: tool.name,
    description: tool.description ?? '',
    // MCP inputSchema is already a valid JSON Schema object
    input_schema: tool.inputSchema as Anthropic.Tool['input_schema'],
  };
}

// ── Client class ──────────────────────────────────────────────────────────────

export class SocialMCPClient {
  private client!: Client;
  private transport!: StdioClientTransport;

  async connect(): Promise<void> {
    const binPath = resolveSocialMCPBin();

    this.transport = new StdioClientTransport({
      command: 'node',
      args: [binPath],
      // Forward all env vars so social-mcp can read platform credentials
      env: process.env as Record<string, string>,
    });

    this.client = new Client(
      { name: 'megamind-social-agent', version: '2.0.0' },
      { capabilities: {} }
    );

    await this.client.connect(this.transport);
  }

  /** Return tools as Anthropic-formatted tool definitions */
  async listToolsAsAnthropic(): Promise<Anthropic.Tool[]> {
    const { tools } = await this.client.listTools();
    return (tools as MCPTool[]).map(mcpToolToAnthropic);
  }

  /** Return raw MCP tool list (useful for logging) */
  async listTools(): Promise<MCPTool[]> {
    const { tools } = await this.client.listTools();
    return tools as MCPTool[];
  }

  /**
   * Call a social-mcp tool by name.
   * Returns the concatenated text of all text content blocks.
   */
  async callTool(
    name: string,
    toolInput: Record<string, unknown>
  ): Promise<string> {
    const result = await this.client.callTool({ name, arguments: toolInput });

    const textParts: string[] = [];
    for (const block of result.content as ToolCallResult[]) {
      if (block.type === 'text') {
        textParts.push(block.text);
      }
    }

    if (result.isError) {
      throw new Error(textParts.join('\n') || 'social-mcp returned an error');
    }

    return textParts.join('\n') || '(no output)';
  }

  async disconnect(): Promise<void> {
    await this.client.close();
  }
}
