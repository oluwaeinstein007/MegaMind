# MegaMind 🧠

**MegaMind** is a robust TypeScript-based content ingestion and processing system designed to crawl, parse, chunk, embed, and store diverse content types (web pages, documents, files) for AI applications. It provides a comprehensive pipeline for semantic search and retrieval using vector databases.

## ✨ Features

### 🕸️ **Web Crawling & Ingestion**

- Full website crawling with configurable depth limits (default: 2 levels)
- Selective URL ingestion by category (visa, flights, accommodation, etc.)
- Rate limiting to respect server resources (default: 500ms between requests)
- Headless browser support (Playwright) for JavaScript-rendered content
- Robots.txt awareness and respect

### 📄 **Document Parsing**

Supports multiple file formats:

- **PDF** – via pdf-parse (with fallback safety)
- **Microsoft Word** – .docx, .doc via mammoth
- **Excel** – .xlsx, .xls via xlsx
- **Web Content** – HTML via Cheerio
- **Plain Text** – UTF-8 encoding
- **Markdown** – .md files

### 🔪 **Smart Chunking**

- Token-aware recursive text splitting (LangChain RecursiveCharacterTextSplitter)
- Configurable chunk size (default: 1024 tokens)
- Configurable overlap between chunks (default: 256 tokens)
- Uses **tiktoken** for accurate token counting
- Preserves document structure and context

### 🤖 **LLM-Agnostic Embeddings**

- **Provider abstraction** for embedding models
- **OpenAI** embeddings (via `@langchain/openai`)
- **Gemini** embeddings (via Google Generative Language API)
- Fallback to zero-vectors on embedding failure (for robustness)
- Configurable embedding vector size (default: 768 for Gemini, 1536 for OpenAI)

### 💾 **Persistent Storage**

- **SQLite** with better-sqlite3 (fast, no dependencies)
- In-memory fallback when native bindings are unavailable
- Stores document metadata, content, and chunk-to-UUID mapping
- Tracks chunk IDs for correlation with vector store

### 🎯 **Vector Search (Qdrant)**

- **Qdrant** vector database integration for semantic search
- Auto-collection creation with fallback host variants
- Dual ID system: database integer ID + UUID for chunk identification
- Optional toggle (`QDRANT_ENABLED`) to skip Qdrant for testing
- Supports cloud-hosted Qdrant instances (with `/api` path normalization)

### 📊 **Travel URL Dataset**

- **20 categories** of travel-related URLs (222 total)
- Categories: visa, flights, accommodation, experiences, events, immigration, insurance, car rentals, cruises, travel guides, health, safety, luggage, currency, packages, language, loyalty, travel tech, sustainable, destinations
- CLI support: ingest by category or all URLs

## 🛠️ Technology Stack

- **Runtime**: Node.js (v18+, ESM)
- **Language**: TypeScript 5+
- **Web Crawling**: Playwright, Cheerio
- **Document Parsing**: pdf-parse, mammoth, xlsx, Cheerio
- **Text Processing**: LangChain, tiktoken, RecursiveCharacterTextSplitter
- **Embeddings**: @langchain/openai, Google Generative Language API
- **Storage**: better-sqlite3, Qdrant (@qdrant/js-client-rest)
- **Package Manager**: pnpm

