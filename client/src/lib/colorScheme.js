const COLOR_TOKEN_DEFINITIONS = [
  { key: "shell", label: "App Background" },
  { key: "panel", label: "Panels" },
  { key: "panelSoft", label: "Panel Surfaces" },
  { key: "text", label: "Main Text" },
  { key: "textSoft", label: "Secondary Text" },
  { key: "accent", label: "Accent" },
  { key: "accentWarm", label: "Warm Accent" }
];

const BASE_COLOR_SCHEME_PRESETS = [
  {
    id: "melodia",
    name: "Melodia",
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
  },
  {
    id: "sunset",
    name: "Sunset Amber",
    dark: {
      shell: "#120c08",
      panel: "#21160f",
      panelSoft: "#332218",
      text: "#f8ebe1",
      textSoft: "#cdae9a",
      accent: "#f97316",
      accentWarm: "#fbbf24"
    },
    light: {
      shell: "#fff8f2",
      panel: "#fffdfb",
      panelSoft: "#fdf0e4",
      text: "#2a180f",
      textSoft: "#7c5b44",
      accent: "#ea580c",
      accentWarm: "#d97706"
    }
  },
  {
    id: "icewave",
    name: "Ice Wave",
    dark: {
      shell: "#061117",
      panel: "#10202a",
      panelSoft: "#1a3240",
      text: "#e4f4fb",
      textSoft: "#8db1c2",
      accent: "#22d3ee",
      accentWarm: "#38bdf8"
    },
    light: {
      shell: "#f2fbff",
      panel: "#ffffff",
      panelSoft: "#e6f5fb",
      text: "#08202d",
      textSoft: "#4d7a8d",
      accent: "#0891b2",
      accentWarm: "#0284c7"
    }
  },
  {
    id: "mint",
    name: "Mint Forest",
    dark: {
      shell: "#07130f",
      panel: "#0f211a",
      panelSoft: "#173328",
      text: "#e4f8ef",
      textSoft: "#96bda9",
      accent: "#10b981",
      accentWarm: "#34d399"
    },
    light: {
      shell: "#f3fcf8",
      panel: "#ffffff",
      panelSoft: "#e7f7ef",
      text: "#0f2a1f",
      textSoft: "#4b7a66",
      accent: "#059669",
      accentWarm: "#10b981"
    }
  },
  {
    id: "violet",
    name: "Violet Pulse",
    dark: {
      shell: "#0d0818",
      panel: "#1a1230",
      panelSoft: "#2a1d48",
      text: "#efe8ff",
      textSoft: "#b8a9d9",
      accent: "#a855f7",
      accentWarm: "#f472b6"
    },
    light: {
      shell: "#f8f3ff",
      panel: "#ffffff",
      panelSoft: "#f1e8ff",
      text: "#1d1130",
      textSoft: "#6e5a96",
      accent: "#9333ea",
      accentWarm: "#db2777"
    }
  },
  {
    id: "rose",
    name: "Rose Quartz",
    dark: {
      shell: "#1a0a13",
      panel: "#2a1320",
      panelSoft: "#3f1f31",
      text: "#fdebf5",
      textSoft: "#d3a8be",
      accent: "#ec4899",
      accentWarm: "#fb7185"
    },
    light: {
      shell: "#fff4f8",
      panel: "#ffffff",
      panelSoft: "#fde7ef",
      text: "#331322",
      textSoft: "#8e5a74",
      accent: "#db2777",
      accentWarm: "#f43f5e"
    }
  },
  {
    id: "cobalt",
    name: "Cobalt Blue",
    dark: {
      shell: "#061024",
      panel: "#0d1d3d",
      panelSoft: "#17305e",
      text: "#e4ecff",
      textSoft: "#9fb4df",
      accent: "#3b82f6",
      accentWarm: "#60a5fa"
    },
    light: {
      shell: "#f3f8ff",
      panel: "#ffffff",
      panelSoft: "#e6efff",
      text: "#0e254d",
      textSoft: "#5673a9",
      accent: "#2563eb",
      accentWarm: "#0ea5e9"
    }
  },
  {
    id: "lagoon",
    name: "Lagoon Green",
    dark: {
      shell: "#041412",
      panel: "#0c2621",
      panelSoft: "#144037",
      text: "#dff9f3",
      textSoft: "#94c7ba",
      accent: "#14b8a6",
      accentWarm: "#2dd4bf"
    },
    light: {
      shell: "#f1fcf9",
      panel: "#ffffff",
      panelSoft: "#e2f7f0",
      text: "#0d2d26",
      textSoft: "#4e7f73",
      accent: "#0f766e",
      accentWarm: "#0d9488"
    }
  },
  {
    id: "lime",
    name: "Lime Spark",
    dark: {
      shell: "#101704",
      panel: "#1b290a",
      panelSoft: "#2a4014",
      text: "#eef7de",
      textSoft: "#bccd95",
      accent: "#84cc16",
      accentWarm: "#a3e635"
    },
    light: {
      shell: "#f8fdea",
      panel: "#ffffff",
      panelSoft: "#edf8d2",
      text: "#23340c",
      textSoft: "#6c8741",
      accent: "#65a30d",
      accentWarm: "#84cc16"
    }
  },
  {
    id: "ruby",
    name: "Ruby Night",
    dark: {
      shell: "#180707",
      panel: "#2b0f12",
      panelSoft: "#41181d",
      text: "#ffe8e8",
      textSoft: "#d8aaaa",
      accent: "#ef4444",
      accentWarm: "#fb7185"
    },
    light: {
      shell: "#fff5f5",
      panel: "#ffffff",
      panelSoft: "#fee7e7",
      text: "#3a1212",
      textSoft: "#8f5a5a",
      accent: "#dc2626",
      accentWarm: "#f43f5e"
    }
  },
  {
    id: "citrus",
    name: "Citrus Glow",
    dark: {
      shell: "#1a1304",
      panel: "#2d2108",
      panelSoft: "#433210",
      text: "#fff5de",
      textSoft: "#d8c08f",
      accent: "#f59e0b",
      accentWarm: "#facc15"
    },
    light: {
      shell: "#fffaee",
      panel: "#ffffff",
      panelSoft: "#fdf1cf",
      text: "#3a2909",
      textSoft: "#8b7342",
      accent: "#d97706",
      accentWarm: "#ca8a04"
    }
  },
  {
    id: "midnight",
    name: "Midnight Gold",
    dark: {
      shell: "#05070f",
      panel: "#0d1425",
      panelSoft: "#17203a",
      text: "#eceff9",
      textSoft: "#9ea8c3",
      accent: "#eab308",
      accentWarm: "#f59e0b"
    },
    light: {
      shell: "#f5f8ff",
      panel: "#ffffff",
      panelSoft: "#e8edf9",
      text: "#111b34",
      textSoft: "#5f6f95",
      accent: "#ca8a04",
      accentWarm: "#d97706"
    }
  },
  {
    id: "mono",
    name: "Monochrome",
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
  },
  {
    id: "lavender",
    name: "Lavender Mist",
    dark: {
      shell: "#120f1f",
      panel: "#1f1a33",
      panelSoft: "#2f274a",
      text: "#f2edff",
      textSoft: "#b7abd8",
      accent: "#a78bfa",
      accentWarm: "#c4b5fd"
    },
    light: {
      shell: "#f8f5ff",
      panel: "#ffffff",
      panelSoft: "#eee8ff",
      text: "#22183d",
      textSoft: "#6f5ea0",
      accent: "#7c3aed",
      accentWarm: "#8b5cf6"
    }
  },
  {
    id: "coral",
    name: "Coral Reef",
    dark: {
      shell: "#1a0f0b",
      panel: "#2d1a13",
      panelSoft: "#45281d",
      text: "#ffece5",
      textSoft: "#d4ad9f",
      accent: "#fb7185",
      accentWarm: "#fb923c"
    },
    light: {
      shell: "#fff7f4",
      panel: "#ffffff",
      panelSoft: "#feece5",
      text: "#3b1e16",
      textSoft: "#936458",
      accent: "#f43f5e",
      accentWarm: "#ea580c"
    }
  },
  {
    id: "ocean",
    name: "Ocean Depth",
    dark: {
      shell: "#040f18",
      panel: "#0a1c2c",
      panelSoft: "#12304a",
      text: "#e1f0ff",
      textSoft: "#94b4d1",
      accent: "#0ea5e9",
      accentWarm: "#22d3ee"
    },
    light: {
      shell: "#f1f9ff",
      panel: "#ffffff",
      panelSoft: "#e3f2ff",
      text: "#0c2742",
      textSoft: "#4d769d",
      accent: "#0284c7",
      accentWarm: "#0891b2"
    }
  },
  {
    id: "forest",
    name: "Forest Pine",
    dark: {
      shell: "#06120b",
      panel: "#102118",
      panelSoft: "#1a3324",
      text: "#e5f8ec",
      textSoft: "#9ac1aa",
      accent: "#22c55e",
      accentWarm: "#4ade80"
    },
    light: {
      shell: "#f2fbf5",
      panel: "#ffffff",
      panelSoft: "#e5f4ea",
      text: "#103322",
      textSoft: "#4f7e67",
      accent: "#16a34a",
      accentWarm: "#22c55e"
    }
  },
  {
    id: "sand",
    name: "Sandstone",
    dark: {
      shell: "#18130a",
      panel: "#2a2113",
      panelSoft: "#40331e",
      text: "#fdf2dc",
      textSoft: "#cfb78e",
      accent: "#fbbf24",
      accentWarm: "#f59e0b"
    },
    light: {
      shell: "#fff9ef",
      panel: "#ffffff",
      panelSoft: "#fdf0d9",
      text: "#3b2d13",
      textSoft: "#8d7245",
      accent: "#d97706",
      accentWarm: "#ca8a04"
    }
  },
  {
    id: "grape",
    name: "Grape Noir",
    dark: {
      shell: "#120914",
      panel: "#211126",
      panelSoft: "#341b3d",
      text: "#f6eaff",
      textSoft: "#c0a2d1",
      accent: "#d946ef",
      accentWarm: "#f472b6"
    },
    light: {
      shell: "#fff5ff",
      panel: "#ffffff",
      panelSoft: "#f8e9ff",
      text: "#32153d",
      textSoft: "#86559a",
      accent: "#c026d3",
      accentWarm: "#db2777"
    }
  },
  {
    id: "cyber",
    name: "Cyber Lime",
    dark: {
      shell: "#090d06",
      panel: "#131a0d",
      panelSoft: "#202b14",
      text: "#edf8df",
      textSoft: "#afc58d",
      accent: "#a3e635",
      accentWarm: "#bef264"
    },
    light: {
      shell: "#f8ffea",
      panel: "#ffffff",
      panelSoft: "#edf9cf",
      text: "#23340b",
      textSoft: "#6f8b43",
      accent: "#65a30d",
      accentWarm: "#84cc16"
    }
  },
  {
    id: "dawn",
    name: "Dawn Sky",
    dark: {
      shell: "#0f0d17",
      panel: "#1b1830",
      panelSoft: "#2b2450",
      text: "#efeaff",
      textSoft: "#b4a7d6",
      accent: "#818cf8",
      accentWarm: "#a78bfa"
    },
    light: {
      shell: "#f7f5ff",
      panel: "#ffffff",
      panelSoft: "#ece9ff",
      text: "#221d40",
      textSoft: "#6f67a3",
      accent: "#6366f1",
      accentWarm: "#8b5cf6"
    }
  },
  {
    id: "plum",
    name: "Plum Velvet",
    dark: {
      shell: "#170913",
      panel: "#291327",
      panelSoft: "#3d1d3b",
      text: "#fdeffd",
      textSoft: "#c89ec6",
      accent: "#e879f9",
      accentWarm: "#f0abfc"
    },
    light: {
      shell: "#fff6ff",
      panel: "#ffffff",
      panelSoft: "#f9e8fb",
      text: "#391b39",
      textSoft: "#8c5d88",
      accent: "#d946ef",
      accentWarm: "#e879f9"
    }
  },
  {
    id: "slate",
    name: "Slate Steel",
    dark: {
      shell: "#0b1017",
      panel: "#131d2b",
      panelSoft: "#1f2d42",
      text: "#e6edf7",
      textSoft: "#a0afc5",
      accent: "#64748b",
      accentWarm: "#94a3b8"
    },
    light: {
      shell: "#f4f7fb",
      panel: "#ffffff",
      panelSoft: "#e7edf5",
      text: "#1c2b41",
      textSoft: "#5c6f8b",
      accent: "#475569",
      accentWarm: "#64748b"
    }
  },
  {
    id: "peach",
    name: "Peach Bloom",
    dark: {
      shell: "#1a0d0a",
      panel: "#2e1813",
      panelSoft: "#45251d",
      text: "#fff0ea",
      textSoft: "#d2ada0",
      accent: "#fb923c",
      accentWarm: "#fdba74"
    },
    light: {
      shell: "#fff8f4",
      panel: "#ffffff",
      panelSoft: "#feede4",
      text: "#3d1f16",
      textSoft: "#8f6455",
      accent: "#ea580c",
      accentWarm: "#f97316"
    }
  },
  {
    id: "neon",
    name: "Neon Night",
    dark: {
      shell: "#060a12",
      panel: "#0d1628",
      panelSoft: "#14223b",
      text: "#e4f6ff",
      textSoft: "#98c0d1",
      accent: "#06b6d4",
      accentWarm: "#14b8a6"
    },
    light: {
      shell: "#f2fdff",
      panel: "#ffffff",
      panelSoft: "#e3f7fb",
      text: "#0d2f3a",
      textSoft: "#4a7b86",
      accent: "#0891b2",
      accentWarm: "#0d9488"
    }
  }
];

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

