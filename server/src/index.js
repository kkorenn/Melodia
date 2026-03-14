const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const mime = require("mime-types");
const openModule = require("open");

const { getConfig } = require("./config");
const {
  initializeDatabase,
  ensureDefaultSettings,
  getSetting
} = require("./db");
const { getPrisma } = require("./prisma");
const { createScanner } = require("./scanner");
const { createSseHub } = require("./sse");
const { createPlaylistRepo } = require("./playlistRepo");

const config = getConfig();
const db = initializeDatabase(config.dbPath);
const prisma = getPrisma(config.dbPath);
const openBrowser =
  typeof openModule === "function" ? openModule : openModule.default;

const app = express();
const sseHub = createSseHub();
const LRCLIB_SEARCH_URL = "https://lrclib.net/api/search";
const LRCLIB_USER_AGENT = "Melodia-Lyrics/1.0 (+https://github.com)";
const LYRICS_CACHE_TTL_MS = config.lyricsCacheTtlHours * 60 * 60 * 1000;
const LYRICS_ERROR_CACHE_TTL_MS = 5 * 60 * 1000;

const LYRICS_STATUS = {
  OK: "ok",
  NO_MATCH: "no_match",
  NO_LYRICS: "no_lyrics",
  ERROR: "error"
};

const SONG_COLUMNS = `
  id,
  path,
  filename,
  title,
  artist,
  album,
  album_artist AS albumArtist,
  year,
  track_number AS trackNumber,
  duration,
  bitrate,
  file_size AS fileSize,
  last_modified AS lastModified,
  date_added AS dateAdded,
  play_count AS playCount,
  last_played AS lastPlayed,
  CASE WHEN cover_art IS NOT NULL THEN 1 ELSE 0 END AS hasArt
`;

const SORT_OPTIONS = {
  title: "LOWER(COALESCE(title, filename))",
  artist: "LOWER(COALESCE(artist, ''))",
  album: "LOWER(COALESCE(album, ''))",
  year: "COALESCE(year, 0)",
  dateAdded: "COALESCE(date_added, 0)",
  playCount: "COALESCE(play_count, 0)",
  lastPlayed: "COALESCE(last_played, 0)",
  duration: "COALESCE(duration, 0)"
};

const ALBUM_TITLE_EXPR = "COALESCE(NULLIF(album, ''), 'Unknown Album')";
const ALBUM_ARTIST_EXPR =
  "COALESCE(NULLIF(album_artist, ''), COALESCE(NULLIF(artist, ''), 'Unknown Artist'))";
const ARTIST_EXPR = "COALESCE(NULLIF(artist, ''), 'Unknown Artist')";
const DEFAULT_COLOR_SCHEME = {
  mode: "preset",
  preset: "melodia",
  custom: {
    dark: {
      shell: "#050a10",
      panel: "#0e1622",
      panelSoft: "#152334",
      text: "#e5eef8",
      textSoft: "#93a2b8",
      accent: "#14b8a6",
      accentWarm: "#f59e0b"
    },
    light: {
      shell: "#f4f8fc",
      panel: "#ffffff",
      panelSoft: "#ecf2f8",
      text: "#0c1420",
      textSoft: "#4d6278",
      accent: "#0d9488",
      accentWarm: "#f59e0b"
    }
  }
};
const SETTINGS_AUTH_COOKIE_NAME = "melodia_settings_session";
const SETTINGS_PASSWORD_MAX_LENGTH = 512;
const SETTINGS_LOGIN_PRUNE_INTERVAL_MS = 60 * 60 * 1000;
const SETTINGS_SESSION_PRUNE_INTERVAL_MS = 15 * 60 * 1000;

ensureDefaultSettings(db, {
  music_dir: config.musicDir,
  port: String(config.port),
  theme: config.theme,
  app_name: config.appName,
  color_scheme: JSON.stringify(DEFAULT_COLOR_SCHEME)
});

const scanner = createScanner({
  db,
  getMusicDir: () => getSetting(db, "music_dir") || config.musicDir,
  broadcast: (event, payload) => sseHub.broadcast(event, payload)
});

const markPlayedTx = db.transaction((songId, playedAt) => {
  db.prepare(
    "UPDATE songs SET play_count = play_count + 1, last_played = ? WHERE id = ?"
  ).run(playedAt, songId);
  db.prepare("INSERT INTO play_history (song_id, played_at) VALUES (?, ?)").run(
    songId,
    playedAt
  );
});

const {
  playlistSortOptions: PLAYLIST_SORT_OPTIONS,
  playlistExistsStmt,
  songExistsStmt,
  addSongToPlaylistTx,
  removeSongFromPlaylistTx,
  sortPlaylistTx
} = createPlaylistRepo(db);

const songForLyricsStmt = db.prepare(
  `SELECT
    id,
    title,
    artist,
    album,
    filename
   FROM songs
   WHERE id = ?
   LIMIT 1`
);
const lyricsCacheBySongStmt = db.prepare(
  `SELECT
    song_id AS songId,
    provider,
    status,
    lyrics,
    language,
    copyright,
    track_id AS trackId,
    fetched_at AS fetchedAt,
    expires_at AS expiresAt,
    error_message AS errorMessage
   FROM lyrics_cache
   WHERE song_id = ?
   LIMIT 1`
);
const upsertLyricsCacheStmt = db.prepare(
  `INSERT INTO lyrics_cache (
    song_id,
    provider,
    status,
    lyrics,
    language,
    copyright,
    track_id,
    fetched_at,
    expires_at,
    error_message
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(song_id) DO UPDATE SET
    provider = excluded.provider,
    status = excluded.status,
    lyrics = excluded.lyrics,
    language = excluded.language,
    copyright = excluded.copyright,
    track_id = excluded.track_id,
    fetched_at = excluded.fetched_at,
    expires_at = excluded.expires_at,
    error_message = excluded.error_message`
);

const settingsLoginAttempts = new Map();
const settingsAuthSessions = new Map();
let settingsLastLoginPruneAt = 0;
let settingsLastSessionPruneAt = 0;

function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function timingSafeStringCompare(left, right) {
  const leftHash = Buffer.from(sha256Hex(left), "hex");
  const rightHash = Buffer.from(sha256Hex(right), "hex");
  return crypto.timingSafeEqual(leftHash, rightHash);
}

function parseCookies(headerValue) {
  if (typeof headerValue !== "string" || !headerValue.trim()) {
    return {};
  }

  return headerValue.split(";").reduce((acc, entry) => {
    const trimmed = entry.trim();
    if (!trimmed) {
      return acc;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) {
      return acc;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    const rawValue = trimmed.slice(equalsIndex + 1).trim();
    if (!key) {
      return acc;
    }

    try {
      acc[key] = decodeURIComponent(rawValue);
    } catch (error) {
      acc[key] = rawValue;
    }
    return acc;
  }, {});
}

function parseScryptHash(value) {
  if (typeof value !== "string") {
    return null;
  }

  const parts = value.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return null;
  }

  const n = Number.parseInt(parts[1], 10);
  const r = Number.parseInt(parts[2], 10);
  const p = Number.parseInt(parts[3], 10);
  let salt;
  let digest;
  try {
    salt = Buffer.from(parts[4], "base64");
    digest = Buffer.from(parts[5], "base64");
  } catch (error) {
    return null;
  }

  if (!salt.length || !digest.length || !Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return null;
  }

  return {
    n,
    r,
    p,
    salt,
    digest
  };
}

