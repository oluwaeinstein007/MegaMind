# MegaMind

**MegaMind** is a TypeScript MCP (Model Context Protocol) server that provides a full-stack content ingestion, embedding, and semantic search pipeline for AI applications. It crawls web pages, parses documents, ingests RSS feeds, chunks text intelligently, embeds it with OpenAI or Gemini, and stores results in SQLite + Qdrant for hybrid retrieval.

---

## Features

### Ingestion

| Source | Tool | Details |
|--------|------|---------|
| Single URL | `INGEST_URL_TOOL` | Crawls a URL with configurable depth, optional sitemap discovery |
| Local file | `INGEST_FILE_TOOL` | Parses PDF, DOCX, XLSX, CSV, HTML, Markdown, JSON, XML, TXT |
| RSS / Atom feed | `INGEST_RSS_TOOL` | Fetches feed, ingests each article as embedded chunks |
| Travel URL dataset | `INGEST_ALL_URLS_TOOL` | 200+ categorised travel URLs; ingest by category or all at once |

**Automatic deduplication** — every chunk is fingerprinted with SHA-256. Re-ingesting the same content is a no-op. Deterministic UUIDs (derived from the hash) are used in Qdrant so upserts are idempotent.

### Search & Retrieval

| Tool | Description |
|------|-------------|
| `SEMANTIC_SEARCH_TOOL` | Embed a query and return the top-K most similar chunks with scores |
| `DOCUMENT_RETRIEVAL_TOOL` | Fetch a single chunk by its database integer ID |
| `DOCUMENT_LIST_TOOL` | Paginated list of all stored chunks |

### Management

| Tool | Description |
|------|-------------|
| `DOCUMENT_DELETE_TOOL` | Delete a chunk by ID or all chunks sharing a source |

### Domain Tools

| Tool | Description |
|------|-------------|
| `getVisaInfoByCountry` | Visa requirements lookup |
| `getImmigrationInfoByCountry` | Immigration info lookup |

---

## Architecture

```
Data Sources
  URLs / Files / RSS feeds
        |
        v
  IngestorService
  +-- WebCrawler         BFS crawl, single browser, sitemap support, concurrent fetching
  +-- DocumentParser     PDF, DOCX, XLSX, CSV, HTML, MD, JSON, XML, TXT
  +-- RSSParser          RSS 2.0 + Atom 1.0
  +-- TextSplitter       Token-aware chunking (tiktoken, LangChain)
        |
        v  SHA-256 hash -> deduplicate -> batch embed
  LLM Embeddings
  +-- OpenAI             text-embedding-3-small / text-embedding-ada-002
  +-- Gemini             text-embedding-004
        |
        +----------------------+
        v                      v
  SQLite (better-sqlite3)   Qdrant (vector DB)
  +-- content + metadata    +-- embeddings
  +-- content_hash (UNIQUE) +-- payload (source, type, metadata)
  +-- chunkId (UUID)  <-------- same deterministic UUID
```

Both stores share the same deterministic chunk UUID, enabling hybrid retrieval: semantic search via Qdrant, then full metadata/content lookup via SQLite.

---

## Installation

### Prerequisites

- Node.js 18+
- pnpm
- A Qdrant instance (cloud or self-hosted)
- An embedding API key (OpenAI or Google Gemini)

### Setup

```bash
git clone https://github.com/nxGnosis/mcp-megamind.git
cd mcp-megamind

pnpm install

# Install Playwright browsers (required for web crawling)
npx playwright install chromium
```

### Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```env
# -- Embedding provider ------------------------------------------------------
LLM_PROVIDER=openai          # or: gemini
LLM_API_KEY=sk-...           # OpenAI key  (or set OPENAI_API_KEY)
GOOGLE_API_KEY=AIza...       # Gemini key  (only needed if LLM_PROVIDER=gemini)
GEMINI_EMBEDDING_MODEL=text-embedding-004

