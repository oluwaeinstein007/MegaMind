/**
 * Improvement #7 — Twitter reply monitoring.
 *
 * Polls Twitter v2 search API for mentions / replies to the configured
 * handle and feeds each unanswered mention into the agent for auto-reply.
 *
 * Config (env vars):
 *   TWITTER_MONITOR_HANDLE   handle to watch, e.g. "@mytravelbot"
 *   TWITTER_APP_KEY / etc.   OAuth 1.0a credentials (same as social-mcp)
 *
 * Polling interval: 60 seconds (Twitter free tier allows ~1 search/sec).
 * Tracks already-replied tweet IDs in memory to avoid double-replies.
 */

import { TwitterApi } from 'twitter-api-v2';

export type AgentRunner = (prompt: string) => Promise<string>;

const POLL_INTERVAL_MS = 60_000;  // 1 minute
let   pollingTimer: ReturnType<typeof setInterval> | null = null;

// In-memory set of tweet IDs already processed
const processed = new Set<string>();

function getClient(): TwitterApi {
  const { TWITTER_APP_KEY, TWITTER_APP_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET } = process.env;
  if (!TWITTER_APP_KEY || !TWITTER_APP_SECRET || !TWITTER_ACCESS_TOKEN || !TWITTER_ACCESS_SECRET) {
    throw new Error('Twitter credentials missing. Set TWITTER_APP_KEY, TWITTER_APP_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET.');
  }
  return new TwitterApi({ appKey: TWITTER_APP_KEY, appSecret: TWITTER_APP_SECRET, accessToken: TWITTER_ACCESS_TOKEN, accessSecret: TWITTER_ACCESS_SECRET });
}

async function pollMentions(runAgent: AgentRunner): Promise<void> {
  const handle = (process.env.TWITTER_MONITOR_HANDLE ?? '').replace('@', '');
  if (!handle) return;

  let client: TwitterApi;
  try {
    client = getClient();
  } catch {
    return; // credentials not set — skip silently
  }

  try {
    const query = `@${handle} -is:retweet`;
    const result = await client.v2.search(query, {
      max_results: 10,
      'tweet.fields': ['author_id', 'created_at', 'conversation_id'],
    });

    for (const tweet of result.tweets ?? []) {
      if (processed.has(tweet.id)) continue;
      processed.add(tweet.id);

      // Avoid replying to our own tweets
      const myUser = await client.v2.me();
      if (tweet.author_id === myUser.data.id) continue;

      const prompt =
        `Someone mentioned @${handle} on Twitter. Tweet ID: ${tweet.id}. ` +
        `Their message: "${tweet.text}". ` +
        `Search travel content relevant to their question, then reply to this tweet ` +
        `using twitter_reply with tweet_id=${tweet.id}. Keep the reply under 280 characters.`;

      console.log(`[monitor] Replying to tweet ${tweet.id}: "${tweet.text.slice(0, 80)}"`);

      try {
        const reply = await runAgent(prompt);
        console.log(`[monitor] Replied: ${reply.slice(0, 120)}`);
      } catch (err) {
        console.error(`[monitor] Agent error for tweet ${tweet.id}:`, (err as Error).message);
      }
    }
  } catch (err) {
    console.warn('[monitor] Poll failed:', (err as Error).message);
  }
}

/** Start polling Twitter for mentions every minute. */
export function startMonitoring(runAgent: AgentRunner): void {
  const handle = process.env.TWITTER_MONITOR_HANDLE;
  if (!handle) {
    console.warn('[monitor] TWITTER_MONITOR_HANDLE not set — monitoring disabled.');
    return;
  }

  console.log(`[monitor] Watching mentions of ${handle} every ${POLL_INTERVAL_MS / 1000}s`);

  // Run immediately then on interval
  void pollMentions(runAgent);
  pollingTimer = setInterval(() => void pollMentions(runAgent), POLL_INTERVAL_MS);
}

/** Stop monitoring. */
export function stopMonitoring(): void {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
    console.log('[monitor] Stopped.');
  }
}
