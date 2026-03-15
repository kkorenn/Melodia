import { useEffect, useState } from "react";
import {
  COLOR_TOKEN_FIELDS,
  getPresetPalette
} from "../../lib/colorScheme";

export function SettingsColorSchemeSection({
  formTheme,
  normalizedScheme,
  customEditTheme,
  setCustomEditTheme,
  presetCards,
  customPalette,
  setColorMode,
  mainColor,
  setMainColor,
  applyPreset,
  resetCustomFromPreset,
  updateCustomColor
}) {
  const [draftMainColor, setDraftMainColor] = useState(mainColor);

  useEffect(() => {
    setDraftMainColor(mainColor);
  }, [mainColor]);

  const handleMainColorInput = (event) => {
    const nextValue = event?.target?.value;
    if (typeof nextValue !== "string" || !nextValue) {
      return;
    }

    setDraftMainColor(nextValue);
    setMainColor(nextValue);
  };

  const visiblePresetCards = Array.isArray(presetCards) ? presetCards.slice(0, 11) : [];

  return (
    <section className="space-y-3 rounded-xl border border-[color:var(--border)] bg-panelSoft/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-textSoft">Color Scheme</p>
        <p className="text-xs text-textSoft">Saved with Settings</p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setColorMode("preset")}
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
          onClick={() => setColorMode("custom")}
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
          <div className="rounded-xl border border-[color:var(--border)] bg-panel/40 p-3">
            <label className="flex items-center justify-between gap-3 text-xs text-textSoft">
              <span>Main Color</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={draftMainColor}
                  onInput={handleMainColorInput}
                  onChange={handleMainColorInput}
                  className="h-8 w-10 cursor-pointer rounded border border-[color:var(--border)] bg-transparent p-0"
                />
                <span className="w-16 text-right font-mono text-xs text-textSoft">{draftMainColor}</span>
              </div>
            </label>
            <p className="mt-2 text-[11px] text-textSoft/90">
              Presets below are generated from this color (except Monochrome).
            </p>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            {visiblePresetCards.map((preset) => {
              const previewPalette = getPresetPalette(preset.id, formTheme, draftMainColor);
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
  );
}
