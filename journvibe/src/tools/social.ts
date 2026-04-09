/**
 * JournVibe Social Media Manager — tool declarations for Gemini.
 *
 * Covers:
 *   • search_travel_content   — knowledge-base semantic search (for post inspiration)
 *   • sample_travel_content   — random inspiration
 *   • generate_image          — image generation for Instagram
 *   • broadcast_post          — multi-platform broadcast
 *   • linkedin_post           — LinkedIn direct post
 *   • telegram_reply          — reply to a specific Telegram message
 */

export interface FunctionDeclaration {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

import { searchTravelContent, sampleTravelContent, getTravelContentCount } from '../lib/megamind.js';
import { generateImage } from '../lib/image-gen.js';
import { linkedInPost } from '../lib/linkedin.js';

// ── Tool declarations ─────────────────────────────────────────────────────────

export const SOCIAL_TOOLS: FunctionDeclaration[] = [
  {
    name: 'search_travel_content',
    description:
      "Search JournVibe's travel knowledge base for content to base posts on. " +
      'Always call this before composing a travel post — grounds content in ' +
      'real visa requirements, destination guides, budgets, and tips. ' +
      'Uses Qdrant semantic search when available, SQLite keyword search as fallback.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Keywords or phrase to search (e.g. "Bali budget", "UK visa Nigeria").',
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default 6, max 20).',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'sample_travel_content',
    description:
      "Return a random sample of travel chunks from JournVibe's database. " +
      'Use when you need post inspiration without a specific topic in mind.',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of random chunks (default 4, max 10).',
        },
      },
    },
  },
  {
    name: 'generate_image',
    description:
      'Generate a travel-themed image from a text prompt. ' +
      'Returns a publicly accessible URL suitable for Instagram posts. ' +
      'Uses Stability AI if configured, otherwise Pollinations.ai (free, no key needed).',
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description:
            'Detailed visual description of the image (e.g. "Aerial view of Santorini blue domes at golden hour, cinematic, 4K").',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'broadcast_post',
    description:
      'Publish a message to multiple social media platforms in one call. ' +
      'Adapts tone automatically: concise for Twitter, rich for Telegram/Discord/Slack, ' +
      'professional for Facebook/LinkedIn. For Instagram a generate_image call is required first.',
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Core message content. Will be adapted per platform.',
        },
        platforms: {
          type: 'string',
          description:
            'Comma-separated list of platforms. ' +
            'Valid: twitter, telegram, discord, slack, whatsapp, facebook, linkedin. ' +
            'Example: "twitter,telegram,discord"',
        },
        twitter_text: {
          type: 'string',
          description: 'Optional Twitter-specific text override (max 280 chars).',
        },
        image_url: {
          type: 'string',
          description: 'Public image URL — required if instagram is in the platforms list.',
        },
      },
      required: ['message', 'platforms'],
    },
  },
  {
    name: 'linkedin_post',
    description: 'Publish a text post to the configured LinkedIn user feed.',
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Post text. LinkedIn supports plain text; keep under 3000 characters.',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'telegram_reply',
    description:
      'Send a reply to a specific Telegram message. Use when you receive an incoming ' +
      'Telegram message and want to reply directly to it (quoted reply).',
    parameters: {
      type: 'object',
      properties: {
        chat_id: {
          type: 'string',
          description: 'The Telegram chat ID or @username.',
        },
        text: {
          type: 'string',
          description: 'The reply text to send.',
        },
        message_id: {
          type: 'number',
          description: 'ID of the message to reply to (for quoted replies). Optional.',
        },
      },
      required: ['chat_id', 'text'],
    },
  },
  {
    name: 'schedule_message',
    description:
      'Schedule a Telegram message to be sent to a specific chat at a future time. ' +
      'Use this when a user asks to be reminded, notified, or messaged at a specific time. ' +
      'The message will be sent automatically even after this conversation ends. ' +
      'Always confirm the scheduled time back to the user.',
    parameters: {
      type: 'object',
      properties: {
        chat_id: {
          type: 'string',
          description: 'The Telegram chat ID to send the message to. Extract from the [chat_id: ...] prefix in the user prompt.',
        },
        text: {
          type: 'string',
          description: 'The message to send at the scheduled time.',
        },
        time: {
          type: 'string',
          description:
            'The time to send the message. Accepts "1:40 AM", "1:45 PM", "13:45", "01:40" formats. ' +
            'If the time has already passed today, it schedules for tomorrow.',
        },
      },
      required: ['chat_id', 'text', 'time'],
    },
  },
];

// ── Names set for routing ─────────────────────────────────────────────────────

export const SOCIAL_TOOL_NAMES = new Set(SOCIAL_TOOLS.map((t) => t.name));

// ── Executor ──────────────────────────────────────────────────────────────────

