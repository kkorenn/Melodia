const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");

const SUPPORTED_EXTENSIONS = new Set([
  ".mp3",
  ".flac",
  ".ogg",
  ".wav",
  ".m4a",
  ".aac"
]);
const SCAN_PROGRESS_EMIT_INTERVAL_MS = 150;
const SCAN_CONCURRENCY = 4;
const SCAN_BATCH_SIZE = 300;
const COVER_THUMBNAIL_SIZE = 320;
const COVER_THUMBNAIL_QUALITY = 78;

let parseFileFn = null;

async function getParseFile() {
  if (parseFileFn) {
    return parseFileFn;
  }

  const module = await import("music-metadata");
  parseFileFn = module.parseFile;
  return parseFileFn;
}

function createScanner({ db, getMusicDir, broadcast }) {
  const state = {
    running: false,
    startedAt: null,
    completedAt: null,
    currentFile: null,
    total: 0,
    scanned: 0,
    progress: 0,
    added: 0,
    updated: 0,
    skipped: 0,
    removed: 0,
    errors: []
  };

  const selectExistingStmt = db.prepare(
    "SELECT path, last_modified, file_size, date_added FROM songs"
  );

  const upsertSongStmt = db.prepare(`
    INSERT INTO songs (
      path, filename, title, artist, album, album_artist,
      year, track_number, duration, bitrate,
      cover_art, cover_art_mime, file_size, last_modified,
      date_added, play_count, last_played
    ) VALUES (
      @path, @filename, @title, @artist, @album, @album_artist,
      @year, @track_number, @duration, @bitrate,
      @cover_art, @cover_art_mime, @file_size, @last_modified,
      @date_added, @play_count, @last_played
    )
    ON CONFLICT(path) DO UPDATE SET
      filename = excluded.filename,
      title = excluded.title,
      artist = excluded.artist,
      album = excluded.album,
      album_artist = excluded.album_artist,
      year = excluded.year,
      track_number = excluded.track_number,
      duration = excluded.duration,
      bitrate = excluded.bitrate,
      cover_art = excluded.cover_art,
      cover_art_mime = excluded.cover_art_mime,
      file_size = excluded.file_size,
      last_modified = excluded.last_modified,
      date_added = excluded.date_added
  `);

  const deleteByPathStmt = db.prepare("DELETE FROM songs WHERE path = ?");

  function snapshot() {
    return {
      ...state,
      errors: state.errors.slice(-20)
    };
  }

  function resetCounters() {
    state.startedAt = Date.now();
    state.completedAt = null;
    state.currentFile = null;
    state.total = 0;
    state.scanned = 0;
    state.progress = 0;
    state.added = 0;
    state.updated = 0;
    state.skipped = 0;
    state.removed = 0;
    state.errors = [];
  }

  function pushError(file, error) {
    state.errors.push({
      file,
      message: error instanceof Error ? error.message : String(error)
    });
  }

  async function* walkDirectory(rootDir) {
    const stack = [rootDir];

    while (stack.length > 0) {
      const current = stack.pop();
      let entries;

      try {
        entries = await fs.readdir(current, { withFileTypes: true });
      } catch (error) {
        pushError(current, error);
        continue;
      }

      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);

        if (entry.isDirectory()) {
          stack.push(fullPath);
          continue;
        }

        if (!entry.isFile()) {
          continue;
        }

        const extension = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_EXTENSIONS.has(extension)) {
          yield fullPath;
        }
      }
    }
  }

  async function toThumbnailCover(picture) {
    if (!picture?.data) {
      return {
        coverArt: null,
        coverArtMime: null
      };
    }

    try {
      const thumbnail = await sharp(picture.data, { failOnError: false })
        .rotate()
        .resize(COVER_THUMBNAIL_SIZE, COVER_THUMBNAIL_SIZE, {
          fit: "inside",
          withoutEnlargement: true
        })
        .jpeg({
          quality: COVER_THUMBNAIL_QUALITY,
          mozjpeg: true
        })
        .toBuffer();

      if (!thumbnail.length) {
        return {
          coverArt: null,
          coverArtMime: null
        };
      }

      return {
        coverArt: thumbnail,
        coverArtMime: "image/jpeg"
      };
    } catch {
      return {
        coverArt: null,
        coverArtMime: null
      };
    }
  }

  async function parseMetadata(filePath, stat, existingRow) {
    let metadata = null;

    try {
      const parseFile = await getParseFile();
      metadata = await parseFile(filePath, {
        duration: true,
        skipCovers: false
      });
    } catch (error) {
      pushError(filePath, error);
    }

    const common = metadata?.common ?? {};
    const format = metadata?.format ?? {};

    const picture = Array.isArray(common.picture) && common.picture.length > 0
      ? common.picture[0]
      : null;

    const dateAdded = existingRow?.date_added
      ? Number(existingRow.date_added)
      : Math.round(stat.birthtimeMs || stat.ctimeMs || stat.mtimeMs);

    const { coverArt, coverArtMime } = await toThumbnailCover(picture);

    return {
      path: filePath,
      filename: path.basename(filePath),
      title: common.title || path.parse(filePath).name,
      artist: common.artist || "Unknown Artist",
      album: common.album || "Unknown Album",
      album_artist: common.albumartist || common.artist || "Unknown Artist",
      year: Number.isFinite(common.year) ? common.year : null,
      track_number: common.track?.no ?? null,
      duration: Number.isFinite(format.duration) ? format.duration : null,
      bitrate: Number.isFinite(format.bitrate) ? Math.round(format.bitrate) : null,
      cover_art: coverArt,
      cover_art_mime: coverArtMime,
      file_size: stat.size,
      last_modified: Math.round(stat.mtimeMs),
      date_added: dateAdded,
      play_count: 0,
      last_played: null
    };
  }

  async function runScan() {
    if (state.running) {
      return snapshot();
    }

    resetCounters();
    state.running = true;
    broadcast("scan-state", snapshot());

    const musicDir = getMusicDir();

    try {
      const dirStat = await fs.stat(musicDir);
      if (!dirStat.isDirectory()) {
        throw new Error(`Configured MUSIC_DIR is not a directory: ${musicDir}`);
      }
    } catch (error) {
      pushError(musicDir, error);
      state.running = false;
      state.completedAt = Date.now();
      broadcast("scan-complete", snapshot());
      return snapshot();
    }

    const existingRows = selectExistingStmt.all();
    const existingByPath = new Map(
      existingRows.map((row) => [row.path, row])
    );

    const seenPaths = new Set();

    state.total = 0;
    broadcast("scan-state", snapshot());

    let lastProgressEmitAt = 0;

    const emitProgress = (force = false) => {
      const now = Date.now();
      if (force || now - lastProgressEmitAt >= SCAN_PROGRESS_EMIT_INTERVAL_MS) {
        broadcast("scan-progress", snapshot());
        lastProgressEmitAt = now;
      }
    };

    let doneDiscovering = false;
    const pendingFiles = [];
    const waitingResolvers = [];

    const upsertSongBatchTx = db.transaction((rows) => {
      for (const row of rows) {
        upsertSongStmt.run(row);
      }
    });

    const deleteBatchTx = db.transaction((paths) => {
      for (const knownPath of paths) {
        deleteByPathStmt.run(knownPath);
      }
    });

    const updateProgress = () => {
      if (!state.total) {
        state.progress = doneDiscovering ? 100 : 0;
        return;
      }

      const computed = Math.round((state.scanned / state.total) * 100);
      state.progress = doneDiscovering ? computed : Math.min(99, computed);
    };

    const takeNextFile = () => {
      if (pendingFiles.length > 0) {
        return Promise.resolve(pendingFiles.shift());
      }

      if (doneDiscovering) {
        return Promise.resolve(null);
      }

      return new Promise((resolve) => {
        waitingResolvers.push(resolve);
      });
    };

    const enqueueFile = (filePath) => {
      state.total += 1;
      updateProgress();
      emitProgress(false);

      if (waitingResolvers.length > 0) {
        const resolve = waitingResolvers.shift();
        resolve(filePath);
        return;
      }

      pendingFiles.push(filePath);
    };

    const discoveryPromise = (async () => {
      for await (const filePath of walkDirectory(musicDir)) {
        enqueueFile(filePath);
      }
      doneDiscovering = true;
      for (const resolve of waitingResolvers.splice(0)) {
        resolve(null);
      }
    })();

    async function processNextFile() {
      const pendingUpserts = [];

      const flushUpserts = () => {
        if (!pendingUpserts.length) {
          return;
        }

        const rows = pendingUpserts.splice(0, pendingUpserts.length);
        try {
          upsertSongBatchTx(rows);
        } catch (error) {
          pushError("batch-upsert", error);
          for (const row of rows) {
            try {
              upsertSongStmt.run(row);
            } catch (rowError) {
              pushError(row.path, rowError);
            }
          }
        }
      };

      while (true) {
        const filePath = await takeNextFile();
        if (!filePath) {
          break;
        }

        state.currentFile = filePath;
        seenPaths.add(filePath);

        try {
          const stat = await fs.stat(filePath);
          const existing = existingByPath.get(filePath);
          const lastModified = Math.round(stat.mtimeMs);

          if (
            existing &&
            Number(existing.last_modified) === lastModified &&
            Number(existing.file_size) === stat.size
          ) {
            state.skipped += 1;
          } else {
            const parsed = await parseMetadata(filePath, stat, existing);
            pendingUpserts.push(parsed);

            if (pendingUpserts.length >= SCAN_BATCH_SIZE) {
              flushUpserts();
            }

            if (existing) {
              state.updated += 1;
            } else {
              state.added += 1;
            }
          }
        } catch (error) {
          pushError(filePath, error);
        }

        state.scanned += 1;
        updateProgress();

        emitProgress(false);
      }

      flushUpserts();
    }

    const workerCount = Math.max(1, SCAN_CONCURRENCY);
    const workers = [];

    for (let index = 0; index < workerCount; index += 1) {
      workers.push(processNextFile());
    }

    await Promise.all([discoveryPromise, ...workers]);

    emitProgress(true);

    const removedPaths = [];
    for (const knownPath of existingByPath.keys()) {
      if (!seenPaths.has(knownPath)) {
        removedPaths.push(knownPath);
        state.removed += 1;
      }
    }

    if (removedPaths.length > 0) {
      try {
        deleteBatchTx(removedPaths);
      } catch (error) {
        pushError("batch-delete", error);
        for (const knownPath of removedPaths) {
          try {
            deleteByPathStmt.run(knownPath);
          } catch (deleteError) {
            pushError(knownPath, deleteError);
          }
        }
      }
    }

    state.running = false;
    state.currentFile = null;
    state.completedAt = Date.now();
    state.progress = 100;

    broadcast("scan-complete", snapshot());
    return snapshot();
  }

  return {
    runScan,
    getState: () => snapshot(),
    getSupportedExtensions: () => [...SUPPORTED_EXTENSIONS]
  };
}

module.exports = {
  createScanner
};
