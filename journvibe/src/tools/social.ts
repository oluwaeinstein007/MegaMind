import { z } from 'zod';
import { tool } from '@veridex/agents';
import { searchTravelContent, sampleTravelContent, getTravelContentCount } from '../lib/megamind.js';
import { generateImage } from '../lib/image-gen.js';
import { linkedInPost } from '../lib/linkedin.js';
import { SocialMCPClient } from '../lib/mcp-client.js';

export function createJournVibeTools(socialClient: SocialMCPClient) {
  const searchTravelContentTool = tool({
    name: 'search_travel_content',
    guidance: {
      summary: "Search JournVibe's travel knowledge base for content to base posts on.",
      whenToUse: [
        'Always call this before composing a travel-related social post to base your content on factual destination data, visa rules, and budgets.',
      ],
      whenNotToUse: [
        'For general browsing or inspiration when no specific topic is queryable — use `sample_travel_content` instead.',
      ],
      successExample: 'Successful result: { "total": 2, "results": [...] }',
    },
    input: z.object({
      query: z.string().min(1).describe('Keywords or phrase to search (e.g. "Bali budget", "UK visa Nigeria").'),
      limit: z.number().optional().describe('Max results to return (default 6, max 20).'),
    }),
    safetyClass: 'read',
    async execute({ input }) {
      const query = String(input.query ?? '').trim();
      const limit = typeof input.limit === 'number' ? Math.min(input.limit, 20) : 6;
      if (!query) return { success: false, llmOutput: 'query is required', error: 'Missing query' };

      const results = await searchTravelContent(query, limit);

      if (results.length === 0) {
        const count = getTravelContentCount();
        return {
          success: true,
          llmOutput: JSON.stringify({
            results: [],
            note: count === 0
              ? 'Knowledge base is empty — run the MegaMind ingestor first.'
              : `No matches for "${query}". Try broader keywords.`,
          }),
        };
      }

      return {
        success: true,
        llmOutput: JSON.stringify({
          total: results.length,
          search_type: results[0] && 'score' in results[0] ? 'semantic (Qdrant)' : 'keyword (SQLite)',
          results: results.map((r: any) => ({
            id:       r.id,
            source:   r.source,
            type:     r.type,
            content:  r.content.length > 900 ? r.content.slice(0, 900) + '…' : r.content,
            metadata: r.metadata,
            score:    r.score,
          })),
        }),
      };
    },
  });

  const sampleTravelContentTool = tool({
    name: 'sample_travel_content',
    guidance: {
      summary: "Return a random sample of travel chunks from JournVibe's database.",
      whenToUse: [
        'Use when you need general post inspiration or destination ideas without a specific topic in mind.',
      ],
      whenNotToUse: [
        'When the user asks for a specific topic, visa requirement, or destination budget — use `search_travel_content` instead.',
      ],
      successExample: 'Successful result: { "results": [...] }',
    },
    input: z.object({
      limit: z.number().optional().describe('Number of random chunks to return (default 4, max 10).'),
    }),
    safetyClass: 'read',
    async execute({ input }) {
      const limit = typeof input.limit === 'number' ? Math.min(input.limit, 10) : 4;
      const results = sampleTravelContent(limit);

      if (results.length === 0) {
        return {
          success: true,
          llmOutput: JSON.stringify({ results: [], note: 'Knowledge base is empty — run the ingestor first.' }),
        };
      }

      return {
        success: true,
        llmOutput: JSON.stringify({
          results: results.map((r: any) => ({
            id:      r.id,
            source:  r.source,
            content: r.content.length > 900 ? r.content.slice(0, 900) + '…' : r.content,
          })),
        }),
      };
    },
  });

  const generateImageTool = tool({
    name: 'generate_image',
    guidance: {
      summary: 'Generate a travel-themed image from a text prompt.',
      whenToUse: [
        'Generate custom visual assets for image-native social platforms (always call this before posting to Instagram).',
      ],
      whenNotToUse: [
        'For text-only platforms like Twitter or LinkedIn unless an image is explicitly requested.',
      ],
      successExample: 'Successful result: { "success": true, "image_url": "https://images.pollinations.ai/...", "prompt": "..." }',
    },
    input: z.object({
      prompt: z.string().describe('Detailed visual description of the image (e.g. "Aerial view of Santorini blue domes at golden hour, cinematic, 4K").'),
    }),
    safetyClass: 'network',
    async execute({ input }) {
      const prompt = String(input.prompt ?? '').trim();
      if (!prompt) return { success: false, llmOutput: 'prompt is required', error: 'Missing prompt' };

      try {
        const url = await generateImage(prompt);
        return {
          success: true,
          llmOutput: JSON.stringify({ success: true, image_url: url, prompt }),
        };
      } catch (err) {
        return {
          success: false,
          llmOutput: `Image generation failed: ${(err as Error).message}`,
          error: (err as Error).message,
        };
      }
    },
  });

  const broadcastPostTool = tool({
    name: 'broadcast_post',
    guidance: {
      summary: 'Publish a message to multiple social media platforms in one call.',
      whenToUse: [
        'The user asks you to publish or broadcast a travel article/update across multiple platform feeds concurrently.',
      ],
      whenNotToUse: [
        'For sending a quote reply to a single direct Telegram message — use `telegram_reply` instead.',
      ],
      successExample: 'Successful result: { "broadcast": true, "platforms": ["twitter", "telegram"], "results": { "twitter": "Tweet sent", ... } }',
    },
    input: z.object({
      message: z.string().describe('Core message content. Will be adapted per platform.'),
      platforms: z.string().describe('Comma-separated list of platforms. Valid: twitter, telegram, discord, slack, whatsapp, facebook, linkedin.'),
      twitter_text: z.string().optional().describe('Optional Twitter-specific text override (max 280 chars).'),
      image_url: z.string().optional().describe('Public image URL — required if instagram is in the platforms list.'),
    }),
    safetyClass: 'write',
    async execute({ input }) {
      const message = String(input.message ?? '').trim();
      const platforms = String(input.platforms ?? '')
        .split(',')
        .map((p) => p.trim().toLowerCase())
        .filter(Boolean);
      const twitterText = input.twitter_text ? String(input.twitter_text).slice(0, 280) : message.slice(0, 280);
      const imageUrl = input.image_url ? String(input.image_url) : undefined;

      if (!message) return { success: false, llmOutput: 'message is required', error: 'Missing message' };
      if (!platforms.length) return { success: false, llmOutput: 'platforms is required', error: 'Missing platforms' };

      const results: Record<string, string> = {};

      for (const platform of platforms) {
        try {
          switch (platform) {
            case 'twitter':
              results.twitter = await socialClient.callTool('SEND_TWEET', { text: twitterText });
              break;

            case 'telegram': {
              const chatId = process.env.TELEGRAM_DEFAULT_CHAT_ID;
              if (!chatId) {
                results.telegram = 'skipped — TELEGRAM_DEFAULT_CHAT_ID not set';
                break;
              }
              results.telegram = await socialClient.callTool('SEND_MESSAGE', { chatId, text: message });
              break;
            }

            case 'discord': {
              const channelId = process.env.DISCORD_DEFAULT_CHANNEL_ID;
              if (!channelId) {
                results.discord = 'skipped — DISCORD_DEFAULT_CHANNEL_ID not set';
                break;
              }
              results.discord = await socialClient.callTool('SEND_DISCORD_MESSAGE', { channelId, content: message });
              break;
            }

            case 'slack': {
              const channelId = process.env.SLACK_DEFAULT_CHANNEL ?? 'general';
              results.slack = await socialClient.callTool('SEND_SLACK_MESSAGE', { channelId, text: message });
              break;
            }

            case 'facebook': {
              const pageId = process.env.FACEBOOK_PAGE_ID;
              if (!pageId) {
                results.facebook = 'skipped — FACEBOOK_PAGE_ID not set';
                break;
              }
              results.facebook = await socialClient.callTool('CREATE_FACEBOOK_POST', { pageId, message });
              break;
            }

            case 'instagram': {
              const userId = process.env.INSTAGRAM_ACCOUNT_ID;
              if (!userId) {
                results.instagram = 'skipped — INSTAGRAM_ACCOUNT_ID not set';
                break;
              }
              if (!imageUrl) {
                results.instagram = 'skipped — image_url required for Instagram';
                break;
              }
              results.instagram = await socialClient.callTool('CREATE_INSTAGRAM_POST', { userId, imageUrl, message });
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

      return {
        success: true,
        llmOutput: JSON.stringify({ broadcast: true, platforms, results }),
      };
    },
  });

  const linkedinPostTool = tool({
    name: 'linkedin_post',
    guidance: {
      summary: 'Publish a text post directly to the configured LinkedIn user feed.',
      whenToUse: [
        'The user specifically requests a post or article to be published to LinkedIn.',
      ],
      whenNotToUse: [
        'For visual platforms or multi-feed publishing — use `generate_image` or `broadcast_post` instead.',
      ],
      successExample: 'Successful result: { "success": true, "post_id": "...", "url": "..." }',
    },
    input: z.object({
      text: z.string().describe('Post text. LinkedIn supports plain text; keep under 3000 characters.'),
    }),
    safetyClass: 'write',
    async execute({ input }) {
      const text = String(input.text ?? '').trim();
      if (!text) return { success: false, llmOutput: 'text is required', error: 'Missing text' };

      try {
        const result = await linkedInPost(text);
        return {
          success: true,
          llmOutput: JSON.stringify({ success: true, post_id: result.id, url: result.url }),
        };
      } catch (err) {
        return {
          success: false,
          llmOutput: `LinkedIn posting failed: ${(err as Error).message}`,
          error: (err as Error).message,
        };
      }
    },
  });

  const telegramReplyTool = tool({
    name: 'telegram_reply',
    guidance: {
      summary: 'Send a reply to a specific Telegram message.',
      whenToUse: [
        'You receive an incoming Telegram message and want to reply directly to it (quoted reply).',
      ],
      whenNotToUse: [
        'For generic broadcasting or posting to other media networks.',
      ],
      successExample: 'Successful result: { "success": true, "message_id": 1234, "chat_id": "5678" }',
    },
    input: z.object({
      chat_id: z.string().describe('The Telegram chat ID or @username.'),
      text: z.string().describe('The reply text to send.'),
      message_id: z.number().optional().describe('ID of the message to reply to (for quoted replies).'),
    }),
    safetyClass: 'write',
    async execute({ input }) {
      const chatId = String(input.chat_id ?? '').trim();
      const text = String(input.text ?? '').trim();
      const messageId = typeof input.message_id === 'number'
        ? input.message_id
        : input.message_id ? parseInt(String(input.message_id), 10) : undefined;

      if (!chatId || !text) {
        return {
          success: false,
          llmOutput: 'chat_id and text are required',
          error: 'Missing required arguments',
        };
      }

      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) return { success: false, llmOutput: 'TELEGRAM_BOT_TOKEN not set', error: 'Missing Telegram token' };

      const payload: Record<string, unknown> = { chat_id: chatId, text };
      if (messageId) payload.reply_to_message_id = messageId;

      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = (await res.json()) as Record<string, unknown>;
        if (!data.ok) {
          return {
            success: false,
            llmOutput: `Telegram API error: ${data.description ?? 'Unknown error'}`,
            error: String(data.description),
          };
        }

        const msg = data.result as Record<string, unknown>;
        return {
          success: true,
          llmOutput: JSON.stringify({ success: true, message_id: msg.message_id, chat_id: chatId }),
        };
      } catch (err) {
        return {
          success: false,
          llmOutput: `Telegram connection error: ${(err as Error).message}`,
          error: (err as Error).message,
        };
      }
    },
  });

  const scheduleMessageTool = tool({
    name: 'schedule_message',
    guidance: {
      summary: 'Schedule a Telegram message to be sent to a specific chat at a future time.',
      whenToUse: [
        'A user asks to be reminded, notified, or messaged at a specific future time.',
      ],
      whenNotToUse: [
        'To reply instantly to a message — use `telegram_reply` instead.',
      ],
      successExample: 'Successful result: { "success": true, "scheduled_at": "13:45", "delay_minutes": 45 }',
    },
    input: z.object({
      chat_id: z.string().describe('The Telegram chat ID to send the message to. Extract from [chat_id: ...] prefix.'),
      text: z.string().describe('The message to send at the scheduled time.'),
      time: z.string().describe('The time to send the message (e.g. "1:40 AM", "13:45").'),
    }),
    safetyClass: 'write',
    async execute({ input }) {
      const chatId = String(input.chat_id ?? '').trim();
      const text = String(input.text ?? '').trim();
      const timeStr = String(input.time ?? '').trim();

      if (!chatId || !text || !timeStr) {
        return {
          success: false,
          llmOutput: 'chat_id, text, and time are all required',
          error: 'Missing arguments',
        };
      }

      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) return { success: false, llmOutput: 'TELEGRAM_BOT_TOKEN not set', error: 'Missing Telegram token' };

      const targetMs = parseScheduleTime(timeStr);
      if (targetMs === null) {
        return {
          success: false,
          llmOutput: `Could not parse time: "${timeStr}". Use formats like "1:40 AM", "13:45".`,
          error: 'Invalid time format',
        };
      }

      const delayMs = targetMs - Date.now();
      if (delayMs < 0) {
        return { success: false, llmOutput: 'Scheduled time is in the past', error: 'Past time' };
      }

      setTimeout(async () => {
        try {
          const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text }),
          });
          const data = (await res.json()) as Record<string, unknown>;
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
      const delayMinutes = Math.round(delayMs / 60_000);

      return {
        success: true,
        llmOutput: JSON.stringify({
          success: true,
          scheduled_at: scheduledTime,
          delay_minutes: delayMinutes,
          message_preview: text.slice(0, 80),
        }),
      };
    },
  });

  return [
    searchTravelContentTool,
    sampleTravelContentTool,
    generateImageTool,
    broadcastPostTool,
    linkedinPostTool,
    telegramReplyTool,
    scheduleMessageTool,
  ];
}

function parseScheduleTime(timeStr: string): number | null {
  const s = timeStr.trim();

  const match12h = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  const match24h = s.match(/^(\d{1,2}):(\d{2})$/);

  let hours: number, minutes: number;

  if (match12h) {
    hours = parseInt(match12h[1], 10);
    minutes = parseInt(match12h[2], 10);
    const period = match12h[3].toUpperCase();
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
  } else if (match24h) {
    hours = parseInt(match24h[1], 10);
    minutes = parseInt(match24h[2], 10);
  } else {
    return null;
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  const target = new Date();
  target.setHours(hours, minutes, 0, 0);

  if (target.getTime() <= Date.now()) {
    target.setDate(target.getDate() + 1);
  }

  return target.getTime();
}
