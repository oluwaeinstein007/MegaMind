/**
 * Twitter mention monitor for the travel advisor.
 *
 * Polls Twitter v2 search API for mentions of the configured handle.
 * Each mention is answered as a travel question and replied to via
 * social-mcp's twitter_reply tool.
 *
 * Config (env vars):
 *   TWITTER_MONITOR_HANDLE   handle to watch, e.g. "@nomadsage"
 *   TWITTER_APP_KEY / etc.   OAuth 1.0a credentials (same as social-mcp)
 *
 * Polling interval: 60 seconds.
 */

import { TwitterApi } from 'twitter-api-v2';

export type AgentRunner = (prompt: string) => Promise<string>;

const POLL_INTERVAL_MS = 60_000;
let   pollingTimer: ReturnType<typeof setInterval> | null = null;

const processed = new Set<string>();

function getClient(): TwitterApi {
  const { TWITTER_APP_KEY, TWITTER_APP_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET } = process.env;
  if (!TWITTER_APP_KEY || !TWITTER_APP_SECRET || !TWITTER_ACCESS_TOKEN || !TWITTER_ACCESS_SECRET) {
    throw new Error('Twitter credentials missing.');
  }
  return new TwitterApi({ appKey: TWITTER_APP_KEY, appSecret: TWITTER_APP_SECRET, accessToken: TWITTER_ACCESS_TOKEN, accessSecret: TWITTER_ACCESS_SECRET });
}

async function pollMentions(runAgent: AgentRunner): Promise<void> {
  const handle = (process.env.TWITTER_MONITOR_HANDLE ?? '').replace('@', '');
  if (!handle) return;

  let client: TwitterApi;
  try { client = getClient(); } catch { return; }

  try {
    const result = await client.v2.search(`@${handle} -is:retweet`, {
      max_results: 10,
      'tweet.fields': ['author_id', 'created_at', 'conversation_id'],
    });

    for (const tweet of result.tweets ?? []) {
      if (processed.has(tweet.id)) continue;
      processed.add(tweet.id);

      const myUser = await client.v2.me();
      if (tweet.author_id === myUser.data.id) continue;

      const prompt =
        `Incoming Twitter mention for @${handle}. Tweet ID: ${tweet.id}. ` +
        `Travel question: "${tweet.text}". ` +
        `Search the knowledge base for relevant travel information, ` +
        `compose a concise answer (≤ 280 characters), then reply using ` +
        `twitter_reply with tweet_id=${tweet.id}.`;

      console.log(`[monitor] Travel question from tweet ${tweet.id}: "${tweet.text.slice(0, 80)}"`);

      try {
        const reply = await runAgent(prompt);
        console.log(`[monitor] Replied: ${reply.slice(0, 120)}`);
      } catch (err) {
        console.error(`[monitor] Error for tweet ${tweet.id}:`, (err as Error).message);
      }
    }
  } catch (err) {
    console.warn('[monitor] Poll failed:', (err as Error).message);
  }
}

export function startMonitoring(runAgent: AgentRunner): void {
  const handle = process.env.TWITTER_MONITOR_HANDLE;
  if (!handle) {
    console.warn('[monitor] TWITTER_MONITOR_HANDLE not set — Twitter monitoring disabled.');
    return;
  }

  console.log(`[monitor] Watching @${handle.replace('@', '')} mentions every ${POLL_INTERVAL_MS / 1000}s`);
  void pollMentions(runAgent);
  pollingTimer = setInterval(() => void pollMentions(runAgent), POLL_INTERVAL_MS);
}

export function stopMonitoring(): void {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
    console.log('[monitor] Stopped.');
  }
}
