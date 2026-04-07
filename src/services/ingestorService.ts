import { createHash } from 'crypto';
import path from 'path';
import { WebCrawler } from './ingestion/webCrawler.js';
import { DocumentParser } from './ingestion/documentParser.js';
import { RSSParser } from './ingestion/rssParser.js';
import { DatabaseService, BatchChunk } from './storage/database.js';
import { TextSplitter } from './chunking/textSplitter.js';
import createEmbeddings, { Embeddings } from '../lib/llm.js';
import { QdrantService } from './storage/qdrantService.js';

export interface IngestionResult {
  ingestedCount: number;
  skippedCount: number;
  chunkIds: string[];
}

export interface SearchResult {
  score: number;
  id: string;
  text: string;
  source: string;
  metadata: Record<string, any>;
}

function generateHash(source: string, content: string): string {
  return createHash('sha256').update(`${source}:${content}`).digest('hex');
}

function hashToUUID(hash: string): string {
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

function normalizeUrl(raw: string): string {
  let url = (raw || '').toString().trim();
  // Strip surrounding quotes and BOM/zero-width chars
  url = url.replace(/^["'\uFEFF\u200B\u200C\u200D]+|["'\uFEFF\u200B\u200C\u200D]+$/g, '');
  // Collapse spaces
  url = url.replace(/\s+/g, '%20');

  const isValid = (s: string) => {
    try {
      const p = new URL(s);
      return p.protocol === 'http:' || p.protocol === 'https:';
    } catch {
      return false;
    }
  };

  if (!isValid(url)) {
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
      const withHttps = `https://${url}`;
      if (isValid(withHttps)) return withHttps;
    }
    throw new Error(
      `Invalid URL — expected http:// or https:// protocol. Received: ${raw}`
    );
  }
  return url;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  baseDelayMs = 1000,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

export class IngestorService {
  private documentParser: DocumentParser;
  private databaseService: DatabaseService;
  private textSplitter: TextSplitter;
  private embeddings: Embeddings;
  private qdrantService: QdrantService;
  private isInitialized = false;
  private readonly defaultMaxDepth = 2;
  private readonly defaultRateLimitMs = 500;
  private readonly embeddingBatchSize: number;
  private readonly embeddingInterBatchDelayMs: number;

  constructor() {
    this.documentParser = new DocumentParser();
    this.databaseService = new DatabaseService();
    this.textSplitter = new TextSplitter();
    this.embeddings = createEmbeddings();
    this.qdrantService = new QdrantService();
    this.embeddingBatchSize = parseInt(process.env.EMBEDDING_BATCH_SIZE || '100', 10);
    this.embeddingInterBatchDelayMs = parseInt(process.env.EMBEDDING_INTER_BATCH_DELAY_MS || '200', 10);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    await this.databaseService.initialize();
    await this.qdrantService.initialize();
    this.isInitialized = true;
    console.log('IngestorService initialized.');
  }

  // ---------------------------------------------------------------------------
  // Core batch ingestion engine
  // ---------------------------------------------------------------------------

  private async batchIngestChunks(
    rawChunks: Array<{ content: string; source: string; type: string; metadata: any }>,
    options: { refresh?: boolean } = {}
  ): Promise<IngestionResult> {
    if (rawChunks.length === 0) {
      return { ingestedCount: 0, skippedCount: 0, chunkIds: [] };
    }

    // 1. Compute hashes; in refresh mode skip dedup check (old chunks already deleted)
    const withHashes = rawChunks.map(chunk => ({
      ...chunk,
      hash: generateHash(chunk.source, chunk.content),
    }));

    let newChunks = withHashes;
    let skippedCount = 0;

    if (!options.refresh) {
      const allHashes = withHashes.map(c => c.hash);
      const existingHashes = this.databaseService.batchHashExists(allHashes);
      newChunks = withHashes.filter(c => !existingHashes.has(c.hash));
      skippedCount = withHashes.length - newChunks.length;
    }

    if (newChunks.length === 0) {
      console.log(`All ${rawChunks.length} chunks already exist in the database, skipping.`);
      return { ingestedCount: 0, skippedCount: rawChunks.length, chunkIds: [] };
    }

    console.log(`Embedding ${newChunks.length} new chunk(s) (${skippedCount} duplicate(s) skipped)...`);

    // 2. Batch embed with retry + inter-batch delay
    const allEmbeddings: number[][] = [];
    const totalBatches = Math.ceil(newChunks.length / this.embeddingBatchSize);
    for (let i = 0; i < newChunks.length; i += this.embeddingBatchSize) {
      const batch = newChunks.slice(i, i + this.embeddingBatchSize);
      const batchNum = Math.floor(i / this.embeddingBatchSize) + 1;
      try {
        const embeddings = await withRetry(
          () => this.embeddings.embedDocuments(batch.map(c => c.content)),
          3,
          1000,
        );
        allEmbeddings.push(...embeddings);
      } catch (err: any) {
        console.warn(
          `Embedding batch ${batchNum}/${totalBatches} failed after retries: ${err?.message ?? err}. Skipping ${batch.length} chunk(s).`
        );
        // Push sentinel zeros so array indices stay aligned; these won't be stored
        allEmbeddings.push(...batch.map(() => null as unknown as number[]));
      }
      if (i + this.embeddingBatchSize < newChunks.length && this.embeddingInterBatchDelayMs > 0) {
        await new Promise(r => setTimeout(r, this.embeddingInterBatchDelayMs));
      }
    }

    // 3. Filter out chunks where embedding failed, build batch records
    const validPairs = newChunks
      .map((chunk, i) => ({ chunk, embedding: allEmbeddings[i] }))
      .filter(p => p.embedding !== null);

    const dbChunks: BatchChunk[] = validPairs.map(({ chunk }) => ({
      chunkId: hashToUUID(chunk.hash),
      source: chunk.source,
      type: chunk.type,
      content: chunk.content,
      metadata: chunk.metadata,
      contentHash: chunk.hash,
    }));

    // 4. Batch save to SQLite (single transaction)
    const savedCount = this.databaseService.saveDocumentBatch(dbChunks);

    // 5. Batch upsert to Qdrant
    await this.qdrantService.batchAddChunks(
      dbChunks.map((chunk, i) => ({
        id: chunk.chunkId,
        text: chunk.content ?? '',
        embedding: validPairs[i].embedding,
        metadata: {
          source: chunk.source,
          type: chunk.type,
          ...chunk.metadata,
        },
      }))
    );

    const chunkIds = dbChunks.map(c => c.chunkId);
    console.log(`Ingestion complete: ${savedCount} saved, ${skippedCount} skipped.`);
    return { ingestedCount: savedCount, skippedCount, chunkIds };
  }

  // ---------------------------------------------------------------------------
  // Public ingestion methods
  // ---------------------------------------------------------------------------

  async ingestUrl(
    url: string,
    options?: { maxDepth?: number; useSitemap?: boolean; refresh?: boolean }
  ): Promise<IngestionResult> {
    await this.initialize();

    const normalizedUrl = normalizeUrl(url);

    const crawler = new WebCrawler({
      maxDepth: options?.maxDepth ?? this.defaultMaxDepth,
      baseUrl: normalizedUrl,
      rateLimitMs: this.defaultRateLimitMs,
      respectRobotsTxt: false,
      useSitemap: options?.useSitemap ?? false,
    });

    console.log(`Starting web crawl from: ${normalizedUrl}`);
    const crawledPages = await crawler.start(normalizedUrl);
    console.log(`Crawled ${crawledPages.size} page(s).`);

    const rawChunks: Array<{ content: string; source: string; type: string; metadata: any }> = [];

    for (const [pageUrl, pageData] of crawledPages) {
      if (!pageData.content) continue;

      // In refresh mode, delete stale chunks for this page before re-ingesting
      if (options?.refresh) {
        const deleted = await this.databaseService.deleteByOriginalUrl(pageUrl);
        if (deleted.count > 0) {
          if (deleted.chunkIds.length > 0) await this.qdrantService.deleteChunks(deleted.chunkIds);
          console.log(`Refresh: removed ${deleted.count} stale chunk(s) for ${pageUrl}`);
        }
      }

      const chunks = await this.textSplitter.splitText(pageData.content);
      for (let i = 0; i < chunks.length; i++) {
        rawChunks.push({
          content: chunks[i],
          source: pageData.title || pageUrl,
          type: 'webpage_chunk',
          metadata: {
            originalUrl: pageUrl,
            title: pageData.title,
            chunkIndex: i,
            totalChunks: chunks.length,
          },
        });
      }
    }

    return this.batchIngestChunks(rawChunks, { refresh: options?.refresh });
  }

  async ingestFile(filePath: string): Promise<IngestionResult> {
    await this.initialize();

    const absolutePath = path.resolve(filePath);
    const parsedDoc = await this.documentParser.parse(absolutePath);

    if (!parsedDoc?.content) {
      console.warn(`No content extracted from file: ${filePath}`);
      return { ingestedCount: 0, skippedCount: 0, chunkIds: [] };
    }

    const chunks = await this.textSplitter.splitText(parsedDoc.content);
    const rawChunks = chunks.map((chunk, i) => ({
      content: chunk,
      source: parsedDoc.metadata.source,
      type: `${parsedDoc.metadata.type}_chunk`,
      metadata: {
        ...parsedDoc.metadata,
        chunkIndex: i,
        totalChunks: chunks.length,
      },
    }));

    return this.batchIngestChunks(rawChunks);
  }

  async ingestRss(feedUrl: string): Promise<IngestionResult> {
    await this.initialize();

    const rssParser = new RSSParser();
    console.log(`Fetching RSS feed: ${feedUrl}`);
    const feed = await rssParser.parse(feedUrl);
    console.log(`Parsed ${feed.items.length} item(s) from feed: ${feed.title}`);

    const rawChunks: Array<{ content: string; source: string; type: string; metadata: any }> = [];

    for (const item of feed.items) {
      const fullText = [item.title, item.content].filter(Boolean).join('\n\n');
      if (!fullText.trim()) continue;

      const chunks = await this.textSplitter.splitText(fullText);
      for (let i = 0; i < chunks.length; i++) {
        rawChunks.push({
          content: chunks[i],
          source: item.link || feedUrl,
          type: 'rss_chunk',
          metadata: {
            feedUrl,
            feedTitle: feed.title,
            articleTitle: item.title,
            link: item.link,
            pubDate: item.pubDate,
            author: item.author,
            categories: item.categories,
            chunkIndex: i,
            totalChunks: chunks.length,
          },
        });
      }
    }

    return this.batchIngestChunks(rawChunks);
  }

  // ---------------------------------------------------------------------------
  // Retrieval and search
  // ---------------------------------------------------------------------------

  async searchSimilar(query: string, limit = 5): Promise<SearchResult[]> {
    await this.initialize();

    const queryEmbedding = await this.embeddings.embedQuery(query);
    const results = await this.qdrantService.search(queryEmbedding, limit);

    return results.map(r => ({
      score: r.score,
      id: String(r.id),
      text: String(r.payload?.text ?? ''),
      source: String(r.payload?.source ?? ''),
      metadata: (r.payload as Record<string, any>) ?? {},
    }));
  }

  async getDocument(id: number): Promise<any | null> {
    await this.initialize();
    return this.databaseService.getDocumentById(id);
  }

  async getAllDocuments(limit?: number, offset?: number): Promise<any[]> {
    await this.initialize();
    return this.databaseService.getAllDocuments(limit, offset);
  }

  async getDocumentCount(): Promise<number> {
    await this.initialize();
    return this.databaseService.getDocumentCount();
  }

  // ---------------------------------------------------------------------------
  // Deletion
  // ---------------------------------------------------------------------------

  async deleteDocument(id: number): Promise<boolean> {
    await this.initialize();
    const result = await this.databaseService.deleteDocument(id);
    if (result.chunkId) {
      await this.qdrantService.deleteChunk(result.chunkId);
    }
    return result.deleted;
  }

  async deleteBySource(source: string): Promise<{ count: number }> {
    await this.initialize();
    const result = await this.databaseService.deleteBySource(source);
    if (result.chunkIds.length > 0) {
      await this.qdrantService.deleteChunks(result.chunkIds);
    }
    return { count: result.count };
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  async close(): Promise<void> {
    await this.databaseService.close();
    this.textSplitter.free();
  }
}
