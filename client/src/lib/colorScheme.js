const COLOR_TOKEN_DEFINITIONS = [
  { key: "shell", label: "App Background" },
  { key: "panel", label: "Panels" },
  { key: "panelSoft", label: "Panel Surfaces" },
  { key: "text", label: "Main Text" },
  { key: "textSoft", label: "Secondary Text" },
  { key: "accent", label: "Accent" },
  { key: "accentWarm", label: "Warm Accent" }
];

const DEFAULT_SEED_COLOR = "#14b8a6";
const THEME_BOOTSTRAP_CACHE_KEY = "melodia-theme-bootstrap-v1";

const MONOCHROME_PRESET = {
  id: "mono",
  name: "Monochrome",
  kind: "static",
  dark: {
    shell: "#0b0b0b",
    panel: "#171717",
    panelSoft: "#262626",
    text: "#f5f5f5",
    textSoft: "#a3a3a3",
    accent: "#e5e5e5",
    accentWarm: "#d4d4d4"
  },
  light: {
    shell: "#f7f7f7",
    panel: "#ffffff",
    panelSoft: "#eeeeee",
    text: "#171717",
    textSoft: "#737373",
    accent: "#404040",
    accentWarm: "#525252"
  }
};

const DYNAMIC_PRESET_VARIANTS = [
  {
    id: "core",
    name: "Core",
    neutralSatBias: 0,
    darkNeutralLightBias: 0,
    lightNeutralLightBias: 0,
    darkAccentSatBias: 0,
    darkAccentLightBias: 0,
    lightAccentSatBias: 0,
    lightAccentLightBias: 0,
    warmHueShift: 18,
    warmSatBias: -4,
    warmLightBias: 4
  },
  {
    id: "vivid",
    name: "Vivid",
    neutralSatBias: 4,
    darkNeutralLightBias: 0,
    lightNeutralLightBias: -1,
    darkAccentSatBias: 12,
    darkAccentLightBias: 4,
    lightAccentSatBias: 10,
    lightAccentLightBias: -2,
    warmHueShift: 24,
    warmSatBias: 2,
    warmLightBias: 4
  },
  {
    id: "deep",
    name: "Deep",
    neutralSatBias: 6,
    darkNeutralLightBias: -2,
    lightNeutralLightBias: -2,
    darkAccentSatBias: 2,
    darkAccentLightBias: -8,
    lightAccentSatBias: 0,
    lightAccentLightBias: -5,
    warmHueShift: 16,
    warmSatBias: -2,
    warmLightBias: -1
  },
  {
    id: "muted",
    name: "Muted",
    neutralSatBias: -8,
    darkNeutralLightBias: 2,
    lightNeutralLightBias: 2,
    darkAccentSatBias: -18,
    darkAccentLightBias: 3,
    lightAccentSatBias: -16,
    lightAccentLightBias: 1,
    warmHueShift: 14,
    warmSatBias: -8,
    warmLightBias: 2
  },
  {
    id: "soft",
    name: "Soft",
    neutralSatBias: -4,
    darkNeutralLightBias: 3,
    lightNeutralLightBias: 2,
    darkAccentSatBias: -8,
    darkAccentLightBias: 6,
    lightAccentSatBias: -8,
    lightAccentLightBias: 3,
    warmHueShift: 14,
    warmSatBias: -6,
    warmLightBias: 4
  },
  {
    id: "night",
    name: "Night",
    neutralSatBias: 5,
    darkNeutralLightBias: -3,
    lightNeutralLightBias: -3,
    darkAccentSatBias: 4,
    darkAccentLightBias: -10,
    lightAccentSatBias: 2,
    lightAccentLightBias: -6,
    warmHueShift: 20,
    warmSatBias: -2,
    warmLightBias: -2
  },
  {
    id: "glow",
    name: "Glow",
    neutralSatBias: 2,
    darkNeutralLightBias: 1,
    lightNeutralLightBias: 0,
    darkAccentSatBias: 10,
    darkAccentLightBias: 8,
    lightAccentSatBias: 8,
    lightAccentLightBias: 3,
    warmHueShift: 28,
    warmSatBias: 0,
    warmLightBias: 6
  },
  {
    id: "ember",
    name: "Ember",
    neutralSatBias: 8,
    darkNeutralLightBias: -1,
    lightNeutralLightBias: -1,
    darkAccentSatBias: 8,
    darkAccentLightBias: -2,
    lightAccentSatBias: 6,
    lightAccentLightBias: -1,
    warmHueShift: 30,
    warmSatBias: 8,
    warmLightBias: 3
  },
  {
    id: "pastel",
    name: "Pastel",
    neutralSatBias: -10,
    darkNeutralLightBias: 4,
    lightNeutralLightBias: 3,
    darkAccentSatBias: -20,
    darkAccentLightBias: 10,
    lightAccentSatBias: -24,
    lightAccentLightBias: 6,
    warmHueShift: 10,
    warmSatBias: -14,
    warmLightBias: 6
  },
  {
    id: "contrast",
    name: "High Contrast",
    neutralSatBias: 0,
    darkNeutralLightBias: -2,
    lightNeutralLightBias: -2,
    darkAccentSatBias: 14,
    darkAccentLightBias: 0,
    lightAccentSatBias: 12,
    lightAccentLightBias: -4,
    warmHueShift: 22,
    warmSatBias: 3,
    warmLightBias: 1
  }
];

