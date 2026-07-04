/**
 * Per-conversation-session store for TVA OTA bearer tokens.
 *
 * Each MCP tool call spawns a fresh stdio child process (see tva-client.ts),
 * so a token can't just live in memory between turns — it has to be
 * persisted here, keyed by the same session ID used for Gemini chat history
 * (see memory.ts), and re-injected into the child process environment on
 * the next turn. The token is never part of the Gemini conversation itself.
 */
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.resolve(__dirname, "..", "..", "tva-sessions.db");

// Guardrail against a chat-driven brute-force login loop.
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

let _db: ReturnType<typeof require> | null = null;

function getDb() {
	if (_db) return _db;
	const BetterSqlite3 = require("better-sqlite3");
	_db = new BetterSqlite3(DB_PATH);
	(_db as ReturnType<typeof require>).exec(`
    CREATE TABLE IF NOT EXISTS tva_sessions (
      session_id TEXT PRIMARY KEY,
      token      TEXT NOT NULL,
      user_uuid  TEXT,
      name       TEXT,
      email      TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS tva_login_attempts (
      session_id   TEXT PRIMARY KEY,
      count        INTEGER NOT NULL DEFAULT 0,
      window_start INTEGER NOT NULL
    );
  `);
	return _db;
}

export interface TvaSession {
	token: string;
	userUuid?: string;
	name?: string;
	email?: string;
}

export function saveTvaSession(sessionId: string, session: TvaSession): void {
	getDb()
		.prepare(
			`INSERT INTO tva_sessions (session_id, token, user_uuid, name, email, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(session_id) DO UPDATE SET
         token = excluded.token, user_uuid = excluded.user_uuid,
         name = excluded.name, email = excluded.email, updated_at = excluded.updated_at`,
		)
		.run(sessionId, session.token, session.userUuid ?? null, session.name ?? null, session.email ?? null);
}

export function getTvaSession(sessionId: string): TvaSession | null {
	const row = getDb()
		.prepare("SELECT token, user_uuid as userUuid, name, email FROM tva_sessions WHERE session_id = ?")
		.get(sessionId) as TvaSession | undefined;
	return row ?? null;
}

export function clearTvaSession(sessionId: string): void {
	getDb().prepare("DELETE FROM tva_sessions WHERE session_id = ?").run(sessionId);
}

/** Returns false (and does not record the attempt) if the session has hit the login attempt limit. */
export function tryRecordLoginAttempt(sessionId: string): boolean {
	const db = getDb();
	const now = Date.now();
	const row = db
		.prepare("SELECT count, window_start FROM tva_login_attempts WHERE session_id = ?")
		.get(sessionId) as { count: number; window_start: number } | undefined;

	if (!row || now - row.window_start > LOGIN_ATTEMPT_WINDOW_MS) {
		db.prepare(
			`INSERT INTO tva_login_attempts (session_id, count, window_start) VALUES (?, 1, ?)
       ON CONFLICT(session_id) DO UPDATE SET count = 1, window_start = excluded.window_start`,
		).run(sessionId, now);
		return true;
	}

	if (row.count >= MAX_LOGIN_ATTEMPTS) return false;

	db.prepare("UPDATE tva_login_attempts SET count = count + 1 WHERE session_id = ?").run(sessionId);
	return true;
}