export async function executeSocialTool(
  name: string,
  input: Record<string, unknown>,
  callSocialTool: (name: string, args: Record<string, unknown>) => Promise<string>
): Promise<string> {
  switch (name) {

    // ── search_travel_content ────────────────────────────────────────────────
    case 'search_travel_content': {
      const query = String(input.query ?? '').trim();
      const limit = typeof input.limit === 'number' ? Math.min(input.limit, 20) : 6;
      if (!query) return JSON.stringify({ error: 'query is required' });

      const results = await searchTravelContent(query, limit);

      if (results.length === 0) {
        const count = getTravelContentCount();
        return JSON.stringify({
          results: [],
          note: count === 0
            ? 'Knowledge base is empty — run the MegaMind ingestor first.'
            : `No matches for "${query}". Try broader keywords.`,
        });
      }

      type WithScore = (typeof results)[number] & { score?: number };
      const hasScore = (r: unknown): r is WithScore => typeof (r as WithScore).score === 'number';
      const firstScore = hasScore(results[0]) ? results[0].score : undefined;

      return JSON.stringify({
        total: results.length,
        search_type: firstScore !== undefined ? 'semantic (Qdrant)' : 'keyword (SQLite)',
        results: results.map((r) => ({
          id:       r.id,
          source:   r.source,
          type:     r.type,
          content:  r.content.length > 900 ? r.content.slice(0, 900) + '…' : r.content,
          metadata: r.metadata,
          score:    hasScore(r) ? r.score : undefined,
        })),
      });
    }

    // ── sample_travel_content ────────────────────────────────────────────────
    case 'sample_travel_content': {
      const limit = typeof input.limit === 'number' ? Math.min(input.limit, 10) : 4;
      const results = sampleTravelContent(limit);

      if (results.length === 0) {
        return JSON.stringify({ results: [], note: 'Knowledge base is empty — run the ingestor first.' });
      }

      return JSON.stringify({
        results: results.map((r) => ({
          id:      r.id,
          source:  r.source,
          content: r.content.length > 900 ? r.content.slice(0, 900) + '…' : r.content,
        })),
      });
    }

    // ── generate_image ───────────────────────────────────────────────────────
    case 'generate_image': {
      const prompt = String(input.prompt ?? '').trim();
      if (!prompt) return JSON.stringify({ error: 'prompt is required' });

      try {
        const url = await generateImage(prompt);
        return JSON.stringify({ success: true, image_url: url, prompt });
      } catch (err) {
        return JSON.stringify({ error: (err as Error).message });
      }
    }

    // ── broadcast_post ───────────────────────────────────────────────────────
    case 'broadcast_post': {
      const message    = String(input.message ?? '').trim();
      const platforms  = String(input.platforms ?? '').split(',').map((p) => p.trim().toLowerCase()).filter(Boolean);
      const twitterText = input.twitter_text ? String(input.twitter_text).slice(0, 280) : message.slice(0, 280);
      const imageUrl   = input.image_url ? String(input.image_url) : undefined;

      if (!message)         return JSON.stringify({ error: 'message is required' });
      if (!platforms.length) return JSON.stringify({ error: 'platforms is required' });

      const results: Record<string, string> = {};

      for (const platform of platforms) {
        try {
          switch (platform) {
            case 'twitter':
              results.twitter = await callSocialTool('SEND_TWEET', { text: twitterText });
              break;

            case 'telegram': {
              const chatId = process.env.TELEGRAM_DEFAULT_CHAT_ID;
              if (!chatId) { results.telegram = 'skipped — TELEGRAM_DEFAULT_CHAT_ID not set'; break; }
              results.telegram = await callSocialTool('SEND_MESSAGE', { chatId, text: message });
              break;
            }

            case 'discord': {
              const channelId = process.env.DISCORD_DEFAULT_CHANNEL_ID;
              if (!channelId) { results.discord = 'skipped — DISCORD_DEFAULT_CHANNEL_ID not set'; break; }
              results.discord = await callSocialTool('SEND_DISCORD_MESSAGE', { channelId, content: message });
              break;
            }

            case 'slack': {
              const channelId = process.env.SLACK_DEFAULT_CHANNEL ?? 'general';
              results.slack = await callSocialTool('SEND_SLACK_MESSAGE', { channelId, text: message });
              break;
            }

            case 'facebook': {
              const pageId = process.env.FACEBOOK_PAGE_ID;
              if (!pageId) { results.facebook = 'skipped — FACEBOOK_PAGE_ID not set'; break; }
              results.facebook = await callSocialTool('CREATE_FACEBOOK_POST', { pageId, message });
              break;
            }

            case 'instagram': {
              const userId = process.env.INSTAGRAM_ACCOUNT_ID;
              if (!userId)   { results.instagram = 'skipped — INSTAGRAM_ACCOUNT_ID not set'; break; }
              if (!imageUrl) { results.instagram = 'skipped — image_url required for Instagram'; break; }
              results.instagram = await callSocialTool('CREATE_INSTAGRAM_POST', { userId, imageUrl, message });
              break;
            }

            case 'linkedin':
              results.linkedin = await linkedInPost(message).then(
                (r) => `LinkedIn post created. ID: ${r.id} URL: ${r.url}`,
                (e: Error) => `LinkedIn error: ${e.message}`
              );
              break;

            case 'whatsapp':
              results.whatsapp = 'skipped — WhatsApp requires a recipient phone number; use SEND_WHATSAPP_MESSAGE directly';
              break;

            default:
              results[platform] = `unknown platform: ${platform}`;
          }
        } catch (err) {
          results[platform] = `error: ${(err as Error).message}`;
        }
      }

      return JSON.stringify({ broadcast: true, platforms, results });
    }

    // ── linkedin_post ────────────────────────────────────────────────────────
    case 'linkedin_post': {
      const text = String(input.text ?? '').trim();
      if (!text) return JSON.stringify({ error: 'text is required' });

      try {
        const result = await linkedInPost(text);
        return JSON.stringify({ success: true, post_id: result.id, url: result.url });
      } catch (err) {
        return JSON.stringify({ error: (err as Error).message });
      }
    }

    // ── telegram_reply ───────────────────────────────────────────────────────
    case 'telegram_reply': {
      const chatId    = String(input.chat_id ?? '').trim();
      const text      = String(input.text ?? '').trim();
      const messageId = typeof input.message_id === 'number'
        ? input.message_id
        : input.message_id ? parseInt(String(input.message_id), 10) : undefined;

      if (!chatId || !text) return JSON.stringify({ error: 'chat_id and text are required' });

      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) return JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN not set' });

      const payload: Record<string, unknown> = { chat_id: chatId, text };
      if (messageId) payload.reply_to_message_id = messageId;

      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json() as Record<string, unknown>;
      if (!data.ok) return JSON.stringify({ error: data.description ?? 'Telegram API error' });

      const msg = data.result as Record<string, unknown>;
      return JSON.stringify({ success: true, message_id: msg.message_id, chat_id: chatId });
    }

    // ── schedule_message ─────────────────────────────────────────────────────
    case 'schedule_message': {
      const chatId  = String(input.chat_id ?? '').trim();
      const text    = String(input.text ?? '').trim();
      const timeStr = String(input.time ?? '').trim();

      if (!chatId || !text || !timeStr) {
        return JSON.stringify({ error: 'chat_id, text, and time are all required' });
      }

      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) return JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN not set' });

      const targetMs = parseScheduleTime(timeStr);
      if (targetMs === null) {
        return JSON.stringify({ error: `Could not parse time: "${timeStr}". Use formats like "1:40 AM", "13:45".` });
      }

      const delayMs = targetMs - Date.now();
      if (delayMs < 0) {
        return JSON.stringify({ error: 'Scheduled time is in the past' });
      }

      setTimeout(async () => {
        try {
          const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ chat_id: chatId, text }),
          });
          const data = await res.json() as Record<string, unknown>;
          if (data.ok) {
            console.log(`[schedule_message] Sent to chat ${chatId} at ${new Date().toISOString()}`);
          } else {
            console.error(`[schedule_message] Telegram error:`, data.description);
          }
        } catch (err) {
          console.error(`[schedule_message] Failed:`, (err as Error).message);
        }
      }, delayMs);

      const scheduledTime = new Date(targetMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const delayMinutes  = Math.round(delayMs / 60_000);
      return JSON.stringify({
        success:         true,
        scheduled_at:    scheduledTime,
        delay_minutes:   delayMinutes,
        message_preview: text.slice(0, 80),
      });
    }

    default:
      return JSON.stringify({ error: `Unknown social tool: ${name}` });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parse a human-readable time string into a future Unix timestamp (ms).
 * If the parsed time is already in the past today, schedules for tomorrow.
 * Returns null if the string cannot be parsed.
 */
function parseScheduleTime(timeStr: string): number | null {
  const s = timeStr.trim();

  // Match "1:40 AM", "01:40AM", "1:40 PM" etc.
  const match12h = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  // Match "13:45", "01:40"
  const match24h = s.match(/^(\d{1,2}):(\d{2})$/);

  let hours: number, minutes: number;

  if (match12h) {
    hours   = parseInt(match12h[1], 10);
    minutes = parseInt(match12h[2], 10);
    const period = match12h[3].toUpperCase();
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours  = 0;
  } else if (match24h) {
    hours   = parseInt(match24h[1], 10);
    minutes = parseInt(match24h[2], 10);
  } else {
    return null;
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  const target = new Date();
  target.setHours(hours, minutes, 0, 0);

  // If already past, schedule for tomorrow
  if (target.getTime() <= Date.now()) {
    target.setDate(target.getDate() + 1);
  }

  return target.getTime();
}
