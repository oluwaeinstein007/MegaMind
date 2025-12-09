import axios from 'axios';
import { OpenAIEmbeddings } from '@langchain/openai';

export type LLMProvider = 'openai' | 'gemini';

export interface LLMOptions {
  provider?: LLMProvider;
  apiKey?: string;
}

export type Embeddings = {
  embedDocuments(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
};

class OpenAIWrapper implements Embeddings {
  private client: any;
  constructor(apiKey: string) {
    this.client = new OpenAIEmbeddings({ apiKey });
  }

  async embedDocuments(texts: string[]) {
    return await this.client.embedDocuments(texts);
  }
  async embedQuery(text: string) {
    const r = await this.client.embedQuery(text);
    return r;
  }
}

class GeminiWrapper implements Embeddings {
  private apiKey: string;
  private projectId?: string;
  private location: string;
  private model: string;

  constructor(apiKey: string, projectId?: string, location = 'us-central1', model = 'textembedding-gecko') {
    this.apiKey = apiKey;
    this.projectId = projectId;
    this.location = location;
    this.model = model;
  }

  // NOTE: Vertex AI endpoints and auth can differ by setup. This implementation
  // expects the environment to supply either an API key or application-default
  // credentials. If you use service account keys, set up ADC or provide a
  // proper bearer token. This wrapper attempts a simple REST call using an API
  // key if present; otherwise it throws with instructions.
  private async requestEmbeddings(texts: string[]) {
    if (!this.projectId) {
      throw new Error('GEMINI requires GOOGLE_PROJECT_ID to be set in the environment.');
    }

    const url = `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/models/${this.model}:embedText`;

    if (this.apiKey) {
      const resp = await axios.post(`${url}?key=${this.apiKey}`, { instances: texts.map(t => ({ content: t })) });
      return resp.data;
    }

    throw new Error('No GOOGLE_API_KEY provided for Gemini embeddings. Configure GOOGLE_API_KEY or ADC.');
  }

  async embedDocuments(texts: string[]) {
    const result = await this.requestEmbeddings(texts);
    // Attempt to extract embeddings from common response shapes.
    if (Array.isArray(result?.predictions)) {
      return result.predictions.map((p: any) => p.embedding ?? p[0]?.embedding ?? p);
    }
    if (Array.isArray(result?.data?.embeddings)) {
      return result.data.embeddings.map((e: any) => e.embedding ?? e);
    }
    throw new Error('Could not parse Gemini embeddings response.');
  }
  async embedQuery(text: string) {
    const r = await this.embedDocuments([text]);
    return r[0];
  }
}

export function createEmbeddings(options: LLMOptions = {}): Embeddings {
  const provider = options.provider || (process.env.LLM_PROVIDER as LLMProvider) || 'openai';
  const apiKey = options.apiKey || process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '';

  if (provider === 'openai') {
    if (!apiKey) throw new Error('OPENAI/LLM_API_KEY is required for OpenAI provider');
    return new OpenAIWrapper(apiKey);
  }

  if (provider === 'gemini') {
    const projectId = process.env.GOOGLE_PROJECT_ID;
    const location = process.env.GOOGLE_LOCATION || 'us-central1';
    const model = process.env.GEMINI_EMBEDDING_MODEL || 'textembedding-gecko';
    if (!apiKey && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      throw new Error('To use Gemini embeddings set GOOGLE_API_KEY or configure application default credentials (GOOGLE_APPLICATION_CREDENTIALS)');
    }
    return new GeminiWrapper(apiKey, projectId, location, model);
  }

  throw new Error(`Unsupported LLM provider: ${provider}`);
}

export default createEmbeddings;