function verifySettingsPassword(passwordInput) {
  if (!config.settingsAuthEnabled) {
    return true;
  }

  const candidate = typeof passwordInput === "string" ? passwordInput : "";
  if (!candidate || candidate.length > SETTINGS_PASSWORD_MAX_LENGTH) {
    return false;
  }

  if (config.settingsPasswordHash) {
    const scryptConfig = parseScryptHash(config.settingsPasswordHash);
    if (!scryptConfig) {
      return false;
    }

    const derived = crypto.scryptSync(candidate, scryptConfig.salt, scryptConfig.digest.length, {
      N: scryptConfig.n,
      r: scryptConfig.r,
      p: scryptConfig.p,
      maxmem: 256 * 1024 * 1024
    });

    return (
      derived.length === scryptConfig.digest.length &&
      crypto.timingSafeEqual(derived, scryptConfig.digest)
    );
  }

  return timingSafeStringCompare(candidate, config.settingsPassword);
}

function pruneSettingsLoginAttempts(now) {
  if (now - settingsLastLoginPruneAt < SETTINGS_LOGIN_PRUNE_INTERVAL_MS) {
    return;
  }

  settingsLastLoginPruneAt = now;
  const maxAge = Math.max(SETTINGS_LOGIN_PRUNE_INTERVAL_MS, config.settingsAuthRateLimitMs * 20);
  for (const [key, value] of settingsLoginAttempts.entries()) {
    if (now - value.lastAttemptAt > maxAge) {
      settingsLoginAttempts.delete(key);
    }
  }
}

function checkSettingsLoginRateLimit(clientKey) {
  const now = Date.now();
  pruneSettingsLoginAttempts(now);
  const previous = settingsLoginAttempts.get(clientKey);

  if (previous) {
    const elapsed = now - previous.lastAttemptAt;
    if (elapsed < config.settingsAuthRateLimitMs) {
      return {
        allowed: false,
        retryAfterMs: config.settingsAuthRateLimitMs - elapsed
      };
    }
  }

  settingsLoginAttempts.set(clientKey, {
    lastAttemptAt: now
  });

  return {
    allowed: true,
    retryAfterMs: 0
  };
}

function pruneSettingsAuthSessions(now) {
  if (now - settingsLastSessionPruneAt < SETTINGS_SESSION_PRUNE_INTERVAL_MS) {
    return;
  }

  settingsLastSessionPruneAt = now;
  for (const [tokenHash, session] of settingsAuthSessions.entries()) {
    if (session.expiresAt <= now) {
      settingsAuthSessions.delete(tokenHash);
    }
  }
}

function shouldUseSecureSettingsCookie(req) {
  if (typeof config.settingsAuthSecureCookie === "boolean") {
    return config.settingsAuthSecureCookie;
  }
  return Boolean(req.secure);
}

function clearSettingsAuthCookie(req, res) {
  res.clearCookie(SETTINGS_AUTH_COOKIE_NAME, {
    path: "/api",
    sameSite: "strict",
    secure: shouldUseSecureSettingsCookie(req)
  });
}

function setSettingsAuthCookie(req, res, token, expiresAt) {
  const maxAge = Math.max(1, expiresAt - Date.now());
  res.cookie(SETTINGS_AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: shouldUseSecureSettingsCookie(req),
    path: "/api",
    maxAge
  });
}

function getSettingsAuthTokenFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SETTINGS_AUTH_COOKIE_NAME];
  return typeof token === "string" && token ? token : "";
}

function getClientKey(req) {
  const directIp = req.socket?.remoteAddress || req.ip || "unknown";
  const cfConnectingIp = req.headers["cf-connecting-ip"];

  if (
    typeof cfConnectingIp === "string" &&
    (directIp === "::1" || directIp === "127.0.0.1" || directIp === "::ffff:127.0.0.1")
  ) {
    return `cf:${cfConnectingIp.trim().slice(0, 120)}`;
  }

  return `ip:${String(directIp).slice(0, 120)}`;
}

function createSettingsAuthSession(req, res) {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = sha256Hex(token);
  const now = Date.now();
  const expiresAt = now + config.settingsAuthSessionTtlMs;

  settingsAuthSessions.set(tokenHash, {
    createdAt: now,
    lastSeenAt: now,
    expiresAt
  });

  setSettingsAuthCookie(req, res, token, expiresAt);
  return {
    expiresAt
  };
}

function getSettingsAuthSession(req) {
  if (!config.settingsAuthEnabled) {
    return {
      authenticated: true,
      expiresAt: null
    };
  }

  const now = Date.now();
  pruneSettingsAuthSessions(now);

  const token = getSettingsAuthTokenFromRequest(req);
  if (!token) {
    return {
      authenticated: false,
      expiresAt: null
    };
  }

  const tokenHash = sha256Hex(token);
  const session = settingsAuthSessions.get(tokenHash);

  if (!session || session.expiresAt <= now) {
    if (session) {
      settingsAuthSessions.delete(tokenHash);
    }
    return {
      authenticated: false,
      expiresAt: null
    };
  }

  session.lastSeenAt = now;
  return {
    authenticated: true,
    expiresAt: session.expiresAt
  };
}

function revokeSettingsAuthSession(req, res) {
  const token = getSettingsAuthTokenFromRequest(req);
  if (token) {
    settingsAuthSessions.delete(sha256Hex(token));
  }
  clearSettingsAuthCookie(req, res);
}

function requireSettingsAuth(req, res, next) {
  const authState = getSettingsAuthSession(req);
  if (!authState.authenticated) {
    return res.status(401).json({
      error: "Settings authentication required",
      code: "SETTINGS_AUTH_REQUIRED"
    });
  }

  req.settingsAuth = authState;
  return next();
}

function parseIntParam(value, fallback, min, max) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function parseSort(query) {
  const sort = typeof query.sort === "string" ? query.sort : "title";
  const direction =
    String(query.direction || "asc").toLowerCase() === "desc" ? "DESC" : "ASC";
  return {
    sortExpr: SORT_OPTIONS[sort] || SORT_OPTIONS.title,
    direction
  };
}

function parseId(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isPrismaNotFoundError(error) {
  return Boolean(error && typeof error === "object" && error.code === "P2025");
}

function nowMsBigInt() {
  return BigInt(Date.now());
}

function numberIfBigInt(value) {
  return typeof value === "bigint" ? Number(value) : value;
}

function normalizePlaylistPrismaRow(row) {
  if (!row || typeof row !== "object") {
    return row;
  }

  return {
    ...row,
    createdAt: numberIfBigInt(row.createdAt),
    updatedAt: numberIfBigInt(row.updatedAt)
  };
}

function sanitizePlaylistName(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().slice(0, 120);
}

function parseDataUrlImage(dataUrl) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    return null;
  }

  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) {
    return null;
  }

  const mimeType = match[1].toLowerCase();
  if (!mimeType.startsWith("image/")) {
    return null;
  }

  let buffer;
  try {
    buffer = Buffer.from(match[2], "base64");
  } catch (error) {
    return null;
  }

  if (!buffer.length || buffer.length > 10 * 1024 * 1024) {
    return null;
  }

  return {
    mimeType,
    buffer
  };
}

