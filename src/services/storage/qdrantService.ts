import { QdrantClient } from '@qdrant/js-client-rest';

export interface QdrantChunk {
  id: string;
  text: string;
  embedding: number[];
  metadata?: Record<string, any>;
}

export class QdrantService {
  private client: QdrantClient;
  private collectionName: string;
  private vectorSize: number;
  private enabled: boolean;

  constructor() {
    const enabledFlag = process.env.QDRANT_ENABLED ?? 'true';
    this.enabled = String(enabledFlag).toLowerCase() !== 'false';

    this.collectionName = process.env.QDRANT_COLLECTION_NAME || 'megamind';
    this.vectorSize = parseInt(process.env.EMBEDDING_VECTOR_SIZE || '1536', 10);

    if (!this.enabled) {
      console.log('Qdrant disabled via QDRANT_ENABLED=false.');
      this.client = {} as any;
      return;
    }

    const qdrantHost = process.env.QDRANT_HOST;
    const qdrantKey = process.env.QDRANT_KEY;

    if (!qdrantHost) throw new Error('QDRANT_HOST environment variable is not set.');
    if (!qdrantKey) throw new Error('QDRANT_KEY environment variable is not set.');

    this.client = new QdrantClient({ url: qdrantHost, apiKey: qdrantKey });
  }

  async initialize(): Promise<void> {
    if (!this.enabled) return;

    try {
      const collectionsResponse = await this.client.getCollections();
      const exists = collectionsResponse.collections.some(c => c.name === this.collectionName);

      if (!exists) {
        console.log(`Creating Qdrant collection: ${this.collectionName}`);
        await this.client.createCollection(this.collectionName, {
          vectors: { size: this.vectorSize, distance: 'Cosine' },
        });
        console.log(`Collection '${this.collectionName}' created.`);
      } else {
        console.log(`Qdrant collection '${this.collectionName}' already exists.`);
      }
    } catch (error: any) {
      console.warn('getCollections failed, attempting direct create:', error?.message ?? error);
      await this.tryCreateWithFallback();
    }
  }

  private async tryCreateWithFallback(): Promise<void> {
    const qdrantKey = process.env.QDRANT_KEY;
    const originalHost = process.env.QDRANT_HOST || '';

    const tryCreate = async (client: QdrantClient): Promise<boolean> => {
      try {
        await client.createCollection(this.collectionName, {
          vectors: { size: this.vectorSize, distance: 'Cosine' },
        });
        console.log(`Collection '${this.collectionName}' created via fallback.`);
        return true;
      } catch {
        return false;
      }
    };

    if (await tryCreate(this.client)) return;

    // Try host variants (strip port, force https)
    const candidates: string[] = [];
    try {
      const parsed = new URL(originalHost);
      parsed.port = '';
      candidates.push(parsed.toString().replace(/\/$/, ''));
      parsed.protocol = 'https:';
      candidates.push(parsed.toString().replace(/\/$/, ''));
    } catch {
      if (originalHost) candidates.push(originalHost.replace(/:\d+/, ''));
    }

    for (const candidate of candidates) {
      if (!candidate || candidate === originalHost) continue;
      const altClient = new QdrantClient({ url: candidate, apiKey: qdrantKey as string });
      if (await tryCreate(altClient)) {
        this.client = altClient;
        console.log(`Switched Qdrant host to '${candidate}'.`);
        return;
      }
    }

    throw new Error('Could not initialize Qdrant collection after all fallback attempts.');
  }

  async batchAddChunks(chunks: QdrantChunk[]): Promise<void> {
    if (!this.enabled || chunks.length === 0) return;

    await this.client.upsert(this.collectionName, {
      wait: true,
      points: chunks.map(chunk => ({
        id: chunk.id,
        vector: chunk.embedding,
        payload: {
          text: chunk.text,
          source: chunk.metadata?.source ?? '',
          type: chunk.metadata?.type ?? '',
          ...chunk.metadata,
        },
      })),
    });
    console.log(`Upserted ${chunks.length} chunks to Qdrant collection '${this.collectionName}'.`);
  }

  async addChunk(id: string, chunkText: string, embedding: number[], metadata?: Record<string, any>): Promise<void> {
    if (!this.enabled) return;
    await this.batchAddChunks([{ id, text: chunkText, embedding, metadata }]);
  }

  async deleteChunk(id: string): Promise<void> {
    if (!this.enabled) return;
    try {
      await this.client.delete(this.collectionName, { wait: true, points: [id] });
    } catch (error: any) {
      console.error(`Error deleting chunk ${id} from Qdrant: ${error.message}`);
    }
  }

  async deleteChunks(ids: string[]): Promise<void> {
    if (!this.enabled || ids.length === 0) return;
    try {
      await this.client.delete(this.collectionName, { wait: true, points: ids });
      console.log(`Deleted ${ids.length} chunks from Qdrant.`);
    } catch (error: any) {
      console.error(`Error deleting chunks from Qdrant: ${error.message}`);
    }
  }

  async search(queryEmbedding: number[], limit = 5): Promise<any[]> {
    if (!this.enabled) return [];
    try {
      return await this.client.search(this.collectionName, {
        vector: queryEmbedding,
        limit,
        with_payload: true,
      });
    } catch (error: any) {
      console.error('Error searching Qdrant:', error.message);
      throw error;
    }
  }
}
