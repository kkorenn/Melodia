const fs = require("fs");
const os = require("os");
const path = require("path");
const dotenv = require("dotenv");

const workspaceRoot = path.resolve(__dirname, "../..");
const melodiaHome = path.join(os.homedir(), ".melodia");
const defaultMusicDir = path.join(melodiaHome, "song");
const defaultDbPath = path.join(melodiaHome, "melodia.sqlite");
const defaultConfigPath = path.join(melodiaHome, "config.json");

dotenv.config({ path: path.join(workspaceRoot, ".env") });

dotenv.config();

function boolFromEnv(value, fallback = true) {
  if (typeof value !== "string") {
    return fallback;
  }
  return !["false", "0", "no", "off"].includes(value.toLowerCase());
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeTheme(value) {
  return value === "light" ? "light" : "dark";
}

function expandUserHome(value) {
  if (value === "~") {
    return os.homedir();
  }
  if (value.startsWith("~/")) {
    return path.join(os.homedir(), value.slice(2));
  }
  return value;
}

function resolvePathValue(value, fallbackValue, configPath) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return fallbackValue;
  }

  const expanded = expandUserHome(raw);

  if (path.isAbsolute(expanded)) {
    return expanded;
  }

  const baseDir = path.dirname(configPath);
  return path.resolve(baseDir, expanded);
}

function ensureMelodiaHome(configPath) {
  fs.mkdirSync(melodiaHome, { recursive: true });
  fs.mkdirSync(defaultMusicDir, { recursive: true });

  if (fs.existsSync(configPath)) {
    return;
  }

  const bootstrapConfig = {
    appName: "Melodia",
    theme: "dark",
    port: 4872,
    musicDir: defaultMusicDir,
    dbPath: defaultDbPath
  };

  fs.writeFileSync(configPath, `${JSON.stringify(bootstrapConfig, null, 2)}\n`, "utf8");
}

function readMelodiaFileConfig(configPath) {
  try {
    const content = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    console.warn(`Failed to read Melodia config at ${configPath}:`, error.message);
  }

  return {};
}

function getConfig() {
  const configValue = String(process.env.MELODIA_CONFIG || defaultConfigPath).trim();
  const configPath = path.resolve(expandUserHome(configValue));
  ensureMelodiaHome(configPath);
  const fileConfig = readMelodiaFileConfig(configPath);

  const port = parsePositiveInteger(process.env.PORT ?? fileConfig.port, 4872);
  const lyricsCacheHours = parsePositiveInteger(
    process.env.LYRICS_CACHE_TTL_HOURS ?? fileConfig.lyricsCacheTtlHours,
    24
  );
  const settingsAuthRateLimitMs = parsePositiveInteger(
    process.env.SETTINGS_AUTH_RATE_LIMIT_MS ?? fileConfig.settingsAuthRateLimitMs,
    5000
  );
  const settingsAuthSessionHours = parsePositiveInteger(
    process.env.SETTINGS_AUTH_SESSION_HOURS ?? fileConfig.settingsAuthSessionHours,
    12
  );
  const settingsPasswordHash = String(process.env.SETTINGS_PASSWORD_HASH || "").trim();
  const settingsPassword = String(process.env.SETTINGS_PASSWORD || "");
  const secureCookieFromEnv =
    process.env.SETTINGS_AUTH_SECURE_COOKIE ?? fileConfig.settingsAuthSecureCookie;
  const resolvedMusicDir = resolvePathValue(
    process.env.MUSIC_DIR ?? fileConfig.musicDir,
    defaultMusicDir,
    configPath
  );
  const resolvedDbPath = resolvePathValue(
    process.env.DB_PATH ?? fileConfig.dbPath,
    defaultDbPath,
    configPath
  );
  const appName = String(process.env.APP_NAME ?? fileConfig.appName ?? "Melodia").trim();

  return {
    workspaceRoot,
    melodiaHome,
    melodiaConfigPath: configPath,
    musicDir: resolvedMusicDir,
    dbPath: resolvedDbPath,
    port,
    autoOpenBrowser: boolFromEnv(
      process.env.AUTO_OPEN_BROWSER ?? fileConfig.autoOpenBrowser,
      true
    ),
    theme: normalizeTheme(process.env.THEME ?? fileConfig.theme),
    appName: appName || "Melodia",
    lyricsCacheTtlHours: lyricsCacheHours,
    settingsPasswordHash,
    settingsPassword,
    settingsAuthEnabled: Boolean(settingsPasswordHash || settingsPassword),
    settingsAuthRateLimitMs: Math.max(1000, settingsAuthRateLimitMs),
    settingsAuthSessionTtlMs: settingsAuthSessionHours * 60 * 60 * 1000,
    settingsAuthSecureCookie:
      typeof secureCookieFromEnv === "string"
        ? boolFromEnv(secureCookieFromEnv, false)
        : typeof secureCookieFromEnv === "boolean"
          ? secureCookieFromEnv
        : null
  };
}

module.exports = {
  getConfig
};
