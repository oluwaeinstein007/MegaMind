import { WebCrawler, CrawledPage } from './ingestion/webCrawler.js';
import { DocumentParser } from './ingestion/documentParser.js';
import { DatabaseService } from './storage/database.js';
import path from 'path';
import { TextSplitter } from './chunking/textSplitter.js'; // Import TextSplitter
import { OpenAIEmbeddings } from '@langchain/openai'; // Import OpenAIEmbeddings
import { QdrantService } from './storage/qdrantService.js'; // Import QdrantService

export class IngestorService {
  private webCrawler: WebCrawler;
  private documentParser: DocumentParser;
  private databaseService: DatabaseService;
  private textSplitter: TextSplitter; // Add TextSplitter instance
  private embeddings: OpenAIEmbeddings; // Add embeddings instance
  private qdrantService: QdrantService; // Add QdrantService instance
  private isInitialized: boolean = false; // Track initialization status

  constructor(apiKey: string) { // Accept API key in constructor
    // Initialize services with default configurations
    this.webCrawler = new WebCrawler({
      maxDepth: 2, // Default depth for MVP
      baseUrl: '', // Will be set during ingestUrl
      rateLimitMs: 500, // Slightly faster rate limit for MVP
    });
    this.documentParser = new DocumentParser();
    this.databaseService = new DatabaseService();
    this.textSplitter = new TextSplitter(); // Initialize TextSplitter
    this.embeddings = new OpenAIEmbeddings({ apiKey: apiKey }); // Initialize OpenAIEmbeddings
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

    // Update the web crawler's base URL
    this.webCrawler = new WebCrawler({
      ...this.webCrawler, // Keep existing options
      baseUrl: url,
    });

    console.log(`Starting web crawl from: ${url}`);
    const crawledPages = await this.webCrawler.start(url);
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
