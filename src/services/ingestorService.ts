import { WebCrawler, CrawledPage } from './ingestion/webCrawler.js';
import { DocumentParser } from './ingestion/documentParser.js';
import { DatabaseService } from './storage/database.js';
import path from 'path';
import { TextSplitter } from './chunking/textSplitter.js'; // Import TextSplitter
import createEmbeddings from '../lib/llm.js';
import { QdrantService } from './storage/qdrantService.js'; // Import QdrantService

export class IngestorService {
  private webCrawler: WebCrawler | null = null;
  private documentParser: DocumentParser;
  private databaseService: DatabaseService;
  private textSplitter: TextSplitter; // Add TextSplitter instance
  private embeddings: any; // Add embeddings instance (LLM-agnostic wrapper)
  private qdrantService: QdrantService; // Add QdrantService instance
  private isInitialized: boolean = false; // Track initialization status
  private defaultMaxDepth = 2;
  private defaultRateLimitMs = 500;

  constructor() {
    // Initialize services with default configurations
    // Do not create WebCrawler here because it requires a valid baseUrl.
    // We'll instantiate it per-ingest when a real URL is provided.
    this.documentParser = new DocumentParser();
    this.databaseService = new DatabaseService();
    this.textSplitter = new TextSplitter(); // Initialize TextSplitter
    this.embeddings = createEmbeddings(); // Create provider-specific embeddings implementation
    this.qdrantService = new QdrantService(); // Initialize QdrantService
  }

  // Initialize the service, including the database and Qdrant collection
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return; // Already initialized
    }
    await this.databaseService.initialize();
    await this.qdrantService.initialize(); // Initialize Qdrant
    this.isInitialized = true;
    console.log('IngestorService initialized.');
  }

  async ingestUrl(url: string): Promise<string[]> {
    await this.initialize(); // Ensure initialization

    // Normalize and validate the provided URL. Trim whitespace and ensure it has a protocol.
    let normalizedUrl = url.trim();
    try {
      new URL(normalizedUrl);
    } catch (e) {
      // If missing protocol, try prefixing https://
      if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(normalizedUrl)) {
        normalizedUrl = `https://${normalizedUrl}`;
        try {
          new URL(normalizedUrl);
        } catch (err) {
          throw new Error(`The \`url\` param expected to contain a valid URL starting with a protocol (http:// or https://). Received: ${url}`);
        }
      } else {
        throw new Error(`The \`url\` param expected to contain a valid URL starting with a protocol (http:// or https://). Received: ${url}`);
      }
    }

    // (Re)create the web crawler with the validated start URL.
    // WebCrawler expects a valid baseUrl, so instantiate it here instead of in the constructor.
    this.webCrawler = new WebCrawler({
      maxDepth: this.defaultMaxDepth,
      baseUrl: normalizedUrl,
      rateLimitMs: this.defaultRateLimitMs,
      respectRobotsTxt: false,
    });

    console.log(`Starting web crawl from: ${normalizedUrl}`);
    const crawledPages = await this.webCrawler.start(normalizedUrl);
    const ingestedIds: string[] = [];

    for (const [pageUrl, pageData] of crawledPages.entries()) {
      const documentContent = pageData.content;

      if (documentContent) {
        // Split content into chunks
        const chunks = await this.textSplitter.splitText(documentContent);

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const chunkMetadata = {
            ...pageData.metadata, // Inherit metadata from pageData
            source: pageData.title || pageUrl, // Use title as source for the chunk
            type: 'webpage_chunk', // Indicate it's a chunk
            originalUrl: pageUrl,
            links: pageData.links,
            chunkIndex: i, // Add chunk index
            totalChunks: chunks.length, // Add total chunk count
          };

          // Generate embedding for the chunk
          const embedding = await this.embeddings.embedQuery(chunk);

          // Save chunk to database and Qdrant
          const dbId = await this.databaseService.saveDocument(
            chunkMetadata.source,
            chunkMetadata.type,
            chunk, // Save the chunk content
            chunkMetadata
          );

          if (dbId) {
            // Use dbId as the point ID for Qdrant
            await this.qdrantService.addChunk(dbId.toString(), chunk, embedding);
            ingestedIds.push(dbId.toString());
          }
        }
      }
    }
    console.log(`Finished crawling and ingesting ${ingestedIds.length} chunks.`);
    return ingestedIds;
  }

  async ingestFile(filePath: string): Promise<string | null> {
    await this.initialize(); // Ensure initialization

    const absoluteFilePath = path.resolve(filePath); // Ensure we have an absolute path
    const parsedDoc = await this.documentParser.parse(absoluteFilePath);

    if (parsedDoc) {
      const documentContent = parsedDoc.content;
      const originalMetadata = parsedDoc.metadata;

      if (documentContent) {
        // Split content into chunks
        const chunks = await this.textSplitter.splitText(documentContent);

        const chunkIds: string[] = [];
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const chunkMetadata = {
            ...originalMetadata,
            source: originalMetadata.source, // Keep original source
            type: `${originalMetadata.type}_chunk`, // Indicate it's a chunk
            chunkIndex: i,
            totalChunks: chunks.length,
          };

          // Generate embedding for the chunk
          const embedding = await this.embeddings.embedQuery(chunk);

          // Save chunk to database and Qdrant
          const dbId = await this.databaseService.saveDocument(
            chunkMetadata.source,
            chunkMetadata.type,
            chunk, // Save the chunk content
            chunkMetadata
          );
          if (dbId) {
            // Use dbId as the point ID for Qdrant
            await this.qdrantService.addChunk(dbId.toString(), chunk, embedding);
            chunkIds.push(dbId.toString());
          }
        }
        // Return the ID of the first chunk, or null if no chunks were saved
        return chunkIds.length > 0 ? chunkIds[0] : null;
      }
    }
    return null;
  }

  async getDocument(id: number): Promise<any | null> {
    await this.initialize(); // Ensure initialization
    return this.databaseService.getDocumentById(id);
  }

  async getAllDocuments(): Promise<any[]> {
    await this.initialize(); // Ensure initialization
    return this.databaseService.getAllDocuments();
  }

  async close(): Promise<void> {
    await this.databaseService.close();
    // await this.qdrantService.close(); // Close Qdrant connection
  }
}
