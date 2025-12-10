import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { TiktokenModel, TiktokenEncoding, get_encoding, Tiktoken } from 'tiktoken';

interface ChunkingOptions {
  chunkSize?: number; // Max tokens per chunk
  chunkOverlap?: number; // Tokens overlapping between chunks
  modelName?: TiktokenModel; // Model to use for token counting
}

export class TextSplitter {
  private splitter: RecursiveCharacterTextSplitter;
  private encodingName: TiktokenEncoding;
  private encoding: Tiktoken; // Cache the encoding instance

  constructor(options: ChunkingOptions = {}) {
    const {
      chunkSize = 1024, // Default to 1024 tokens
      chunkOverlap = 256, // Default to 256 tokens overlap
      modelName = 'gpt-4o' as TiktokenModel, // Default to a common model
    } = options;

    // Map model names to tiktoken encoding names
    const modelToEncoding: Record<string, TiktokenEncoding> = {
      'gpt-4o': 'o200k_base', // gpt-4o uses o200k_base, not cl100k_base
      'gpt-4-turbo': 'cl100k_base',
      'gpt-4': 'cl100k_base',
      'gpt-3.5-turbo': 'cl100k_base',
      // Add other common model mappings if necessary
    };

    // Use the mapping or fallback to 'cl100k_base'
    this.encodingName = modelToEncoding[modelName as string] || 'cl100k_base';

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