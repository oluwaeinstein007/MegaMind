/**
 * Travel Advisor — credential validation on startup.
 *
 * Shows which social platforms the advisor can reply on
 * (credentials for social-mcp) and which data sources are configured.
 */

export interface PlatformStatus {
  platform: string;
  ready: boolean;
  missing: string[];
}

function buildPlatformVars(): Record<string, string[]> {
  const vars: Record<string, string[]> = {
    Gemini:   ['GEMINI_API_KEY'],
    Qdrant:   ['QDRANT_HOST', 'QDRANT_KEY'],
    Telegram: ['TELEGRAM_BOT_TOKEN'],
    Twitter:  ['TWITTER_APP_KEY', 'TWITTER_APP_SECRET', 'TWITTER_ACCESS_TOKEN', 'TWITTER_ACCESS_SECRET'],
    Discord:  ['DISCORD_BOT_TOKEN'],
    Slack:    ['SLACK_BOT_TOKEN'],
    WhatsApp: ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'],
  };

  if ((process.env.EMBEDDING_PROVIDER ?? 'gemini').toLowerCase() === 'openai') {
    vars['OpenAI'] = ['OPENAI_API_KEY'];
  }

  return vars;
}

export function validateCredentials(): PlatformStatus[] {
  return Object.entries(buildPlatformVars()).map(([platform, vars]) => {
    const missing = vars.filter((v) => !process.env[v]);
    return { platform, ready: missing.length === 0, missing };
  });
}

export function printCredentialReport(): void {
  const statuses = validateCredentials();
  console.log('\n┌─ Credential Status ───────────────────────────────────┐');
  for (const { platform, ready, missing } of statuses) {
    const icon = ready ? '✓' : '✗';
    const line = ready
      ? `│  ${icon} ${platform.padEnd(10)} ready`
      : `│  ${icon} ${platform.padEnd(10)} missing: ${missing.join(', ')}`;
    console.log(line);
  }
  console.log('└───────────────────────────────────────────────────────┘\n');
}

export function hasMinimumCredentials(): boolean {
  return !!process.env.GEMINI_API_KEY;
}
