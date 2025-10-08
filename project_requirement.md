# MCP Ingestor Requirements Document

## 1. Overview

Build a TypeScript-based MCP (Model Context Protocol) server that ingests, processes, and serves various content types for AI model consumption.

## 2. Core Requirements

### 2.1 Web Content Ingestion

- **Full Website Crawling**: Ability to crawl entire websites with configurable depth limits
- **Selective URL Ingestion**: Target specific URLs or URL patterns
- **Respect robots.txt**: Honor website crawling policies
- **Rate Limiting**: Configurable delays between requests to avoid overloading servers
- **Authentication Support**: Handle basic auth, OAuth, or API key protected content
- **Dynamic Content**: Support JavaScript-rendered content (headless browser capability)
- **Sitemap Parsing**: Leverage XML sitemaps for efficient crawling
- **Content Filtering**: Exclude specific content types (ads, navigation, footers)

### 2.2 Document Format Support

- **PDF**: Extract text, tables, and metadata
- **Images**: OCR capability for text extraction, image description generation (Optional)
- **CSV**: Parse and structure tabular data with header detection
- **Plain Text**: UTF-8 and other encoding support
- **DOC/DOCX**: Microsoft Word document parsing
- **Additional Formats**:
  - Markdown (.md)
  - Rich Text Format (.rtf)
  - Excel files (.xlsx, .xls)
  - PowerPoint (.pptx, .ppt)
  - HTML files
  - JSON/XML structured data

### 2.3 Chunking Strategy

- **Semantic Chunking**: Split by meaning rather than arbitrary character counts
- **Configurable Chunk Size**: Support for different token limits (512, 1024, 2048 tokens)
- **Overlap Strategy**: Configurable overlap between chunks to maintain context
- **Respect Document Structure**: Preserve hierarchies (headings, sections, paragraphs)
- **Code-Aware Chunking**: Special handling for code blocks to maintain syntax integrity
- **Table Preservation**: Keep tables intact or split intelligently
- **Metadata Preservation**: Attach source, page number, section to each chunk

### 2.4 API Endpoint Learning

### Learning from Responses (Important)

Ability to send queries to selected API endpoints.
Parse and ingest their responses into the system.
Support scheduled/triggered re-ingestion (to keep data fresh).
Store provenance of data (which endpoint, request, response).

### Advance Response Learning (Optional)

- **Response Monitoring**: Capture and store responses from specified endpoints
- **Pattern Recognition**: Identify common response structures and schemas
- **Example Storage**: Build a repository of request-response pairs
- **Context Injection**: Use learned patterns to improve future queries
- **Versioning**: Track API changes over time

## 3. Additional Suggested Requirements

### 3.1 Data Management

- **Deduplication**: Avoid storing duplicate content across sources
- **Incremental Updates**: Re-ingest only changed content
- **Content Versioning**: Track changes to ingested content over time
- **Expiration Policies**: Automatic cleanup of stale content
- **Source Tracking**: Maintain complete provenance for all ingested data
  Metadata store: Store ingestion details (URL, source type, last updated).

### 3.2 Processing & Enrichment

- **Metadata Extraction**: Author, date, tags, language detection
- **Content Summarization**: Generate TL;DR summaries for long documents
- **Entity Recognition**: Extract names, places, organizations, dates
- **Link Graph**: Build relationship maps between documents
- **Quality Scoring**: Assess content quality and relevance

### 3.3 Search & Retrieval

- **Full-Text Search**: Fast keyword-based search across all content
- **Semantic Search**: Find conceptually similar content (requires vector DB)
- **Filtering**: By source, date, type, metadata
- **Ranking**: Relevance scoring for search results
- **Hybrid Search**: Combine keyword and semantic search

### Performance & Scalability

Batch ingestion jobs.
Streaming support (process while downloading).
Retry & backoff for failed ingestion tasks.
Support distributed ingestion (workers).

### 3.4 MCP Server Features

- **Tools Exposure**: Expose ingestion and search as MCP tools
- **Resources**: Serve ingested content as MCP resources
- **Prompts**: Provide templates for common retrieval patterns
- **Streaming**: Support streaming responses for large results
- **Progress Reporting**: Real-time status updates during ingestion

### 3.5 Monitoring & Observability

- **Ingestion Metrics**: Success/failure rates, processing times
- **Error Handling**: Graceful degradation and retry logic
- **Logging**: Structured logs for debugging and auditing
- **Health Checks**: Endpoint to verify service status
- **Usage Analytics**: Track most accessed content and patterns

### 3.6 Configuration & Control

