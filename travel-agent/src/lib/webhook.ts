/**
 * Inbound webhook server for the travel advisor.
 *
 * Receives messages from Telegram, Discord, Slack, and WhatsApp and
 * routes them to the travel agent. The agent answers with travel advice
 * and then replies on the originating platform via social-mcp tools.
 *
 * Config (env vars):
 *   WEBHOOK_PORT    HTTP port (default: 3456)
 *   WEBHOOK_SECRET  Shared secret for request validation
 *   WEBHOOK_ENABLED Set to "true" to start on boot
 */

import express, { type Request, type Response } from 'express';

/** Agent runner accepts an optional session ID for per-chat context. */
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
            `Incoming Telegram travel question from @${fromUser} in chat ${chatId} ` +
            `(message_id: ${msgId}): "${msg.text}". ` +
            `Answer the travel question, then reply using the SEND_MESSAGE tool ` +
            `with chatId=${chatId}.`
          ),
          sessionId: `telegram-${chatId}`,
        };
      }

      case 'slack': {
        const event = body.event as Record<string, unknown> | undefined;
        if (!event || event.type !== 'message' || event.bot_id) return null;
        return {
          prompt: (
            `Incoming Slack travel question in channel ${event.channel} ` +
            `(thread_ts: ${event.ts}): "${event.text}". ` +
            `Answer the travel question, then reply using SEND_SLACK_MESSAGE ` +
            `with channel=${event.channel} and thread_ts=${event.ts}.`
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
            `Incoming Discord travel question in channel ${channelId} ` +
            `(message_id: ${messageId}): "${content}". ` +
            `Answer the travel question, then reply using SEND_DISCORD_MESSAGE ` +
            `with channelId=${channelId}.`
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
            `Incoming WhatsApp travel question from ${message.from}: "${text}". ` +
            `Answer the travel question, then reply using SEND_WHATSAPP_MESSAGE ` +
            `with to=${message.from}.`
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
    res.json({ status: 'ok', service: 'nomadsage-travel-advisor', ts: new Date().toISOString() });
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
      console.log(`[webhook/${platform}] travel question${sessionId ? ` (session: ${sessionId})` : ''}`);

      try {
        const result = await runAgent(prompt, sessionId);
        console.log(`[webhook/${platform}] replied:`, result.slice(0, 200));
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