function hexToHue(hexValue) {
  const normalized = normalizeHexColor(hexValue, "#000000").slice(1);
  const red = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const green = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(normalized.slice(4, 6), 16) / 255;

  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  if (delta === 0) {
    return 0;
  }

  let hue;
  if (max === red) {
    hue = ((green - blue) / delta) % 6;
  } else if (max === green) {
    hue = (blue - red) / delta + 2;
  } else {
    hue = (red - green) / delta + 4;
  }

  return normalizeHue(hue * 60);
}

function getHueFamilyLabel(hue) {
  const normalized = normalizeHue(hue);
  if (normalized < 15 || normalized >= 345) {
    return "Ruby";
  }
  if (normalized < 35) {
    return "Coral";
  }
  if (normalized < 55) {
    return "Amber";
  }
  if (normalized < 75) {
    return "Lemon";
  }
  if (normalized < 95) {
    return "Lime";
  }
  if (normalized < 145) {
    return "Forest";
  }
  if (normalized < 175) {
    return "Mint";
  }
  if (normalized < 205) {
    return "Cyan";
  }
  if (normalized < 235) {
    return "Azure";
  }
  if (normalized < 260) {
    return "Blue";
  }
  if (normalized < 285) {
    return "Indigo";
  }
  if (normalized < 315) {
    return "Violet";
  }
  return "Rose";
}

