/**
 * MegaMind Social Agent — agentic loop (v2)
 *
 * Architecture
 * ────────────
 *  ┌──────────────────────────────────────────┐
 *  │            Claude (opus-4-6)             │
 *  │  tool_use ↓             ↑ tool_result    │
 *  └──────────────────────────────────────────┘
 *         │                       │
 *   social tools            travel tools
 *         │                       │
 *  ┌──────▼──────┐        ┌───────▼──────────┐
 *  │ social-mcp  │        │  MegaMind SQLite  │
 *  │  (via MCP   │        │  (direct query)   │
 *  │   stdio)    │        └──────────────────-┘
 *  └─────────────┘
 *
 * Social-media operations (tweet, telegram send, discord, slack, whatsapp,
 * facebook, instagram) are 100% delegated to the `social-mcp` npm package
 * running as an MCP stdio sub-process.
 *
 * Travel content (search / sample MegaMind's knowledge base) is handled
 * locally so posts are grounded in real ingested data.
 */

import Anthropic from '@anthropic-ai/sdk';
import { SocialMCPClient } from './lib/mcp-client.js';
import { TRAVEL_TOOLS, TRAVEL_TOOL_NAMES, executeTravelTool } from './tools/travel.js';

const MODEL = 'claude-opus-4-6';

const SYSTEM_PROMPT = `You are the MegaMind Social Agent — an expert travel content creator and social media manager.

## What you can do
• Post and reply on Twitter/X, Telegram, Discord, Slack, WhatsApp, Facebook, and Instagram
  (all via the social-mcp tools automatically available to you)
• Search MegaMind's travel knowledge base to write accurate, data-backed posts
  (search_travel_content, sample_travel_content)

## Rules
1. Travel posts: ALWAYS call search_travel_content (or sample_travel_content) FIRST to
   collect real facts before composing the post. Never invent visa rules, costs, or travel tips.
2. Platform tone:
   - Twitter/X: concise, punchy, ≤ 280 chars, 2–3 hashtags
   - Telegram / Discord / Slack: can be longer, use markdown formatting
   - Facebook: professional, complete sentences
   - Instagram: caption with emojis and 5–10 relevant hashtags; requires an image URL
   - WhatsApp: personal, conversational tone
3. After every successful post, confirm with the platform's returned post/message ID.
4. If a credential is missing, report it clearly and tell the user which env var to set.
5. When asked to post on multiple platforms, do them sequentially using separate tool calls.`;

// ── Agent runner ──────────────────────────────────────────────────────────────

export interface RunAgentOptions {
  verbose?: boolean;
}

/**
 * Run a full agentic turn.
 *
 * Opens a fresh social-mcp connection, runs the Claude tool-use loop until
 * stop_reason === 'end_turn', then closes the connection.
 */
export async function runAgent(
  userPrompt: string,
  options: RunAgentOptions = {}
): Promise<string> {
  const { verbose = false } = options;

  // ── 1. Connect to social-mcp ────────────────────────────────────────────
  const socialClient = new SocialMCPClient();
  await socialClient.connect();

  let socialToolNames: Set<string>;
  let allTools: Anthropic.Tool[];

  try {
    const socialTools = await socialClient.listToolsAsAnthropic();
    socialToolNames = new Set(socialTools.map((t) => t.name));
    // Combine: social-mcp tools + local travel tools
    allTools = [...socialTools, ...TRAVEL_TOOLS];

    if (verbose) {
      console.error(
        `[agent] social-mcp tools: ${[...socialToolNames].join(', ')}`
      );
    }
  } catch (err) {
    await socialClient.disconnect();
    throw new Error(
      `Failed to list tools from social-mcp: ${err instanceof Error ? err.message : err}`
    );
  }

  // ── 2. Claude tool-use loop ─────────────────────────────────────────────
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userPrompt }];

  try {
    while (true) {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: allTools,
        messages,
      });

      if (verbose) {
        console.error(`[agent] stop_reason=${response.stop_reason}`);
      }

      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === 'text'
      );

      // Done — return final text
      if (response.stop_reason === 'end_turn') {
        return textBlocks.map((b) => b.text).join('\n');
      }

      if (response.stop_reason !== 'tool_use') {
        return textBlocks.map((b) => b.text).join('\n') || '[No response]';
      }

      // Push assistant turn into history
      messages.push({ role: 'assistant', content: response.content });

      // Execute every tool call in this turn
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      );

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        const input = toolUse.input as Record<string, unknown>;

        if (verbose) {
          console.error(`\n[tool→] ${toolUse.name}`, JSON.stringify(input, null, 2));
        }

        let result: string;

        if (TRAVEL_TOOL_NAMES.has(toolUse.name)) {
          // ── Local: travel content ────────────────────────────────────
          result = executeTravelTool(toolUse.name, input);
        } else if (socialToolNames.has(toolUse.name)) {
          // ── Delegated: social-mcp ────────────────────────────────────
          try {
            result = await socialClient.callTool(toolUse.name, input);
          } catch (err) {
            result = JSON.stringify({
              error: err instanceof Error ? err.message : String(err),
            });
          }
        } else {
          result = JSON.stringify({ error: `Unknown tool: ${toolUse.name}` });
        }

        if (verbose) {
          console.error(`[←tool] ${result.slice(0, 300)}`);
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: result,
        });
      }

      // Feed results back to Claude
      messages.push({ role: 'user', content: toolResults });
    }
  } finally {
    await socialClient.disconnect();
  }
}
