import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { TiktokenEncoding, get_encoding, Tiktoken } from 'tiktoken';

interface ChunkingOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  modelName?: string;
}

// Map model names to the nearest tiktoken encoding.
// Non-OpenAI models don't have a tiktoken encoding, but cl100k_base is a
// close-enough proxy for splitting purposes (we only care about rough token
// counts, not exact values from the target model's own tokenizer).
const MODEL_ENCODING_MAP: Record<string, TiktokenEncoding> = {
  // OpenAI
  'gpt-4o': 'o200k_base',
  'gpt-4o-mini': 'o200k_base',
  'gpt-4-turbo': 'cl100k_base',
  'gpt-4': 'cl100k_base',
  'gpt-3.5-turbo': 'cl100k_base',
  'text-embedding-ada-002': 'cl100k_base',
  'text-embedding-3-small': 'cl100k_base',
  'text-embedding-3-large': 'cl100k_base',

  // Gemini (approximated with cl100k_base)
  'gemini-embedding-001': 'cl100k_base',
  'text-embedding-004': 'cl100k_base',
  'gemini-pro': 'cl100k_base',

  // Voyage AI / Anthropic (approximated with cl100k_base)
  'voyage-3-large': 'cl100k_base',
  'voyage-3': 'cl100k_base',
  'voyage-3-lite': 'cl100k_base',
  'voyage-code-3': 'cl100k_base',
  'voyage-finance-2': 'cl100k_base',
  'voyage-law-2': 'cl100k_base',
};

function resolveModelFromEnv(): string {
  const provider = process.env.LLM_PROVIDER ?? 'openai';

  if (provider === 'gemini') {
    return process.env.GEMINI_EMBEDDING_MODEL ?? 'gemini-embedding-001';
  }

  if (provider === 'voyage' || provider === 'anthropic') {
    return process.env.VOYAGE_EMBEDDING_MODEL ?? 'voyage-3';
  }

  // openai
  return process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';
}

export class TextSplitter {
  private splitter: RecursiveCharacterTextSplitter;
  private encoding: Tiktoken;

  constructor(options: ChunkingOptions = {}) {
    const {
      chunkSize = 1024,
      chunkOverlap = 256,
      modelName,
    } = options;

    const effectiveModel = modelName ?? resolveModelFromEnv();
    const encodingName: TiktokenEncoding = MODEL_ENCODING_MAP[effectiveModel] ?? 'cl100k_base';

    console.log(`TextSplitter: model="${effectiveModel}" encoding="${encodingName}"`);

    this.encoding = get_encoding(encodingName);

    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
      lengthFunction: str => this.encoding.encode(str).length,
      separators: ['\n\n', '\n', ' ', ''],
    });
  }

  async splitText(text: string): Promise<string[]> {
    if (!text) return [];
    return this.splitter.splitText(text);
  }

  getTokenCount(text: string): number {
    return this.encoding.encode(text).length;
  }

  free(): void {
    this.encoding.free();
  }
}