const GENERATED_VARIANTS = [
  {
    id: "core",
    label: "Core",
    darkSaturationBias: 0,
    darkLightBias: 0,
    lightSaturationBias: 0,
    lightLightBias: 0,
    warmShift: 16
  },
  {
    id: "vivid",
    label: "Vivid",
    darkSaturationBias: 10,
    darkLightBias: 2,
    lightSaturationBias: 8,
    lightLightBias: -2,
    warmShift: 24
  },
  {
    id: "muted",
    label: "Muted",
    darkSaturationBias: -16,
    darkLightBias: 4,
    lightSaturationBias: -18,
    lightLightBias: 2,
    warmShift: 12
  },
  {
    id: "deep",
    label: "Deep",
    darkSaturationBias: 4,
    darkLightBias: -8,
    lightSaturationBias: -4,
    lightLightBias: -4,
    warmShift: 20
  },
  {
    id: "soft",
    label: "Soft",
    darkSaturationBias: -8,
    darkLightBias: 6,
    lightSaturationBias: -10,
    lightLightBias: 4,
    warmShift: 14
  }
];

function buildGeneratedPreset(hue, variant) {
  const warmHue = normalizeHue(hue + variant.warmShift);
  const darkAccentSaturation = clamp(74 + variant.darkSaturationBias, 40, 95);
  const darkAccentLightness = clamp(52 + variant.darkLightBias, 36, 72);
  const lightAccentSaturation = clamp(68 + variant.lightSaturationBias, 36, 92);
  const lightAccentLightness = clamp(40 + variant.lightLightBias, 26, 58);

  return {
    id: `auto-${String(Math.round(hue)).padStart(3, "0")}-${variant.id}`,
    name: `${getHueFamilyLabel(hue)} ${variant.label}`,
    dark: {
      shell: hslToHex(hue, 30, clamp(7 + variant.darkLightBias * 0.2, 4, 13)),
      panel: hslToHex(hue, 34, clamp(12 + variant.darkLightBias * 0.2, 8, 20)),
      panelSoft: hslToHex(hue, 40, clamp(18 + variant.darkLightBias * 0.3, 12, 28)),
      text: hslToHex(hue, 28, 92),
      textSoft: hslToHex(hue, 16, 70),
      accent: hslToHex(hue, darkAccentSaturation, darkAccentLightness),
      accentWarm: hslToHex(
        warmHue,
        clamp(darkAccentSaturation - 6, 36, 95),
        clamp(darkAccentLightness + 3, 32, 78)
      )
    },
    light: {
      shell: hslToHex(hue, 44, 97),
      panel: hslToHex(hue, 30, 99),
      panelSoft: hslToHex(hue, 32, 92),
      text: hslToHex(hue, 34, 12),
      textSoft: hslToHex(hue, 18, 40),
      accent: hslToHex(hue, lightAccentSaturation, lightAccentLightness),
      accentWarm: hslToHex(
        warmHue,
        clamp(lightAccentSaturation - 4, 30, 92),
        clamp(lightAccentLightness + 2, 24, 64)
      )
    }
  };
}

