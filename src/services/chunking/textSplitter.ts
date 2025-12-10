import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { TiktokenModel, TiktokenEncoding, get_encoding, Tiktoken } from 'tiktoken';

interface ChunkingOptions {
  chunkSize?: number; // Max tokens per chunk
  chunkOverlap?: number; // Tokens overlapping between chunks
  modelName?: TiktokenModel | string; // Model to use for token counting (flexible for non-OpenAI models)
}

export class TextSplitter {
  private splitter: RecursiveCharacterTextSplitter;
  private encodingName: TiktokenEncoding;
  private encoding: Tiktoken; // Cache the encoding instance

  constructor(options: ChunkingOptions = {}) {
    const {
      chunkSize = 1024, // Default to 1024 tokens
      chunkOverlap = 256, // Default to 256 tokens overlap
      modelName, // No default - we'll determine based on environment
    } = options;

    // Determine the model based on environment if not explicitly provided
    const effectiveModelName = modelName || this.getModelFromEnvironment();

    // Map model names to tiktoken encoding names
    const modelToEncoding: Record<string, TiktokenEncoding> = {
      // OpenAI models
      'gpt-4o': 'o200k_base',
      'gpt-4o-mini': 'o200k_base',
      'gpt-4-turbo': 'cl100k_base',
      'gpt-4': 'cl100k_base',
      'gpt-3.5-turbo': 'cl100k_base',
      'text-embedding-ada-002': 'cl100k_base',
      'text-embedding-3-small': 'cl100k_base',
      'text-embedding-3-large': 'cl100k_base',
      
      // Gemini models - use cl100k_base as a reasonable approximation
      // (Gemini uses its own tokenizer, but cl100k_base is a decent proxy)
      'text-embedding-004': 'cl100k_base',
      'gemini-pro': 'cl100k_base',
      'gemini': 'cl100k_base',
    };

    // Use the mapping or fallback to 'cl100k_base'
    this.encodingName = modelToEncoding[effectiveModelName as string] || 'cl100k_base';
    console.log(`TextSplitter using model "${effectiveModelName}" with encoding "${this.encodingName}"`);

    // Create and cache the encoding instance once
    this.encoding = get_encoding(this.encodingName);

    // Initialize the text splitter
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: chunkSize,
      chunkOverlap: chunkOverlap,
      // Use the cached encoding instance
      lengthFunction: (str) => this.encoding.encode(str).length,
      separators: ["\n\n", "\n", " ", ""], // Default separators
    });
  }

  /**
   * Determines which model/encoding to use based on environment variables
   */
  private getModelFromEnvironment(): string {
    const provider = process.env.LLM_PROVIDER;
    
    if (provider === 'gemini') {
      return process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004';
    }
    
    // Default to OpenAI
    return process.env.OPENAI_MODEL || 'gpt-4o';
  }

  async splitText(text: string): Promise<string[]> {
    if (!text) {
      return [];
    }
    const chunks = await this.splitter.splitText(text);
    return chunks;
  }

  // Method to get token count for a given text
  getTokenCount(text: string): number {
    return this.encoding.encode(text).length;
  }

  // Clean up the encoding when done (important to prevent memory leaks)
  free(): void {
    this.encoding.free();
  }
}