## 🏗️ Architecture Overview

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MegaMind Ingestion System                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────┐    │
│  │                         Data Sources                              │    │
│  ├───────────────────────────────────────────────────────────────────┤    │
│  │  📱 URLs  │  📄 PDFs  │  📊 Excel  │  📝 Documents  │  🌐 HTML  │    │
│  └──────┬────────┬─────────┬─────────┬──────────────────────────────┘    │
│         │        │         │         │                                    │
│         └────────┴─────────┴─────────┘                                    │
│                  │                                                         │
│         ┌────────▼────────────────────────┐                              │
│         │   Ingestion Pipeline            │                              │
│         ├────────────────────────────────┤                              │
│         │ 1️⃣  URL Validation & Normalization                             │
│         │    • Trim whitespace            │                              │
│         │    • Validate protocol          │                              │
│         │    • Handle encoding            │                              │
│         ├────────────────────────────────┤                              │
│         │ 2️⃣  Content Fetching            │                              │
│         │    • WebCrawler (Playwright)    │                              │
│         │    • Document Parser            │                              │
│         │    • Format detection           │                              │
│         ├────────────────────────────────┤                              │
│         │ 3️⃣  Content Extraction          │                              │
│         │    • HTML → Text (Cheerio)      │                              │
│         │    • PDF → Text (pdf-parse)     │                              │
│         │    • DOCX → Text (mammoth)      │                              │
│         │    • Excel → Text (xlsx)        │                              │
│         ├────────────────────────────────┤                              │
│         │ 4️⃣  Text Chunking              │                              │
│         │    • Token counting (tiktoken)  │                              │
│         │    • Recursive splitting        │                              │
│         │    • Chunk size: 1024 tokens    │                              │
│         │    • Overlap: 256 tokens        │                              │
│         ├────────────────────────────────┤                              │
│         │ 5️⃣  Embedding Generation        │                              │
│         │    • Provider selection         │                              │
│         │    • OpenAI | Gemini            │                              │
│         │    • Fallback: zero vectors     │                              │
│         ├────────────────────────────────┤                              │
│         │ 6️⃣  Data Storage               │                              │
│         │    • Metadata → SQLite          │                              │
│         │    • Vectors → Qdrant           │                              │
│         │    • Dual ID tracking           │                              │
│         └────────┬─────────────────────────┘                              │
│                  │                                                         │
│  ┌───────────────┴──────────────────────────────────┐                    │
│  │           Storage Layer (Dual System)            │                    │
│  ├────────────────────┬───────────────────────────┤                    │
│  │                    │                           │                    │
│  │  📦 SQLite DB      │  🎯 Qdrant Vector DB      │                    │
│  │  ┌──────────────┐  │  ┌─────────────────────┐ │                    │
│  │  │ id (int)     │  │  │ chunkId (UUID)      │ │                    │
│  │  │ chunkId (str)│◄──┤  │ vector (float[])    │ │                    │
│  │  │ source       │  │  │ payload.text (str)  │ │                    │
│  │  │ type         │  │  │ metadata (json)     │ │                    │
│  │  │ content      │  │  └─────────────────────┘ │                    │
│  │  │ metadata     │  │                           │                    │
│  │  │ ingested_at  │  │  Collection: "journals"  │                    │
│  │  │              │  │  Distance: Cosine        │                    │
│  │  └──────────────┘  │  Dimension: 768/1536     │                    │
│  │                    │                           │                    │
│  │  ✅ In-Memory     │  ✅ Cloud-Hosted or      │                    │
│  │     Fallback       │     Local Instance       │                    │
│  │                    │                           │                    │
│  └────────────────────┴───────────────────────────┘                    │
│                                                                         │
│  ┌───────────────────────────────────────────────────────┐            │
│  │            Search & Retrieval (Future)                │            │
│  ├───────────────────────────────────────────────────────┤            │
│  │  Semantic Search → Qdrant vector similarity          │            │
│  │  + Metadata Filtering → SQLite                       │            │
│  │  = Hybrid Search Results                             │            │
│  └───────────────────────────────────────────────────────┘            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow Diagram

```
Travel URL Dataset
       │
       ▼
┌─────────────────────────────────────────────────────┐
│ IngestorService.ingestUrl(url)                      │
│ IngestorService.ingestFile(filePath)                │
└─────────────┬───────────────────────────────────────┘
              │
              ▼
     ┌────────────────────────────────────────────────────┐
     │ 1. URL Validation & Normalization                  │
     │   • Trim, strip BOM, handle encoding               │
     │   • Validate protocol (http/https)                 │
     │   • Fallback to https:// if missing                │
     └─────────────┬──────────────────────────────────────┘
                   │
         ┌─────────┴──────────┐
         ▼                    ▼
   ┌─────────────┐      ┌──────────────┐
   │ WebCrawler  │      │DocumentParser│
   │ (Playwright)│      │(Multi-format)│
   └────┬────────┘      └────┬─────────┘
        │                     │
        └─────────┬───────────┘
                  │
                  ▼
        ┌─────────────────────────────────┐
        │ 2. Content Extraction           │
        │   • HTML → Cheerio parsing      │
        │   • PDF → text extraction       │
        │   • Doc/Excel parsing           │
        └────────┬────────────────────────┘
                 │
                 ▼
        ┌─────────────────────────────────┐
        │ 3. TextSplitter.splitText()     │
        │   • Token-aware chunking        │
        │   • Chunk: 1024 tokens          │
        │   • Overlap: 256 tokens         │
        └────────┬────────────────────────┘
                 │
                 ▼
      ┌──────────────────────────────────┐
      │ chunks: string[]                 │
      │ metadata: {                      │
      │   source, type, chunkIndex, ... │
      │ }                                │
      └────────┬─────────────────────────┘
               │
               ▼
      ┌──────────────────────────────────────┐
      │ 4. LLM.embedQuery(chunk)             │
      │   • Provider selection               │
      │   • OpenAI | Gemini                  │
      │   • Fallback: zero-vector            │
      └────────┬─────────────────────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
  embedding[]      ┌──────────────────────────┐
  (float[])        │ chunkId = randomUUID()   │
       │           └──────────────────────────┘
       │                  │
       │         ┌────────┴─────────┐
       │         ▼                  ▼
       │    ┌──────────────┐   ┌──────────────┐
       │    │ SQLite DB    │   │ Qdrant       │
       │    │ INSERT       │   │ upsert()     │
       │    │ (metadata)   │   │ (embedding)  │
       │    └──────────────┘   └──────────────┘
       │         ▲                   ▲
       └─────────┴───────────────────┘
             (both linked via chunkId)
               │
               ▼
        ┌─────────────────────┐
        │ Return chunkId[]    │
        │ Ingestion Complete! │
        └─────────────────────┘
```

### Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    IngestorService                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Properties:                                               │  │
│  │ • webCrawler: WebCrawler                                  │  │
│  │ • documentParser: DocumentParser                          │  │
│  │ • textSplitter: TextSplitter                              │  │
│  │ • embeddings: Embeddings (OpenAI | Gemini)               │  │
│  │ • databaseService: DatabaseService                        │  │
│  │ • qdrantService: QdrantService                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  Public Methods:                                                  │
│  ├─ initialize()      → Init DB + Qdrant                        │
│  ├─ ingestUrl()       → Crawl URL → Parse → Chunk → Embed      │
│  ├─ ingestFile()      → Parse file → Chunk → Embed             │
│  ├─ getDocument()     → Fetch from DB                           │
│  ├─ getAllDocuments() → List all documents                      │
│  └─ close()           → Cleanup resources                       │
└─────────────────────────────────────────────────────────────────┘
                    ▲
         ┌──────────┼──────────┬──────────┐
         │          │          │          │
         ▼          ▼          ▼          ▼
  ┌────────────┐ ┌──────────┐ ┌────────────┐ ┌──────────────┐
  │ WebCrawler │ │ Document │ │ TextSplit- │ │ LLM Provider │
  │            │ │  Parser  │ │    ter     │ │ (OpenAI/     │
  │ Methods:   │ │          │ │            │ │  Gemini)     │
  │ • start()  │ │ • parse()│ │ • split()  │ │              │
  │ • crawl()  │ │          │ │ • tokenCnt()│ │ • embed()    │
  │ • fetch()  │ └──────────┘ └────────────┘ └──────────────┘
  │            │
  │ Uses:      │
  │ • Playwright
  │ • Cheerio  │
  │ • robots-  │
  │   parser   │
  └────────────┘

  ┌─────────────────────────────────┬──────────────────────────────┐
  │     DatabaseService (SQLite)     │   QdrantService (Vector DB) │
  │                                  │                              │
  │ Methods:                         │ Methods:                     │
  │ • initialize()                   │ • initialize()              │
  │ • saveDocument()                 │ • addChunk()                │
  │ • getDocumentById()              │ • search()                  │
  │ • getAllDocuments()              │                              │
  │ • close()                        │ Storage:                     │
  │                                  │ • Embeddings                 │
  │ Storage:                         │ • Metadata (payload)         │
  │ • documents table                │ • Collections                │
  │ • Metadata + content             │                              │
  │ • In-memory fallback             │                              │
  └────────────────────────────────┴──────────────────────────────┘
