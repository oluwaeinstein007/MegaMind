# MegaMind

MegaMind is a robust TypeScript-based MCP (Model Context Protocol) server designed for ingesting, processing, and serving diverse content types to AI models. It provides a comprehensive pipeline for web crawling, document parsing, semantic chunking, and API endpoint learning, enabling rich context for AI applications.

## Features

- ✅ **Web Content Ingestion**:
  - Full website crawling with configurable depth limits.
  - Selective URL ingestion and pattern matching.
  - Respects `robots.txt` and implements rate limiting.
  - Supports authentication (basic auth, OAuth, API keys).
  - Handles JavaScript-rendered content via headless browser (Playwright).
  - Parses XML sitemaps for efficient crawling.
  - Content filtering to exclude ads, navigation, etc.
- ✅ **Document Format Support**:
  - PDF (text, tables, metadata).
  - Images (OCR for text, optional image description).
  - CSV (structured data with header detection).
  - Plain Text (UTF-8 and other encodings).
  - Microsoft Word (.doc, .docx).
  - Markdown (.md), Rich Text Format (.rtf), Excel (.xlsx, .xls), PowerPoint (.pptx, .ppt), HTML, JSON/XML.
- ✅ **Advanced Chunking Strategy**:
  - Semantic chunking based on meaning.
  - Configurable chunk size (e.g., 512, 1024, 2048 tokens).
  - Configurable overlap between chunks.
  - Preserves document structure (headings, sections).
  - Code-aware chunking for syntax integrity.
  - Intelligent table and metadata preservation.
- ✅ **API Endpoint Learning**:
  - Ingests responses from specified API endpoints.
  - Supports scheduled/triggered re-ingestion for fresh data.
  - Stores provenance (endpoint, request, response).

## Coming Soon

- **API Endpoint Learning**: Advanced features like response monitoring, pattern recognition, context injection.

- ✅ **Data Management**:
  - Deduplication of content.
  - Incremental updates for changed content.
  - Content versioning.
  - Expiration policies for stale content.
  - Comprehensive source tracking and metadata storage.
- ✅ **Processing & Enrichment**:
  - Metadata extraction (author, date, language).
  - Content summarization.
  - Entity recognition.
  - Link graph construction.
  - Content quality scoring.
- ✅ **Search & Retrieval**:
  - Full-text search.
  - Semantic search (via Vector DB integration).
  - Filtering by source, date, type, metadata.
  - Relevance ranking.
  - Hybrid search combining keyword and semantic approaches.
- ✅ **MCP Server Features**:
  - Exposes ingestion and search as MCP tools.
  - Serves ingested content as MCP resources.
  - Provides prompt templates.
  - Supports streaming responses.
  - Real-time progress reporting.
- ✅ **Monitoring & Observability**:
  - Ingestion metrics, error handling, structured logging.
  - Health checks and usage analytics.
- ✅ **Configuration & Control**:
  - Configuration via YAML/JSON files and environment variables.
  - Content policies and storage limits.
  - Scheduling for periodic re-ingestion.
- ✅ **Security & Privacy**:
  - Secure credential management.
  - Content sanitization (PII, secrets removal).
  - Access control.
  - Audit logs and data encryption.
- ✅ **Vector Database Integration**:
  - Supports semantic search, similarity matching, and RAG.
  - Options include Qdrant, Weaviate, ChromaDB, Pinecone, pgvector.
  - Recommended hybrid approach using traditional DB (SQLite/PostgreSQL) for metadata and Vector DB for embeddings.

## Technology Stack

- **Core**: TypeScript, Node.js (v18+), MCP Framework (e.g., FastMCP ts), LangChain, OpenAI/Gemini LLM.
- **Content Processing**: Cheerio, JSDOM, Playwright, pdf-parse, tesseract.js, mammoth, xlsx, PapaParse.
- **Chunking & Text Processing**: LangChain, tiktoken, compromise.
- **Storage**: SQLite, PostgreSQL, Qdrant/Weaviate, Redis.
- **Utilities**: Zod, Winston, Bull, dotenv.

## Architecture Overview

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

## Installation & Setup

1.  Clone the repository:
    ```bash
    git clone https://github.com/nxGnosis/MegaMind.git
    cd MegaMind
    ```
2.  Install dependencies:
    ```bash
    pnpm install
    ```
3.  Configure environment variables (e.g., database credentials, API keys) by creating a `.env` file based on `.env.example` (if it exists, otherwise refer to documentation).
4.  Initialize the database (if applicable).

## Usage

To start the MCP Ingestor server:

```bash
pnpm start
```

(Or the appropriate command based on `package.json` scripts, e.g., `pnpm dev`)

Refer to the MCP documentation for details on using the exposed tools and resources.

## Contributing

Contributions are welcome! Please refer to the `CONTRIBUTING.md` file for guidelines.

## License

This project is licensed under the MIT License.
