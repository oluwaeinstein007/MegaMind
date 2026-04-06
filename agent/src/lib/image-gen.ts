/**
 * Improvement #4 — Image generation.
 *
 * Generates travel images for Instagram posts.
 *
 * Providers (tried in order):
 *   1. Stability AI  — set STABILITY_AI_API_KEY (paid, high quality)
 *   2. Pollinations.ai — free, no API key required (fallback)
 *
 * Returns a publicly accessible image URL suitable for the Instagram Graph API.
 */

/** Generate an image from a text prompt; returns a public URL. */
export async function generateImage(prompt: string): Promise<string> {
  if (process.env.STABILITY_AI_API_KEY) {
    try {
      return await stabilityAiGenerate(prompt);
    } catch (err) {
      console.warn('[image-gen] Stability AI failed, falling back to Pollinations.ai:', (err as Error).message);
    }
  }
  return pollinationsUrl(prompt);
}

// ── Pollinations.ai (free, no key) ────────────────────────────────────────────

function pollinationsUrl(prompt: string): string {
  // Pollinations returns a permanent image URL — ideal for Instagram containers
  const encoded = encodeURIComponent(prompt.slice(0, 500));
  const seed = Math.floor(Math.random() * 100_000);
  return `https://image.pollinations.ai/prompt/${encoded}?seed=${seed}&width=1080&height=1080&nologo=true`;
}

// ── Stability AI ──────────────────────────────────────────────────────────────

async function stabilityAiGenerate(prompt: string): Promise<string> {
  const apiKey = process.env.STABILITY_AI_API_KEY!;

  const response = await fetch(
    'https://api.stability.ai/v2beta/stable-image/generate/core',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      body: (() => {
        const form = new FormData();
        form.append('prompt', prompt.slice(0, 500));
        form.append('output_format', 'png');
        form.append('aspect_ratio', '1:1');
        return form;
      })(),
    }
  );

  if (!response.ok) {
    throw new Error(`Stability AI error ${response.status}: ${await response.text()}`);
  }

  const json = (await response.json()) as { image: string; finish_reason: string };

  // Stability returns base64 — we must host it somewhere for Instagram.
  // Upload to a free ephemeral host (file.io) so we get a real URL.
  return await uploadBase64Image(json.image);
}

/** Upload a base64 PNG to file.io and return the download URL. */
async function uploadBase64Image(base64: string): Promise<string> {
  const bytes = Buffer.from(base64, 'base64');
  const blob  = new Blob([bytes], { type: 'image/png' });

  const form = new FormData();
  form.append('file', blob, 'image.png');

  const res = await fetch('https://file.io/?expires=1d', {
    method: 'POST',
    body: form,
  });

  if (!res.ok) throw new Error(`file.io upload failed: ${res.status}`);

  const json = (await res.json()) as { success: boolean; link: string };
  if (!json.success) throw new Error('file.io upload unsuccessful');

  return json.link;
}