# Dimension must match your embedding model:
#   OpenAI text-embedding-3-small -> 1536
#   Gemini text-embedding-004     -> 768
EMBEDDING_VECTOR_SIZE=1536

# -- Qdrant ------------------------------------------------------------------
QDRANT_HOST=https://your-cluster.cloud.qdrant.io
QDRANT_KEY=your-qdrant-api-key
QDRANT_COLLECTION_NAME=megamind   # collection is created automatically
QDRANT_ENABLED=true               # set false to skip Qdrant (SQLite only)

# -- Performance tuning ------------------------------------------------------
EMBEDDING_BATCH_SIZE=50           # chunks per embedding API call (default 50)
```

Full variable reference:

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | `openai` | `openai` or `gemini` |
| `LLM_API_KEY` | — | API key for the embedding provider |
| `OPENAI_API_KEY` | — | OpenAI key (alternative to `LLM_API_KEY`) |
| `GOOGLE_API_KEY` | — | Google Gemini key |
| `GEMINI_EMBEDDING_MODEL` | `text-embedding-004` | Gemini embedding model |
| `EMBEDDING_VECTOR_SIZE` | `1536` | Vector dimension (must match model) |
| `EMBEDDING_BATCH_SIZE` | `50` | Chunks per embedding batch call |
| `QDRANT_HOST` | — | Qdrant base URL |
| `QDRANT_KEY` | — | Qdrant API key |
| `QDRANT_COLLECTION_NAME` | `megamind` | Qdrant collection name |
| `QDRANT_ENABLED` | `true` | Disable to use SQLite only |

---

## Build & Run

```bash
pnpm build    # compile TypeScript -> dist/
pnpm start    # run dist/index.js over stdio (MCP transport)
```

---

## MCP Tool Reference

### INGEST_URL_TOOL

Crawls a URL and stores all discovered content.

```json
{
  "url": "https://docs.example.com",
  "maxDepth": 2,
  "useSitemap": true
}
```

- `maxDepth` (0-5, default 2): how many link levels to follow
- `useSitemap` (default false): attempt sitemap.xml discovery first

### INGEST_FILE_TOOL

Ingests a local file.

```json
{ "filePath": "/path/to/document.pdf" }
```

Supported: `.pdf`, `.txt`, `.md`, `.docx`, `.html`, `.htm`, `.csv`, `.xlsx`, `.xls`, `.json`, `.xml`

### INGEST_RSS_TOOL

Ingests all articles from an RSS or Atom feed.

```json
{ "feedUrl": "https://news.example.com/feed.xml" }
```

### INGEST_ALL_URLS_TOOL

Ingests from the built-in travel URL dataset.

```json
{ "category": "visa" }
```

Omit `category` to ingest all 200+ URLs. Available categories: `visa`, `flights`, `accommodation`, `experiences`, `events`, `immigration`, `insurance`, `carRentals`, `cruises`, `travelGuides`, `health`, `safety`, `luggage`, `currency`, `packages`, `language`, `loyalty`, `travelTech`, `sustainable`, `destinations`.

### SEMANTIC_SEARCH_TOOL

Find the most relevant stored chunks for a query.

```json
{
  "query": "What are the visa requirements for Japan?",
  "limit": 5
}
```

Returns ranked results with similarity scores.

### DOCUMENT_LIST_TOOL

List stored chunks with pagination.

```json
{ "limit": 20, "offset": 0 }
```

### DOCUMENT_RETRIEVAL_TOOL

Retrieve a single chunk by database ID.

```json
{ "id": 42 }
```

### DOCUMENT_DELETE_TOOL

Delete by chunk ID or by source.

```json
{ "id": 42 }
```
```json
{ "source": "https://docs.example.com/page" }
```

---

## Deduplication

Every chunk is fingerprinted: `SHA-256(source + ":" + content)`. Before embedding:

1. Hashes for all candidate chunks are computed.
2. A single batched SQL query finds which hashes already exist.
3. Only new (unseen) chunks are forwarded to the embedding API.
4. SQLite uses `INSERT OR IGNORE` with a `UNIQUE` index on `content_hash`.
5. Qdrant uses deterministic UUIDs (first 32 hex chars of the SHA-256 formatted as a UUID), so `upsert` is naturally idempotent.

Re-ingesting a URL that has not changed costs one SQL query and zero embedding API calls.

---

## Batch Embedding

Instead of one API call per chunk, the pipeline:

1. Collects all new chunks across all pages.
2. Calls `embedDocuments(texts[])` in batches of `EMBEDDING_BATCH_SIZE` (default 50).
3. Saves all chunks to SQLite in a single transaction.
4. Upserts all vectors to Qdrant in a single batch call.

This reduces network round-trips from O(N chunks) to O(N / batch_size).

---

## Web Crawling

The `WebCrawler` uses a single Playwright browser instance across all page fetches. Crawling is BFS by depth level with configurable concurrency (default 3 parallel fetches per batch):

```
depth 0: [startUrl]
depth 1: [link1, link2, link3, ...]   <- up to 3 fetched in parallel
depth 2: [...discovered links...]
```

Optional sitemap mode fetches `/sitemap.xml` first, extracts up to 100 URLs from the sitemap index, and crawls those directly — useful for large documentation sites.

---

## Project Structure

```
src/
+-- index.ts                        # MCP server entry point
+-- lib/
|   +-- config.ts                   # External API config
|   +-- http.ts                     # Typed fetch helper
|   +-- llm.ts                      # Embedding provider abstraction (OpenAI + Gemini)
+-- data/
|   +-- travel-urls-dataset.ts      # 200+ travel URLs in 20 categories
|   +-- travel-product-enum.ts
+-- services/
|   +-- ingestorService.ts          # Ingestion orchestrator
|   +-- immigrationService.ts
|   +-- visaService.ts
|   +-- ingestion/
|   |   +-- webCrawler.ts           # BFS crawler (Playwright + Cheerio)
|   |   +-- documentParser.ts       # Multi-format file parser
|   |   +-- rssParser.ts            # RSS 2.0 + Atom feed parser
|   +-- chunking/
|   |   +-- textSplitter.ts         # Token-aware recursive chunking (tiktoken)
|   +-- storage/
|       +-- database.ts             # SQLite service (better-sqlite3 + in-memory fallback)
|       +-- qdrantService.ts        # Qdrant vector DB client
+-- tools/
    +-- immigration-tools/
    +-- visa-tools/
    +-- ingestor-tools/
        +-- ingestUrlTool.ts
        +-- ingestFileTool.ts
        +-- ingestAllUrlsTool.ts
        +-- ingestRssTool.ts
        +-- searchTool.ts
        +-- getDocumentTool.ts
        +-- listDocumentsTool.ts
        +-- deleteDocumentTool.ts
```

---

## Troubleshooting

**`better-sqlite3` native binding missing**

The system automatically falls back to an in-memory store. Data is lost on process exit. To fix:

```bash
pnpm install   # triggers native rebuild
```

**Qdrant connection errors**

- Verify `QDRANT_HOST` is the full URL including `https://`
- The service automatically tries host variants (strip port, force https) on failure
- Set `QDRANT_ENABLED=false` to skip Qdrant and use SQLite only

**Playwright browser missing**

```bash
npx playwright install chromium
```

**Wrong vector dimension**

`EMBEDDING_VECTOR_SIZE` must match your embedding model. If you change models after ingesting data, update `QDRANT_COLLECTION_NAME` to point to a fresh collection (or delete the old one in Qdrant).

---

## Contributing

1. Fork the repository
2. Create a branch: `git checkout -b feature/my-feature`
3. Commit and push
4. Open a Pull Request

---

## License

ISC
