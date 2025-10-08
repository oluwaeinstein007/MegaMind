import { QdrantClient } from '@qdrant/js-client-rest';
import { TextSplitter } from '../chunking/textSplitter.js';

interface QdrantOptions {
  url?: string; // Qdrant instance URL
  collectionName?: string; // Name of the collection to use
  vectorSize?: number; // Size of the vectors (e.g., embedding dimension)
  // Add other Qdrant client options as needed
}

export class QdrantService {

  private client: QdrantClient;
  private collectionName: string;
  private vectorSize: number;
  private textSplitter: TextSplitter;

  constructor(options: QdrantOptions = {}) {
    const {
      url = 'http://localhost:6333', // Default Qdrant URL
      collectionName = 'documents', // Default collection name
      vectorSize = 1536, // Default vector size for OpenAI's text-embedding-ada-002
    } = options;

    this.client = new QdrantClient({ url });
    this.collectionName = collectionName;
    this.vectorSize = vectorSize;
    this.textSplitter = new TextSplitter();
  }

  async initialize(): Promise<void> {
    try {
      // Check if collection exists, create if not
      const collectionsResponse = await this.client.getCollections();
      const collectionExists = collectionsResponse.collections.some(
        (col) => col.name === this.collectionName
      );

      if (!collectionExists) {
        console.log(`Creating Qdrant collection: ${this.collectionName}`);
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: this.vectorSize,
            distance: 'Cosine', // Or 'Euclid', 'Dot'
          },
        });
        console.log(`Collection '${this.collectionName}' created.`);
      } else {
        console.log(`Qdrant collection '${this.collectionName}' already exists.`);
      }
    } catch (error: any) {
      console.error('Error initializing Qdrant client or collection:', error.message);
      throw error;
    }
  }

  // Method to add a document chunk with its embedding to Qdrant
  async addChunk(id: string, chunkText: string, embedding: number[]): Promise<void> {
    try {
      await this.client.upsert(this.collectionName, {
        wait: true,
        points: [
          {
            id: id,
            vector: embedding,
            payload: {
              text: chunkText,
            },
          },
        ],
      });
      console.log(`Chunk added to Qdrant: ${id}`);
    } catch (error: any) {
      console.error(`Error adding chunk ${id} to Qdrant: ${error.message}`);
      throw error;
    }
  }

  // Method to search for similar chunks
  async search(queryEmbedding: number[], limit: number = 3): Promise<any[]> {
    try {
      const searchResult = await this.client.search(this.collectionName, {
        vector: queryEmbedding,
        limit: limit,
        with_payload: true,
      });
      return searchResult;
    } catch (error: any) {
      console.error('Error searching Qdrant:', error.message);
      throw error;
    }
  }
}