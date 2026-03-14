const path = require("path");
const dotenv = require("dotenv");

const workspaceRoot = path.resolve(__dirname, "../..");

dotenv.config({ path: path.join(workspaceRoot, ".env") });

dotenv.config();

function boolFromEnv(value, fallback = true) {
  if (typeof value !== "string") {
    return fallback;
  }
  return !["false", "0", "no", "off"].includes(value.toLowerCase());
}

function getConfig() {
  const port = Number.parseInt(process.env.PORT ?? "4872", 10);
  const lyricsCacheHours = Number.parseInt(
    process.env.LYRICS_CACHE_TTL_HOURS ?? "24",
    10
  );
  const settingsAuthRateLimitMs = Number.parseInt(
    process.env.SETTINGS_AUTH_RATE_LIMIT_MS ?? "5000",
    10
  );
  const settingsAuthSessionHours = Number.parseInt(
    process.env.SETTINGS_AUTH_SESSION_HOURS ?? "12",
    10
  );
  const settingsPasswordHash = String(process.env.SETTINGS_PASSWORD_HASH || "").trim();
  const settingsPassword = String(process.env.SETTINGS_PASSWORD || "");
  const secureCookieFromEnv = process.env.SETTINGS_AUTH_SECURE_COOKIE;

  return {
    workspaceRoot,
    musicDir: process.env.MUSIC_DIR || path.join(workspaceRoot, "music"),
    dbPath: path.resolve(
      workspaceRoot,
      process.env.DB_PATH || "./server/data/melodia.sqlite"
    ),
    port: Number.isFinite(port) ? port : 4872,
    autoOpenBrowser: boolFromEnv(process.env.AUTO_OPEN_BROWSER, true),
    theme: process.env.THEME || "dark",
    appName: process.env.APP_NAME || "Melodia",
    lyricsCacheTtlHours:
      Number.isFinite(lyricsCacheHours) && lyricsCacheHours > 0
        ? lyricsCacheHours
        : 24,
    settingsPasswordHash,
    settingsPassword,
    settingsAuthEnabled: Boolean(settingsPasswordHash || settingsPassword),
    settingsAuthRateLimitMs:
      Number.isFinite(settingsAuthRateLimitMs) && settingsAuthRateLimitMs >= 1000
        ? settingsAuthRateLimitMs
        : 5000,
    settingsAuthSessionTtlMs:
      Number.isFinite(settingsAuthSessionHours) && settingsAuthSessionHours > 0
        ? settingsAuthSessionHours * 60 * 60 * 1000
        : 12 * 60 * 60 * 1000,
    settingsAuthSecureCookie:
      typeof secureCookieFromEnv === "string"
        ? boolFromEnv(secureCookieFromEnv, false)
        : null
  };
}

module.exports = {
  getConfig
};
