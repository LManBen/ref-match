import Database from 'better-sqlite3'

export type Db = Database.Database

export function openDb(path: string): Db {
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  migrate(db)
  return db
}

function migrate(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshot (
      system     TEXT NOT NULL,
      sku        TEXT NOT NULL,
      cab        TEXT,
      name       TEXT,
      raw_json   TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_snapshot_system_sku ON snapshot(system, sku);

    CREATE TABLE IF NOT EXISTS run (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at   TEXT NOT NULL,
      finished_at  TEXT,
      sources_json TEXT NOT NULL,
      partial      INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS result (
      run_id          INTEGER NOT NULL,
      sku             TEXT NOT NULL,
      status          TEXT NOT NULL,
      per_system_json TEXT NOT NULL,
      majority_cab    TEXT,
      proposal        TEXT,
      warnings_json   TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES run(id)
    );
    CREATE INDEX IF NOT EXISTS idx_result_run_status ON result(run_id, status);
    CREATE INDEX IF NOT EXISTS idx_result_run_sku ON result(run_id, sku);
  `)
}
