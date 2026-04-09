/**
 * JournVibe — Telegram Bot (polling-based, Telegraf)
 *
 * Acts as a command interface for the social media agent.
 * Users can request posts, broadcasts, and content creation via chat.
 *
 * Behaviour:
 *   • Private chats  — responds to every message
 *   • Groups         — only responds when @mentioned or replied to
 *   • Session expiry — conversation history cleared after 30 min of inactivity
 */

import { Telegraf } from 'telegraf';
import { clearSession } from './memory.js';
import type { AgentRunner } from './webhook.js';

const SESSION_TTL_MS = 30 * 60 * 1000;

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

  private stripMention(text: string, botUsername: string): string {
    return text.replace(new RegExp(`@${botUsername}`, 'gi'), '').trim();
  }

  private shouldRespond(chatType: ChatType, text: string, botUsername: string, replyToUserId: number | undefined, botId: number): boolean {
    if (chatType === 'private') return true;
    return (
      text.toLowerCase().includes(`@${botUsername.toLowerCase()}`) ||
      replyToUserId === botId
    );
  }

  private groupIntro(mention: string): string {
    return (
      `I'm JournVibe — your AI travel content & social media manager.\n` +
      `Tag me (${mention}) or reply to my messages to post!\n\n` +
      `I can post on Twitter/X, Telegram, Discord, Slack, WhatsApp, Facebook, Instagram & LinkedIn.`
    );
  }

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
          `Hello ${name}! I'm JournVibe, your travel content & social media agent.\n\n` +
          `Tell me what to post and where:\n` +
          `  "Post a travel tip about Bali on Twitter"\n` +
          `  "Broadcast a Lisbon guide to twitter, telegram and discord"\n` +
          `  "Generate an Instagram post about Japan cherry blossoms"\n\n` +
          `Use /clear to reset our conversation.`,
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
      ctx.reply('Conversation cleared! Ready for new instructions.');
    });

    this.bot.command('help', (ctx) => {
      const isGroup = ctx.chat?.type !== 'private';
      const mention = ctx.botInfo?.username ? `@${ctx.botInfo.username}` : 'me';
      ctx.reply(
        `*JournVibe Social Media Manager*\n\n` +
        `*Commands:*\n` +
        `/clear — Reset conversation history\n` +
        `/help  — Show this help\n\n` +
        (isGroup ? `*Usage:* Tag ${mention} or reply to my messages.\n\n` : '') +
        `*Example prompts:*\n` +
        `• Post a travel tip about Portugal on Twitter\n` +
        `• Broadcast a Bali budget guide to twitter,telegram,discord\n` +
        `• Generate an Instagram post about Japan cherry blossoms\n` +
        `• Search travel content about UK visa requirements`,
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

  async start(): Promise<void> {
    console.log('[telegram-bot] Starting (polling mode)…');
    await this.bot.launch({ dropPendingUpdates: true });
    const username = this.bot.botInfo?.username;
    console.log(`[telegram-bot] @${username ?? 'bot'} is live`);
  }

  stop(): void {
    this.bot.stop('SIGINT');
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
  }
}
