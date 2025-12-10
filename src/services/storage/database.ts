import path from 'path';
import { fileURLToPath } from 'url';

// Define an interface for the document row to improve type safety
interface DocumentRow {
  id: number;
  source: string;
  type: string;
  content: string | null;
  metadata: string; // Stored as JSON string
  ingested_at: string; // Timestamp string
}

interface ParsedDocumentRow extends Omit<DocumentRow, 'metadata'> {
  metadata: any; // Parsed metadata object
}

export class DatabaseService {
  private db: any = null; // better-sqlite3 Database instance
  private dbPath: string;
  private usingInMemory: boolean = false;
  private inMemoryStore: Map<number, DocumentRow> = new Map();
  private nextInMemoryId = 1;

  constructor(dbName: string = 'ingestor.db') {
    // Store the database file in the project root for simplicity
    // Compute __dirname equivalent in ESM using import.meta.url
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    // __dirname will be in ./dist when compiled, so we need to go up two levels
    this.dbPath = path.join(__dirname, '..', '..', dbName);
  }

  async initialize(): Promise<void> {
    // Lazy-load better-sqlite3 at runtime
    const { createRequire } = await import('module');
    const requireFunc = createRequire(import.meta.url);

    let BetterSqlite3: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      BetterSqlite3 = requireFunc('better-sqlite3');
      this.db = new BetterSqlite3(this.dbPath);
    } catch (err: any) {
      console.warn('Could not load better-sqlite3 native module; falling back to in-memory storage.');
      console.warn('Reason:', err && err.message ? err.message : err);
      console.warn('If you want persistent storage please install/build better-sqlite3 or configure a DATABASE_URL to use a different database.');
      this.usingInMemory = true;
      this.inMemoryStore = new Map();
      this.nextInMemoryId = 1;
    }

    // If using a disk sqlite DB, set up schema and PRAGMA. In-memory fallback skips this.
    if (this.db) {
      // Enable foreign key constraints
      this.db.pragma('foreign_keys = ON');

      // Create tables if they don't exist
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source TEXT NOT NULL,
          type TEXT NOT NULL,
          content TEXT,
          metadata TEXT,
          ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log(`Database initialized at ${this.dbPath}`);
    } else {
      console.log('Using in-memory document store (no better-sqlite3 available).');
    }
  }

  async saveDocument(source: string, type: string, content: string | null, metadata: any): Promise<number | null> {
    if (this.usingInMemory) {
      const id = this.nextInMemoryId++;
      const row: DocumentRow = {
        id,
        source,
        type,
        content,
        metadata: JSON.stringify(metadata),
        ingested_at: new Date().toISOString(),
      };
      this.inMemoryStore.set(id, row);
      return id;
    }

    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }

    try {
      const metadataJson = JSON.stringify(metadata);
      const stmt = this.db.prepare(
        'INSERT INTO documents (source, type, content, metadata) VALUES (?, ?, ?, ?)'
      );
      const result = stmt.run(source, type, content, metadataJson);
      return result.lastInsertRowid as number;
    } catch (error: any) {
      console.error(`Error saving document: ${error.message}`);
      return null;
    }
  }

  async getDocumentById(id: number): Promise<ParsedDocumentRow | null> {
    if (this.usingInMemory) {
      const row = this.inMemoryStore.get(id);
      if (!row) return null;
      const parsedRow: ParsedDocumentRow = {
        ...row,
        metadata: JSON.parse(row.metadata),
      };
      return parsedRow;
    }

    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    try {
      const stmt = this.db.prepare('SELECT * FROM documents WHERE id = ?');
      const row = stmt.get(id) as DocumentRow | undefined;
      if (row) {
        const parsedRow: ParsedDocumentRow = {
          ...row,
          metadata: JSON.parse(row.metadata),
        };
        return parsedRow;
      }
      return null;
    } catch (error: any) {
      console.error(`Error getting document by ID ${id}: ${error.message}`);
      return null;
    }
  }

  async getAllDocuments(): Promise<ParsedDocumentRow[]> {
    if (this.usingInMemory) {
      const rows = Array.from(this.inMemoryStore.values());
      return rows.map(row => ({
        ...row,
        metadata: JSON.parse(row.metadata),
      }));
    }

    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    try {
      const stmt = this.db.prepare('SELECT * FROM documents');
      const rows = stmt.all() as DocumentRow[];
      return rows.map(row => ({
        ...row,
        metadata: JSON.parse(row.metadata),
      }));
    } catch (error: any) {
      console.error(`Error getting all documents: ${error.message}`);
      return [];
    }
  }

  async close(): Promise<void> {
    if (this.usingInMemory) {
      this.inMemoryStore.clear();
      this.usingInMemory = false;
      console.log('In-memory database cleared.');
      return;
    }

    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('Database connection closed.');
    }
  }
}
