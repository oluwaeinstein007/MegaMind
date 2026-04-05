/**
 * MegaMind travel-content bridge.
 *
 * Queries the MegaMind SQLite database directly so the agent can ground its
 * social posts in real ingested travel data (visa info, destinations, tips, etc.).
 *
 * Set MEGAMIND_DB_PATH to point at MegaMind's ingestor.db (default: ../dist/ingestor.db).
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

export interface TravelChunk {
  id: number;
  chunkId: string | null;
  source: string;
  type: string;
  content: string;
  metadata: Record<string, unknown>;
  ingested_at: string;
}

function resolveDbPath(): string {
  if (process.env.MEGAMIND_DB_PATH) {
    return path.resolve(process.env.MEGAMIND_DB_PATH);
  }
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, '..', '..', '..', 'dist', 'ingestor.db');
}

let _db: ReturnType<typeof require> | null = null;

function getDb() {
  if (_db) return _db;
  const dbPath = resolveDbPath();
  try {
    const BetterSqlite3 = require('better-sqlite3');
    _db = new BetterSqlite3(dbPath, { readonly: true });
    return _db;
  } catch {
    throw new Error(
      `Cannot open MegaMind database at "${dbPath}". ` +
        'Run the MegaMind ingestor first, or set MEGAMIND_DB_PATH.'
    );
  }
}

/** Full-text keyword search across all ingested travel chunks. */
export function searchTravelContent(query: string, limit = 8): TravelChunk[] {
  const db = getDb();
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `%${t}%`);

  if (terms.length === 0) return [];

  // Build a WHERE clause that ANDs each term across both content and source
  const conditions = terms.map(() => '(LOWER(content) LIKE ? OR LOWER(source) LIKE ?)').join(' AND ');
  const params: string[] = terms.flatMap((t) => [t, t]);
  params.push(String(limit));

  const sql = `
    SELECT id, chunkId, source, type, content, metadata, ingested_at
    FROM documents
    WHERE content IS NOT NULL AND ${conditions}
    ORDER BY ingested_at DESC
    LIMIT ?
  `;

  const rows = db.prepare(sql).all(...params) as Array<{
    id: number;
    chunkId: string | null;
    source: string;
    type: string;
    content: string;
    metadata: string;
    ingested_at: string;
  }>;

  return rows.map((r) => ({
    ...r,
    metadata: (() => {
      try {
        return JSON.parse(r.metadata);
      } catch {
        return {};
      }
    })(),
  }));
}

/** Return a random sample of travel chunks for inspiration posts. */
export function sampleTravelContent(limit = 5): TravelChunk[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, chunkId, source, type, content, metadata, ingested_at
       FROM documents
       WHERE content IS NOT NULL AND LENGTH(content) > 100
       ORDER BY RANDOM()
       LIMIT ?`
    )
    .all(limit) as Array<{
    id: number;
    chunkId: string | null;
    source: string;
    type: string;
    content: string;
    metadata: string;
    ingested_at: string;
  }>;

  return rows.map((r) => ({
    ...r,
    metadata: (() => {
      try {
        return JSON.parse(r.metadata);
      } catch {
        return {};
      }
    })(),
  }));
}

/** Count total ingested documents. */
export function getTravelContentCount(): number {
  try {
    const db = getDb();
    const row = db.prepare('SELECT COUNT(*) as count FROM documents').get() as { count: number };
    return row.count;
  } catch {
    return 0;
  }
}