export const COLOR_SCHEME_PRESETS = [
  ...DYNAMIC_PRESET_VARIANTS.map((variant) => ({
    id: `main-${variant.id}`,
    name: variant.name,
    kind: "dynamic",
    variant
  })),
  MONOCHROME_PRESET
];

export const COMMON_COLOR_SCHEME_PRESET_IDS = [
  "main-core",
  "main-vivid",
  "main-deep",
  "main-soft",
  "mono"
];

const PRESET_BY_ID = new Map(COLOR_SCHEME_PRESETS.map((preset) => [preset.id, preset]));
const DEFAULT_PRESET_ID = "main-core";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeHue(hue) {
  const normalized = Number.isFinite(Number(hue)) ? Number(hue) : 0;
  return ((normalized % 360) + 360) % 360;
}

function hslToHex(hue, saturation, lightness) {
  const h = normalizeHue(hue) / 360;
  const s = clamp(saturation, 0, 100) / 100;
  const l = clamp(lightness, 0, 100) / 100;

  if (s === 0) {
    const gray = Math.round(l * 255);
    const hex = gray.toString(16).padStart(2, "0");
    return `#${hex}${hex}${hex}`;
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const convert = (t) => {
    let next = t;
    if (next < 0) {
      next += 1;
    }
    if (next > 1) {
      next -= 1;
    }
    if (next < 1 / 6) {
      return p + (q - p) * 6 * next;
    }
    if (next < 1 / 2) {
      return q;
    }
    if (next < 2 / 3) {
      return p + (q - p) * (2 / 3 - next) * 6;
    }
    return p;
  };

  const red = Math.round(convert(h + 1 / 3) * 255)
    .toString(16)
    .padStart(2, "0");
  const green = Math.round(convert(h) * 255)
    .toString(16)
    .padStart(2, "0");
  const blue = Math.round(convert(h - 1 / 3) * 255)
    .toString(16)
    .padStart(2, "0");

  return `#${red}${green}${blue}`;
}

export function normalizeHexColor(value, fallback = "#000000") {
  const input = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (/^#[0-9a-f]{6}$/.test(input)) {
    return input;
  }

  if (/^[0-9a-f]{6}$/.test(input)) {
    return `#${input}`;
  }

  const shortHexMatch = input.match(/^#?([0-9a-f]{3}|[0-9a-f]{4})$/);
  if (shortHexMatch) {
    const source = shortHexMatch[1].slice(0, 3);
    const expanded = source
      .split("")
      .map((char) => `${char}${char}`)
      .join("");
    return `#${expanded}`;
  }

  const longHexWithAlphaMatch = input.match(/^#?([0-9a-f]{8})$/);
  if (longHexWithAlphaMatch) {
    return `#${longHexWithAlphaMatch[1].slice(0, 6)}`;
  }

  return fallback;
}

function hexToHsl(hexValue) {
  const normalized = normalizeHexColor(hexValue, "#000000").slice(1);
  const red = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const green = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(normalized.slice(4, 6), 16) / 255;

  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  const lightness = (max + min) / 2;

  if (delta === 0) {
    return {
      h: 0,
      s: 0,
      l: Math.round(lightness * 100)
    };
  }

  const saturation =
    lightness > 0.5
      ? delta / (2 - max - min)
      : delta / (max + min);

  let hue;
  if (max === red) {
    hue = (green - blue) / delta + (green < blue ? 6 : 0);
  } else if (max === green) {
    hue = (blue - red) / delta + 2;
  } else {
    hue = (red - green) / delta + 4;
  }

  return {
    h: normalizeHue(hue * 60),
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100)
  };
}

function clonePalette(palette) {
  return COLOR_TOKEN_DEFINITIONS.reduce((acc, token) => {
    acc[token.key] = palette[token.key];
    return acc;
  }, {});
}

function normalizePalette(palette, fallbackPalette) {
  return COLOR_TOKEN_DEFINITIONS.reduce((acc, token) => {
    const fallback = fallbackPalette[token.key];
    acc[token.key] = normalizeHexColor(palette?.[token.key], fallback);
    return acc;
  }, {});
}

function buildDynamicPalette(seedColor, theme, variant) {
  const seed = hexToHsl(seedColor);
  const hue = seed.h;
  const seedSat = clamp(seed.s, 34, 92);
  const seedLight = clamp(seed.l, 25, 75);

  const accentSat =
    theme === "dark"
      ? clamp(seedSat + variant.darkAccentSatBias, 34, 96)
      : clamp(seedSat + variant.lightAccentSatBias, 28, 92);
  const accentLight =
    theme === "dark"
      ? clamp(50 + variant.darkAccentLightBias + (seedLight - 50) * 0.12, 30, 72)
      : clamp(41 + variant.lightAccentLightBias + (seedLight - 50) * 0.08, 22, 60);

  const warmHue = normalizeHue(hue + variant.warmHueShift);
  const warmSat = clamp(accentSat + variant.warmSatBias, 24, 96);
  const warmLight = clamp(accentLight + variant.warmLightBias, 22, 78);

  const neutralSat = clamp(20 + variant.neutralSatBias, 0, 42);

  if (theme === "dark") {
    return {
      shell: hslToHex(hue, neutralSat, clamp(7 + variant.darkNeutralLightBias, 3, 15)),
      panel: hslToHex(hue, neutralSat + 3, clamp(12 + variant.darkNeutralLightBias, 7, 22)),
      panelSoft: hslToHex(
        hue,
        neutralSat + 8,
        clamp(18 + variant.darkNeutralLightBias * 1.2, 12, 30)
      ),
      text: hslToHex(hue, 18, 93),
      textSoft: hslToHex(hue, 12, 70),
      accent: hslToHex(hue, accentSat, accentLight),
      accentWarm: hslToHex(warmHue, warmSat, warmLight)
    };
  }

  return {
    shell: hslToHex(hue, clamp(neutralSat + 16, 6, 48), clamp(97 + variant.lightNeutralLightBias, 93, 99)),
    panel: hslToHex(hue, clamp(neutralSat + 8, 4, 36), 99),
    panelSoft: hslToHex(
      hue,
      clamp(neutralSat + 12, 6, 42),
      clamp(92 + variant.lightNeutralLightBias, 86, 97)
    ),
    text: hslToHex(hue, 24, 12),
    textSoft: hslToHex(hue, 12, 41),
    accent: hslToHex(hue, accentSat, accentLight),
    accentWarm: hslToHex(warmHue, warmSat, warmLight)
  };
}

function getPreset(presetId) {
  return PRESET_BY_ID.get(presetId) || PRESET_BY_ID.get(DEFAULT_PRESET_ID);
}

export function getPresetPalette(presetId, theme, seedColor = DEFAULT_SEED_COLOR) {
  const preset = getPreset(presetId);
  const mode = theme === "light" ? "light" : "dark";

  if (preset.kind === "dynamic") {
    const normalizedSeedColor = normalizeHexColor(seedColor, DEFAULT_SEED_COLOR);
    return buildDynamicPalette(normalizedSeedColor, mode, preset.variant);
  }

  return clonePalette(preset[mode]);
}

export function getDefaultColorScheme() {
  return {
    mode: "preset",
    preset: DEFAULT_PRESET_ID,
    seedColor: DEFAULT_SEED_COLOR,
    custom: {
      dark: getPresetPalette(DEFAULT_PRESET_ID, "dark", DEFAULT_SEED_COLOR),
      light: getPresetPalette(DEFAULT_PRESET_ID, "light", DEFAULT_SEED_COLOR)
    }
  };
}

export function normalizeColorScheme(value) {
  const fallback = getDefaultColorScheme();
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }

  const preset = getPreset(value.preset);
  const mode = value.mode === "custom" ? "custom" : "preset";
  const seedColor = normalizeHexColor(value.seedColor, DEFAULT_SEED_COLOR);
  const fallbackDark = getPresetPalette(preset.id, "dark", seedColor);
  const fallbackLight = getPresetPalette(preset.id, "light", seedColor);

  return {
    mode,
    preset: preset.id,
    seedColor,
    custom: {
      dark: normalizePalette(value.custom?.dark, fallbackDark),
      light: normalizePalette(value.custom?.light, fallbackLight)
    }
  };
}

export function getActivePalette(theme, colorScheme) {
  const normalized = normalizeColorScheme(colorScheme);
  const mode = theme === "light" ? "light" : "dark";

  if (normalized.mode === "custom") {
    return clonePalette(normalized.custom[mode]);
  }

  return getPresetPalette(normalized.preset, mode, normalized.seedColor);
}

function hexToTriplet(hex) {
  const normalized = normalizeHexColor(hex, "#000000").slice(1);
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `${red} ${green} ${blue}`;
}

export function applyColorScheme(theme, colorScheme) {
  if (typeof document === "undefined") {
    return;
  }

  const palette = getActivePalette(theme, colorScheme);
  const root = document.documentElement;
  const shellTriplet = hexToTriplet(palette.shell);
  const panelTriplet = hexToTriplet(palette.panel);
  const panelSoftTriplet = hexToTriplet(palette.panelSoft);
  const textTriplet = hexToTriplet(palette.text);
  const textSoftTriplet = hexToTriplet(palette.textSoft);
  const accentTriplet = hexToTriplet(palette.accent).replace(/\s+/g, " ");
  const accentWarmTriplet = hexToTriplet(palette.accentWarm);

  root.style.setProperty("--color-shell", shellTriplet);
  root.style.setProperty("--color-panel", panelTriplet);
  root.style.setProperty("--color-panel-soft", panelSoftTriplet);
  root.style.setProperty("--color-text", textTriplet);
  root.style.setProperty("--color-text-soft", textSoftTriplet);
  root.style.setProperty("--color-accent", accentTriplet);
  root.style.setProperty("--color-accent-warm", accentWarmTriplet);
  root.style.setProperty(
    "--accent-soft",
    `rgb(${accentTriplet} / ${theme === "light" ? "0.18" : "0.22"})`
  );
  root.style.setProperty(
    "--glow-color",
    `rgb(${accentTriplet} / ${theme === "light" ? "0.22" : "0.28"})`
  );

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        THEME_BOOTSTRAP_CACHE_KEY,
        JSON.stringify({
          theme: theme === "light" ? "light" : "dark",
          palette: {
            shell: shellTriplet,
            panel: panelTriplet,
            panelSoft: panelSoftTriplet,
            text: textTriplet,
            textSoft: textSoftTriplet,
            accent: accentTriplet,
            accentWarm: accentWarmTriplet
          }
        })
      );
    } catch {
      // no-op: cache write is best-effort only
    }
  }
}

export const COLOR_TOKEN_FIELDS = COLOR_TOKEN_DEFINITIONS;
