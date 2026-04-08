/**
 * NomadSage Travel Advisor — Telegram Bot (polling-based, Telegraf)
 *
 * A conversational travel Q&A bot. Answers questions about visas,
 * destinations, budgets, immigration, and travel tips — grounded in
 * the MegaMind knowledge base with source citations.
 *
 * Behaviour:
 *   • Private chats  — responds to every message
 *   • Groups         — only responds when @mentioned or replied to
 *   • Sessions       — one per chat (groups) or per user (DMs)
 *   • Session expiry — conversation history cleared after 30 min of inactivity
 */

import { Telegraf } from 'telegraf';
import { clearSession } from './memory.js';

/** Agent runner accepts an optional session ID for per-chat context. */
export type AgentRunner = (prompt: string, sessionId?: string) => Promise<string>;

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

type ChatType = 'private' | 'group' | 'supergroup' | 'channel';

export class TelegramBot {
  private bot: Telegraf;
  private runner: AgentRunner;
  private timers = new Map<string, NodeJS.Timeout>();

  constructor(token: string, runner: AgentRunner) {
    this.bot = new Telegraf(token);
    this.runner = runner;
    this.setupHandlers();
  }

  // ── Session helpers ───────────────────────────────────────────────────────

  private sessionId(chatType: ChatType, chatId: number, userId: number): string {
    return chatType === 'group' || chatType === 'supergroup'
      ? `telegram-group-${chatId}`
      : `telegram-dm-${userId}`;
  }

  private touch(sessionId: string): void {
    const existing = this.timers.get(sessionId);
    if (existing) clearTimeout(existing);

    this.timers.set(
      sessionId,
      setTimeout(() => {
        clearSession(sessionId);
        this.timers.delete(sessionId);
        console.log(`[telegram-bot] Session expired: ${sessionId}`);
      }, SESSION_TTL_MS),
    );
  }

  private resetSession(sessionId: string): void {
    clearSession(sessionId);
    const t = this.timers.get(sessionId);
    if (t) { clearTimeout(t); this.timers.delete(sessionId); }
  }

  // ── Message helpers ───────────────────────────────────────────────────────

  private stripMention(text: string, botUsername: string): string {
    return text.replace(new RegExp(`@${botUsername}`, 'gi'), '').trim();
  }

  private shouldRespond(
    chatType: ChatType,
    text: string,
    botUsername: string,
    replyToUserId: number | undefined,
    botId: number,
  ): boolean {
    if (chatType === 'private') return true;
    return (
      text.toLowerCase().includes(`@${botUsername.toLowerCase()}`) ||
      replyToUserId === botId
    );
  }

  // ── Intro text ────────────────────────────────────────────────────────────

  private groupIntro(mention: string): string {
    return (
      `I'm NomadSage — your AI travel advisor.\n` +
      `Tag me (${mention}) or reply to my messages to ask travel questions!\n\n` +
      `I can help with visas, destinations, budgets, immigration rules, and more.`
    );
  }

  // ── Handler setup ─────────────────────────────────────────────────────────

  private setupHandlers(): void {

    this.bot.on('new_chat_members', (ctx) => {
      const botId = ctx.botInfo?.id;
      const added = ctx.message.new_chat_members.some((m) => m.id === botId);
      if (!added) return;
      const mention = ctx.botInfo?.username ? `@${ctx.botInfo.username}` : 'me';
      ctx.reply(this.groupIntro(mention));
    });

    this.bot.start((ctx) => {
      const name    = ctx.from?.first_name ?? 'there';
      const isGroup = ctx.chat?.type !== 'private';
      const mention = ctx.botInfo?.username ? `@${ctx.botInfo.username}` : 'me';

      if (isGroup) {
        ctx.reply(this.groupIntro(mention));
      } else {
        ctx.reply(
          `Hello ${name}! I'm NomadSage, your AI travel advisor.\n\n` +
          `Ask me anything about travel — visas, destinations, budgets, ` +
          `immigration requirements, safety tips, and more.\n\n` +
          `All my answers are grounded in real travel data with source links.\n\n` +
          `Use /clear to reset our conversation, /help for examples.`,
        );
      }
    });

    this.bot.command('clear', (ctx) => {
      const chatType = ctx.chat?.type as ChatType;
      const chatId   = ctx.chat?.id;
      const userId   = ctx.from?.id;
      if (!chatId || !userId) return;

      const sid = this.sessionId(chatType, chatId, userId);
      this.resetSession(sid);

      const scope = chatType === 'group' || chatType === 'supergroup'
        ? 'Group conversation'
        : 'Conversation';
      ctx.reply(`${scope} cleared! Start fresh with your next question.`);
    });

    this.bot.command('help', (ctx) => {
      const isGroup = ctx.chat?.type !== 'private';
      const mention = ctx.botInfo?.username ? `@${ctx.botInfo.username}` : 'me';
      ctx.reply(
        `*NomadSage Travel Advisor*\n\n` +
        `*Commands:*\n` +
        `/clear — Reset conversation history\n` +
        `/help  — Show this help\n\n` +
        (isGroup ? `*Usage:* Tag ${mention} or reply to my messages.\n\n` : '') +
        `*Example questions:*\n` +
        `• Do I need a visa to visit Canada from Nigeria?\n` +
        `• What are the cheapest places to travel in Europe?\n` +
        `• How long can I stay in the Schengen Area?\n` +
        `• What documents do I need for a UK student visa?\n` +
        `• Is Thailand safe for solo travellers?`,
        { parse_mode: 'Markdown' },
      );
    });

    this.bot.on('text', async (ctx) => {
      const chatType = ctx.chat?.type as ChatType;
      const chatId   = ctx.chat?.id;
      const userId   = ctx.from?.id;
      if (!chatId || !userId) return;

      const botUsername   = ctx.botInfo?.username ?? '';
      const botId         = ctx.botInfo?.id ?? 0;
      const rawText       = ctx.message.text;
      const replyToUserId = ctx.message.reply_to_message?.from?.id;

      if (!this.shouldRespond(chatType, rawText, botUsername, replyToUserId, botId)) return;

      const userMessage = this.stripMention(rawText, botUsername);
      if (!userMessage) return;

      const isGroup     = chatType === 'group' || chatType === 'supergroup';
      const senderName  = ctx.from?.first_name ?? 'User';
      const agentPrompt = isGroup ? `[${senderName}]: ${userMessage}` : userMessage;

      const sid = this.sessionId(chatType, chatId, userId);
      this.touch(sid);

      try {
        await ctx.sendChatAction('typing');

        const reply = await this.runner(agentPrompt, sid);

        // Try Markdown first, fall back to plain text
        try {
          await ctx.reply(reply, { parse_mode: 'Markdown' });
        } catch {
          await ctx.reply(reply);
        }
      } catch (err) {
        console.error(`[telegram-bot] Error (chat ${chatId}, user ${userId}):`, err);
        const msg = err instanceof Error ? err.message : 'Unknown error';
        await ctx.reply(`Something went wrong: ${msg}\n\nTry /clear to reset.`);
      }
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    console.log('[telegram-bot] Starting (polling mode)…');
    await this.bot.launch({ dropPendingUpdates: true });
    const username = this.bot.botInfo?.username;
    console.log(`[telegram-bot] @${username ?? 'bot'} is live`);
    console.log(`[telegram-bot] DMs: always responds | Groups: @mention or reply to bot`);
  }

  stop(): void {
    this.bot.stop('SIGINT');
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
  }
}
