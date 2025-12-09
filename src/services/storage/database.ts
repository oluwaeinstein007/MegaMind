import { open, Database } from 'sqlite';
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
  private db: Database | null = null;
  private dbPath: string;

  constructor(dbName: string = 'ingestor.db') {
    // Store the database file in the project root for simplicity
    // Compute __dirname equivalent in ESM using import.meta.url
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    // __dirname will be in ./dist when compiled, so we need to go up two levels
    this.dbPath = path.join(__dirname, '..', '..', dbName);
  }

  async initialize(): Promise<void> {
    // Lazy-load sqlite3 at runtime to avoid top-level native binding errors
    // (which can happen when the native addon isn't built for the current Node.js).
    const { createRequire } = await import('module');
    const requireFunc = createRequire(import.meta.url);

    let sqlite3: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      sqlite3 = requireFunc('sqlite3');
    } catch (err: any) {
      console.error('Failed to load sqlite3 native module.');
      console.error('Reason:', err && err.message ? err.message : err);
      console.error('Possible fixes:');
      console.error('- Run `pnpm rebuild sqlite3` or `pnpm rebuild` to rebuild native modules for your Node version.');
      console.error('- Ensure you have the required build toolchain (python, make, gcc) for node-gyp.');
      console.error('- If you do not need sqlite3, remove it from dependencies.');
      throw err;
    }

    this.db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database,
    });

    // Enable foreign key constraints
    await this.db.run('PRAGMA foreign_keys = ON;');

    // Create tables if they don't exist
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT,
        metadata TEXT, -- Store metadata as JSON string
        ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log(`Database initialized at ${this.dbPath}`);
  }

  async saveDocument(source: string, type: string, content: string | null, metadata: any): Promise<number | null> {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    try {
      const metadataJson = JSON.stringify(metadata);
      const result = await this.db.run(
        'INSERT INTO documents (source, type, content, metadata) VALUES (?, ?, ?, ?)',
        [source, type, content, metadataJson]
      );
      // result.lastID can be undefined if the insert fails or if there's no auto-incrementing PK.
      // We return null in such cases to match the function's return type.
      return result.lastID ?? null;
    } catch (error: any) {
      console.error(`Error saving document: ${error.message}`);
      return null;
    }
  }

  async getDocumentById(id: number): Promise<ParsedDocumentRow | null> {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    try {
      // Use type assertion for the row to satisfy TypeScript
      const row = await this.db.get<DocumentRow>('SELECT * FROM documents WHERE id = ?', [id]);
      if (row) {
        // Parse metadata back to object
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
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    try {
      const rows = await this.db.all<DocumentRow[]>('SELECT * FROM documents');
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
    if (this.db) {
      await this.db.close();
      this.db = null;
      console.log('Database connection closed.');
    }
  }
}