function buildGeneratedColorSchemePresets() {
  const presets = [];
  for (let hue = 0; hue < 360; hue += 6) {
    for (const variant of GENERATED_VARIANTS) {
      presets.push(buildGeneratedPreset(hue, variant));
    }
  }
  return presets;
}

function sortPresetsByColor(left, right) {
  const leftHue = hexToHue(left?.dark?.accent);
  const rightHue = hexToHue(right?.dark?.accent);
  if (leftHue !== rightHue) {
    return leftHue - rightHue;
  }
  return String(left?.name || "").localeCompare(String(right?.name || ""));
}

const GENERATED_COLOR_SCHEME_PRESETS = buildGeneratedColorSchemePresets();

export const COLOR_SCHEME_PRESETS = [
  ...BASE_COLOR_SCHEME_PRESETS,
  ...GENERATED_COLOR_SCHEME_PRESETS
].sort(sortPresetsByColor);

export const COMMON_COLOR_SCHEME_PRESET_IDS = [
  "melodia",
  "sunset",
  "icewave",
  "mint"
];

const PRESET_BY_ID = new Map(COLOR_SCHEME_PRESETS.map((preset) => [preset.id, preset]));
const DEFAULT_PRESET_ID = "melodia";

function clonePalette(palette) {
  return COLOR_TOKEN_DEFINITIONS.reduce((acc, token) => {
    acc[token.key] = palette[token.key];
    return acc;
  }, {});
}

