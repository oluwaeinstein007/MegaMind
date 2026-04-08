/**
 * MegaMind travel-content bridge — v3
 *
 * Improvement #3: Qdrant semantic search (primary) with SQLite LIKE fallback.
 *
 * Search strategy:
 *   1. If QDRANT_HOST + QDRANT_KEY are set → embed the query and vector-search Qdrant
 *   2. Otherwise → keyword LIKE search across the SQLite documents table
 *
 * Embedding for Qdrant queries uses the same provider as MegaMind ingestion:
 *   EMBEDDING_PROVIDER=openai  → text-embedding-3-small via OpenAI SDK
 *   EMBEDDING_PROVIDER=gemini  → text-embedding-004 via Google GenAI SDK
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { QdrantClient } from '@qdrant/js-client-rest';

const require = createRequire(import.meta.url);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TravelChunk {
  id: number | string;
  chunkId?: string | null;
  source: string;
  type: string;
  content: string;
  metadata: Record<string, unknown>;
  score?: number; // relevance score from Qdrant
}

// ── SQLite helpers ────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

function resolveDbPath(): string {
  if (process.env.MEGAMIND_DB_PATH) return path.resolve(process.env.MEGAMIND_DB_PATH);
  return path.resolve(__dirname, '..', '..', '..', 'dist', 'ingestor.db');
}

let _sqliteDb: ReturnType<typeof require> | null = null;

function getSqliteDb() {
  if (_sqliteDb) return _sqliteDb;
  const dbPath = resolveDbPath();
  const BetterSqlite3 = require('better-sqlite3');
  _sqliteDb = new BetterSqlite3(dbPath, { readonly: true });
  return _sqliteDb;
}

function sqliteLikeSearch(query: string, limit: number): TravelChunk[] {
  const db = getSqliteDb();
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `%${t}%`);

  if (terms.length === 0) return [];

  const conditions = terms.map(() => '(LOWER(content) LIKE ? OR LOWER(source) LIKE ?)').join(' AND ');
  const params: string[] = terms.flatMap((t) => [t, t]);
  params.push(String(limit));

  const rows = db
    .prepare(
      `SELECT id, chunkId, source, type, content, metadata, ingested_at
       FROM documents
       WHERE content IS NOT NULL AND ${conditions}
       ORDER BY ingested_at DESC LIMIT ?`
    )
    .all(...params) as Array<{
      id: number; chunkId: string | null; source: string; type: string;
      content: string; metadata: string; ingested_at: string;
    }>;

  return rows.map((r) => ({
    ...r,
    metadata: (() => { try { return JSON.parse(r.metadata); } catch { return {}; } })(),
  }));
}

// ── Qdrant helpers ────────────────────────────────────────────────────────────

function getQdrantClient(): QdrantClient | null {
  const host = process.env.QDRANT_HOST;
  const key  = process.env.QDRANT_KEY;
  const enabled = (process.env.QDRANT_ENABLED ?? 'true').toLowerCase() !== 'false';
  if (!enabled || !host || !key) return null;
  return new QdrantClient({ url: host, apiKey: key });
}

async function embedQuery(query: string): Promise<number[] | null> {
  const provider = (process.env.EMBEDDING_PROVIDER ?? 'openai').toLowerCase();

  if (provider === 'gemini') {
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
      const model = genAI.getGenerativeModel({ model: process.env.GEMINI_EMBEDDING_MODEL ?? 'gemini-embedding-001' });
      const result = await model.embedContent(query);
      return result.embedding.values;
    } catch (err) {
      console.warn('[megamind] Gemini embedding failed:', (err as Error).message);
      return null;
    }
  }

  // Default: OpenAI
  try {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const res = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });
    return res.data[0].embedding;
  } catch (err) {
    console.warn('[megamind] OpenAI embedding failed:', (err as Error).message);
    return null;
  }
}

async function qdrantSearch(query: string, limit: number): Promise<TravelChunk[] | null> {
  const client = getQdrantClient();
  if (!client) return null;

  const embedding = await embedQuery(query);
  if (!embedding) return null;

  const collectionName = process.env.QDRANT_COLLECTION_NAME ?? 'megamind';

  try {
    const results = await client.search(collectionName, {
      vector: embedding,
      limit,
      with_payload: true,
    });

    return results.map((r) => {
      const payload = (r.payload ?? {}) as Record<string, unknown>;
      return {
        id: String(r.id),
        source: String(payload.source ?? ''),
        type:   String(payload.type ?? 'web'),
        content: String(payload.text ?? payload.content ?? ''),
        metadata: typeof payload.metadata === 'object' && payload.metadata !== null
          ? (payload.metadata as Record<string, unknown>)
          : {},
        score: r.score,
      };
    });
  } catch (err) {
    console.warn('[megamind] Qdrant search failed:', (err as Error).message);
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Search travel content: Qdrant first, SQLite LIKE fallback. */
export async function searchTravelContent(query: string, limit = 8): Promise<TravelChunk[]> {
  // Try Qdrant semantic search first
  const qdrantResults = await qdrantSearch(query, limit);
  if (qdrantResults && qdrantResults.length > 0) return qdrantResults;

  // Fall back to SQLite keyword search
  try {
    return sqliteLikeSearch(query, limit);
  } catch {
    return [];
  }
}

/** Return a random sample of travel chunks for inspiration. */
export function sampleTravelContent(limit = 5): TravelChunk[] {
  try {
    const db = getSqliteDb();
    const rows = db
      .prepare(
        `SELECT id, chunkId, source, type, content, metadata
         FROM documents
         WHERE content IS NOT NULL AND LENGTH(content) > 100
         ORDER BY RANDOM() LIMIT ?`
      )
      .all(limit) as Array<{
        id: number; chunkId: string | null; source: string; type: string;
        content: string; metadata: string;
      }>;

    return rows.map((r) => ({
      ...r,
      metadata: (() => { try { return JSON.parse(r.metadata); } catch { return {}; } })(),
    }));
  } catch {
    return [];
  }
}

/** Count total ingested documents. */
export function getTravelContentCount(): number {
  try {
    const db = getSqliteDb();
    const row = db.prepare('SELECT COUNT(*) as count FROM documents').get() as { count: number };
    return row.count;
  } catch {
    return 0;
  }
}
