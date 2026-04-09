/**
 * Image generation — Stability AI (primary) with Pollinations.ai fallback.
 *
 * Returns a publicly accessible image URL suitable for Instagram posts.
 */

/**
 * Generate a travel image from a text prompt.
 * Falls back to Pollinations.ai (free, no key required) if Stability AI is not configured.
 */
export async function generateImage(prompt: string): Promise<string> {
  const stabilityKey = process.env.STABILITY_AI_API_KEY;

  if (stabilityKey) {
    return generateWithStabilityAI(prompt, stabilityKey);
  }

  return generateWithPollinations(prompt);
}

async function generateWithStabilityAI(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      text_prompts: [{ text: prompt, weight: 1 }],
      cfg_scale: 7,
      height: 1024,
      width: 1024,
      steps: 30,
      samples: 1,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Stability AI error ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json() as { artifacts: Array<{ base64: string }> };
  const base64 = data.artifacts?.[0]?.base64;
  if (!base64) throw new Error('Stability AI returned no image');

  // Return a data URL — callers that need a public URL should upload this
  return `data:image/png;base64,${base64}`;
}

function generateWithPollinations(prompt: string): string {
  // Pollinations.ai returns a stable image URL directly (no API key needed)
  const encoded = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true`;
}
