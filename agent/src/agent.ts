/**
 * MegaMind Social Agent — Gemini function-calling loop (v3)
 *
 * Uses Google Gemini (gemini-2.0-flash by default) with function calling.
 * Social-media operations are delegated to the social-mcp package (stdio).
 * Travel content, image gen, broadcast, and LinkedIn are handled locally.
 * Conversation history is persisted to SQLite via memory.ts (#10).
 */

import {
  GoogleGenerativeAI,
  type Content,
  type FunctionCall,
  type FunctionDeclarationsTool,
  type FunctionResponsePart,
} from '@google/generative-ai';
import { SocialMCPClient } from './lib/mcp-client.js';
import { TRAVEL_TOOLS, TRAVEL_TOOL_NAMES, executeTravelTool } from './tools/travel.js';
import { createSession, loadHistory, saveHistory } from './lib/memory.js';

const DEFAULT_MODEL = 'gemini-2.0-flash';

const SYSTEM_INSTRUCTION = `You are the MegaMind Social Agent — an expert travel content creator and social media manager.

## Capabilities
• Post and reply on Twitter/X, Telegram, Discord, Slack, WhatsApp, Facebook, and Instagram (via social-mcp tools)
• Publish to LinkedIn (linkedin_post tool)
• Search MegaMind's travel knowledge base (search_travel_content, sample_travel_content)
• Generate travel images for Instagram (generate_image)
• Broadcast to multiple platforms at once (broadcast_post)

## Rules
1. For any travel post: ALWAYS call search_travel_content or sample_travel_content FIRST.
   Never invent visa rules, costs, or travel tips — only use data from the tools.
2. Platform tone:
   - Twitter/X: ≤ 280 chars, punchy, 2–3 hashtags
   - Telegram / Discord / Slack: markdown formatting, can be longer
   - Facebook / LinkedIn: professional, complete sentences
   - Instagram: emoji-rich caption + 5–10 hashtags; always generate_image first
   - WhatsApp: personal, conversational
3. broadcast_post adapts the message per platform automatically.
4. After every successful post, confirm with the returned post/message ID.
5. If a credential is missing, say which env var to set rather than silently failing.
6. You remember our conversation — refer to earlier context when relevant.`;

export interface RunAgentOptions {
  verbose?: boolean;
  sessionId?: string;
}

export interface RunAgentResult {
  text: string;
  sessionId: string;
}

/**
 * Run one agentic turn with Gemini function-calling.
 * Opens social-mcp, runs the loop, closes social-mcp, returns final text.
 */
export async function runAgent(
  userPrompt: string,
  options: RunAgentOptions = {}
): Promise<RunAgentResult> {
  const { verbose = false } = options;

  // ── Session / memory ───────────────────────────────────────────────────────
  const sessionId = options.sessionId ?? createSession();
  const history   = loadHistory(sessionId);

  // ── social-mcp connection ──────────────────────────────────────────────────
  const socialClient = new SocialMCPClient();
  await socialClient.connect();

  let socialToolNames: Set<string>;
  let socialGeminiTools: Awaited<ReturnType<typeof socialClient.listToolsAsGemini>>;

  try {
    socialGeminiTools = await socialClient.listToolsAsGemini();
    socialToolNames   = new Set(socialGeminiTools.map((t) => t.name));
    if (verbose) console.error(`[agent] social-mcp tools: ${[...socialToolNames].join(', ')}`);
  } catch (err) {
    await socialClient.disconnect();
    throw new Error(`Failed to list social-mcp tools: ${(err as Error).message}`);
  }

  // Combine all tool declarations into Gemini FunctionDeclarationsTool objects
  const allTools: FunctionDeclarationsTool[] = [
    { functionDeclarations: socialGeminiTools as FunctionDeclarationsTool['functionDeclarations'] },
    { functionDeclarations: TRAVEL_TOOLS      as FunctionDeclarationsTool['functionDeclarations'] },
  ];

  // ── Gemini client ──────────────────────────────────────────────────────────
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set.');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL ?? DEFAULT_MODEL,
    systemInstruction: SYSTEM_INSTRUCTION,
    tools: allTools,
  });

  const chat = model.startChat({ history });

  try {
    // ── Gemini function-calling loop ─────────────────────────────────────────
    let currentPrompt: string | FunctionResponsePart[] = userPrompt;

    while (true) {
      const result = typeof currentPrompt === 'string'
        ? await chat.sendMessage(currentPrompt)
        : await chat.sendMessage(currentPrompt);

      const response = result.response;
      const candidate = response.candidates?.[0];

      if (!candidate) throw new Error('Gemini returned no candidates.');

      const parts = candidate.content?.parts ?? [];

      // Collect function calls from this turn
      const functionCalls = parts
        .filter((p): p is { functionCall: FunctionCall } => !!p.functionCall)
        .map((p) => p.functionCall);

      // No function calls → final text answer
      if (functionCalls.length === 0) {
        const text = parts
          .filter((p): p is { text: string } => typeof p.text === 'string')
          .map((p) => p.text)
          .join('');

        // Persist conversation history
        const updatedHistory = await chat.getHistory();
        saveHistory(sessionId, updatedHistory as Content[]);

        return { text: text || '[No response]', sessionId };
      }

      // Execute function calls and collect responses
      const functionResponses: FunctionResponsePart[] = [];

      for (const call of functionCalls) {
        const { name, args } = call;
        const input = (args ?? {}) as Record<string, unknown>;

        if (verbose) console.error(`\n[tool→] ${name}`, JSON.stringify(input, null, 2));

        let responseContent: unknown;

        try {
          if (TRAVEL_TOOL_NAMES.has(name)) {
            // Local travel / utility tool
            const raw = await executeTravelTool(
              name,
              input,
              (toolName, toolArgs) => socialClient.callTool(toolName, toolArgs)
            );
            responseContent = JSON.parse(raw);
          } else if (socialToolNames.has(name)) {
            // Delegated to social-mcp
            const text = await socialClient.callTool(name, input);
            responseContent = { result: text };
          } else {
            responseContent = { error: `Unknown tool: ${name}` };
          }
        } catch (err) {
          responseContent = { error: (err as Error).message };
        }

        if (verbose) console.error(`[←tool] ${JSON.stringify(responseContent).slice(0, 300)}`);

        functionResponses.push({
          functionResponse: { name, response: responseContent as Record<string, unknown> },
        });
      }

      // Feed all function responses back to Gemini in one turn
      currentPrompt = functionResponses;
    }
  } finally {
    await socialClient.disconnect();
  }
}
