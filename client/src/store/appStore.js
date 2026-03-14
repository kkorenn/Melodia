import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getDefaultColorScheme, normalizeColorScheme } from "../lib/colorScheme";

const defaultScanState = {
  running: false,
  total: 0,
  scanned: 0,
  progress: 0,
  added: 0,
  updated: 0,
  skipped: 0,
  removed: 0,
  currentFile: null,
  errors: []
};
const defaultViewModes = {
  library: "list",
  playlists: "grid",
  artists: "grid",
  albums: "grid",
  artistAlbums: "grid"
};

export const useAppStore = create(
  persist(
    (set) => ({
      appName: "Melodia",
      theme: "dark",
      colorScheme: getDefaultColorScheme(),
      gridSize: "large",
      viewModes: defaultViewModes,
      settings: null,
      stats: null,
      scanState: defaultScanState,
      setSettings: (settings) => {
        const normalizedColorScheme = normalizeColorScheme(settings?.colorScheme);
        return set(() => ({
          settings,
          appName: settings?.appName || "Melodia",
          theme: settings?.theme || "dark",
          colorScheme: normalizedColorScheme
        }));
      },
      setPublicSettings: (settings) => {
        const normalizedColorScheme = normalizeColorScheme(settings?.colorScheme);
        return set(() => ({
          appName: settings?.appName || "Melodia",
          theme: settings?.theme || "dark",
          colorScheme: normalizedColorScheme
        }));
      },
      setTheme: (theme) => set(() => ({ theme })),
      setGridSize: (gridSize) =>
        set(() => ({
          gridSize: gridSize === "small" ? "small" : "large"
        })),
      setViewMode: (key, mode) =>
        set((state) => ({
          viewModes: {
            ...defaultViewModes,
            ...(state.viewModes || {}),
            [key]: mode === "list" ? "list" : "grid"
          }
        })),
      setColorScheme: (colorScheme) =>
        set(() => ({
          colorScheme: normalizeColorScheme(colorScheme)
        })),
      setAppName: (appName) => set(() => ({ appName })),
      setStats: (stats) => set(() => ({ stats })),
      setScanState: (scanState) =>
        set(() => ({
          scanState: {
            ...defaultScanState,
            ...scanState
          }
        }))
    }),
    {
      name: "melodia-app",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        appName: state.appName,
        theme: state.theme,
        colorScheme: state.colorScheme,
        gridSize: state.gridSize,
        viewModes: state.viewModes
      })
    }
  )
);
