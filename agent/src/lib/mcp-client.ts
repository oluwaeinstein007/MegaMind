/**
 * SocialMCPClient — v3
 *
 * Improvement #8: Rate-limit handling with exponential backoff.
 *
 * All tool calls are wrapped in a retry loop that detects 429 / rate-limit
 * errors from social-mcp and backs off before retrying.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { FunctionDeclaration } from '../tools/travel.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

type ToolCallContent = { type: string; text?: string };

// ── Retry config ──────────────────────────────────────────────────────────────

const MAX_RETRIES  = 3;
const BASE_DELAY_MS = 1_500;

function isRateLimitError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('429') ||
    lower.includes('ratelimit') ||
    lower.includes('slow down')
  );
}

async function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// ── Schema sanitiser: JSON Schema → Gemini-compatible ─────────────────────────
// Gemini doesn't support anyOf, oneOf, minLength, maxLength, etc.

function sanitiseSchema(schema: Record<string, unknown>): Record<string, unknown> {
  if (!schema || typeof schema !== 'object') return schema;

  const out: Record<string, unknown> = {};

  // Flatten anyOf by picking the first concrete type
  if (Array.isArray(schema.anyOf)) {
    const first = (schema.anyOf as Record<string, unknown>[])[0];
    if (first?.type) out.type = first.type;
    if (schema.description) out.description = schema.description;
    return out;
  }

  // Copy only fields Gemini understands
  const allowed = ['type', 'description', 'enum', 'format', 'nullable', 'properties', 'required', 'items'];
  for (const key of allowed) {
    if (key in schema) out[key] = schema[key];
  }

  if (out.properties && typeof out.properties === 'object') {
    const sanitised: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(out.properties as Record<string, unknown>)) {
      sanitised[k] = sanitiseSchema(v as Record<string, unknown>);
    }
    out.properties = sanitised;
  }

  if (out.items) {
    out.items = sanitiseSchema(out.items as Record<string, unknown>);
  }

  return out;
}

// ── Converter: MCP tool → Gemini FunctionDeclaration ─────────────────────────

export function mcpToolToGemini(tool: MCPTool): FunctionDeclaration {
  const schema = sanitiseSchema(tool.inputSchema);
  // Ensure top-level type is 'object' for Gemini
  if (!schema.type) schema.type = 'object';
  return {
    name: tool.name,
    description: tool.description ?? '',
    parameters: schema as FunctionDeclaration['parameters'],
  };
}

// ── Client ────────────────────────────────────────────────────────────────────

function resolveBin(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname  = path.dirname(__filename);
  return path.resolve(__dirname, '..', '..', 'node_modules', 'social-mcp', 'dist', 'index.js');
}

export class SocialMCPClient {
  private client!: Client;
  private transport!: StdioClientTransport;

  async connect(): Promise<void> {
    this.transport = new StdioClientTransport({
      command: 'node',
      args: [resolveBin()],
      env: process.env as Record<string, string>,
    });

    this.client = new Client(
      { name: 'megamind-social-agent', version: '3.0.0' },
      { capabilities: {} }
    );

    await this.client.connect(this.transport);
  }

  /** Return all social-mcp tools as Gemini FunctionDeclarations. */
  async listToolsAsGemini(): Promise<FunctionDeclaration[]> {
    const { tools } = await this.client.listTools();
    return (tools as MCPTool[]).map(mcpToolToGemini);
  }

  async listTools(): Promise<MCPTool[]> {
    const { tools } = await this.client.listTools();
    return tools as MCPTool[];
  }

  /**
   * Call a social-mcp tool with exponential-backoff retry on rate-limit errors.
   * Returns concatenated text from the tool's content blocks.
   */
  async callTool(name: string, toolInput: Record<string, unknown>): Promise<string> {
    let attempt = 0;

    while (true) {
      try {
        const result = await this.client.callTool({ name, arguments: toolInput });
        const text = (result.content as ToolCallContent[])
          .filter((b) => b.type === 'text')
          .map((b) => b.text ?? '')
          .join('\n');

        if (result.isError) throw new Error(text || 'social-mcp returned an error');
        return text || '(no output)';
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        attempt++;

        if (attempt >= MAX_RETRIES || !isRateLimitError(msg)) {
          throw new Error(`[${name}] ${msg}`);
        }

        const delay = BASE_DELAY_MS * 2 ** (attempt - 1);
        console.warn(`[mcp] Rate-limited on ${name}. Retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRIES})`);
        await sleep(delay);
      }
    }
  }

  async disconnect(): Promise<void> {
    await this.client.close();
  }
}