```

### Dual Storage System

```
┌──────────────────────────────────────────────────────────────────┐
│              Chunk Storage Architecture                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  For each chunk:                                                 │
│                                                                  │
│    Original Content              UUID Generated                  │
│          │                            │                         │
│          ▼                            ▼                         │
│    ┌──────────────────────────┬─────────────────────────────┐  │
│    │   SQLite (Metadata DB)   │  Qdrant (Vector Store)      │  │
│    ├──────────────────────────┼─────────────────────────────┤  │
│    │ id: 1 (auto)             │  chunkId: uuid-string       │  │
│    │ chunkId: uuid-string  ◄──┤  (linked back to DB id)     │  │
│    │ source: "https://..."    │                             │  │
│    │ type: "webpage_chunk"    │  vector: [0.23, -0.45, ...] │  │
│    │ content: "Full chunk..." │  (768 or 1536 dimensions)   │  │
│    │ metadata: {...}          │                             │  │
│    │ ingested_at: timestamp   │  payload: {                 │  │
│    │                          │    text: "chunk content"    │  │
│    │ ✅ Query by ID/date      │    metadata: {...}          │  │
│    │ ✅ Full text search      │  }                          │  │
│    │ ✅ Metadata filtering    │                             │  │
│    │ ✅ Persistent storage    │  ✅ Semantic similarity     │  │
│    │ ✅ In-memory fallback    │  ✅ Vector search           │  │
│    │                          │  ✅ Hybrid retrieval        │  │
│    └──────────────────────────┴─────────────────────────────┘  │
│                                                                  │
│  Single Source of Truth: Use chunkId to correlate data          │
│                                                                  │
│  Example Query Flow:                                             │
│  1. User query → embed() → vector                               │
│  2. Qdrant.search(vector) → top K chunkIds                      │
│  3. SQLite.query(chunkId IN [...]) → full metadata + content    │
│  4. Return ranked results with context                          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## 📦 Installation

### Prerequisites

- Node.js v18 or higher
- pnpm (recommended) or npm

### Steps

1. Clone the repository:

   ```bash
   git clone https://github.com/oluwaeinstein007/MegaMind.git
   cd MegaMind
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Install Playwright browsers (required for web crawling):

   ```bash
   npx playwright install
   ```

4. Create a `.env` file from `.env.example`:

   ```bash
   cp .env.example .env
   ```

5. Configure environment variables:

   ```env
   # LLM Configuration
   LLM_PROVIDER=gemini  # or openai
   LLM_API_KEY=your-api-key-here
   GEMINI_EMBEDDING_MODEL=text-embedding-004
   EMBEDDING_VECTOR_SIZE=768

   # Qdrant Configuration
   QDRANT_HOST=https://your-qdrant-instance.cloud.qdrant.io
   QDRANT_KEY=your-qdrant-api-key
   QDRANT_ENABLED=true

   # Optional Database
   DATABASE_URL=postgresql://user:password@host:5432/dbname
   ```

## 🚀 Quick Start

### Build the project:

```bash
pnpm build
```

### Run ingestion tests:

**Ingest a single category (e.g., visa URLs):**

```bash
node scripts/run_ingest.mjs visa
```

**Ingest all travel URLs:**

```bash
node scripts/run_ingest.mjs
```

**Disable Qdrant (testing with in-memory only):**

```bash
QDRANT_ENABLED=false node scripts/run_ingest.mjs visa
```

### Expected Output:

```
📥 Travel URLs Dataset loaded successfully!
📚 Total Categories: 20
🔗 Total URLs: 222
🗂️ Categories: visa, flights, accommodation, ...

🚀 Starting ingestion for 15 URLs in visa category...

🕸️ Ingesting: https://travel.state.gov/content/travel/en/us-visas.html
✅ Successfully ingested 3 chunks from https://travel.state.gov/...
🧩 Chunk added to Qdrant: 11a1a70e-a7a8-4be2-a99c-d0277a79c614
...

📊 Ingestion Summary:
  🔗 Total URLs: 15
  ✅ Successful: 12
  ❌ Failed: 3

📋 Detailed Results:
  ✅ https://travel.state.gov/... - 3 chunks
  ❌ https://blocked-site.com/... - Error: 403 Forbidden
```

## 📁 Project Structure

```
src/
├── index.ts                      # Main entry point
├── lib/
│   ├── config.ts               # Configuration loader
│   ├── http.ts                 # HTTP utilities
│   └── llm.ts                  # LLM provider abstraction
├── data/
│   ├── travel-urls-dataset.ts  # Travel URL dataset + helpers
│   └── travel-product-enum.ts  # Travel product enums
├── services/
│   ├── ingestorService.ts      # Orchestrates ingestion pipeline
│   ├── immigrationService.ts   # Immigration-specific logic
│   ├── visaService.ts          # Visa-specific logic
│   ├── ingestion/
│   │   ├── webCrawler.ts       # Web crawling (Playwright)
│   │   └── documentParser.ts   # Multi-format document parsing
│   ├── chunking/
│   │   └── textSplitter.ts     # Token-aware chunking
│   ├── storage/
│   │   ├── database.ts         # SQLite/in-memory storage
│   │   └── qdrantService.ts    # Qdrant vector DB client
├── tools/
│   ├── immigration-tools/      # Immigration tools
│   ├── ingestor-tools/         # Ingestion tools (CLI wrappers)
│   └── visa-tools/             # Visa tools
└── scripts/
    └── run_ingest.mjs          # Test harness for ingestion
