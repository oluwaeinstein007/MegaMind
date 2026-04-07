/**
 * Travel + cross-cutting tools — Gemini FunctionDeclarations.
 *
 * Covers:
 *   • search_travel_content   (#3 Qdrant-backed semantic search)
 *   • sample_travel_content   (random inspiration)
 *   • generate_image          (#4 image generation for Instagram)
 *   • broadcast_post          (#5 multi-platform broadcast)
 *   • linkedin_post           (#6 LinkedIn)
 */

// Define locally so this file has no peer-dep on @google/generative-ai at import time
export interface FunctionDeclaration {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

import { searchTravelContent, sampleTravelContent, getTravelContentCount } from '../lib/megamind.js';
import { generateImage } from '../lib/image-gen.js';
import { linkedInPost } from '../lib/linkedin.js';

// ── Tool declarations (passed to Gemini) ──────────────────────────────────────

export const TRAVEL_TOOLS: FunctionDeclaration[] = [
  {
    name: 'search_travel_content',
    description:
      "Search MegaMind's travel knowledge base for relevant content chunks. " +
      'Always call this before composing a travel post — it grounds content in ' +
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
      "Return a random sample of travel chunks from MegaMind's database. " +
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
            'Comma-separated list of platforms to post to. ' +
            'Valid values: twitter, telegram, discord, slack, whatsapp, facebook, linkedin. ' +
            'Example: "twitter,telegram,discord"',
        },
        twitter_text: {
          type: 'string',
          description: 'Optional Twitter-specific text override (max 280 chars). Uses message if omitted.',
        },
        image_url: {
          type: 'string',
          description: 'Optional public image URL — required if instagram is in the platforms list.',
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
      'Send a reply to a specific Telegram message. Use this when you receive an incoming ' +
      'Telegram message and want to reply directly to it (quoted reply). ' +
      'If message_id is omitted the message is sent without quoting.',
    parameters: {
      type: 'object',
      properties: {
        chat_id: {
          type: 'string',
          description: 'The Telegram chat ID or @username of the chat.',
        },
        text: {
          type: 'string',
          description: 'The reply text to send.',
        },
        message_id: {
          type: 'number',
          description: 'The ID of the message to reply to (for quoted replies). Optional.',
        },
      },
      required: ['chat_id', 'text'],
    },
  },
];

// ── Names set for routing ─────────────────────────────────────────────────────

export const TRAVEL_TOOL_NAMES = new Set(TRAVEL_TOOLS.map((t) => t.name));

// ── Executor ──────────────────────────────────────────────────────────────────

/**
 * Execute a local travel/utility tool and return a JSON string result.
 *
 * broadcast_post needs access to the social-mcp callTool function, so we
 * accept it as a dependency parameter.
 */
export async function executeTravelTool(
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
            ? 'MegaMind database is empty — run the MegaMind ingestor first.'
            : `No matches for "${query}". Try broader keywords.`,
        });
      }

      // score is present on Qdrant results; cast to access the optional field safely
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
        return JSON.stringify({ results: [], note: 'MegaMind database is empty — run the ingestor first.' });
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

      if (!message)    return JSON.stringify({ error: 'message is required' });
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
              results.instagram = await callSocialTool('CREATE_INSTAGRAM_POST', {
                userId, imageUrl, message,
              });
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
      return JSON.stringify({
        success: true,
        message_id: msg.message_id,
        chat_id: chatId,
      });
    }

    default:
      return JSON.stringify({ error: `Unknown travel tool: ${name}` });
  }
}
