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
  // Use the recommended model for embeddings
  private model: string; 

  // Default to the recommended model for embeddings
  constructor(apiKey: string, model = 'text-embedding-004') {
    this.apiKey = apiKey;
    this.model = model;
  }

  private async requestEmbeddings(texts: string[]) {
    if (!this.apiKey) {
      throw new Error('GOOGLE_API_KEY is required for Gemini embeddings.');
    }

    // Correct URL structure for the Generative Language API's batchEmbedContents endpoint
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:batchEmbedContents?key=${this.apiKey}`;
    
    try {
      const resp = await axios.post(
        url,
        {
          // The Gemini API batchEmbedContents expects a list of requests, 
          // where each request has the model name and the content to embed.
          requests: texts.map(text => ({
            model: `models/${this.model}`, // The model must be prefixed with 'models/'
            content: { parts: [{ text }] }
          }))
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      return resp.data;
    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || error.message;
      // Log more specific details if available
      console.error('Gemini API Error:', error.response?.data || error.message);
      throw new Error(`Gemini embeddings failed: ${errorMsg}`);
    }
  }

  async embedDocuments(texts: string[]) {
    const result = await this.requestEmbeddings(texts);
    
    // Check for the expected array of embeddings in the response
    if (Array.isArray(result?.embeddings)) {
      // The Gemini API response provides 'values' inside each embedding object
      return result.embeddings.map((item: any) => item.values);
    }

    throw new Error('Could not parse Gemini embeddings response: ' + JSON.stringify(result));
  }

  async embedQuery(text: string) {
    const r = await this.embedDocuments([text]);
    return r[0];
  }
}

// ... The rest of your code remains the same
export function createEmbeddings(options: LLMOptions = {}): Embeddings {
  const provider = options.provider || (process.env.LLM_PROVIDER as LLMProvider) || 'openai';

  if (provider === 'openai') {
    const apiKey = options.apiKey || process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '';
    if (!apiKey) throw new Error('OPENAI_API_KEY or LLM_API_KEY is required for OpenAI provider');
    return new OpenAIWrapper(apiKey);
  }

  if (provider === 'gemini') {
    const apiKey = options.apiKey || process.env.GOOGLE_API_KEY || process.env.LLM_API_KEY || '';
    const model = process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004';

    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY or LLM_API_KEY is required for Gemini embeddings. Get one at: https://aistudio.google.com/app/apikey');
    }

    return new GeminiWrapper(apiKey, model);
  }

  throw new Error(`Unsupported LLM provider: ${provider}`);
}

export default createEmbeddings;