import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { TiktokenModel, TiktokenEncoding, get_encoding } from 'tiktoken';

interface ChunkingOptions {
  chunkSize?: number; // Max tokens per chunk
  chunkOverlap?: number; // Tokens overlapping between chunks
  modelName?: TiktokenModel; // Model to use for token counting
}

export class TextSplitter {
  private splitter: RecursiveCharacterTextSplitter;
  private encodingName: TiktokenEncoding; // Changed from string to TiktokenEncoding

  constructor(options: ChunkingOptions = {}) {
    const {
      chunkSize = 1024, // Default to 1024 tokens
      chunkOverlap = 256, // Default to 256 tokens overlap
      modelName = 'gpt-4o' as TiktokenModel, // Default to a common model
    } = options;

    // Map model names to tiktoken encoding names.
    const modelToEncoding: Record<string, TiktokenEncoding> = { // Changed value type to TiktokenEncoding
      'gpt-4o': 'cl100k_base',
      'gpt-4-turbo': 'cl100k_base',
      'gpt-4': 'cl100k_base',
      'gpt-3.5-turbo': 'cl100k_base',
      // Add other common model mappings if necessary
    };

    // Use the mapping or fallback to 'cl100k_base'
    this.encodingName = modelToEncoding[modelName as string] || 'cl100k_base';

    // Initialize the text splitter
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: chunkSize,
      chunkOverlap: chunkOverlap,
      // Use get_encoding to get the tokenizer and its length function
      lengthFunction: (str) => get_encoding(this.encodingName).encode(str).length,
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
    return get_encoding(this.encodingName).encode(text).length;
  }
}