/**
 * Webhook inbox — Express server for incoming platform messages.
 *
 * Listens for incoming messages from Telegram, Discord, Slack, and WhatsApp
 * and routes them to the social agent for automated replies.
 *
 * Config (env vars):
 *   WEBHOOK_PORT    HTTP port (default: 3456)
 *   WEBHOOK_SECRET  Shared secret for request validation
 *   WEBHOOK_ENABLED Set to "true" to start on boot
 */

import express, { type Request, type Response } from 'express';

export type AgentRunner = (prompt: string, sessionId?: string) => Promise<string>;

const DEFAULT_PORT = 3456;

interface ExtractResult {
  prompt: string;
  sessionId?: string;
}

function extractTextAndContext(platform: string, body: Record<string, unknown>): ExtractResult | null {
  try {
    switch (platform) {
      case 'telegram': {
        const msg = (body.message ?? body.channel_post) as Record<string, unknown> | undefined;
        if (!msg?.text) return null;
        const chatId   = (msg.chat as Record<string, unknown>)?.id;
        const msgId    = msg.message_id;
        const fromUser = ((msg.from as Record<string, unknown>)?.username ?? 'user');
        return {
          prompt: (
            `Incoming Telegram message from @${fromUser} in chat ${chatId} (message_id: ${msgId}): ` +
            `"${msg.text}". ` +
            `Reply using telegram_reply with chat_id=${chatId} and message_id=${msgId}.`
          ),
          sessionId: `telegram-${chatId}`,
        };
      }
      case 'slack': {
        const event = body.event as Record<string, unknown> | undefined;
        if (!event || event.type !== 'message' || event.bot_id) return null;
        return {
          prompt: (
            `Incoming Slack message in channel ${event.channel} (thread_ts: ${event.ts}): "${event.text}". ` +
            `Reply using SEND_SLACK_MESSAGE with channel=${event.channel} and thread_ts=${event.ts}.`
          ),
        };
      }
      case 'discord': {
        const content   = body.content;
        const channelId = body.channel_id;
        const messageId = body.id;
        if (!content || !channelId) return null;
        return {
          prompt: (
            `Incoming Discord message in channel ${channelId} (message_id: ${messageId}): "${content}". ` +
            `Reply using SEND_DISCORD_MESSAGE with channel_id=${channelId}.`
          ),
        };
      }
      case 'whatsapp': {
        const entry   = ((body.entry as unknown[]) ?? [])[0] as Record<string, unknown> | undefined;
        const changes = ((entry?.changes as unknown[]) ?? [])[0] as Record<string, unknown> | undefined;
        const value   = changes?.value as Record<string, unknown> | undefined;
        const message = ((value?.messages as unknown[]) ?? [])[0] as Record<string, unknown> | undefined;
        if (!message) return null;
        const text = (message.text as Record<string, unknown>)?.body;
        return {
          prompt: (
            `Incoming WhatsApp message from ${message.from}: "${text}". ` +
            `Reply using SEND_WHATSAPP_MESSAGE with to=${message.from}.`
          ),
        };
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export function createWebhookServer(runAgent: AgentRunner): express.Application {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', ts: new Date().toISOString() });
  });

  function makeHandler(platform: string) {
    return async (req: Request, res: Response) => {
      const secret = process.env.WEBHOOK_SECRET;
      if (secret) {
        const provided = req.headers['x-webhook-secret'] ?? req.query.secret;
        if (provided !== secret) { res.status(401).json({ error: 'Unauthorized' }); return; }
      }

      if (req.body.type === 'url_verification') { res.json({ challenge: req.body.challenge }); return; }

      res.status(200).json({ ok: true });

      const extracted = extractTextAndContext(platform, req.body as Record<string, unknown>);
      if (!extracted) return;

      const { prompt, sessionId } = extracted;
      console.log(`[webhook/${platform}] incoming${sessionId ? ` (session: ${sessionId})` : ''} — running agent`);

      try {
        const result = await runAgent(prompt, sessionId);
        console.log(`[webhook/${platform}] reply:`, result.slice(0, 200));
      } catch (err) {
        console.error(`[webhook/${platform}] error:`, (err as Error).message);
      }
    };
  }

  app.post('/webhook/telegram',  makeHandler('telegram'));
  app.post('/webhook/slack',     makeHandler('slack'));
  app.post('/webhook/discord',   makeHandler('discord'));
  app.post('/webhook/whatsapp',  makeHandler('whatsapp'));

  return app;
}

export function startWebhookServer(runAgent: AgentRunner): void {
  const port = parseInt(process.env.WEBHOOK_PORT ?? String(DEFAULT_PORT), 10);
  createWebhookServer(runAgent).listen(port, () => {
    console.log(`[webhook] Listening on http://localhost:${port}`);
    console.log(`[webhook] POST /webhook/{telegram,slack,discord,whatsapp}  GET /health`);
  });
}
