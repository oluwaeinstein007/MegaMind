/**
 * JournVibe Social Media Manager — Gemini function-calling loop
 *
 * A dedicated social media agent powered by Google Gemini.
 * Creates and publishes travel content across Twitter/X, Telegram,
 * Discord, Slack, WhatsApp, Facebook, Instagram, and LinkedIn.
 *
 * Social-media operations are delegated to the social-mcp package (stdio).
 * Travel content is sourced from the MegaMind knowledge base via local tools.
 */

import {
  GoogleGenerativeAI,
  type Content,
  type FunctionCall,
  type FunctionDeclarationsTool,
  type FunctionResponsePart,
} from '@google/generative-ai';
import { SocialMCPClient } from './lib/mcp-client.js';
import { SOCIAL_TOOLS, SOCIAL_TOOL_NAMES, executeSocialTool } from './tools/social.js';
import { createSession, loadHistory, saveHistory } from './lib/memory.js';

const DEFAULT_MODEL = 'gemini-2.0-flash';

const SYSTEM_INSTRUCTION = `You are JournVibe — an expert travel content creator and social media manager.

## Capabilities
- Post and reply on Twitter/X, Telegram, Discord, Slack, WhatsApp, Facebook, and Instagram (via social-mcp tools)
- Publish to LinkedIn (linkedin_post tool)
- Search NomadSage's travel knowledge base for post inspiration (search_travel_content, sample_travel_content)
- Generate travel images for Instagram (generate_image)
- Broadcast to multiple platforms at once (broadcast_post)

## Rules

### Content Quality
1. For any travel post: ALWAYS call search_travel_content or sample_travel_content FIRST.
   Never invent visa rules, costs, or travel tips — only use data from the knowledge base.
2. Write engaging, platform-native copy. Make it shareable and informative.

### Platform Tone & Format
- **Twitter/X:** ≤ 280 chars, punchy opening, 2–3 hashtags. Every character counts.
- **Telegram / Discord / Slack:** Markdown formatting welcome; can be longer and richer.
- **Facebook:** Conversational and complete. 2–4 short paragraphs with a call-to-action.
- **LinkedIn:** Professional tone, complete sentences, structured sections if needed.
- **Instagram:** Emoji-rich caption, strong hook, 5–10 hashtags at the end. Always call generate_image first.
- **WhatsApp:** Personal, conversational, like a message from a knowledgeable friend.

### Execution
3. broadcast_post adapts the message per platform automatically.
4. After every successful post, confirm with the returned post/message ID.
5. If a credential is missing, state which env var to set rather than failing silently.
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
 * Run one agentic turn: open social-mcp, create & publish content,
 * close social-mcp, return confirmation text.
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

  // Combine social-mcp tools with local social tools
  const allTools: FunctionDeclarationsTool[] = [
    { functionDeclarations: socialGeminiTools as FunctionDeclarationsTool['functionDeclarations'] },
    { functionDeclarations: SOCIAL_TOOLS      as FunctionDeclarationsTool['functionDeclarations'] },
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

      // No function calls → final answer
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
          if (SOCIAL_TOOL_NAMES.has(name)) {
            const raw = await executeSocialTool(
              name,
              input,
              (toolName, toolArgs) => socialClient.callTool(toolName, toolArgs)
            );
            responseContent = JSON.parse(raw);
          } else if (socialToolNames.has(name)) {
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