function parseStoredJson(value, fallback) {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    // no-op
  }

  return fallback;
}

function parseBooleanQueryFlag(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
}

function normalizeTrackQueryValue(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().replace(/\s+/g, " ");
}

function buildFtsMatchQuery(value) {
  const source = normalizeTrackQueryValue(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ");

  const tokens = source
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 8);

  if (!tokens.length) {
    return "";
  }

  return tokens.map((token) => `"${token}"*`).join(" AND ");
}

function buildLyricsResponseFromCache(cachedRow, songId, cached) {
  return {
    songId,
    provider: cachedRow.provider,
    status: cachedRow.status,
    lyrics: cachedRow.lyrics,
    language: cachedRow.language,
    copyright: cachedRow.copyright,
    trackId: cachedRow.trackId,
    fetchedAt: cachedRow.fetchedAt,
    expiresAt: cachedRow.expiresAt,
    cached,
    error: cachedRow.errorMessage || null
  };
}

function cacheLyricsRow({
  songId,
  provider,
  status,
  lyrics,
  language,
  copyright,
  trackId,
  fetchedAt,
  expiresAt,
  errorMessage
}) {
  try {
    upsertLyricsCacheStmt.run(
      songId,
      provider,
      status,
      lyrics ?? null,
      language ?? null,
      copyright ?? null,
      trackId ?? null,
      fetchedAt,
      expiresAt,
      errorMessage ?? null
    );
    return {
      cached: true,
      missingSong: false
    };
  } catch (error) {
    const isForeignKeyError =
      error &&
      typeof error === "object" &&
      (error.code === "SQLITE_CONSTRAINT_FOREIGNKEY" ||
        String(error.message || "").includes("FOREIGN KEY constraint failed"));

    if (isForeignKeyError) {
      return {
        cached: false,
        missingSong: true
      };
    }

    throw error;
  }
}

function getLyricsExpiry(now, status) {
  return (
    now + (status === LYRICS_STATUS.ERROR ? LYRICS_ERROR_CACHE_TTL_MS : LYRICS_CACHE_TTL_MS)
  );
}

function normalizeLooseText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function scoreLrcLibMatch(entry, title, artist, album) {
  let score = 0;
  const entryTitle = normalizeLooseText(entry?.trackName);
  const entryArtist = normalizeLooseText(entry?.artistName);
  const entryAlbum = normalizeLooseText(entry?.albumName);
  const normalizedTitle = normalizeLooseText(title);
  const normalizedArtist = normalizeLooseText(artist);
  const normalizedAlbum = normalizeLooseText(album);

  if (normalizedTitle && entryTitle) {
    if (entryTitle === normalizedTitle) {
      score += 6;
    } else if (
      entryTitle.includes(normalizedTitle) ||
      normalizedTitle.includes(entryTitle)
    ) {
      score += 3;
    }
  }

  if (normalizedArtist && entryArtist) {
    if (entryArtist === normalizedArtist) {
      score += 6;
    } else if (
      entryArtist.includes(normalizedArtist) ||
      normalizedArtist.includes(entryArtist)
    ) {
      score += 3;
    }
  }

  if (normalizedAlbum && entryAlbum) {
    if (entryAlbum === normalizedAlbum) {
      score += 3;
    } else if (
      entryAlbum.includes(normalizedAlbum) ||
      normalizedAlbum.includes(entryAlbum)
    ) {
      score += 1;
    }
  }

  if (entry?.plainLyrics || entry?.syncedLyrics) {
    score += 1;
  }

  return score;
}

function pickBestLrcLibEntry(entries, title, artist, album) {
  let winner = null;
  let winnerScore = Number.NEGATIVE_INFINITY;

  for (const entry of entries || []) {
    const score = scoreLrcLibMatch(entry, title, artist, album);
    if (score > winnerScore) {
      winner = entry;
      winnerScore = score;
    }
  }

  return winner;
}

async function fetchLyricsFromLrcLib(song) {
  const title = normalizeTrackQueryValue(song.title || path.parse(song.filename).name);
  const artist = normalizeTrackQueryValue(song.artist);
  const album = normalizeTrackQueryValue(song.album);

  if (!title) {
    return {
      provider: "lrclib",
      status: LYRICS_STATUS.NO_MATCH,
      lyrics: null,
      language: null,
      copyright: null,
      trackId: null
    };
  }

  const requestUrl = new URL(LRCLIB_SEARCH_URL);
  requestUrl.searchParams.set("track_name", title);
  if (artist) {
    requestUrl.searchParams.set("artist_name", artist);
  }
  if (album) {
    requestUrl.searchParams.set("album_name", album);
  }

  const response = await fetch(requestUrl, {
    headers: {
      Accept: "application/json",
      "User-Agent": LRCLIB_USER_AGENT
    }
  });

  if (!response.ok) {
    throw new Error(`LRCLIB HTTP ${response.status}`);
  }

  let entries = [];
  try {
    const payload = await response.json();
    if (Array.isArray(payload)) {
      entries = payload;
    }
  } catch (error) {
    throw new Error("LRCLIB returned non-JSON response");
  }

  const match = pickBestLrcLibEntry(entries, title, artist, album);
  if (!match) {
    return {
      provider: "lrclib",
      status: LYRICS_STATUS.NO_MATCH,
      lyrics: null,
      language: null,
      copyright: null,
      trackId: null
    };
  }

  const lyricsText = String(match.plainLyrics || match.syncedLyrics || "").trim();
  if (!lyricsText) {
    return {
      provider: "lrclib",
      status: LYRICS_STATUS.NO_LYRICS,
      lyrics: null,
      language: null,
      copyright: null,
      trackId: null
    };
  }

  return {
    provider: "lrclib",
    status: LYRICS_STATUS.OK,
    lyrics: lyricsText,
    language: null,
    copyright: null,
    trackId: null
  };
}

async function fetchLyrics(song) {
  return fetchLyricsFromLrcLib(song);
}

function buildSettingsPayload(settings) {
  return {
    musicDir: settings.music_dir || config.musicDir,
    port: Number.parseInt(settings.port || String(config.port), 10) || config.port,
    theme: settings.theme || config.theme,
    appName: settings.app_name || config.appName,
    colorScheme: parseStoredJson(settings.color_scheme, DEFAULT_COLOR_SCHEME)
  };
}

async function getSettingsPayloadPrisma() {
  const rows = await prisma.setting.findMany({
    select: {
      key: true,
      value: true
    }
  });
  const settings = rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
  return buildSettingsPayload(settings);
}

async function getPublicSettingsPayloadPrisma() {
  const settings = await getSettingsPayloadPrisma();
  return {
    theme: settings.theme,
    appName: settings.appName,
    colorScheme: settings.colorScheme
  };
}

function sendJson(res, payload) {
  res.setHeader("Cache-Control", "no-store");
  return res.json(payload);
}

app.use(cors());
app.use(
  compression({
    filter: (req, res) => {
      if (req.path === "/api/scan/events") {
        return false;
      }
      return compression.filter(req, res);
    }
  })
);
app.use(express.json({ limit: "12mb" }));

