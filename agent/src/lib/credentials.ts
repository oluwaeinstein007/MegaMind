/**
 * Improvement #9 — Credential validation on startup.
 *
 * Checks every platform's required env vars and reports which are
 * configured, which are missing, and which are fully ready.
 * Does NOT throw; callers decide whether to abort or warn.
 */

export interface PlatformStatus {
  platform: string;
  ready: boolean;
  missing: string[];
}

const PLATFORM_VARS: Record<string, string[]> = {
  Gemini:    ['GEMINI_API_KEY'],
  Twitter:   ['TWITTER_APP_KEY', 'TWITTER_APP_SECRET', 'TWITTER_ACCESS_TOKEN', 'TWITTER_ACCESS_SECRET'],
  Telegram:  ['TELEGRAM_BOT_TOKEN'],
  Discord:   ['DISCORD_BOT_TOKEN'],
  Slack:     ['SLACK_BOT_TOKEN'],
  WhatsApp:  ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'],
  Facebook:  ['FACEBOOK_ACCESS_TOKEN', 'FACEBOOK_PAGE_ID'],
  Instagram: ['INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_ACCOUNT_ID'],
  LinkedIn:  ['LINKEDIN_ACCESS_TOKEN', 'LINKEDIN_USER_ID'],
  Qdrant:    ['QDRANT_HOST', 'QDRANT_KEY'],
  OpenAI:    ['OPENAI_API_KEY'],     // only needed for Qdrant embedding
};

/** Check all platform credentials and return per-platform status. */
export function validateCredentials(): PlatformStatus[] {
  return Object.entries(PLATFORM_VARS).map(([platform, vars]) => {
    const missing = vars.filter((v) => !process.env[v]);
    return { platform, ready: missing.length === 0, missing };
  });
}

/** Print a startup credential report to the console. */
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

/** Return true only if the minimum required credential (Gemini) is present. */
export function hasMinimumCredentials(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

/** Return the list of platforms that are fully configured. */
export function readyPlatforms(): string[] {
  return validateCredentials()
    .filter((s) => s.ready && s.platform !== 'Gemini' && s.platform !== 'Qdrant' && s.platform !== 'OpenAI')
    .map((s) => s.platform);
}
