import { useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  COMMON_COLOR_SCHEME_PRESET_IDS,
  COLOR_SCHEME_PRESETS,
  COLOR_TOKEN_FIELDS,
  getDefaultColorScheme,
  getPresetPalette,
  normalizeColorScheme,
  normalizeHexColor
} from "../lib/colorScheme";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import {
  fetchSettings,
  fetchSettingsAuthStatus,
  fetchStats,
  loginSettings,
  logoutSettings,
  saveSettings,
  triggerRescan
} from "../lib/api";
import { useAppStore } from "../store/appStore";
import { formatLargeNumber, formatTotalDuration } from "../utils/format";

export function SettingsPage() {
  const {
    settings,
    stats,
    scanState,
    setSettings,
    setStats,
    setTheme,
    setColorScheme
  } = useAppStore(
    useShallow((state) => ({
      settings: state.settings,
      stats: state.stats,
      scanState: state.scanState,
      setSettings: state.setSettings,
      setStats: state.setStats,
      setTheme: state.setTheme,
      setColorScheme: state.setColorScheme
    }))
  );

  const [form, setForm] = useState({
    musicDir: "",
    port: 4872,
    theme: "dark",
    colorScheme: getDefaultColorScheme()
  });

  const [customEditTheme, setCustomEditTheme] = useState("dark");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [rescanning, setRescanning] = useState(false);
  const [showAllPresets, setShowAllPresets] = useState(false);
  const [authState, setAuthState] = useState({
    loading: true,
    enabled: false,
    authenticated: false,
    expiresAt: null
  });
  const [settingsPassword, setSettingsPassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const hasHydratedRef = useRef(false);
  const lastSavedSignatureRef = useRef("");
  const saveRequestIdRef = useRef(0);

  const normalizedScheme = useMemo(
    () => normalizeColorScheme(form.colorScheme),
    [form.colorScheme]
  );
  const customPalette = normalizedScheme.custom[customEditTheme];
  const presetCards = useMemo(() => {
    const allPresets = COLOR_SCHEME_PRESETS;
    if (showAllPresets || allPresets.length <= 4) {
      return allPresets;
    }

    const commonSet = new Set(COMMON_COLOR_SCHEME_PRESET_IDS);
    const commonPresets = allPresets.filter((preset) => commonSet.has(preset.id));
    const fallbackCommon = commonPresets.length ? commonPresets : allPresets.slice(0, 4);

    if (fallbackCommon.some((preset) => preset.id === normalizedScheme.preset)) {
      return fallbackCommon;
    }

    const activePreset = allPresets.find(
      (preset) => preset.id === normalizedScheme.preset
    );

    return activePreset ? [...fallbackCommon, activePreset] : fallbackCommon;
  }, [normalizedScheme.preset, showAllPresets]);
  const autoSavePayload = useMemo(
    () => ({
      musicDir: form.musicDir,
      port: form.port,
      theme: form.theme,
      colorScheme: normalizedScheme
    }),
    [form.musicDir, form.port, form.theme, normalizedScheme]
  );
  const autoSaveSignature = useMemo(
    () => JSON.stringify(autoSavePayload),
    [autoSavePayload]
  );
  const debouncedAutoSaveSignature = useDebouncedValue(autoSaveSignature, 650);

  useEffect(() => {
    let cancelled = false;

    const loadSettingsData = () => {
      Promise.all([fetchSettings(), fetchStats()])
        .then(([settingsData, statsData]) => {
          if (cancelled) {
            return;
          }

          const nextScheme = normalizeColorScheme(settingsData.colorScheme);
          const initialPayload = {
            musicDir: settingsData.musicDir || "",
            port: settingsData.port || 4872,
            theme: settingsData.theme || "dark",
            colorScheme: nextScheme
          };

          setSettings(settingsData);
          setStats(statsData);
          setForm(initialPayload);
          setCustomEditTheme(settingsData.theme === "light" ? "light" : "dark");
          lastSavedSignatureRef.current = JSON.stringify(initialPayload);
          hasHydratedRef.current = true;
          setMessage("Auto-save is on.");
        })
        .catch((err) => {
          if (cancelled) {
            return;
          }

          if (err?.status === 401) {
            hasHydratedRef.current = false;
            setAuthState((previous) => ({
              ...previous,
              loading: false,
              enabled: true,
              authenticated: false
            }));
            setError("Settings are locked. Enter your password to continue.");
            return;
          }

          setError(err.message || "Could not load settings");
        });
    };

    fetchSettingsAuthStatus()
      .then((status) => {
        if (cancelled) {
          return;
        }

        setAuthState({
          loading: false,
          enabled: Boolean(status?.enabled),
          authenticated: Boolean(status?.authenticated),
          expiresAt: status?.expiresAt || null
        });

        if (status?.enabled && !status?.authenticated) {
          hasHydratedRef.current = false;
          setMessage("Settings are locked.");
          return;
        }

        loadSettingsData();
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }

        setAuthState((previous) => ({
          ...previous,
          loading: false
        }));
        setError(err.message || "Could not verify settings authentication");
      });

    return () => {
      cancelled = true;
    };
  }, [setSettings, setStats]);

  useEffect(() => {
    if (!scanState.running) {
      setRescanning(false);
      fetchStats()
        .then((statsData) => setStats(statsData))
        .catch(() => {
          // no-op
        });
    }
  }, [scanState.running, setStats]);

  useEffect(() => {
    if (!hasHydratedRef.current) {
      return;
    }

    if (authState.enabled && !authState.authenticated) {
      return;
    }

    setColorScheme(normalizedScheme);
  }, [authState.authenticated, authState.enabled, normalizedScheme, setColorScheme]);

  useEffect(() => {
    if (!hasHydratedRef.current) {
      return;
    }

    if (debouncedAutoSaveSignature === lastSavedSignatureRef.current) {
      return;
    }

    const requestId = saveRequestIdRef.current + 1;
    saveRequestIdRef.current = requestId;
    setSaving(true);
    setError("");
    setMessage("Saving changes...");

    const payload = JSON.parse(debouncedAutoSaveSignature);
    saveSettings(payload)
      .then((response) => {
        if (requestId !== saveRequestIdRef.current) {
          return;
        }

        lastSavedSignatureRef.current = debouncedAutoSaveSignature;
        if (response?.settings) {
          setSettings(response.settings);
          setTheme(response.settings.theme || "dark");
        }
        setMessage("All changes saved.");
      })
      .catch((err) => {
        if (requestId !== saveRequestIdRef.current) {
          return;
        }
        if (err?.status === 401) {
          hasHydratedRef.current = false;
          setAuthState((previous) => ({
            ...previous,
            authenticated: false
          }));
          setMessage("");
          setError("Settings session expired. Unlock settings again.");
          return;
        }
        setError(err.message || "Could not auto-save settings");
      })
      .finally(() => {
        if (requestId === saveRequestIdRef.current) {
          setSaving(false);
        }
      });
  }, [
    debouncedAutoSaveSignature,
    setSettings,
    setTheme
  ]);

  const updateScheme = (updater) => {
    setForm((previous) => {
      const current = normalizeColorScheme(previous.colorScheme);
      const next = normalizeColorScheme(updater(current));
      return {
        ...previous,
        colorScheme: next
      };
    });
  };

  const applyPreset = (presetId) => {
    updateScheme((current) => ({
      ...current,
      mode: "preset",
      preset: presetId
    }));
  };

  const enableCustomMode = () => {
    updateScheme((current) => ({
      ...current,
      mode: "custom"
    }));
  };

  const resetCustomFromPreset = () => {
    updateScheme((current) => ({
      ...current,
      custom: {
        dark: getPresetPalette(current.preset, "dark"),
        light: getPresetPalette(current.preset, "light")
      }
    }));
  };

  const updateCustomColor = (tokenKey, nextHexValue) => {
    updateScheme((current) => {
      const paletteTheme = customEditTheme === "light" ? "light" : "dark";
      const existingPalette = current.custom[paletteTheme];
      return {
        ...current,
        mode: "custom",
        custom: {
          ...current.custom,
          [paletteTheme]: {
            ...existingPalette,
            [tokenKey]: normalizeHexColor(nextHexValue, existingPalette[tokenKey])
          }
        }
      };
    });
  };

  const startRescan = () => {
    setError("");
    setMessage("");
    setRescanning(true);
    triggerRescan()
      .then(() => {
        setMessage("Rescan started. Live progress is shown below.");
      })
      .catch((err) => {
        if (err?.status === 401) {
          setAuthState((previous) => ({
            ...previous,
            authenticated: false
          }));
          setError("Settings session expired. Unlock settings again.");
          setRescanning(false);
          return;
        }
        setError(err.message || "Could not start rescan");
        setRescanning(false);
      });
  };

  const unlockSettings = () => {
    if (!settingsPassword) {
      setError("Enter your settings password.");
      return;
    }

    setUnlocking(true);
    setError("");
    setMessage("");

    loginSettings(settingsPassword)
      .then((response) => {
        const authenticated = Boolean(response?.authenticated);
        setAuthState((previous) => ({
          ...previous,
          loading: false,
          enabled: true,
          authenticated,
          expiresAt: response?.expiresAt || null
        }));

        if (!authenticated) {
          setError("Could not unlock settings.");
          return;
        }

        setSettingsPassword("");
        setMessage("Settings unlocked.");

        return Promise.all([fetchSettings(), fetchStats()]).then(
          ([settingsData, statsData]) => {
            const nextScheme = normalizeColorScheme(settingsData.colorScheme);
            const initialPayload = {
              musicDir: settingsData.musicDir || "",
              port: settingsData.port || 4872,
              theme: settingsData.theme || "dark",
              colorScheme: nextScheme
            };

            setSettings(settingsData);
            setStats(statsData);
            setForm(initialPayload);
            setCustomEditTheme(settingsData.theme === "light" ? "light" : "dark");
            lastSavedSignatureRef.current = JSON.stringify(initialPayload);
            hasHydratedRef.current = true;
          }
        );
      })
      .catch((err) => {
        if (err?.status === 429) {
          const waitSeconds = Math.max(
            1,
            Math.ceil(Number(err?.retryAfterMs || 0) / 1000)
          );
          setError(`Too many attempts. Try again in ${waitSeconds}s.`);
          return;
        }
        setError(err.message || "Could not unlock settings");
      })
      .finally(() => {
        setUnlocking(false);
      });
  };

  const lockSettings = () => {
    logoutSettings()
      .catch(() => {
        // no-op
      })
      .finally(() => {
        hasHydratedRef.current = false;
        setAuthState((previous) => ({
          ...previous,
          authenticated: false
        }));
        setMessage("Settings locked.");
      });
  };

  const applyTheme = (nextTheme) => {
    setForm((previous) => ({ ...previous, theme: nextTheme }));
    setCustomEditTheme(nextTheme === "light" ? "light" : "dark");
    setTheme(nextTheme);
    setError("");
  };

  const settingsLocked = authState.enabled && !authState.authenticated;

  if (authState.loading) {
    return <p className="text-sm text-textSoft">Checking settings access...</p>;
  }

  if (settingsLocked) {
    return (
      <section className="space-y-5">
        <div>
          <h2 className="text-2xl font-semibold text-text">Settings</h2>
          <p className="text-sm text-textSoft">Protected via backend password</p>
        </div>

        <div className="space-y-4 rounded-2xl border border-[color:var(--border)] bg-panel/70 p-4">
          <p className="text-sm text-textSoft">
            Enter your settings password to unlock configuration and rescanning controls.
          </p>

          <label className="block text-sm text-textSoft">
            Settings Password
            <input
              type="password"
              value={settingsPassword}
              onChange={(event) => setSettingsPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  unlockSettings();
                }
              }}
              className="mt-1 w-full rounded-xl border border-[color:var(--border)] bg-panelSoft px-3 py-2 text-sm text-text outline-none focus:border-accent"
              placeholder="Enter password"
              autoComplete="current-password"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={unlockSettings}
              disabled={unlocking}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-shell transition hover:brightness-110 disabled:opacity-60"
            >
              {unlocking ? "Unlocking..." : "Unlock Settings"}
            </button>
            <span className="text-xs text-textSoft">Rate limit: 1 try every 5 seconds</span>
          </div>

          {message && <p className="text-sm text-emerald-300">{message}</p>}
          {error && <p className="text-sm text-rose-300">{error}</p>}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-text">Settings</h2>
        <p className="text-sm text-textSoft">Local-only configuration for Melodia</p>
        {authState.enabled && (
          <button
            type="button"
            onClick={lockSettings}
            className="mt-2 rounded-lg border border-[color:var(--border)] px-2.5 py-1.5 text-xs text-textSoft transition hover:border-accent/40 hover:text-text"
          >
            Lock Settings
          </button>
        )}
      </div>

      <div className="space-y-4 rounded-2xl border border-[color:var(--border)] bg-panel/70 p-4">
        <label className="block text-sm text-textSoft">
          Music Root Folder
          <input
            value={form.musicDir}
            onChange={(event) =>
              setForm((previous) => ({ ...previous, musicDir: event.target.value }))
            }
            className="mt-1 w-full rounded-xl border border-[color:var(--border)] bg-panelSoft px-3 py-2 text-sm text-text outline-none focus:border-accent"
            placeholder="/absolute/path/to/music"
          />
        </label>

        <label className="block text-sm text-textSoft">
          API Port (restart required after change)
          <input
            type="number"
            min={1}
            value={form.port}
            onChange={(event) =>
              setForm((previous) => ({ ...previous, port: Number(event.target.value) || 4872 }))
            }
            className="mt-1 w-full rounded-xl border border-[color:var(--border)] bg-panelSoft px-3 py-2 text-sm text-text outline-none focus:border-accent"
          />
        </label>

        <div>
          <p className="text-sm text-textSoft">Theme</p>
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={() => applyTheme("dark")}
              className={`rounded-xl px-3 py-2 text-sm transition ${
                form.theme === "dark"
                  ? "bg-accent text-shell"
                  : "border border-[color:var(--border)] text-textSoft hover:text-text"
              }`}
            >
              Dark
            </button>
            <button
              type="button"
              onClick={() => applyTheme("light")}
              className={`rounded-xl px-3 py-2 text-sm transition ${
                form.theme === "light"
                  ? "bg-accent text-shell"
                  : "border border-[color:var(--border)] text-textSoft hover:text-text"
              }`}
            >
              Light
            </button>
          </div>
        </div>

        <section className="space-y-3 rounded-xl border border-[color:var(--border)] bg-panelSoft/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-textSoft">Color Scheme</p>
            <p className="text-xs text-textSoft">Saved with Settings</p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => updateScheme((current) => ({ ...current, mode: "preset" }))}
              className={`rounded-lg px-2.5 py-1.5 text-xs transition ${
                normalizedScheme.mode === "preset"
                  ? "bg-accent text-shell"
                  : "border border-[color:var(--border)] text-textSoft hover:text-text"
              }`}
            >
              Presets
            </button>
            <button
              type="button"
              onClick={enableCustomMode}
              className={`rounded-lg px-2.5 py-1.5 text-xs transition ${
                normalizedScheme.mode === "custom"
                  ? "bg-accent text-shell"
                  : "border border-[color:var(--border)] text-textSoft hover:text-text"
              }`}
            >
              Custom
            </button>
          </div>

          {normalizedScheme.mode === "preset" && (
            <div className="space-y-2">
              {COLOR_SCHEME_PRESETS.length > 4 && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-textSoft">
                    {showAllPresets
                      ? `Showing all ${COLOR_SCHEME_PRESETS.length} palettes`
                      : "Showing 4 common palettes"}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAllPresets((previous) => !previous)}
                    className="rounded-lg border border-[color:var(--border)] px-2.5 py-1 text-xs text-textSoft transition hover:border-accent/40 hover:text-text"
                  >
                    {showAllPresets ? "Show Less" : "Show More"}
                  </button>
                </div>
              )}

              <div className="grid gap-2 md:grid-cols-2">
                {presetCards.map((preset) => {
                  const previewPalette = getPresetPalette(preset.id, form.theme);
                  const isActive = normalizedScheme.preset === preset.id;

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset.id)}
                      className={`rounded-xl border p-3 text-left transition ${
                        isActive
                          ? "border-accent/50 bg-accent/10"
                          : "border-[color:var(--border)] hover:border-accent/40 hover:bg-panel/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-text">{preset.name}</span>
                        {isActive && (
                          <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-accent">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex gap-1">
                        {["shell", "panel", "accent", "accentWarm"].map((tokenKey) => (
                          <span
                            key={tokenKey}
                            className="h-4 w-4 rounded-full border border-white/20"
                            style={{ backgroundColor: previewPalette[tokenKey] }}
                          />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {normalizedScheme.mode === "custom" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCustomEditTheme("dark")}
                    className={`rounded-lg px-2.5 py-1.5 text-xs transition ${
                      customEditTheme === "dark"
                        ? "bg-accent text-shell"
                        : "border border-[color:var(--border)] text-textSoft hover:text-text"
                    }`}
                  >
                    Edit Dark Palette
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomEditTheme("light")}
                    className={`rounded-lg px-2.5 py-1.5 text-xs transition ${
                      customEditTheme === "light"
                        ? "bg-accent text-shell"
                        : "border border-[color:var(--border)] text-textSoft hover:text-text"
                    }`}
                  >
                    Edit Light Palette
                  </button>
                </div>
                <button
                  type="button"
                  onClick={resetCustomFromPreset}
                  className="rounded-lg border border-[color:var(--border)] px-2.5 py-1.5 text-xs text-textSoft transition hover:border-accent/40 hover:text-text"
                >
                  Reset From Preset
                </button>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                {COLOR_TOKEN_FIELDS.map((token) => (
                  <label
                    key={`${customEditTheme}-${token.key}`}
                    className="flex items-center justify-between rounded-xl border border-[color:var(--border)] bg-panel/50 px-3 py-2"
                  >
                    <span className="text-xs text-textSoft">{token.label}</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={customPalette[token.key]}
                        onChange={(event) =>
                          updateCustomColor(token.key, event.target.value)
                        }
                        className="h-8 w-10 cursor-pointer rounded border border-[color:var(--border)] bg-transparent p-0"
                      />
                      <span className="w-16 text-right font-mono text-xs text-textSoft">
                        {customPalette[token.key]}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </section>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={startRescan}
            disabled={scanState.running || rescanning}
            className="rounded-xl border border-[color:var(--border)] px-4 py-2 text-sm text-textSoft transition hover:border-accent/40 hover:text-text disabled:opacity-60"
          >
            {scanState.running || rescanning ? "Scanning..." : "Rescan Library"}
          </button>
          <span className="text-xs text-textSoft">
            {saving ? "Saving..." : "Auto-save enabled"}
          </span>
        </div>

        {message && <p className="text-sm text-emerald-300">{message}</p>}
        {error && <p className="text-sm text-rose-300">{error}</p>}
      </div>

      <section className="space-y-3 rounded-2xl border border-[color:var(--border)] bg-panel/70 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm uppercase tracking-[0.14em] text-textSoft">
            Library Scan Progress
          </h3>
          <span className="text-sm text-text">{scanState.progress || 0}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-panelSoft">
          <div
            className="h-full bg-gradient-to-r from-accent to-accentWarm transition-all"
            style={{ width: `${scanState.progress || 0}%` }}
          />
        </div>
        <p className="text-xs text-textSoft">
          {scanState.running
            ? `Scanning ${scanState.scanned || 0}/${scanState.total || 0} files`
            : "Idle"}
        </p>
        <p className="truncate text-xs text-textSoft">
          {scanState.currentFile || "No file active"}
        </p>
        <p className="text-xs text-textSoft">
          Added: {scanState.added || 0} · Updated: {scanState.updated || 0} · Skipped:{" "}
          {scanState.skipped || 0} · Removed: {scanState.removed || 0}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 rounded-2xl border border-[color:var(--border)] bg-panel/70 p-4 lg:grid-cols-4">
        <div className="rounded-xl bg-panelSoft/70 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-textSoft">Songs</p>
          <p className="mt-1 text-xl font-semibold text-text">
            {formatLargeNumber(stats?.totalSongs || 0)}
          </p>
        </div>
        <div className="rounded-xl bg-panelSoft/70 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-textSoft">Artists</p>
          <p className="mt-1 text-xl font-semibold text-text">
            {formatLargeNumber(stats?.totalArtists || 0)}
          </p>
        </div>
        <div className="rounded-xl bg-panelSoft/70 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-textSoft">Albums</p>
          <p className="mt-1 text-xl font-semibold text-text">
            {formatLargeNumber(stats?.totalAlbums || 0)}
          </p>
        </div>
        <div className="rounded-xl bg-panelSoft/70 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-textSoft">Total Duration</p>
          <p className="mt-1 text-xl font-semibold text-text">
            {formatTotalDuration(stats?.totalDuration || 0)}
          </p>
        </div>
      </section>

      {settings?.port && (
        <p className="text-xs text-textSoft">
          Current API port: <span className="text-text">{settings.port}</span>
        </p>
      )}
    </section>
  );
}
