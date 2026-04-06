/**
 * Improvement #2 — Webhook inbox.
 *
 * Starts an Express server that listens for incoming messages from:
 *   • Telegram (bot webhook)
 *   • Discord  (interactions endpoint)
 *   • Slack    (Events API)
 *   • WhatsApp (Cloud API webhook)
 *
 * On every incoming message, the agent is invoked to generate and send a reply.
 *
 * Config (env vars):
 *   WEBHOOK_PORT    HTTP port (default: 3456)
 *   WEBHOOK_SECRET  Shared secret for request validation
 *   WEBHOOK_ENABLED Set to "true" to start on boot
 */

import express, { type Request, type Response } from 'express';

export type AgentRunner = (prompt: string) => Promise<string>;

const DEFAULT_PORT = 3456;

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractTextAndContext(platform: string, body: Record<string, unknown>): string | null {
  try {
    switch (platform) {
      case 'telegram': {
        const msg = (body.message ?? body.channel_post) as Record<string, unknown> | undefined;
        if (!msg?.text) return null;
        const chatId  = (msg.chat as Record<string, unknown>)?.id;
        const msgId   = msg.message_id;
        const fromUser = ((msg.from as Record<string, unknown>)?.username ?? 'user');
        return (
          `Incoming Telegram message from @${fromUser} in chat ${chatId} (message_id: ${msgId}): ` +
          `"${msg.text}". ` +
          `Reply to this message using telegram_reply with chat_id=${chatId} and message_id=${msgId}.`
        );
      }

      case 'slack': {
        const event = body.event as Record<string, unknown> | undefined;
        if (!event || event.type !== 'message' || event.bot_id) return null;
        const channel = event.channel;
        const ts      = event.ts;
        const text    = event.text;
        return (
          `Incoming Slack message in channel ${channel} (thread_ts: ${ts}): "${text}". ` +
          `Reply in the thread using slack_reply with channel=${channel} and thread_ts=${ts}.`
        );
      }

      case 'discord': {
        const content = (body as Record<string, unknown>).content;
        const channelId = (body as Record<string, unknown>).channel_id;
        const messageId = (body as Record<string, unknown>).id;
        if (!content || !channelId) return null;
        return (
          `Incoming Discord message in channel ${channelId} (message_id: ${messageId}): "${content}". ` +
          `Reply using discord_reply with channel_id=${channelId} and message_id=${messageId}.`
        );
      }

      case 'whatsapp': {
        const entry = ((body.entry as unknown[]) ?? [])[0] as Record<string, unknown> | undefined;
        const changes = ((entry?.changes as unknown[]) ?? [])[0] as Record<string, unknown> | undefined;
        const value = changes?.value as Record<string, unknown> | undefined;
        const message = ((value?.messages as unknown[]) ?? [])[0] as Record<string, unknown> | undefined;
        if (!message) return null;
        const from = message.from;
        const text = (message.text as Record<string, unknown>)?.body;
        return (
          `Incoming WhatsApp message from ${from}: "${text}". ` +
          `Reply using whatsapp_send with to=${from}.`
        );
      }

      default:
        return null;
    }
  } catch {
    return null;
  }
}

// ── Server factory ────────────────────────────────────────────────────────────

export function createWebhookServer(runAgent: AgentRunner): express.Application {
  const app = express();
  app.use(express.json());

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', ts: new Date().toISOString() });
  });

  // Generic handler factory
  function makeHandler(platform: string) {
    return async (req: Request, res: Response) => {
      // Optional shared-secret validation
      const secret = process.env.WEBHOOK_SECRET;
      if (secret) {
        const provided = req.headers['x-webhook-secret'] ?? req.query.secret;
        if (provided !== secret) {
          res.status(401).json({ error: 'Unauthorized' });
          return;
        }
      }

      // Slack URL verification challenge
      if (req.body.type === 'url_verification') {
        res.json({ challenge: req.body.challenge });
        return;
      }

      // Acknowledge quickly (async processing below)
      res.status(200).json({ ok: true });

      const prompt = extractTextAndContext(platform, req.body as Record<string, unknown>);
      if (!prompt) return;

      console.log(`[webhook/${platform}] incoming message — running agent`);
      try {
        const result = await runAgent(prompt);
        console.log(`[webhook/${platform}] agent reply:`, result.slice(0, 200));
      } catch (err) {
        console.error(`[webhook/${platform}] agent error:`, (err as Error).message);
      }
    };
  }

  app.post('/webhook/telegram',  makeHandler('telegram'));
  app.post('/webhook/slack',     makeHandler('slack'));
  app.post('/webhook/discord',   makeHandler('discord'));
  app.post('/webhook/whatsapp',  makeHandler('whatsapp'));

  return app;
}

/** Start the webhook server and return the http.Server instance. */
export function startWebhookServer(runAgent: AgentRunner): void {
  const port = parseInt(process.env.WEBHOOK_PORT ?? String(DEFAULT_PORT), 10);
  const app  = createWebhookServer(runAgent);

  app.listen(port, () => {
    console.log(`[webhook] Listening on http://localhost:${port}`);
    console.log(`[webhook] Endpoints:`);
    console.log(`           POST /webhook/telegram`);
    console.log(`           POST /webhook/slack`);
    console.log(`           POST /webhook/discord`);
    console.log(`           POST /webhook/whatsapp`);
    console.log(`           GET  /health`);
  });
}