```

## 🔧 Configuration

### Environment Variables

| Variable                 | Default              | Description                                                     |
| ------------------------ | -------------------- | --------------------------------------------------------------- |
| `LLM_PROVIDER`           | `openai`             | Embedding provider: `openai` or `gemini`                        |
| `LLM_API_KEY`            | -                    | API key for the LLM provider                                    |
| `OPENAI_API_KEY`         | -                    | OpenAI API key (fallback for compatibility)                     |
| `GOOGLE_API_KEY`         | -                    | Google API key for Gemini embeddings                            |
| `GOOGLE_PROJECT_ID`      | -                    | Google Cloud project ID                                         |
| `GEMINI_EMBEDDING_MODEL` | `text-embedding-004` | Gemini embedding model name                                     |
| `EMBEDDING_VECTOR_SIZE`  | `1536`               | Embedding vector dimension                                      |
| `QDRANT_HOST`            | -                    | Qdrant instance URL (required if `QDRANT_ENABLED=true`)         |
| `QDRANT_KEY`             | -                    | Qdrant API key (required if `QDRANT_ENABLED=true`)              |
| `QDRANT_ENABLED`         | `true`               | Enable Qdrant vector storage                                    |
| `DATABASE_URL`           | -                    | PostgreSQL connection string (optional; uses SQLite by default) |

### Troubleshooting

**"Could not locate the bindings file..." (sqlite3 native addon missing)**

- The project uses **better-sqlite3** which requires native compilation
- Solution 1: Install Python and build tools, then rebuild:
  ```bash
  pnpm install
  ```
- Solution 2: Use in-memory storage (data lost on exit):
  ```bash
  # The system automatically falls back to in-memory if better-sqlite3 fails
  ```

**Qdrant 404 errors**

- Cloud Qdrant instances may require `/api` path normalization
- The code automatically attempts host variants (with/without port, with/without `/api`)
- Verify `QDRANT_HOST` matches your cloud provider's endpoint exactly

**Playwright browser not installed**

```bash
npx playwright install
```

## 📝 Usage Examples

### Programmatic API

```typescript
import { IngestorService } from "./dist/services/ingestorService.js";

const ingestor = new IngestorService();

// Ingest a single URL
const ids = await ingestor.ingestUrl("https://example.com");
console.log(`Ingested ${ids.length} chunks`);

// Retrieve a document
const doc = await ingestor.getDocument(1);
console.log(doc.content);

// Cleanup
await ingestor.close();
```

### CLI

```bash
# Ingest visa URLs
node scripts/run_ingest.mjs visa

# Ingest all categories
node scripts/run_ingest.mjs

# Test without Qdrant
QDRANT_ENABLED=false node scripts/run_ingest.mjs
```

## 🏗️ Architecture

### Ingestion Pipeline

1. **URL Validation** → Normalize and validate URLs
2. **Web Crawling** → Fetch pages with Playwright
3. **Content Extraction** → Parse HTML with Cheerio
4. **Document Parsing** → Handle multiple file formats
5. **Text Chunking** → Split with token awareness and overlap
6. **Embedding Generation** → Call LLM provider
7. **Storage**:
   - Save metadata + chunk to SQLite
   - Save embedding to Qdrant
   - Link via shared UUID

### Data Flow

```
URL → WebCrawler → DocumentParser → TextSplitter
  ↓                                      ↓
HTML/Text ──────────────────────────────┘
  ↓
Chunks → LLM.embedQuery() → Embeddings
  ↓                             ↓
DatabaseService         QdrantService
  (SQLite)               (Vector DB)
  ↓                             ↓
Stored Metadata         Stored Vectors
+ Content + UUID     + Payload + UUID
```

## 🧪 Testing

Run the ingestion test harness:

```bash
pnpm build
node scripts/run_ingest.mjs visa
```

Expected behavior:

- ✅ Pages are fetched and parsed
- ✅ Content is chunked into 1024-token segments
- ✅ Embeddings are generated via Gemini or OpenAI
- ✅ Chunks are stored in SQLite with metadata
- ✅ Embeddings are stored in Qdrant (if enabled)
- ✅ Summary shows success/failure counts

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the **MIT License** – see the LICENSE file for details.

## 📞 Support

For issues, questions, or suggestions:

- Open a GitHub issue: [Issues](https://github.com/oluwaeinstein007/MegaMind/issues)
- Contact: [project-email-or-website]

---

**Last Updated**: December 2025  
**Version**: 1.0.0
