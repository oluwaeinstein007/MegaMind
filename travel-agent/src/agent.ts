/**
 * NomadSage Travel Advisor — Veridex-powered Agent Runtime
 *
 * A travel advisory agent powered by the Veridex Agent Fabric SDK and Google Gemini.
 * Answers questions grounded in the MegaMind knowledge base with source citations.
 *
 * Outbound replies on social platforms (Telegram, Twitter, Slack, WhatsApp) are
 * delegated to social-mcp using dynamic tool contracts.
 */

import {
  createAgent,
  GeminiProvider,
  tool,
  InMemoryTranscriptStore,
  type TranscriptEntry,
  type RunResult,
  AgentRuntime,
} from '@veridex/agents';
import { z } from 'zod';
import { SocialMCPClient } from './lib/mcp-client.js';
import { searchTravelContentTool, sampleTravelContentTool } from './tools/travel.js';
import { createSession, loadHistory, saveHistory } from './lib/memory.js';

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
  const history = loadHistory(sessionId);

  // ── social-mcp connection (for platform replies) ───────────────────────────
  const socialClient = new SocialMCPClient();
  await socialClient.connect();

  let veridexMCPTools: any[] = [];

  try {
    const socialGeminiTools = await socialClient.listToolsAsGemini();
    veridexMCPTools = socialGeminiTools.map((t) => {
      return tool({
        name: t.name,
        description: t.description ?? '',
        input: z.record(z.any()), // dynamic Zod schema for dynamic tools
        safetyClass: 'write', // writing to platforms is marked as write safety class
        async execute({ input }) {
          if (verbose) {
            console.error(`[mcp-tool→] ${t.name}`, JSON.stringify(input, null, 2));
          }
          const response = await socialClient.callTool(t.name, input);
          return {
            success: true,
            llmOutput: response,
          };
        },
      });
    });
  } catch (err) {
    await socialClient.disconnect();
    throw new Error(`Failed to list social-mcp tools: ${(err as Error).message}`);
  }

  // ── Gemini client ──────────────────────────────────────────────────────────
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set.');

  const geminiProvider = new GeminiProvider({
    apiKey,
    model: process.env.GEMINI_MODEL ?? 'gemini-3.5-flash',
  });

  const transcriptStore = new InMemoryTranscriptStore();
  const runId = `run_${Date.now()}`;

  // Seed history from memory.db into the Veridex TranscriptStore
  const transcriptEntries: TranscriptEntry[] = [];
  let turnIndex = 0;

  for (const item of history) {
    const roleKind = item.role === 'model' ? 'model_output' : 'user_input';
    const text = item.parts.map((p) => p.text).join('\n');
    transcriptEntries.push({
      id: `hist_${turnIndex}_${Math.random().toString(36).slice(2, 8)}`,
      runId,
      agentId: 'nomadsage-travel-agent',
      turnIndex: turnIndex++,
      kind: roleKind,
      content: text,
      timestamp: Date.now() - (history.length - turnIndex) * 1000,
    });
  }

  // Add the current prompt as user_input entry
  transcriptEntries.push({
    id: `curr_prompt_${Date.now()}`,
    runId,
    agentId: 'nomadsage-travel-agent',
    turnIndex: turnIndex++,
    kind: 'user_input',
    content: userPrompt,
    timestamp: Date.now(),
  });

  await transcriptStore.replace(runId, transcriptEntries);

  const agent = createAgent(
    {
      id: 'nomadsage-travel-agent',
      name: 'NomadSage Travel Advisor',
      model: { provider: 'gemini', model: process.env.GEMINI_MODEL ?? 'gemini-3.5-flash' },
      instructions: SYSTEM_INSTRUCTION,
      tools: [
        searchTravelContentTool,
        sampleTravelContentTool,
        ...veridexMCPTools,
      ],
      maxTurns: 8,
    },
    {
      modelProviders: {
        gemini: geminiProvider,
      },
      transcriptStore,
      enableTracing: verbose,
      enableCheckpoints: false,
    }
  );

  // Hook run loop in outer scope so we can access dynamic parameters
  let runtime: AgentRuntime = agent;

  try {
    // Run the agent. The runtime compiles context and handles the loop natively!
    // Since we pre-seeded the transcripts, we pass an empty string or mock run
    // to execute the next turn. Let's trigger the runtime loop.
    const result = await agent.resumeFromCheckpoint('', {
      // Mock resume of pre-seeded transcript
    }).catch(async (e) => {
      // In @veridex/agents, resumeFromCheckpoint expects a valid checkpoint.
      // Alternatively, we can use agent.run(userPrompt) and prepend history inside
      // the beforeRun hook! Let's do that — it's far cleaner and avoids using resumeFromCheckpoint.
      return null;
    });

    let runResult: RunResult;

    if (result) {
      runResult = result;
    } else {
      // Let's configure a hook to inject the history when run() starts
      const beforeRunHook = {
        name: 'seed_history',
        phase: 'beforeRun' as const,
        execute: async (ctx: any) => {
          // Pre-populate the transcripts in the store for this runId
          // The first entry is already added by agent.run(userPrompt) as user_input.
          // We will prepopulate history entries before it.
          const currentEntries = await transcriptStore.list(ctx.runId);
          const historyEntries: TranscriptEntry[] = [];
          let hIndex = 0;

          for (const item of history) {
            const roleKind = item.role === 'model' ? 'model_output' : 'user_input';
            const text = item.parts.map((p) => p.text).join('\n');
            historyEntries.push({
              id: `hist_${hIndex}_${Math.random().toString(36).slice(2, 8)}`,
              runId: ctx.runId,
              agentId: ctx.agentId,
              turnIndex: hIndex++,
              kind: roleKind,
              content: text,
              timestamp: Date.now() - (history.length - hIndex) * 1000,
            });
          }

          // Adjust currentEntries indexes
          const adjustedCurrent = currentEntries.map((entry) => ({
            ...entry,
            turnIndex: (entry.turnIndex ?? 0) + history.length,
          }));

          await transcriptStore.replace(ctx.runId, [...historyEntries, ...adjustedCurrent]);
        },
      };

      // Add hook to the agent definition
      agent.definition.hooks = {
        beforeRun: [beforeRunHook],
      };

      runResult = await agent.run(userPrompt);
    }

    // Save final output back to memory.db
    const runEntries = await transcriptStore.list(runResult.run.id);
    const newEntries = runEntries.filter((entry) => (entry.turnIndex ?? 0) >= history.length);

    const newContents = newEntries
      .filter((entry) => entry.kind === 'user_input' || entry.kind === 'model_output')
      .map((entry) => ({
        role: entry.kind === 'model_output' ? ('model' as const) : ('user' as const),
        parts: [{ text: entry.content }],
      }));

    saveHistory(sessionId, [...history, ...newContents]);

    return {
      text: runResult.output || '[No response]',
      sessionId,
    };
  } finally {
    await socialClient.disconnect();
  }
}