app.get("/api/health", (req, res) => {
  sendJson(res, {
    ok: true,
    now: Date.now(),
    scan: scanner.getState()
  });
});

app.get("/api/settings/public", async (req, res) => {
  try {
    const payload = await getPublicSettingsPayloadPrisma();
    sendJson(res, payload);
  } catch (error) {
    console.error("Could not read public settings via Prisma:", error);
    res.status(500).json({ error: "Could not load public settings" });
  }
});

app.get("/api/settings/auth/status", (req, res) => {
  const authState = getSettingsAuthSession(req);
  return sendJson(res, {
    enabled: config.settingsAuthEnabled,
    authenticated: authState.authenticated,
    expiresAt: authState.expiresAt
  });
});

app.post("/api/settings/auth/login", (req, res) => {
  if (!config.settingsAuthEnabled) {
    return sendJson(res, {
      success: true,
      enabled: false,
      authenticated: true,
      expiresAt: null
    });
  }

  const clientKey = getClientKey(req);
  const rateLimit = checkSettingsLoginRateLimit(clientKey);
  if (!rateLimit.allowed) {
    return res.status(429).json({
      error: `Too many attempts. Wait ${Math.ceil(rateLimit.retryAfterMs / 1000)}s.`,
      retryAfterMs: rateLimit.retryAfterMs
    });
  }

  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!verifySettingsPassword(password)) {
    return res.status(401).json({
      error: "Invalid password"
    });
  }

  const session = createSettingsAuthSession(req, res);
  return sendJson(res, {
    success: true,
    enabled: true,
    authenticated: true,
    expiresAt: session.expiresAt
  });
});

app.post("/api/settings/auth/logout", (req, res) => {
  revokeSettingsAuthSession(req, res);
  return sendJson(res, {
    success: true
  });
});

app.get("/api/settings", requireSettingsAuth, async (req, res) => {
  try {
    const payload = await getSettingsPayloadPrisma();
    sendJson(res, payload);
  } catch (error) {
    console.error("Could not read settings via Prisma:", error);
    res.status(500).json({ error: "Could not load settings" });
  }
});

app.post("/api/settings", requireSettingsAuth, async (req, res) => {
  const {
    musicDir,
    port,
    theme,
    appName,
    colorScheme
  } = req.body || {};

  const settingWrites = [];

  const enqueueSettingWrite = (key, value) => {
    settingWrites.push(
      prisma.setting.upsert({
        where: { key },
        create: {
          key,
          value: String(value ?? ""),
          updatedAt: nowMsBigInt()
        },
        update: {
          value: String(value ?? ""),
          updatedAt: nowMsBigInt()
        }
      })
    );
  };

  if (typeof musicDir === "string" && musicDir.trim()) {
    const resolvedPath = path.resolve(musicDir.trim());
    try {
      const stat = await fsp.stat(resolvedPath);
      if (!stat.isDirectory()) {
        return res.status(400).json({
          error: "musicDir must be an existing directory"
        });
      }
    } catch (error) {
      return res.status(400).json({
        error: "musicDir must be an existing directory"
      });
    }

    enqueueSettingWrite("music_dir", resolvedPath);
  }

  if (Number.isFinite(Number(port)) && Number(port) > 0) {
    enqueueSettingWrite("port", String(Math.floor(Number(port))));
  }

  if (theme === "dark" || theme === "light") {
    enqueueSettingWrite("theme", theme);
  }

  if (typeof appName === "string" && appName.trim()) {
    enqueueSettingWrite("app_name", appName.trim().slice(0, 80));
  }

  if (typeof colorScheme !== "undefined") {
    if (!colorScheme || typeof colorScheme !== "object" || Array.isArray(colorScheme)) {
      return res.status(400).json({
        error: "colorScheme must be an object"
      });
    }

    let serialized;
    try {
      serialized = JSON.stringify(colorScheme);
    } catch (error) {
      return res.status(400).json({
        error: "colorScheme must be serializable JSON"
      });
    }

    if (serialized.length > 20000) {
      return res.status(400).json({
        error: "colorScheme is too large"
      });
    }

    enqueueSettingWrite("color_scheme", serialized);
  }

  try {
    if (settingWrites.length > 0) {
      await prisma.$transaction(settingWrites);
    }

    const nextSettingsPayload = await getSettingsPayloadPrisma();

    sendJson(res, {
      success: true,
      settings: nextSettingsPayload,
      portNotice:
        "If port changed, restart the server to apply the new listening port."
    });
  } catch (error) {
    console.error("Could not write settings via Prisma:", error);
    res.status(500).json({ error: "Could not save settings" });
  }
});

app.get("/api/scan/events", (req, res) => {
  sseHub.addClient(req, res, {
    scan: scanner.getState()
  });
});

app.get("/api/scan/state", (req, res) => {
  sendJson(res, scanner.getState());
});

app.post("/api/rescan", requireSettingsAuth, (req, res) => {
  if (scanner.getState().running) {
    return res.status(409).json({
      error: "Scan is already running",
      scan: scanner.getState()
    });
  }

  scanner.runScan().catch((error) => {
    console.error("Library scan failed:", error);
  });

  return sendJson(res, {
    started: true,
    scan: scanner.getState()
  });
});

app.get("/api/stats", (req, res) => {
  const row = db
    .prepare(
      `SELECT
        COUNT(*) AS totalSongs,
        COUNT(DISTINCT ${ARTIST_EXPR}) AS totalArtists,
        COUNT(DISTINCT ${ALBUM_TITLE_EXPR} || '||' || ${ALBUM_ARTIST_EXPR}) AS totalAlbums,
        COALESCE(SUM(duration), 0) AS totalDuration
      FROM songs`
    )
    .get();

  sendJson(res, {
    totalSongs: row.totalSongs,
    totalArtists: row.totalArtists,
    totalAlbums: row.totalAlbums,
    totalDuration: row.totalDuration
  });
});

app.get("/api/songs", (req, res) => {
  const offset = parseIntParam(req.query.offset, 0, 0, 10_000_000);
  const limit = parseIntParam(req.query.limit, 200, 1, 500);
  const { sortExpr, direction } = parseSort(req.query);

  const rows = db
    .prepare(
      `SELECT ${SONG_COLUMNS}
       FROM songs
       ORDER BY ${sortExpr} ${direction}, id ASC
       LIMIT ? OFFSET ?`
    )
    .all(limit, offset);

  const total = db.prepare("SELECT COUNT(*) AS count FROM songs").get().count;

  sendJson(res, {
    rows,
    offset,
    limit,
    total,
    hasMore: offset + rows.length < total
  });
});

app.get("/api/views/recently-played", (req, res) => {
  const limit = parseIntParam(req.query.limit, 50, 1, 200);

  const rows = db
    .prepare(
      `SELECT
        s.id,
        s.path,
        s.filename,
        s.title,
        s.artist,
        s.album,
        s.album_artist AS albumArtist,
        s.year,
        s.track_number AS trackNumber,
        s.duration,
        s.bitrate,
        s.file_size AS fileSize,
        s.last_modified AS lastModified,
        s.date_added AS dateAdded,
        s.play_count AS playCount,
        s.last_played AS lastPlayed,
        CASE WHEN s.cover_art IS NOT NULL THEN 1 ELSE 0 END AS hasArt,
        rp.played_at AS playedAt
      FROM (
        SELECT song_id, MAX(played_at) AS played_at
        FROM play_history
        GROUP BY song_id
      ) rp
      INNER JOIN songs s ON s.id = rp.song_id
      ORDER BY rp.played_at DESC
      LIMIT ?`
    )
    .all(limit);

  sendJson(res, { rows });
});