- **Config File**: YAML/JSON for settings
- **Environment Variables**: Override configs for different environments
- **Content Policies**: Define what should/shouldn't be ingested
- **Storage Limits**: Set maximum storage per source or globally
- **Scheduling**: Periodic re-ingestion of sources

### 3.7 Security & Privacy

- **Credential Management**: Secure storage of API keys and passwords
- **Content Sanitization**: Remove sensitive information (PII, secrets)
- **Access Control**: Who can ingest/query what content
- **Audit Logs**: Track all operations for compliance
- **Data Encryption**: At-rest and in-transit encryption

## 4. Vector Database Consideration

- **Semantic Search**: Find content by meaning, not just keywords
- **Similarity Matching**: "Find documents similar to this one"
- **RAG (Retrieval Augmented Generation)**: Provide relevant context to LLMs
- **Clustering**: Group similar content automatically
- **Recommendation**: Suggest related content

### Recommended Vector DB Options

1. **Qdrant**: High performance, TypeScript client, easy setup
2. **Weaviate**: Built-in vectorization, good for production
3. **ChromaDB**: Simple, embedded option for smaller scale
4. **Pinecone**: Managed service, very scalable (commercial)
5. **pgvector**: PostgreSQL extension, good if already using Postgres

### Hybrid Approach (Recommended)

Use both traditional storage and vector database:

- **SQLite/PostgreSQL**: Store raw content, metadata, relationships
- **Vector DB**: Store embeddings for semantic search
- **Best of Both**: Fast exact match + powerful semantic search

## 5. Technology Stack Recommendations

### Core Framework

- **TypeScript**: Type safety and better developer experience
- **MCP Framework**: suggestion FastMCP ts or any mcp framework you're best at
- **Node.js**: Runtime environment (v18+) or latest
- LLM: Gemini (but optional ability to switch to Openai) if needed
- LangChain

### Content Processing

- **Cheerio/JSDOM**: HTML parsing
- **Playwright**: JavaScript-rendered content
- **pdf-parse** or **pdf.js**: PDF extraction
- **tesseract.js**: OCR for images
- **mammoth**: DOCX parsing
- **xlsx**: Excel parsing
- **PapaParse**: CSV parsing

### Chunking & Text Processing

- **langchain**: Text splitters and document loaders
- **tiktoken**: Accurate token counting
- **compromise**: Natural language processing

### Storage

- **SQLite** (simple) or **PostgreSQL** (production): Metadata and content
- **Qdrant/Weaviate**: Vector embeddings
- **Redis**: Caching and job queues

### Utilities

- **Zod**: Schema validation
- **Winston**: Logging
- **Bull**: Job queues for async processing
- **dotenv**: Configuration management

## 6. Architecture Overview

```
┌─────────────────┐
│   MCP Client    │ (Claude, other AI tools)
└────────┬────────┘
         │ MCP Protocol
┌────────▼────────────────────────────────┐
│         MCP Ingestor Server             │
│  ┌──────────────────────────────────┐   │
│  │      Tools & Resources           │   │
│  └───────────┬──────────────────────┘   │
│              │                           │
│  ┌───────────▼──────────────────────┐   │
│  │    Ingestion Pipeline            │   │
│  │  • Fetchers (Web, File)          │   │
│  │  • Parsers (PDF, DOCX, etc.)     │   │
│  │  • Chunkers                       │   │
│  │  • Enrichers                      │   │
│  └───────────┬──────────────────────┘   │
│              │                           │
│  ┌───────────▼──────────────────────┐   │
│  │    Storage Layer                 │   │
│  │  • Metadata DB                   │   │
│  │  • Content Store                 │   │
│  │  • Vector DB                     │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## 7. MVP vs Full Implementation

### MVP (Phase 1)

- Web crawling (single URL + same-domain links)
- PDF and text file ingestion
- SQLite storage
- Basic MCP tools for ingest and retrieve

### Phase 2

- All document formats
- Semantic chunking
- Vector database integration
- Full-text and semantic search
- Incremental updates
- metadata storing improvement and versioning

### Phase 3

- API endpoint learning
- Advanced enrichment (entities, summaries)
- Monitoring and analytics
- Production-grade error handling
- Performance & Scalability
- Multi-tenancy support (optional)

## 8. Success Metrics

- **Ingestion Speed**: Documents processed per minute
- **Retrieval Accuracy**: Relevance of search results
- **Coverage**: Percentage of content successfully extracted
- **Uptime**: Service availability
- **Storage Efficiency**: Compression and deduplication ratios
- **Query Latency**: Time to return search results (< 200ms target)