export function normalizeHexColor(value, fallback = "#000000") {
  const input = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (/^#[0-9a-f]{6}$/.test(input)) {
    return input;
  }

  if (/^[0-9a-f]{6}$/.test(input)) {
    return `#${input}`;
  }

  return fallback;
}

function normalizePalette(palette, fallbackPalette) {
  return COLOR_TOKEN_DEFINITIONS.reduce((acc, token) => {
    const fallback = fallbackPalette[token.key];
    acc[token.key] = normalizeHexColor(palette?.[token.key], fallback);
    return acc;
  }, {});
}

function getPreset(presetId) {
  return PRESET_BY_ID.get(presetId) || PRESET_BY_ID.get(DEFAULT_PRESET_ID);
}

export function getPresetPalette(presetId, theme) {
  const preset = getPreset(presetId);
  const mode = theme === "light" ? "light" : "dark";
  return clonePalette(preset[mode]);
}

export function getDefaultColorScheme() {
  const preset = getPreset(DEFAULT_PRESET_ID);
  return {
    mode: "preset",
    preset: preset.id,
    custom: {
      dark: clonePalette(preset.dark),
      light: clonePalette(preset.light)
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

  return {
    mode,
    preset: preset.id,
    custom: {
      dark: normalizePalette(value.custom?.dark, preset.dark),
      light: normalizePalette(value.custom?.light, preset.light)
    }
  };
}

export function getActivePalette(theme, colorScheme) {
  const normalized = normalizeColorScheme(colorScheme);
  const mode = theme === "light" ? "light" : "dark";

  if (normalized.mode === "custom") {
    return clonePalette(normalized.custom[mode]);
  }

  return getPresetPalette(normalized.preset, mode);
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

  root.style.setProperty("--color-shell", hexToTriplet(palette.shell));
  root.style.setProperty("--color-panel", hexToTriplet(palette.panel));
  root.style.setProperty("--color-panel-soft", hexToTriplet(palette.panelSoft));
  root.style.setProperty("--color-text", hexToTriplet(palette.text));
  root.style.setProperty("--color-text-soft", hexToTriplet(palette.textSoft));
  root.style.setProperty("--color-accent", hexToTriplet(palette.accent));
  root.style.setProperty("--color-accent-warm", hexToTriplet(palette.accentWarm));

  const accentTriplet = hexToTriplet(palette.accent).replace(/\s+/g, " ");
  root.style.setProperty(
    "--accent-soft",
    `rgb(${accentTriplet} / ${theme === "light" ? "0.18" : "0.22"})`
  );
  root.style.setProperty(
    "--glow-color",
    `rgb(${accentTriplet} / ${theme === "light" ? "0.22" : "0.28"})`
  );
}

export const COLOR_TOKEN_FIELDS = COLOR_TOKEN_DEFINITIONS;