app.get("/api/views/most-played", (req, res) => {
  const limit = parseIntParam(req.query.limit, 200, 1, 500);

  const rows = db
    .prepare(
      `SELECT ${SONG_COLUMNS}
       FROM songs
       WHERE play_count > 0
       ORDER BY play_count DESC, COALESCE(last_played, 0) DESC
       LIMIT ?`
    )
    .all(limit);

  sendJson(res, { rows });
});

app.get("/api/views/rediscover", (req, res) => {
  const limit = parseIntParam(req.query.limit, 120, 1, 500);
  const staleDays = parseIntParam(req.query.staleDays, 90, 7, 3650);
  const cutoffMs = Date.now() - staleDays * 24 * 60 * 60 * 1000;

  const unheard = db
    .prepare(
      `SELECT ${SONG_COLUMNS}
       FROM songs
       WHERE COALESCE(play_count, 0) = 0
       ORDER BY COALESCE(date_added, 0) DESC, id DESC
       LIMIT ?`
    )
    .all(limit);

  const rediscover = db
    .prepare(
      `SELECT ${SONG_COLUMNS}
       FROM songs
       WHERE COALESCE(play_count, 0) > 0
         AND COALESCE(last_played, 0) > 0
         AND COALESCE(last_played, 0) < ?
       ORDER BY COALESCE(last_played, 0) ASC, COALESCE(play_count, 0) DESC, id ASC
       LIMIT ?`
    )
    .all(cutoffMs, limit);

  sendJson(res, {
    staleDays,
    cutoffMs,
    unheard,
    rediscover
  });
});

app.get("/api/views/active-artists", (req, res) => {
  const limit = parseIntParam(req.query.limit, 60, 1, 500);
  const days = parseIntParam(req.query.days, 30, 1, 3650);
  const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;

  const rows = db
    .prepare(
      `WITH recent_activity AS (
        SELECT
          ${ARTIST_EXPR} AS artist,
          COUNT(*) AS recentPlays,
          COUNT(DISTINCT ph.song_id) AS uniqueSongs,
          MAX(ph.played_at) AS lastPlayed,
          MIN(s.id) AS artSongId
        FROM play_history ph
        INNER JOIN songs s ON s.id = ph.song_id
        WHERE ph.played_at >= ?
        GROUP BY ${ARTIST_EXPR}
      ),
      artist_totals AS (
        SELECT
          ${ARTIST_EXPR} AS artist,
          SUM(COALESCE(play_count, 0)) AS totalPlays
        FROM songs
        GROUP BY ${ARTIST_EXPR}
      )
      SELECT
        recent_activity.artist,
        recent_activity.recentPlays,
        recent_activity.uniqueSongs,
        recent_activity.lastPlayed,
        COALESCE(artist_totals.totalPlays, 0) AS totalPlays,
        recent_activity.artSongId
      FROM recent_activity
      LEFT JOIN artist_totals ON artist_totals.artist = recent_activity.artist
      ORDER BY recent_activity.recentPlays DESC,
        COALESCE(recent_activity.lastPlayed, 0) DESC,
        recent_activity.artist COLLATE NOCASE ASC
      LIMIT ?`
    )
    .all(sinceMs, limit);

  sendJson(res, {
    days,
    sinceMs,
    rows
  });
});

app.get("/api/artists", (req, res) => {
  const rows = db
    .prepare(
      `SELECT
        ${ARTIST_EXPR} AS artist,
        COUNT(*) AS songCount,
        COUNT(DISTINCT ${ALBUM_TITLE_EXPR} || '::' || ${ALBUM_ARTIST_EXPR}) AS albumCount,
        SUM(COALESCE(play_count, 0)) AS totalPlays,
        MAX(last_played) AS lastPlayed,
        MIN(id) AS artSongId
      FROM songs
      GROUP BY ${ARTIST_EXPR}
      ORDER BY artist COLLATE NOCASE ASC`
    )
    .all();

  const now = Date.now();
  const activeSince30d = now - 30 * 24 * 60 * 60 * 1000;
  const stats = rows.reduce(
    (acc, row) => {
      const songCount = Number(row.songCount) || 0;
      const albumCount = Number(row.albumCount) || 0;
      const totalPlays = Number(row.totalPlays) || 0;
      const lastPlayed = Number(row.lastPlayed) || 0;

      acc.totalSongs += songCount;
      acc.totalAlbums += albumCount;
      acc.totalPlays += totalPlays;

      if (lastPlayed > 0 && lastPlayed >= activeSince30d) {
        acc.activeArtists30d += 1;
      }

      return acc;
    },
    {
      artistCount: rows.length,
      totalSongs: 0,
      totalAlbums: 0,
      totalPlays: 0,
      activeArtists30d: 0
    }
  );

  sendJson(res, { rows, stats });
});

app.get("/api/artists/:artist/songs", (req, res) => {
  const artist = decodeURIComponent(req.params.artist || "");

  const rows = db
    .prepare(
      `SELECT ${SONG_COLUMNS}
       FROM songs
       WHERE ${ARTIST_EXPR} = ?
       ORDER BY COALESCE(track_number, 9999) ASC, LOWER(COALESCE(title, filename)) ASC`
    )
    .all(artist);

  sendJson(res, { rows, artist });
});

app.get("/api/artists/:artist/albums", (req, res) => {
  const artist = decodeURIComponent(req.params.artist || "");

  const rows = db
    .prepare(
      `SELECT
        ${ALBUM_TITLE_EXPR} AS album,
        ${ALBUM_ARTIST_EXPR} AS albumArtist,
        MAX(year) AS year,
        COUNT(*) AS songCount,
        MIN(id) AS artSongId
      FROM songs
      WHERE ${ARTIST_EXPR} = ?
      GROUP BY album, albumArtist
      ORDER BY (year IS NULL) ASC, year DESC, album COLLATE NOCASE ASC`
    )
    .all(artist);

  sendJson(res, { rows, artist });
});

app.get("/api/albums", (req, res) => {
  const offset = parseIntParam(req.query.offset, 0, 0, 10_000_000);
  const limit = parseIntParam(req.query.limit, 200, 1, 500);

  const rows = db
    .prepare(
      `SELECT
        ${ALBUM_TITLE_EXPR} AS album,
        ${ALBUM_ARTIST_EXPR} AS albumArtist,
        MAX(year) AS year,
        COUNT(*) AS songCount,
        MIN(id) AS artSongId
      FROM songs
      GROUP BY album, albumArtist
      ORDER BY (year IS NULL) ASC, year DESC, album COLLATE NOCASE ASC
      LIMIT ? OFFSET ?`
    )
    .all(limit, offset);

  const total = db
    .prepare(
      `SELECT COUNT(*) AS count FROM (
         SELECT 1
         FROM songs
         GROUP BY ${ALBUM_TITLE_EXPR}, ${ALBUM_ARTIST_EXPR}
       )`
    )
    .get().count;

  sendJson(res, {
    rows,
    offset,
    limit,
    total,
    hasMore: offset + rows.length < total
  });
});

