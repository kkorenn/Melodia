const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const { createPlaylistRepo } = require("../src/playlistRepo");

function createTestDatabase() {
  const db = new Database(":memory:");
  const schemaPath = path.join(__dirname, "..", "..", "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  db.exec(schemaSql);
  return db;
}

function insertSong(db, values) {
  db.prepare(
    `INSERT INTO songs (
      path,
      filename,
      title,
      artist,
      album,
      album_artist,
      last_modified,
      file_size
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    values.path,
    values.filename,
    values.title,
    values.artist,
    values.album,
    values.albumArtist,
    Date.now(),
    1024
  );
}

test("playlist repo lifecycle helpers keep playlist metadata in sqlite", () => {
  const db = createTestDatabase();
  const repo = createPlaylistRepo(db);

  const created = repo.createPlaylistTx("Focus");
  assert.ok(created.id > 0);
  assert.equal(created.name, "Focus");

  const renamed = repo.renamePlaylistTx(created.id, "Workout");
  assert.deepEqual(
    Object.keys(renamed).sort(),
    ["id", "name", "updatedAt"]
  );
  assert.equal(renamed.name, "Workout");

  const cover = repo.setPlaylistCoverTx(created.id, Buffer.from("art"), "image/png");
  assert.equal(cover.id, created.id);
  const coverRow = db
    .prepare(
      "SELECT cover_art_mime AS coverArtMime, length(cover_art) AS coverBytes FROM playlists WHERE id = ?"
    )
    .get(created.id);
  assert.equal(coverRow.coverArtMime, "image/png");
  assert.equal(coverRow.coverBytes, 3);

  const cleared = repo.clearPlaylistCoverTx(created.id);
  assert.equal(cleared.id, created.id);
  const clearedRow = db
    .prepare(
      "SELECT cover_art AS coverArt, cover_art_mime AS coverArtMime FROM playlists WHERE id = ?"
    )
    .get(created.id);
  assert.equal(clearedRow.coverArt, null);
  assert.equal(clearedRow.coverArtMime, null);

  const deleted = repo.deletePlaylistTx(created.id);
  assert.equal(deleted, 1);
  assert.equal(repo.playlistExistsStmt.get(created.id), undefined);
});

test("playlist repo add, remove, and sort helpers keep positions stable", () => {
  const db = createTestDatabase();
  insertSong(db, {
    path: "/music/zeta.mp3",
    filename: "zeta.mp3",
    title: "Zeta",
    artist: "Beta",
    album: "Late",
    albumArtist: "Beta"
  });
  insertSong(db, {
    path: "/music/alpha.mp3",
    filename: "alpha.mp3",
    title: "Alpha",
    artist: "Alpha",
    album: "Early",
    albumArtist: "Alpha"
  });
  insertSong(db, {
    path: "/music/gamma.mp3",
    filename: "gamma.mp3",
    title: "Gamma",
    artist: "Gamma",
    album: "Middle",
    albumArtist: "Gamma"
  });

  const repo = createPlaylistRepo(db);
  const playlist = repo.createPlaylistTx("Sort Test");

  repo.addSongToPlaylistTx(playlist.id, 1);
  repo.addSongToPlaylistTx(playlist.id, 2);
  repo.addSongToPlaylistTx(playlist.id, 3);

  repo.removeSongFromPlaylistTx(playlist.id, 2);

  let rows = db
    .prepare(
      "SELECT song_id AS songId, position FROM playlist_songs WHERE playlist_id = ? ORDER BY position ASC"
    )
    .all(playlist.id);
  assert.deepEqual(rows, [
    { songId: 1, position: 1 },
    { songId: 3, position: 2 }
  ]);

  repo.addSongToPlaylistTx(playlist.id, 2);
  repo.sortPlaylistTx(playlist.id, "title", "ASC");

  rows = db
    .prepare(
      `SELECT
         s.title AS title,
         ps.position AS position
       FROM playlist_songs ps
       INNER JOIN songs s ON s.id = ps.song_id
       WHERE ps.playlist_id = ?
       ORDER BY ps.position ASC`
    )
    .all(playlist.id);

  assert.deepEqual(rows, [
    { title: "Alpha", position: 1 },
    { title: "Gamma", position: 2 },
    { title: "Zeta", position: 3 }
  ]);
});
