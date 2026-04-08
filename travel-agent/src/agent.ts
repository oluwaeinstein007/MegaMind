/**
 * NomadSage Travel Advisor — Gemini function-calling loop
 *
 * A travel advisory agent powered by Google Gemini.
 * Answers questions grounded in the MegaMind knowledge base with source citations.
 *
 * Social platform replies (Twitter, Telegram, Discord, Slack, WhatsApp) are
 * delegated to social-mcp — no custom platform clients are built here.
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

const SYSTEM_INSTRUCTION = `You are NomadSage — an expert AI travel advisor with deep knowledge of destinations, visa requirements, immigration processes, travel budgets, safety, and cultural tips worldwide.

## Your Role
Provide accurate, detailed, and helpful travel advice grounded exclusively in the MegaMind knowledge base. You receive questions from multiple social media platforms (Twitter/X, Telegram, Discord, Slack, WhatsApp) and answer them directly on those platforms.

## How to Answer
1. **Always search first.** Before answering any travel question, call \`search_travel_content\` to find relevant knowledge-base data. Never invent visa rules, entry requirements, costs, or travel tips.
2. **Structure every response clearly** using markdown:
   - Use **bold** for key facts (costs, dates, requirements)
   - Use bullet points or numbered lists for step-by-step processes
   - Use ## headers to separate major sections in longer answers
   - Keep paragraphs short and scannable
3. **Always include a References section** at the end of every response that used search results, listing every source by title and URL:

---
**References**
- [Source Title](URL)
- [Source Title](URL)

4. If the knowledge base has no relevant data, say so clearly and suggest official sources (embassy websites, government portals).
5. Be concise but complete. Do not pad responses.

## Replying on Social Platforms
When you receive a message from a social platform (indicated in the prompt), use the appropriate social-mcp tool to send your reply back:
- **Telegram** → use SEND_MESSAGE with the chatId provided
- **Twitter/X** → use twitter_reply with the tweet_id provided (keep ≤ 280 chars; include the full answer in a thread if needed)
- **Discord** → use SEND_DISCORD_MESSAGE with the channelId provided
- **Slack** → use SEND_SLACK_MESSAGE with the channel and thread_ts provided
- **WhatsApp** → use SEND_WHATSAPP_MESSAGE with the recipient number provided

Format your reply to suit the platform (shorter on Twitter, richer markdown on Telegram/Discord/Slack).

## Tone
Professional yet approachable. Knowledgeable and direct, giving real actionable advice.`;

export interface RunAgentOptions {
  verbose?: boolean;
  sessionId?: string;
}

export interface RunAgentResult {
  text: string;
  sessionId: string;
}

/**
 * Run one agentic turn: search the knowledge base, compose a grounded
 * travel answer with citations, optionally reply via social-mcp, and
 * return the final formatted text.
 */
export async function runAgent(
  userPrompt: string,
  options: RunAgentOptions = {}
): Promise<RunAgentResult> {
  const { verbose = false } = options;

  // ── Session / memory ───────────────────────────────────────────────────────
  const sessionId = options.sessionId ?? createSession();
  const history   = loadHistory(sessionId);

  // ── social-mcp connection (for platform replies) ───────────────────────────
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

  // Combine social-mcp (reply tools) + local travel (search tools)
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
      const result    = await chat.sendMessage(currentPrompt);
      const response  = result.response;
      const candidate = response.candidates?.[0];

      if (!candidate) throw new Error('Gemini returned no candidates.');

      const parts = candidate.content?.parts ?? [];

      const functionCalls = parts
        .filter((p): p is { functionCall: FunctionCall } => !!p.functionCall)
        .map((p) => p.functionCall);

      // No function calls → final text answer
      if (functionCalls.length === 0) {
        const text = parts
          .filter((p): p is { text: string } => typeof p.text === 'string')
          .map((p) => p.text)
          .join('');

        const updatedHistory = await chat.getHistory();
        saveHistory(sessionId, updatedHistory as Content[]);

        return { text: text || '[No response]', sessionId };
      }

      // Execute function calls
      const functionResponses: FunctionResponsePart[] = [];

      for (const call of functionCalls) {
        const { name, args } = call;
        const input = (args ?? {}) as Record<string, unknown>;

        if (verbose) console.error(`\n[tool→] ${name}`, JSON.stringify(input, null, 2));

        let responseContent: unknown;

        try {
          if (TRAVEL_TOOL_NAMES.has(name)) {
            // Local knowledge-base tool
            const raw = await executeTravelTool(name, input);
            responseContent = JSON.parse(raw);
          } else if (socialToolNames.has(name)) {
            // Platform reply via social-mcp
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

      currentPrompt = functionResponses;
    }
  } finally {
    await socialClient.disconnect();
  }
}