app.get("/api/albums/tracks", (req, res) => {
  const album = typeof req.query.album === "string" ? req.query.album : "";
  const albumArtist =
    typeof req.query.albumArtist === "string" ? req.query.albumArtist : "";

  if (!album || !albumArtist) {
    return res.status(400).json({
      error: "album and albumArtist query parameters are required"
    });
  }

  const rows = db
    .prepare(
      `SELECT ${SONG_COLUMNS}
       FROM songs
       WHERE ${ALBUM_TITLE_EXPR} = ? AND ${ALBUM_ARTIST_EXPR} = ?
       ORDER BY COALESCE(track_number, 9999) ASC, LOWER(COALESCE(title, filename)) ASC`
    )
    .all(album, albumArtist);

  sendJson(res, { rows, album, albumArtist });
});

app.get("/api/playlists", (req, res) => {
  const rows = db
    .prepare(
      `SELECT
        p.id,
        p.name,
        p.created_at AS createdAt,
        p.updated_at AS updatedAt,
        COUNT(ps.song_id) AS songCount,
        CASE WHEN p.cover_art IS NOT NULL THEN 1 ELSE 0 END AS hasCustomArt,
        MIN(CASE WHEN s.cover_art IS NOT NULL THEN s.id END) AS fallbackArtSongId
      FROM playlists p
      LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
      LEFT JOIN songs s ON s.id = ps.song_id
      GROUP BY p.id
      ORDER BY LOWER(p.name) ASC, p.id ASC`
    )
    .all();

  sendJson(res, { rows });
});

app.post("/api/playlists", requireSettingsAuth, async (req, res) => {
  const name = sanitizePlaylistName(req.body?.name) || "New Playlist";
  const now = nowMsBigInt();
  try {
    const row = await prisma.playlist.create({
      data: {
        name,
        createdAt: now,
        updatedAt: now
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true
      }
    });

    sendJson(res, {
      success: true,
      playlist: {
        ...normalizePlaylistPrismaRow(row),
        songCount: 0,
        hasCustomArt: 0,
        fallbackArtSongId: null
      }
    });
  } catch (error) {
    console.error("Could not create playlist via Prisma:", error);
    res.status(500).json({ error: "Could not create playlist" });
  }
});

app.get("/api/playlists/:playlistId", (req, res) => {
  const playlistId = parseId(req.params.playlistId);
  if (!playlistId) {
    return res.status(400).json({ error: "Invalid playlist id" });
  }

  const row = db
    .prepare(
      `SELECT
        p.id,
        p.name,
        p.created_at AS createdAt,
        p.updated_at AS updatedAt,
        COUNT(ps.song_id) AS songCount,
        CASE WHEN p.cover_art IS NOT NULL THEN 1 ELSE 0 END AS hasCustomArt,
        MIN(CASE WHEN s.cover_art IS NOT NULL THEN s.id END) AS fallbackArtSongId
      FROM playlists p
      LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
      LEFT JOIN songs s ON s.id = ps.song_id
      WHERE p.id = ?
      GROUP BY p.id`
    )
    .get(playlistId);

  if (!row) {
    return res.status(404).json({ error: "Playlist not found" });
  }

  sendJson(res, { playlist: row });
});

app.patch("/api/playlists/:playlistId", requireSettingsAuth, async (req, res) => {
  const playlistId = parseId(req.params.playlistId);
  if (!playlistId) {
    return res.status(400).json({ error: "Invalid playlist id" });
  }

  const name = sanitizePlaylistName(req.body?.name);
  if (!name) {
    return res.status(400).json({ error: "Playlist name is required" });
  }

  const updatedAt = nowMsBigInt();
  let playlist;
  try {
    playlist = await prisma.playlist.update({
      where: { id: playlistId },
      data: {
        name,
        updatedAt
      },
      select: {
        id: true,
        name: true
      }
    });
  } catch (error) {
    if (isPrismaNotFoundError(error)) {
      return res.status(404).json({ error: "Playlist not found" });
    }
    console.error("Could not rename playlist via Prisma:", error);
    return res.status(500).json({ error: "Could not rename playlist" });
  }

  sendJson(res, {
    success: true,
    playlist: {
      ...playlist,
      updatedAt: Number(updatedAt)
    }
  });
});

app.delete("/api/playlists/:playlistId", requireSettingsAuth, async (req, res) => {
  const playlistId = parseId(req.params.playlistId);
  if (!playlistId) {
    return res.status(400).json({ error: "Invalid playlist id" });
  }

  try {
    await prisma.playlist.delete({
      where: { id: playlistId }
    });
  } catch (error) {
    if (isPrismaNotFoundError(error)) {
      return res.status(404).json({ error: "Playlist not found" });
    }
    console.error("Could not delete playlist via Prisma:", error);
    return res.status(500).json({ error: "Could not delete playlist" });
  }

  sendJson(res, { success: true });
});

app.get("/api/playlists/:playlistId/songs", (req, res) => {
  const playlistId = parseId(req.params.playlistId);
  if (!playlistId) {
    return res.status(400).json({ error: "Invalid playlist id" });
  }

  const playlist = playlistExistsStmt.get(playlistId);
  if (!playlist) {
    return res.status(404).json({ error: "Playlist not found" });
  }

  const rows = db
    .prepare(
      `SELECT
        s.id,
        s.path,
        s.filename,
        s.title,
        s.artist,
        s.album,
        s.album_artist AS albumArtist,
        s.year,
        s.track_number AS trackNumber,
        s.duration,
        s.bitrate,
        s.file_size AS fileSize,
        s.last_modified AS lastModified,
        s.date_added AS dateAdded,
        s.play_count AS playCount,
        s.last_played AS lastPlayed,
        CASE WHEN s.cover_art IS NOT NULL THEN 1 ELSE 0 END AS hasArt,
        ps.position AS playlistPosition,
        ps.added_at AS addedAt
      FROM playlist_songs ps
      INNER JOIN songs s ON s.id = ps.song_id
      WHERE ps.playlist_id = ?
      ORDER BY ps.position ASC, ps.id ASC`
    )
    .all(playlistId);

  sendJson(res, {
    playlist: {
      id: playlist.id,
      name: playlist.name
    },
    rows
  });
});

app.post("/api/playlists/:playlistId/songs", requireSettingsAuth, (req, res) => {
  const playlistId = parseId(req.params.playlistId);
  if (!playlistId) {
    return res.status(400).json({ error: "Invalid playlist id" });
  }

  if (!playlistExistsStmt.get(playlistId)) {
    return res.status(404).json({ error: "Playlist not found" });
  }

  const songId = parseId(req.body?.songId);
  if (!songId) {
    return res.status(400).json({ error: "Invalid song id" });
  }

  if (!songExistsStmt.get(songId)) {
    return res.status(404).json({ error: "Song not found" });
  }

  const result = addSongToPlaylistTx(playlistId, songId);
  sendJson(res, {
    success: true,
    added: result.added
  });
});

