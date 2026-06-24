import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

let db: Database.Database;

export function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'ilovepdf_local.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS file_history (
      id TEXT PRIMARY KEY,
      tool_name TEXT NOT NULL,
      input_files TEXT NOT NULL,      -- JSON string array
      output_file TEXT NOT NULL,
      status TEXT NOT NULL,           -- SUCCESS, FAILED
      error_message TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS license (
      key TEXT PRIMARY KEY,
      license_key TEXT NOT NULL,
      licensee TEXT NOT NULL,
      tier TEXT NOT NULL,             -- FREE, PRO
      expires_at TEXT NOT NULL,
      activated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export function saveHistory(history: {
  id: string;
  tool_name: string;
  input_files: string[];
  output_file: string;
  status: string;
  error_message?: string;
}) {
  const stmt = db.prepare(`
    INSERT INTO file_history (id, tool_name, input_files, output_file, status, error_message)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    history.id,
    history.tool_name,
    JSON.stringify(history.input_files),
    history.output_file,
    history.status,
    history.error_message || null
  );
}

export function getHistory(limit = 50) {
  const stmt = db.prepare(`
    SELECT * FROM file_history ORDER BY timestamp DESC LIMIT ?
  `);
  const rows = stmt.all(limit) as Array<{
    id: string;
    tool_name: string;
    input_files: string;
    output_file: string;
    status: string;
    error_message: string | null;
    timestamp: string;
  }>;

  return rows.map(r => ({
    ...r,
    input_files: JSON.parse(r.input_files) as string[]
  }));
}

export function saveSetting(key: string, value: string) {
  const stmt = db.prepare(`
    INSERT INTO settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
  stmt.run(key, value);
}

export function getSetting(key: string, defaultValue = ''): string {
  const stmt = db.prepare(`SELECT value FROM settings WHERE key = ?`);
  const row = stmt.get(key) as { value: string } | undefined;
  return row ? row.value : defaultValue;
}

export function saveLicense(licenseData: {
  license_key: string;
  licensee: string;
  tier: string;
  expires_at: string;
}) {
  // Clear any existing license first
  db.prepare(`DELETE FROM license`).run();
  
  const stmt = db.prepare(`
    INSERT INTO license (key, license_key, licensee, tier, expires_at)
    VALUES ('active', ?, ?, ?, ?)
  `);
  stmt.run(
    licenseData.license_key,
    licenseData.licensee,
    licenseData.tier,
    licenseData.expires_at
  );
}

export function getLicense() {
  const stmt = db.prepare(`SELECT * FROM license WHERE key = 'active'`);
  return stmt.get() as {
    license_key: string;
    licensee: string;
    tier: string;
    expires_at: string;
    activated_at: string;
  } | undefined;
}

export function clearLicense() {
  db.prepare(`DELETE FROM license`).run();
}
