# MegaMind CLI Reference

CLI scripts for ingesting content into and searching the MegaMind knowledge base.

---

## Prerequisites

Copy `.env.example` to `.env` and fill in your keys before running any script.

```bash
cp .env.example .env
```

Required variables:

| Variable | Purpose |
|---|---|
| `LLM_PROVIDER` | `gemini` or `openai` |
| `GOOGLE_API_KEY` | Required when `LLM_PROVIDER=gemini` |
| `OPENAI_API_KEY` | Required when `LLM_PROVIDER=openai` |
| `GEMINI_EMBEDDING_MODEL` | Embedding model (e.g. `gemini-embedding-001`) |
| `EMBEDDING_VECTOR_SIZE` | Must match the model output dimension |
| `QDRANT_HOST` | Your Qdrant cluster URL |
| `QDRANT_KEY` | Qdrant API key |
| `QDRANT_COLLECTION_NAME` | Collection name (created automatically) |

> The scripts load `.env` automatically via Node's built-in `process.loadEnvFile`.

---

## run_ingest.ts — Ingest a single URL or file

```
pnpm tsx run_ingest.ts <url-or-file-path> [options]
```

### Options

| Flag | Default | Description |
|---|---|---|
| `--depth <n>` | `2` | Max crawl depth when following links from a URL |
| `--sitemap` | off | Discover pages via `sitemap.xml` instead of crawling |

### Examples

```bash
# Ingest a website (crawl 2 levels deep by default)
pnpm tsx run_ingest.ts https://www.uscis.gov/

# Crawl deeper and use sitemap discovery
pnpm tsx run_ingest.ts https://travel.state.gov/ --depth 3 --sitemap

# Ingest a local PDF
pnpm tsx run_ingest.ts ./docs/visa-guide.pdf

# Ingest a local Word document
pnpm tsx run_ingest.ts ./docs/immigration-policy.docx

# Ingest a CSV file
pnpm tsx run_ingest.ts ./data/travel-records.csv

# Ingest from depth 1 only (landing page, no link following)
pnpm tsx run_ingest.ts https://www.canada.ca/en/immigration-refugees-citizenship.html --depth 1
```

### Output

```
Ingesting URL: https://www.uscis.gov/

Done.
  New chunks stored : 142
  Duplicates skipped: 0
  Sample chunk IDs  : abc123, def456, ghi789 ...
```

---

## run_ingest_dataset.ts — Bulk ingest the travel URLs dataset

Iterates all (or a filtered subset of) the 228 URLs in `src/data/travel-urls-dataset.ts` and ingests each one.

```
pnpm tsx run_ingest_dataset.ts [options]
```

### Options

| Flag | Default | Description |
|---|---|---|
| `--category <name>` | all | Only ingest one category (see list below) |
| `--depth <n>` | `1` | Max crawl depth per URL |
| `--concurrency <n>` | `3` | Number of URLs ingested in parallel |
| `--dry-run` | off | Print URLs without ingesting anything |

### Available categories

| Category | Count | Description |
|---|---|---|
| `visa` | 15 | Government visa sites, e-visa portals |
| `flights` | 20 | Airlines, flight search engines |
| `accommodation` | 15 | Hotels, vacation rentals, hostels |
| `experiences` | 15 | Tours, activities, local experiences |
| `events` | 14 | Concerts, festivals, sports events |
| `immigration` | 10 | Government immigration departments |
| `insurance` | 10 | Travel insurance providers |
| `carRentals` | 14 | Car rental companies, transport planning |
| `cruises` | 10 | Cruise lines, ferry services |
| `travelGuides` | 14 | Destination guides, travel magazines |
| `health` | 9 | Travel health, vaccination info |
| `safety` | 8 | Travel advisories, security info |
| `luggage` | 8 | Luggage and travel gear brands |
| `currency` | 7 | Currency converters, money transfer |
| `packages` | 9 | All-inclusive and package providers |
| `language` | 6 | Translation and language learning |
| `loyalty` | 8 | Airline and hotel loyalty programs |
| `travelTech` | 8 | Travel apps and tools |
| `sustainable` | 7 | Eco and responsible travel |
| `destinations` | 15 | Official tourism sites by country |

### Examples

```bash
# Ingest all 228 URLs (3 in parallel, depth 1)
pnpm tsx run_ingest_dataset.ts

# Dry run — print what would be ingested
pnpm tsx run_ingest_dataset.ts --dry-run

# Only ingest immigration-related sites
pnpm tsx run_ingest_dataset.ts --category immigration

# Visa sites with deeper crawl
pnpm tsx run_ingest_dataset.ts --category visa --depth 2

# Run more URLs in parallel (use carefully — watch API rate limits)
pnpm tsx run_ingest_dataset.ts --concurrency 5

# Combine options
pnpm tsx run_ingest_dataset.ts --category travelGuides --depth 2 --concurrency 2
```

### Output

```
Travel URL Dataset Ingestor
  Category   : immigration
  URLs       : 2
  Depth      : 1
  Concurrency: 3

[1/2] US Citizenship and Immigration Services ... ✓ +84 (skip 0)
[2/2] US Customs and Border Protection ... ✓ +61 (skip 3)

Summary
  New chunks stored : 145
  Duplicates skipped: 3
  Failed URLs       : 0
```

---

## run_search.ts — Semantic search

Query the knowledge base using natural language. Returns the most relevant chunks ranked by similarity score.

```
pnpm tsx run_search.ts "<query>" [options]
```

### Options

| Flag | Default | Description |
|---|---|---|
| `--limit <n>` | `5` | Max number of results to return |

### Examples

```bash
# Basic search
pnpm tsx run_search.ts "visa application process"

# Return more results
pnpm tsx run_search.ts "immigration requirements" --limit 10

# Travel health queries
pnpm tsx run_search.ts "vaccinations required for travel to Africa"

# Visa-specific queries
pnpm tsx run_search.ts "how to apply for a US tourist visa"
pnpm tsx run_search.ts "Schengen visa requirements Europe"
pnpm tsx run_search.ts "Canada eTA eligibility"

# Insurance and safety
pnpm tsx run_search.ts "travel insurance that covers medical evacuation"
pnpm tsx run_search.ts "travel advisories for Southeast Asia"

# Transport
pnpm tsx run_search.ts "cheapest way to book flights"
pnpm tsx run_search.ts "Eurail pass options"
```

### Output

```
Searching for: "immigration requirements" (limit=10)

--- Result 1 (score: 91.4%) ---
Source : https://www.uscis.gov/
URL    : https://www.uscis.gov/green-card/green-card-eligibility

[chunk text preview...]

--- Result 2 (score: 88.7%) ---
Source : https://www.cbp.gov/
...
```

---

## Tips

**Avoid re-ingesting the same content.** Duplicate chunks are detected by content hash and skipped automatically. You can safely re-run ingest commands — only new content will be stored.

**Depth trade-offs:**

| Depth | Behaviour | Use when |
|---|---|---|
| `1` | Landing page only | Quick ingestion, homepage content |
| `2` | Landing page + direct links | Most use cases (default for single URL) |
| `3+` | Deep crawl | Large documentation sites |

**Rate limits.** If you hit API rate limits during bulk dataset ingestion, lower `--concurrency` to `1` or `2`.

**Adding new URLs to the dataset.** Edit `src/data/travel-urls-dataset.ts` and add entries to the relevant category array, then re-run `run_ingest_dataset.ts --category <name>`.