app.delete(
  "/api/playlists/:playlistId/songs/:songId",
  requireSettingsAuth,
  (req, res) => {
    const playlistId = parseId(req.params.playlistId);
    const songId = parseId(req.params.songId);

    if (!playlistId || !songId) {
      return res.status(400).json({ error: "Invalid id" });
    }

    if (!playlistExistsStmt.get(playlistId)) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    const changes = removeSongFromPlaylistTx(playlistId, songId);
    if (!changes) {
      return res.status(404).json({ error: "Song is not in this playlist" });
    }

    sendJson(res, { success: true });
  }
);

app.post("/api/playlists/:playlistId/sort", requireSettingsAuth, (req, res) => {
  const playlistId = parseId(req.params.playlistId);
  if (!playlistId) {
    return res.status(400).json({ error: "Invalid playlist id" });
  }

  if (!playlistExistsStmt.get(playlistId)) {
    return res.status(404).json({ error: "Playlist not found" });
  }

  const by = typeof req.body?.by === "string" ? req.body.by : "position";
  const direction =
    String(req.body?.direction || "asc").toLowerCase() === "desc" ? "DESC" : "ASC";

  if (!PLAYLIST_SORT_OPTIONS[by]) {
    return res.status(400).json({ error: "Unsupported sort field" });
  }

  sortPlaylistTx(playlistId, by, direction);
  sendJson(res, { success: true });
});

app.post("/api/playlists/:playlistId/cover", requireSettingsAuth, async (req, res) => {
  const playlistId = parseId(req.params.playlistId);
  if (!playlistId) {
    return res.status(400).json({ error: "Invalid playlist id" });
  }

  const parsed = parseDataUrlImage(req.body?.coverDataUrl);
  if (!parsed) {
    return res.status(400).json({
      error:
        "Invalid coverDataUrl. Expected base64 data URL image and max size of 10MB."
    });
  }

  try {
    await prisma.playlist.update({
      where: { id: playlistId },
      data: {
        coverArt: parsed.buffer,
        coverArtMime: parsed.mimeType,
        updatedAt: nowMsBigInt()
      }
    });
  } catch (error) {
    if (isPrismaNotFoundError(error)) {
      return res.status(404).json({ error: "Playlist not found" });
    }
    console.error("Could not set playlist cover via Prisma:", error);
    return res.status(500).json({ error: "Could not update playlist cover" });
  }

  sendJson(res, { success: true });
});

app.delete("/api/playlists/:playlistId/cover", requireSettingsAuth, async (req, res) => {
  const playlistId = parseId(req.params.playlistId);
  if (!playlistId) {
    return res.status(400).json({ error: "Invalid playlist id" });
  }
  try {
    await prisma.playlist.update({
      where: { id: playlistId },
      data: {
        coverArt: null,
        coverArtMime: null,
        updatedAt: nowMsBigInt()
      }
    });
  } catch (error) {
    if (isPrismaNotFoundError(error)) {
      return res.status(404).json({ error: "Playlist not found" });
    }
    console.error("Could not clear playlist cover via Prisma:", error);
    return res.status(500).json({ error: "Could not clear playlist cover" });
  }

  sendJson(res, { success: true });
});

app.get("/api/playlists/:playlistId/art", (req, res) => {
  const playlistId = parseId(req.params.playlistId);
  if (!playlistId) {
    return res.status(400).json({ error: "Invalid playlist id" });
  }

  const row = db
    .prepare(
      `SELECT
        p.cover_art AS playlistCoverArt,
        p.cover_art_mime AS playlistCoverArtMime,
        p.updated_at AS playlistUpdatedAt,
        s.cover_art AS firstSongCoverArt,
        s.cover_art_mime AS firstSongCoverArtMime,
        s.last_modified AS firstSongLastModified
      FROM playlists p
      LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
      LEFT JOIN songs s ON s.id = ps.song_id
      WHERE p.id = ?
      ORDER BY ps.position ASC
      LIMIT 1`
    )
    .get(playlistId);

  if (!row) {
    return res.status(404).json({ error: "Playlist not found" });
  }

  if (row.playlistCoverArt) {
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.type(row.playlistCoverArtMime || "image/jpeg");
    return res.send(row.playlistCoverArt);
  }

  if (row.firstSongCoverArt) {
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.type(row.firstSongCoverArtMime || "image/jpeg");
    return res.send(row.firstSongCoverArt);
  }

  return res.status(404).json({ error: "Cover art not available" });
});

app.get("/api/search", (req, res) => {
  const query = String(req.query.q || "").trim();
  if (!query) {
    return sendJson(res, {
      query,
      songs: [],
      artists: [],
      albums: []
    });
  }

  const ftsQuery = buildFtsMatchQuery(query);
  if (!ftsQuery) {
    return sendJson(res, {
      query,
      songs: [],
      artists: [],
      albums: []
    });
  }

  const songs = db
    .prepare(
      `SELECT
        matched.id,
        matched.title,
        matched.artist,
        matched.album,
        matched.duration,
        matched.hasArt
      FROM (
        SELECT
          s.id,
          s.title,
          COALESCE(NULLIF(s.artist, ''), 'Unknown Artist') AS artist,
          COALESCE(NULLIF(s.album, ''), 'Unknown Album') AS album,
          s.duration,
          CASE WHEN s.cover_art IS NOT NULL THEN 1 ELSE 0 END AS hasArt,
          bm25(songs_fts) AS score
        FROM songs_fts
        INNER JOIN songs s ON s.id = songs_fts.rowid
        WHERE songs_fts MATCH ?
        ORDER BY score ASC
        LIMIT 120
      ) matched
      ORDER BY matched.score ASC, LOWER(COALESCE(matched.title, '')) ASC, matched.id ASC
      LIMIT 30`
    )
    .all(ftsQuery);

  const artists = db
    .prepare(
      `SELECT
        matched.artist AS artist,
        COUNT(*) AS songCount,
        MIN(matched.id) AS artSongId
      FROM (
        SELECT
          s.id,
          COALESCE(NULLIF(s.artist, ''), 'Unknown Artist') AS artist,
          bm25(songs_fts) AS score
        FROM songs_fts
        INNER JOIN songs s ON s.id = songs_fts.rowid
        WHERE songs_fts MATCH ?
        ORDER BY score ASC
        LIMIT 240
      ) matched
      GROUP BY matched.artist
      ORDER BY MIN(matched.score) ASC, songCount DESC, matched.artist COLLATE NOCASE ASC
      LIMIT 12`
    )
    .all(ftsQuery);

  const albums = db
    .prepare(
      `SELECT
        matched.album AS album,
        matched.albumArtist AS albumArtist,
        COUNT(*) AS songCount,
        MIN(matched.id) AS artSongId
      FROM (
        SELECT
          s.id,
          COALESCE(NULLIF(s.album, ''), 'Unknown Album') AS album,
          COALESCE(NULLIF(s.album_artist, ''), COALESCE(NULLIF(s.artist, ''), 'Unknown Artist')) AS albumArtist,
          bm25(songs_fts) AS score
        FROM songs_fts
        INNER JOIN songs s ON s.id = songs_fts.rowid
        WHERE songs_fts MATCH ?
        ORDER BY score ASC
        LIMIT 240
      ) matched
      GROUP BY matched.album, matched.albumArtist
      ORDER BY MIN(matched.score) ASC, songCount DESC, matched.album COLLATE NOCASE ASC
      LIMIT 12`
    )
    .all(ftsQuery);

  return sendJson(res, {
    query,
    songs,
    artists,
    albums
  });
});

