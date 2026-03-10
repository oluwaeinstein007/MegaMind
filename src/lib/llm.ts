import axios from 'axios';
import { OpenAIEmbeddings } from '@langchain/openai';

export type LLMProvider = 'openai' | 'gemini' | 'voyage' | 'anthropic';

export interface LLMOptions {
  provider?: LLMProvider;
  apiKey?: string;
}

export type Embeddings = {
  embedDocuments(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
};

// ---------------------------------------------------------------------------
// OpenAI
// ---------------------------------------------------------------------------

class OpenAIWrapper implements Embeddings {
  private client: OpenAIEmbeddings;

  constructor(apiKey: string) {
    this.client = new OpenAIEmbeddings({ apiKey });
  }

  async embedDocuments(texts: string[]) {
    return this.client.embedDocuments(texts);
  }

  async embedQuery(text: string) {
    return this.client.embedQuery(text);
  }
}

// ---------------------------------------------------------------------------
// Google Gemini (Generative Language API — batchEmbedContents)
// ---------------------------------------------------------------------------

class GeminiWrapper implements Embeddings {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'gemini-embedding-001') {
    this.apiKey = apiKey;
    this.model = model;
  }

  private async requestEmbeddings(texts: string[]): Promise<number[][]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:batchEmbedContents?key=${this.apiKey}`;

    try {
      const resp = await axios.post(
        url,
        {
          requests: texts.map(text => ({
            model: `models/${this.model}`,
            content: { parts: [{ text }] },
          })),
        },
        { headers: { 'Content-Type': 'application/json' } }
      );

      const data = resp.data;
      if (Array.isArray(data?.embeddings)) {
        return data.embeddings.map((item: any) => item.values as number[]);
      }
      throw new Error('Unexpected Gemini response shape: ' + JSON.stringify(data));
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || error.message;
      throw new Error(`Gemini embeddings failed: ${msg}`);
    }
  }

  async embedDocuments(texts: string[]) {
    return this.requestEmbeddings(texts);
  }

  async embedQuery(text: string) {
    const results = await this.requestEmbeddings([text]);
    return results[0];
  }
}

// ---------------------------------------------------------------------------
// Voyage AI  (Anthropic-ecosystem embeddings — https://www.voyageai.com)
// Use LLM_PROVIDER=voyage  OR  LLM_PROVIDER=anthropic (alias)
// API key: VOYAGE_API_KEY  (or ANTHROPIC_API_KEY as fallback)
//
// Models & dimensions:
//   voyage-3-large      → 1024
//   voyage-3            → 1024
//   voyage-3-lite       → 512
//   voyage-code-3       → 1024
//   voyage-finance-2    → 1024
//   voyage-law-2        → 1024
// ---------------------------------------------------------------------------

class VoyageWrapper implements Embeddings {
  private apiKey: string;
  private model: string;
  private readonly baseUrl = 'https://api.voyageai.com/v1/embeddings';

  constructor(apiKey: string, model = 'voyage-3') {
    this.apiKey = apiKey;
    this.model = model;
  }

  private async requestEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const resp = await axios.post(
        this.baseUrl,
        { model: this.model, input: texts },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = resp.data;
      if (Array.isArray(data?.data)) {
        // Sort by index to preserve input order
        const sorted = [...data.data].sort((a: any, b: any) => a.index - b.index);
        return sorted.map((item: any) => item.embedding as number[]);
      }
      throw new Error('Unexpected Voyage AI response shape: ' + JSON.stringify(data));
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.response?.data?.message || error.message;
      throw new Error(`Voyage AI embeddings failed: ${msg}`);
    }
  }

  async embedDocuments(texts: string[]) {
    return this.requestEmbeddings(texts);
  }

  async embedQuery(text: string) {
    const results = await this.requestEmbeddings([text]);
    return results[0];
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createEmbeddings(options: LLMOptions = {}): Embeddings {
  // 'anthropic' is an accepted alias for 'voyage'
  const rawProvider = options.provider ?? (process.env.LLM_PROVIDER as LLMProvider) ?? 'openai';
  const provider: LLMProvider = rawProvider === 'anthropic' ? 'voyage' : rawProvider;

  switch (provider) {
    case 'openai': {
      const apiKey = options.apiKey ?? process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? '';
      if (!apiKey) throw new Error('Set OPENAI_API_KEY or LLM_API_KEY for the OpenAI provider.');
      return new OpenAIWrapper(apiKey);
    }

    case 'gemini': {
      const apiKey = options.apiKey ?? process.env.GOOGLE_API_KEY ?? process.env.LLM_API_KEY ?? '';
      if (!apiKey)
        throw new Error(
          'Set GOOGLE_API_KEY or LLM_API_KEY for the Gemini provider. ' +
            'Get one at https://aistudio.google.com/app/apikey'
        );
      const model = process.env.GEMINI_EMBEDDING_MODEL ?? 'gemini-embedding-001';
      return new GeminiWrapper(apiKey, model);
    }

    case 'voyage': {
      const apiKey =
        options.apiKey ??
        process.env.VOYAGE_API_KEY ??
        process.env.ANTHROPIC_API_KEY ??
        process.env.LLM_API_KEY ??
        '';
      if (!apiKey)
        throw new Error(
          'Set VOYAGE_API_KEY (or ANTHROPIC_API_KEY / LLM_API_KEY) for the Voyage AI provider. ' +
            'Get one at https://www.voyageai.com'
        );
      const model = process.env.VOYAGE_EMBEDDING_MODEL ?? 'voyage-3';
      return new VoyageWrapper(apiKey, model);
    }

    default:
      throw new Error(
        `Unsupported LLM_PROVIDER: "${rawProvider}". Valid values: openai, gemini, voyage, anthropic.`
      );
  }
}

export default createEmbeddings;
