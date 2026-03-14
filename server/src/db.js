const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

function initializeDatabase(dbPath) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");

  const schemaPath = path.join(__dirname, "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  db.exec(schemaSql);
  migrateTimestampColumnsToBigInt(db);

  return db;
}

function getColumnInfo(db, tableName, columnName) {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return rows.find((entry) => entry.name === columnName) || null;
}

function migrateTimestampColumnsToBigInt(db) {
  const settingsUpdatedInfo = getColumnInfo(db, "settings", "updated_at");
  const settingsKeyInfo = getColumnInfo(db, "settings", "key");
  const playlistsCreatedInfo = getColumnInfo(db, "playlists", "created_at");
  const playlistsUpdatedInfo = getColumnInfo(db, "playlists", "updated_at");

  const settingsUpdatedType = String(settingsUpdatedInfo?.type || "").trim().toUpperCase();
  const playlistsCreatedType = String(playlistsCreatedInfo?.type || "").trim().toUpperCase();
  const playlistsUpdatedType = String(playlistsUpdatedInfo?.type || "").trim().toUpperCase();
  const settingsKeyIsNotNull = Number(settingsKeyInfo?.notnull || 0) === 1;

  const needsSettingsMigration =
    (settingsUpdatedType && settingsUpdatedType !== "BIGINT") || !settingsKeyIsNotNull;
  const needsPlaylistsMigration =
    (playlistsCreatedType && playlistsCreatedType !== "BIGINT") ||
    (playlistsUpdatedType && playlistsUpdatedType !== "BIGINT");

  if (!needsSettingsMigration && !needsPlaylistsMigration) {
    return;
  }

  db.exec("PRAGMA foreign_keys = OFF");
  try {
    db.exec("BEGIN");

    if (needsSettingsMigration) {
      db.exec(`
        CREATE TABLE settings__bigint_migration (
          key TEXT NOT NULL PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at BIGINT NOT NULL
        );
        INSERT INTO settings__bigint_migration (key, value, updated_at)
        SELECT key, value, updated_at FROM settings;
        DROP TABLE settings;
        ALTER TABLE settings__bigint_migration RENAME TO settings;
      `);
    }

    if (needsPlaylistsMigration) {
      db.exec(`
        CREATE TABLE playlists__bigint_migration (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          cover_art BLOB,
          cover_art_mime TEXT,
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL
        );
        INSERT INTO playlists__bigint_migration (
          id,
          name,
          cover_art,
          cover_art_mime,
          created_at,
          updated_at
        )
        SELECT
          id,
          name,
          cover_art,
          cover_art_mime,
          created_at,
          updated_at
        FROM playlists;
        DROP TABLE playlists;
        ALTER TABLE playlists__bigint_migration RENAME TO playlists;
        CREATE INDEX IF NOT EXISTS idx_playlists_name ON playlists(name);
      `);
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }
}

function ensureDefaultSettings(db, defaults) {
  const upsert = db.prepare(
    `INSERT INTO settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  );

  const now = Date.now();
  const existing = db.prepare("SELECT key FROM settings").all();
  const existingSet = new Set(existing.map((row) => row.key));

  for (const [key, value] of Object.entries(defaults)) {
    if (!existingSet.has(key)) {
      upsert.run(key, String(value ?? ""), now);
    }
  }
}

function getSetting(db, key) {
  const row = db
    .prepare("SELECT value FROM settings WHERE key = ? LIMIT 1")
    .get(key);
  return row ? row.value : null;
}

function setSetting(db, key, value) {
  db.prepare(
    `INSERT INTO settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(key, String(value ?? ""), Date.now());
}

function getAllSettings(db) {
  const rows = db.prepare("SELECT key, value FROM settings").all();
  return rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}

module.exports = {
  initializeDatabase,
  ensureDefaultSettings,
  getSetting,
  setSetting,
  getAllSettings
};