app.get("/api/lyrics/:songId", async (req, res) => {
  const songId = parseId(req.params.songId);
  if (!songId) {
    return res.status(400).json({ error: "Invalid song id" });
  }

  const song = songForLyricsStmt.get(songId);
  if (!song) {
    return res.status(404).json({ error: "Song not found" });
  }

  const forceRefresh = parseBooleanQueryFlag(req.query.refresh);
  const now = Date.now();
  const cachedLyrics = lyricsCacheBySongStmt.get(songId);
  if (
    cachedLyrics &&
    !forceRefresh &&
    Number(cachedLyrics.expiresAt || 0) > now
  ) {
    return sendJson(res, buildLyricsResponseFromCache(cachedLyrics, songId, true));
  }

  try {
    const fetched = await fetchLyrics(song);
    const fetchedAt = Date.now();
    const expiresAt = getLyricsExpiry(fetchedAt, fetched.status);

    const cacheResult = cacheLyricsRow({
      songId,
      provider: fetched.provider,
      status: fetched.status,
      lyrics: fetched.lyrics,
      language: fetched.language,
      copyright: fetched.copyright,
      trackId: fetched.trackId,
      fetchedAt,
      expiresAt,
      errorMessage: null
    });

    if (cacheResult.missingSong) {
      return res.status(404).json({ error: "Song no longer exists" });
    }

    return sendJson(res, {
      songId,
      provider: fetched.provider,
      status: fetched.status,
      lyrics: fetched.lyrics,
      language: fetched.language,
      copyright: fetched.copyright,
      trackId: fetched.trackId,
      fetchedAt,
      expiresAt,
      cached: false,
      error: null
    });
  } catch (error) {
    const fetchedAt = Date.now();
    const expiresAt = getLyricsExpiry(fetchedAt, LYRICS_STATUS.ERROR);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    try {
      const cacheResult = cacheLyricsRow({
        songId,
        provider: "lrclib",
        status: LYRICS_STATUS.ERROR,
        lyrics: null,
        language: null,
        copyright: null,
        trackId: null,
        fetchedAt,
        expiresAt,
        errorMessage
      });

      if (cacheResult.missingSong) {
        return res.status(404).json({ error: "Song no longer exists" });
      }
    } catch (cacheError) {
      console.error("Could not cache lyrics error state:", cacheError);
    }

    return res.status(502).json({
      error: "Failed to fetch lyrics from LRCLIB",
      details: errorMessage
    });
  }
});

app.get("/api/art/:songId", (req, res) => {
  const songId = parseId(req.params.songId);
  if (!songId) {
    return res.status(400).json({ error: "Invalid song id" });
  }

  const row = db
    .prepare(
      `SELECT
        cover_art AS coverArt,
        cover_art_mime AS coverArtMime,
        last_modified AS lastModified
      FROM songs
      WHERE id = ?
      LIMIT 1`
    )
    .get(songId);

  if (!row || !row.coverArt) {
    return res.status(404).json({ error: "Cover art not available" });
  }

  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.setHeader(
    "ETag",
    `art-${songId}-${Number(row.lastModified || 0)}-${row.coverArt.length}`
  );

  res.type(row.coverArtMime || "image/jpeg");
  return res.send(row.coverArt);
});

function parseRange(rangeHeader, fileSize) {
  if (!rangeHeader || !rangeHeader.startsWith("bytes=")) {
    return null;
  }

  const [startToken, endToken] = rangeHeader.replace("bytes=", "").split("-");
  let start;
  let end;

  if (startToken === "") {
    const suffixLength = Number.parseInt(endToken, 10);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null;
    }
    start = Math.max(0, fileSize - suffixLength);
    end = fileSize - 1;
  } else {
    start = Number.parseInt(startToken, 10);
    if (!Number.isFinite(start) || start < 0 || start >= fileSize) {
      return null;
    }

    if (endToken === "") {
      end = fileSize - 1;
    } else {
      end = Number.parseInt(endToken, 10);
      if (!Number.isFinite(end)) {
        return null;
      }
      end = Math.min(end, fileSize - 1);
    }

    if (end < start) {
      return null;
    }
  }

  return { start, end };
}

app.get("/api/stream/:songId", async (req, res) => {
  const songId = parseId(req.params.songId);
  if (!songId) {
    return res.status(400).json({ error: "Invalid song id" });
  }

  const song = db
    .prepare("SELECT path FROM songs WHERE id = ? LIMIT 1")
    .get(songId);

  if (!song) {
    return res.status(404).json({ error: "Song not found" });
  }

  let stat;
  try {
    stat = await fsp.stat(song.path);
  } catch (error) {
    return res.status(404).json({ error: "Audio file missing on disk" });
  }

  const fileSize = stat.size;
  const contentType = mime.lookup(song.path) || "application/octet-stream";
  const parsedRange = parseRange(req.headers.range, fileSize);

  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Type", contentType);

  if (!parsedRange && req.headers.range) {
    res.status(416);
    res.setHeader("Content-Range", `bytes */${fileSize}`);
    return res.end();
  }

  if (parsedRange) {
    const { start, end } = parsedRange;
    const chunkSize = end - start + 1;

    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
    res.setHeader("Content-Length", chunkSize);

    return fs.createReadStream(song.path, { start, end }).pipe(res);
  }

  res.status(200);
  res.setHeader("Content-Length", fileSize);
  return fs.createReadStream(song.path).pipe(res);
});

app.post("/api/play/:songId", (req, res) => {
  const songId = parseId(req.params.songId);
  if (!songId) {
    return res.status(400).json({ error: "Invalid song id" });
  }

  const exists = db.prepare("SELECT 1 FROM songs WHERE id = ? LIMIT 1").get(songId);
  if (!exists) {
    return res.status(404).json({ error: "Song not found" });
  }

  const playedAt = Date.now();
  markPlayedTx(songId, playedAt);

  return sendJson(res, {
    success: true,
    playedAt
  });
});

app.use("/api", (req, res) => {
  res.status(404).json({ error: "Not found" });
});

const clientDist = path.join(config.workspaceRoot, "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));

  app.get("*", (req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

const portSetting = getSetting(db, "port");
const port = Number.parseInt(portSetting || String(config.port), 10) || config.port;

app.listen(port, () => {
  console.log(`Melodia API listening on http://localhost:${port}`);

  const shouldOpen =
    config.autoOpenBrowser && process.env.npm_lifecycle_event === "start";

  if (shouldOpen) {
    const target = process.env.CLIENT_URL || `http://localhost:${port}`;
    openBrowser(target).catch(() => {
      // no-op: browser auto-open is optional
    });
  }
});

const songCount = db.prepare("SELECT COUNT(*) AS count FROM songs").get().count;
if (songCount === 0) {
  scanner.runScan().catch((error) => {
    console.error("Initial library scan failed:", error);
  });
}
