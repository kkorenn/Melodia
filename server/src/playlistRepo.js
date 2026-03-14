const PLAYLIST_SORT_OPTIONS = {
  position: "COALESCE(ps.position, 0)",
  title: "LOWER(COALESCE(s.title, s.filename))",
  artist: "LOWER(COALESCE(s.artist, ''))",
  album: "LOWER(COALESCE(s.album, ''))",
  duration: "COALESCE(s.duration, 0)",
  year: "COALESCE(s.year, 0)",
  dateAdded: "COALESCE(s.date_added, 0)",
  addedAt: "COALESCE(ps.added_at, 0)"
};

function createPlaylistRepo(db) {
  const playlistExistsStmt = db.prepare(
    "SELECT id, name FROM playlists WHERE id = ? LIMIT 1"
  );

  const songExistsStmt = db.prepare("SELECT id FROM songs WHERE id = ? LIMIT 1");

  const normalizePlaylistPositionsTx = db.transaction((playlistId) => {
    const rows = db
      .prepare(
        "SELECT id FROM playlist_songs WHERE playlist_id = ? ORDER BY position ASC, id ASC"
      )
      .all(playlistId);

    const updatePositionStmt = db.prepare(
      "UPDATE playlist_songs SET position = ? WHERE id = ?"
    );

    rows.forEach((row, index) => {
      updatePositionStmt.run(index + 1, row.id);
    });
  });

  const addSongToPlaylistTx = db.transaction((playlistId, songId) => {
    const existing = db
      .prepare(
        "SELECT 1 FROM playlist_songs WHERE playlist_id = ? AND song_id = ? LIMIT 1"
      )
      .get(playlistId, songId);

    if (existing) {
      return { added: false };
    }

    const nextPosition = db
      .prepare(
        "SELECT COALESCE(MAX(position), 0) + 1 AS nextPosition FROM playlist_songs WHERE playlist_id = ?"
      )
      .get(playlistId).nextPosition;

    const now = Date.now();
    db.prepare(
      "INSERT INTO playlist_songs (playlist_id, song_id, position, added_at) VALUES (?, ?, ?, ?)"
    ).run(playlistId, songId, nextPosition, now);

    db.prepare("UPDATE playlists SET updated_at = ? WHERE id = ?").run(now, playlistId);

    return { added: true };
  });

  const removeSongFromPlaylistTx = db.transaction((playlistId, songId) => {
    const result = db
      .prepare("DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?")
      .run(playlistId, songId);

    if (result.changes > 0) {
      normalizePlaylistPositionsTx(playlistId);
      db.prepare("UPDATE playlists SET updated_at = ? WHERE id = ?").run(
        Date.now(),
        playlistId
      );
    }

    return result.changes;
  });

  const sortPlaylistTx = db.transaction((playlistId, by, direction) => {
    const sortExpr = PLAYLIST_SORT_OPTIONS[by] || PLAYLIST_SORT_OPTIONS.position;
    const safeDirection = direction === "DESC" ? "DESC" : "ASC";

    const rows = db
      .prepare(
        `SELECT
           ps.id
         FROM playlist_songs ps
         INNER JOIN songs s ON s.id = ps.song_id
         WHERE ps.playlist_id = ?
         ORDER BY ${sortExpr} ${safeDirection}, ps.id ASC`
      )
      .all(playlistId);

    const updatePositionStmt = db.prepare(
      "UPDATE playlist_songs SET position = ? WHERE id = ?"
    );

    rows.forEach((row, index) => {
      updatePositionStmt.run(index + 1, row.id);
    });

    db.prepare("UPDATE playlists SET updated_at = ? WHERE id = ?").run(
      Date.now(),
      playlistId
    );
  });

  return {
    playlistSortOptions: PLAYLIST_SORT_OPTIONS,
    playlistExistsStmt,
    songExistsStmt,
    addSongToPlaylistTx,
    removeSongFromPlaylistTx,
    sortPlaylistTx
  };
}

module.exports = {
  createPlaylistRepo
};
