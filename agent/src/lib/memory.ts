/**
 * Improvement #10 — Thread / conversation memory.
 *
 * Persists Gemini chat history across REPL turns using a SQLite database
 * so the agent remembers context (e.g. "reply to the tweet I just posted").
 *
 * Each REPL session gets a unique session ID.  History is stored as JSON-
 * serialised Gemini Content objects and loaded back on the next turn.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import type { Content } from '@google/generative-ai';

const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const DB_PATH = path.resolve(__dirname, '..', '..', 'memory.db');

// Max turns to keep in memory (older turns are pruned)
const MAX_HISTORY_TURNS = 40;

let _db: ReturnType<typeof require> | null = null;

function getDb() {
  if (_db) return _db;
  const BetterSqlite3 = require('better-sqlite3');
  _db = new BetterSqlite3(DB_PATH);
  (_db as ReturnType<typeof require>).exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS messages (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      session   TEXT    NOT NULL,
      role      TEXT    NOT NULL,
      content   TEXT    NOT NULL,
      created_at TEXT   DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session);
  `);
  return _db;
}

/** Create a new session and return its ID (timestamp-based). */
export function createSession(): string {
  const id = `session_${Date.now()}`;
  const db = getDb();
  db.prepare('INSERT OR IGNORE INTO sessions(id) VALUES(?)').run(id);
  return id;
}

/** Load recent history for a session as Gemini Content[]. */
export function loadHistory(sessionId: string): Content[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT role, content FROM messages
       WHERE session = ?
       ORDER BY id DESC
       LIMIT ?`
    )
    .all(sessionId, MAX_HISTORY_TURNS) as Array<{ role: string; content: string }>;

  // Return in chronological order
  return rows
    .reverse()
    .map((r) => {
      try {
        return JSON.parse(r.content) as Content;
      } catch {
        return { role: r.role as 'user' | 'model', parts: [{ text: r.content }] };
      }
    });
}

/** Append new history turns to the session. */
export function saveHistory(sessionId: string, history: Content[]): void {
  // Only save the turns that are new (tail after what was loaded)
  const db = getDb();
  const existing = db
    .prepare('SELECT COUNT(*) as n FROM messages WHERE session = ?')
    .get(sessionId) as { n: number };
  const existingCount = existing.n;

  const newTurns = history.slice(existingCount);
  const stmt = db.prepare(
    'INSERT INTO messages(session, role, content) VALUES(?, ?, ?)'
  );

  const insertAll = db.transaction((turns: Content[]) => {
    for (const turn of turns) {
      stmt.run(sessionId, turn.role, JSON.stringify(turn));
    }
  });

  insertAll(newTurns);

  // Prune old turns beyond the limit
  db.prepare(
    `DELETE FROM messages WHERE session = ? AND id NOT IN (
       SELECT id FROM messages WHERE session = ? ORDER BY id DESC LIMIT ?
     )`
  ).run(sessionId, sessionId, MAX_HISTORY_TURNS);
}

/** List recent sessions. */
export function listSessions(limit = 10): Array<{ id: string; created_at: string }> {
  const db = getDb();
  return db
    .prepare('SELECT id, created_at FROM sessions ORDER BY created_at DESC LIMIT ?')
    .all(limit) as Array<{ id: string; created_at: string }>;
}

/** Clear all history for a session. */
export function clearSession(sessionId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM messages WHERE session = ?').run(sessionId);
}
