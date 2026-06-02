/**
 * JournVibe Social Media Manager — Veridex-powered Agent Runtime
 *
 * A dedicated social media agent powered by the Veridex Agent Fabric SDK and Google Gemini.
 * Creates and publishes travel content across Twitter/X, Telegram,
 * Discord, Slack, WhatsApp, Facebook, Instagram, and LinkedIn.
 *
 * Social-media operations are delegated to the social-mcp package (stdio).
 * Travel content is sourced from the MegaMind knowledge base via local tools.
 */

import {
  createAgent,
  GeminiProvider,
  InMemoryTranscriptStore,
  type TranscriptEntry,
  type RunResult,
  AgentRuntime,
  tool,
} from '@veridex/agents';
import { z } from 'zod';
import readline from 'readline';
import { SocialMCPClient } from './lib/mcp-client.js';
import { createJournVibeTools } from './tools/social.js';
import { createSession, loadHistory, saveHistory } from './lib/memory.js';

const SYSTEM_INSTRUCTION = `You are JournVibe — an expert travel content creator and social media manager.

## Capabilities
- Post and reply on Twitter/X, Telegram, Discord, Slack, WhatsApp, Facebook, and Instagram (via social-mcp tools)
- Publish to LinkedIn (linkedin_post tool)
- Search JournVibe's travel knowledge base for post inspiration (search_travel_content, sample_travel_content)
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
6. You remember our conversation — refer to earlier context when relevant.

### Scheduling
7. When a user asks to be reminded, notified, or for you to "chat/message them" at a specific time:
   - Use the **schedule_message** tool immediately — do NOT say you cannot do it.
   - Extract the chat_id from the [chat_id: ...] prefix that appears at the start of every Telegram message.
   - Compose a helpful reminder text (e.g. "Hey! You asked me to remind you at this time.").
   - Confirm the scheduled time to the user after the tool returns.
8. Every Telegram message arrives with a [chat_id: <number>] prefix — use that value for chat_id in schedule_message and telegram_reply calls.`;

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
  const history = loadHistory(sessionId);

  // ── social-mcp connection ──────────────────────────────────────────────────
  const socialClient = new SocialMCPClient();
  await socialClient.connect();

  let veridexMCPTools: any[] = [];
  let localTools: any[] = [];

  try {
    const socialGeminiTools = await socialClient.listToolsAsGemini();
    veridexMCPTools = socialGeminiTools.map((t) => {
      // Dynamic mapping of social MCP tools into Veridex ToolContracts
      return tool({
        name: t.name,
        description: t.description ?? '',
        input: z.record(z.any()),
        safetyClass: 'write',
        async execute({ input }: any) {
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

    // Create the adapted JournVibe tools
    localTools = createJournVibeTools(socialClient);
  } catch (err) {
    await socialClient.disconnect();
    throw new Error(`Failed to list social-mcp tools: ${(err as Error).message}`);
  }

  // ── Gemini Provider ────────────────────────────────────────────────────────
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set.');

  const geminiProvider = new GeminiProvider({
    apiKey,
    model: process.env.GEMINI_MODEL ?? 'gemini-3.5-flash',
  });

  const transcriptStore = new InMemoryTranscriptStore();

  const agent = createAgent(
    {
      id: 'journvibe-social-agent',
      name: 'JournVibe Media Manager',
      model: { provider: 'gemini', model: process.env.GEMINI_MODEL ?? 'gemini-3.5-flash' },
      instructions: SYSTEM_INSTRUCTION,
      tools: [...localTools, ...veridexMCPTools],
      policies: [
        // Intercept all tools marked with safety class 'write' (like social post execution)
        { type: 'requireApprovalFor', params: { safetyClasses: ['write'] } },
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
      approvalRoutes: [
        // Route 'write' safety class tools to human interactive approval
        { match: (proposal: any) => proposal.safetyClass === 'write', mode: 'human_required' },
      ],
      approvalHandlers: {
        // Human-in-the-loop CLI console interactive approval handler
        human_required: async (request: any) => {
          console.log(`\n⚠️  [POLICY GATE: APPROVAL REQUIRED]`);
          console.log(`Action  : ${request.proposal.type === 'tool_call' ? `Tool Execution` : 'State change'}`);
          console.log(`Resource: ${request.proposal.name}`);
          console.log(`Payload :`, JSON.stringify(request.proposal.arguments, null, 2));

          const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
          const answer = await new Promise<string>((resolve) => {
            rl.question(`Approve this social posting action? (y/N): `, (ans) => {
              rl.close();
              resolve(ans.trim().toLowerCase());
            });
          });

          const approved = answer === 'y' || answer === 'yes';

          if (approved) {
            console.log(`✅ Action approved by operator. Resuming execution...`);
          } else {
            console.log(`❌ Action denied by operator. Aborting execution.`);
          }

          return {
            requestId: request.id,
            approved,
            decidedBy: 'console-operator',
            decidedAt: Date.now(),
          };
        },
      },
    }
  );

  // Hook to pre-load chat history from SQLite database
  const beforeRunHook = {
    name: 'seed_history',
    phase: 'beforeRun' as const,
    execute: async (ctx: any) => {
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

      // Adjust index of current entries
      const adjustedCurrent = currentEntries.map((entry) => ({
        ...entry,
        turnIndex: (entry.turnIndex ?? 0) + history.length,
      }));

      await transcriptStore.replace(ctx.runId, [...historyEntries, ...adjustedCurrent]);
    },
  };

  agent.definition.hooks = {
    beforeRun: [beforeRunHook],
  };

  try {
    const runResult = await agent.run(userPrompt);

    // Save final output history back to SQLite memory.db
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
