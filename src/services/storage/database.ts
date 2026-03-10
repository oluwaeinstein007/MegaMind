import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

interface DocumentRow {
  id: number;
  chunkId?: string | null;
  source: string;
  type: string;
  content: string | null;
  metadata: string;
  content_hash?: string | null;
  ingested_at: string;
}

interface ParsedDocumentRow extends Omit<DocumentRow, 'metadata'> {
  metadata: any;
}

export interface BatchChunk {
  chunkId: string;
  source: string;
  type: string;
  content: string | null;
  metadata: any;
  contentHash: string;
}

export class DatabaseService {
  private db: any = null;
  private dbPath: string;
  private usingInMemory = false;
  private inMemoryStore: Map<number, DocumentRow> = new Map();
  private inMemoryHashes: Set<string> = new Set();
  private nextInMemoryId = 1;

  constructor(dbName = 'ingestor.db') {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    this.dbPath = path.join(__dirname, '..', '..', dbName);
  }

  static computeHash(source: string, content: string): string {
    return createHash('sha256').update(`${source}:${content}`).digest('hex');
  }

  async initialize(): Promise<void> {
    const { createRequire } = await import('module');
    const requireFunc = createRequire(import.meta.url);

    let BetterSqlite3: any;
    try {
      BetterSqlite3 = requireFunc('better-sqlite3');
      this.db = new BetterSqlite3(this.dbPath);
    } catch (err: any) {
      console.warn('Could not load better-sqlite3; falling back to in-memory storage. Reason:', err?.message ?? err);
      this.usingInMemory = true;
      return;
    }

    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chunkId TEXT,
        source TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT,
        metadata TEXT,
        content_hash TEXT,
        ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_documents_source ON documents(source);
      CREATE INDEX IF NOT EXISTS idx_documents_chunk_id ON documents(chunkId);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_content_hash ON documents(content_hash)
        WHERE content_hash IS NOT NULL;
    `);

    // Migration: add content_hash column if missing (for existing databases)
    const cols = this.db.prepare('PRAGMA table_info(documents)').all() as Array<{ name: string }>;
    if (!cols.some(c => c.name === 'content_hash')) {
      this.db.exec('ALTER TABLE documents ADD COLUMN content_hash TEXT;');
      this.db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_content_hash ON documents(content_hash)
          WHERE content_hash IS NOT NULL;
      `);
      console.log('Database migrated: added content_hash column.');
    }

    console.log(`Database initialized at ${this.dbPath}`);
  }

  batchHashExists(hashes: string[]): Set<string> {
    if (hashes.length === 0) return new Set();
    if (this.usingInMemory) {
      return new Set(hashes.filter(h => this.inMemoryHashes.has(h)));
    }
    if (!this.db) return new Set();
    const placeholders = hashes.map(() => '?').join(',');
    const rows = this.db
      .prepare(`SELECT content_hash FROM documents WHERE content_hash IN (${placeholders})`)
      .all(...hashes) as Array<{ content_hash: string }>;
    return new Set(rows.map(r => r.content_hash));
  }

  saveDocumentBatch(chunks: BatchChunk[]): number {
    if (chunks.length === 0) return 0;

    if (this.usingInMemory) {
      let saved = 0;
      for (const chunk of chunks) {
        if (!this.inMemoryHashes.has(chunk.contentHash)) {
          const id = this.nextInMemoryId++;
          this.inMemoryStore.set(id, {
            id,
            chunkId: chunk.chunkId,
            source: chunk.source,
            type: chunk.type,
            content: chunk.content,
            metadata: JSON.stringify(chunk.metadata),
            content_hash: chunk.contentHash,
            ingested_at: new Date().toISOString(),
          });
          this.inMemoryHashes.add(chunk.contentHash);
          saved++;
        }
      }
      return saved;
    }

    if (!this.db) throw new Error('Database not initialized.');

    const stmt = this.db.prepare(
      'INSERT OR IGNORE INTO documents (chunkId, source, type, content, metadata, content_hash) VALUES (?, ?, ?, ?, ?, ?)'
    );

    const insertBatch = this.db.transaction((rows: BatchChunk[]) => {
      let saved = 0;
      for (const row of rows) {
        const result = stmt.run(
          row.chunkId,
          row.source,
          row.type,
          row.content,
          JSON.stringify(row.metadata),
          row.contentHash
        );
        if (result.changes > 0) saved++;
      }
      return saved;
    });

    return insertBatch(chunks);
  }

  async saveDocument(
    source: string,
    type: string,
    content: string | null,
    metadata: any,
    chunkId?: string,
    contentHash?: string
  ): Promise<number | null> {
    if (this.usingInMemory) {
      if (contentHash && this.inMemoryHashes.has(contentHash)) return null;
      const id = this.nextInMemoryId++;
      this.inMemoryStore.set(id, {
        id,
        chunkId: chunkId || null,
        source,
        type,
        content,
        metadata: JSON.stringify(metadata),
        content_hash: contentHash || null,
        ingested_at: new Date().toISOString(),
      });
      if (contentHash) this.inMemoryHashes.add(contentHash);
      return id;
    }

    if (!this.db) throw new Error('Database not initialized. Call initialize() first.');

    try {
      const stmt = this.db.prepare(
        'INSERT OR IGNORE INTO documents (chunkId, source, type, content, metadata, content_hash) VALUES (?, ?, ?, ?, ?, ?)'
      );
      const result = stmt.run(chunkId || null, source, type, content, JSON.stringify(metadata), contentHash || null);
      return result.changes > 0 ? (result.lastInsertRowid as number) : null;
    } catch (error: any) {
      console.error(`Error saving document: ${error.message}`);
      return null;
    }
  }

  async deleteDocument(id: number): Promise<{ chunkId: string | null; deleted: boolean }> {
    if (this.usingInMemory) {
      const row = this.inMemoryStore.get(id);
      if (!row) return { chunkId: null, deleted: false };
      this.inMemoryStore.delete(id);
      if (row.content_hash) this.inMemoryHashes.delete(row.content_hash);
      return { chunkId: row.chunkId || null, deleted: true };
    }

    if (!this.db) throw new Error('Database not initialized.');
    const row = this.db
      .prepare('SELECT chunkId, content_hash FROM documents WHERE id = ?')
      .get(id) as { chunkId: string | null; content_hash: string | null } | undefined;
    if (!row) return { chunkId: null, deleted: false };
    this.db.prepare('DELETE FROM documents WHERE id = ?').run(id);
    return { chunkId: row.chunkId, deleted: true };
  }

  async deleteBySource(source: string): Promise<{ chunkIds: string[]; count: number }> {
    if (this.usingInMemory) {
      const toDelete: number[] = [];
      const chunkIds: string[] = [];
      for (const [id, row] of this.inMemoryStore) {
        if (row.source === source) {
          toDelete.push(id);
          if (row.chunkId) chunkIds.push(row.chunkId);
          if (row.content_hash) this.inMemoryHashes.delete(row.content_hash);
        }
      }
      for (const id of toDelete) this.inMemoryStore.delete(id);
      return { chunkIds, count: toDelete.length };
    }

    if (!this.db) throw new Error('Database not initialized.');
    const rows = this.db
      .prepare('SELECT chunkId FROM documents WHERE source = ?')
      .all(source) as Array<{ chunkId: string | null }>;
    const chunkIds = rows.map(r => r.chunkId).filter(Boolean) as string[];
    const result = this.db.prepare('DELETE FROM documents WHERE source = ?').run(source);
    return { chunkIds, count: result.changes };
  }

  async getDocumentById(id: number): Promise<ParsedDocumentRow | null> {
    if (this.usingInMemory) {
      const row = this.inMemoryStore.get(id);
      if (!row) return null;
      return { ...row, metadata: JSON.parse(row.metadata) };
    }

    if (!this.db) throw new Error('Database not initialized.');
    try {
      const row = this.db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as DocumentRow | undefined;
      if (!row) return null;
      return { ...row, metadata: JSON.parse(row.metadata) };
    } catch (error: any) {
      console.error(`Error getting document by ID ${id}: ${error.message}`);
      return null;
    }
  }

  async getDocumentByChunkId(chunkId: string): Promise<ParsedDocumentRow | null> {
    if (this.usingInMemory) {
      for (const row of this.inMemoryStore.values()) {
        if (row.chunkId === chunkId) return { ...row, metadata: JSON.parse(row.metadata) };
      }
      return null;
    }

    if (!this.db) throw new Error('Database not initialized.');
    try {
      const row = this.db
        .prepare('SELECT * FROM documents WHERE chunkId = ?')
        .get(chunkId) as DocumentRow | undefined;
      if (!row) return null;
      return { ...row, metadata: JSON.parse(row.metadata) };
    } catch (error: any) {
      console.error(`Error getting document by chunkId ${chunkId}: ${error.message}`);
      return null;
    }
  }

  async getAllDocuments(limit?: number, offset?: number): Promise<ParsedDocumentRow[]> {
    if (this.usingInMemory) {
      const rows = Array.from(this.inMemoryStore.values());
      const start = offset ?? 0;
      const end = limit !== undefined ? start + limit : rows.length;
      return rows.slice(start, end).map(row => ({ ...row, metadata: JSON.parse(row.metadata) }));
    }

    if (!this.db) throw new Error('Database not initialized.');
    try {
      const params: any[] = [];
      let sql = 'SELECT * FROM documents ORDER BY ingested_at DESC';
      if (limit !== undefined) { sql += ' LIMIT ?'; params.push(limit); }
      if (offset !== undefined) { sql += ' OFFSET ?'; params.push(offset); }
      const rows = this.db.prepare(sql).all(...params) as DocumentRow[];
      return rows.map(row => ({ ...row, metadata: JSON.parse(row.metadata) }));
    } catch (error: any) {
      console.error(`Error getting all documents: ${error.message}`);
      return [];
    }
  }

  async getDocumentCount(): Promise<number> {
    if (this.usingInMemory) return this.inMemoryStore.size;
    if (!this.db) return 0;
    const result = this.db.prepare('SELECT COUNT(*) as count FROM documents').get() as { count: number };
    return result.count;
  }

  async close(): Promise<void> {
    if (this.usingInMemory) {
      this.inMemoryStore.clear();
      this.inMemoryHashes.clear();
      return;
    }
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
