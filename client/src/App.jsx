import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { Sidebar } from "./components/Sidebar";
import { MobileNav } from "./components/MobileNav";
import { TopBar } from "./components/TopBar";
import { PlayerBar } from "./components/PlayerBar";
import { QueueSidebar } from "./components/QueueSidebar";
import { LibraryPage } from "./pages/LibraryPage";
import { useAudioEngine } from "./hooks/useAudioEngine";
import { useScanEvents } from "./hooks/useScanEvents";
import { artUrl, fetchPublicSettings, fetchStats } from "./lib/api";
import { applyColorScheme } from "./lib/colorScheme";
import { MainScrollProvider } from "./lib/mainScroll.jsx";
import { useAppStore } from "./store/appStore";
import { usePlayerStore } from "./store/playerStore";

const PlaylistsPage = lazy(() =>
  import("./pages/PlaylistsPage").then((module) => ({
    default: module.PlaylistsPage
  }))
);
const PlaylistDetailPage = lazy(() =>
  import("./pages/PlaylistDetailPage").then((module) => ({
    default: module.PlaylistDetailPage
  }))
);
const ArtistsPage = lazy(() =>
  import("./pages/ArtistsPage").then((module) => ({
    default: module.ArtistsPage
  }))
);
const ArtistDetailPage = lazy(() =>
  import("./pages/ArtistDetailPage").then((module) => ({
    default: module.ArtistDetailPage
  }))
);
const AlbumsPage = lazy(() =>
  import("./pages/AlbumsPage").then((module) => ({
    default: module.AlbumsPage
  }))
);
const AlbumDetailPage = lazy(() =>
  import("./pages/AlbumDetailPage").then((module) => ({
    default: module.AlbumDetailPage
  }))
);
const MostPlayedPage = lazy(() =>
  import("./pages/MostPlayedPage").then((module) => ({
    default: module.MostPlayedPage
  }))
);
const RecentlyPlayedPage = lazy(() =>
  import("./pages/RecentlyPlayedPage").then((module) => ({
    default: module.RecentlyPlayedPage
  }))
);
const RediscoverPage = lazy(() =>
  import("./pages/RediscoverPage").then((module) => ({
    default: module.RediscoverPage
  }))
);
const ActiveArtistsPage = lazy(() =>
  import("./pages/ActiveArtistsPage").then((module) => ({
    default: module.ActiveArtistsPage
  }))
);
const StatisticsPage = lazy(() =>
  import("./pages/StatisticsPage").then((module) => ({
    default: module.StatisticsPage
  }))
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((module) => ({
    default: module.SettingsPage
  }))
);

export default function App() {
  const [mainScrollElement, setMainScrollElement] = useState(null);
  const { currentSong, currentTime, duration, buffered, seek, next } = useAudioEngine();
  useScanEvents();
  const isPlaying = usePlayerStore((state) => state.isPlaying);

  const { appName, theme, colorScheme, setPublicSettings, setStats } = useAppStore(
    useShallow((state) => ({
      appName: state.appName,
      theme: state.theme,
      colorScheme: state.colorScheme,
      setPublicSettings: state.setPublicSettings,
      setStats: state.setStats
    }))
  );

  useEffect(() => {
    Promise.allSettled([fetchPublicSettings(), fetchStats()]).then((results) => {
      const [settingsResult, statsResult] = results;

      if (settingsResult.status === "fulfilled") {
        setPublicSettings(settingsResult.value);
      }

      if (statsResult.status === "fulfilled") {
        setStats(statsResult.value);
      }
    });
  }, [setPublicSettings, setStats]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.add("light");
    } else {
      root.classList.remove("light");
    }
    applyColorScheme(theme, colorScheme);
  }, [theme, colorScheme]);

  useEffect(() => {
    const safeAppName = (appName || "Melodia").trim() || "Melodia";
    if (!currentSong) {
      document.title = safeAppName;
      return;
    }

    const songTitle = (currentSong.title || currentSong.filename || "Unknown Track").trim();
    const artist = (currentSong.artist || "").trim();
    document.title = artist
      ? `${songTitle} - ${artist} | ${safeAppName}`
      : `${songTitle} | ${safeAppName}`;
  }, [appName, currentSong?.id, currentSong?.title, currentSong?.filename, currentSong?.artist]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }

    const mediaSession = navigator.mediaSession;
    if (!currentSong) {
      mediaSession.metadata = null;
      mediaSession.playbackState = "none";
      return;
    }

    const songTitle = (currentSong.title || currentSong.filename || "Unknown Track").trim();
    const artist = (currentSong.artist || "Unknown Artist").trim();
    const album = (currentSong.album || "Unknown Album").trim();
    const artworkSource = currentSong.id
      ? new URL(artUrl(currentSong.id), window.location.origin).toString()
      : new URL("/favicon.svg", window.location.origin).toString();

    if (typeof window.MediaMetadata === "function") {
      mediaSession.metadata = new window.MediaMetadata({
        title: songTitle,
        artist,
        album,
        artwork: [
          { src: artworkSource, sizes: "96x96", type: "image/jpeg" },
          { src: artworkSource, sizes: "128x128", type: "image/jpeg" },
          { src: artworkSource, sizes: "192x192", type: "image/jpeg" },
          { src: artworkSource, sizes: "256x256", type: "image/jpeg" },
          { src: artworkSource, sizes: "384x384", type: "image/jpeg" },
          { src: artworkSource, sizes: "512x512", type: "image/jpeg" }
        ]
      });
    }

    mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [
    currentSong?.id,
    currentSong?.title,
    currentSong?.filename,
    currentSong?.artist,
    currentSong?.album,
    isPlaying
  ]);

  return (
    <MainScrollProvider value={mainScrollElement}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <Sidebar />

          <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <TopBar />
              <MobileNav />
              <main
                ref={setMainScrollElement}
                className="app-main-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-4 md:px-6"
              >
                <Routes>
                  <Route path="/" element={<LibraryPage />} />
                  <Route
                    path="/playlists"
                    element={
                      <Suspense fallback={<p className="text-sm text-textSoft">Loading page...</p>}>
                        <PlaylistsPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/playlists/:playlistId"
                    element={
                      <Suspense fallback={<p className="text-sm text-textSoft">Loading page...</p>}>
                        <PlaylistDetailPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/artists"
                    element={
                      <Suspense fallback={<p className="text-sm text-textSoft">Loading page...</p>}>
                        <ArtistsPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/artists/:artist"
                    element={
                      <Suspense fallback={<p className="text-sm text-textSoft">Loading page...</p>}>
                        <ArtistDetailPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/albums"
                    element={
                      <Suspense fallback={<p className="text-sm text-textSoft">Loading page...</p>}>
                        <AlbumsPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/albums/:albumArtist/:album"
                    element={
                      <Suspense fallback={<p className="text-sm text-textSoft">Loading page...</p>}>
                        <AlbumDetailPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/rediscover"
                    element={
                      <Suspense fallback={<p className="text-sm text-textSoft">Loading page...</p>}>
                        <RediscoverPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/active-artists"
                    element={
                      <Suspense fallback={<p className="text-sm text-textSoft">Loading page...</p>}>
                        <ActiveArtistsPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/statistics"
                    element={
                      <Suspense fallback={<p className="text-sm text-textSoft">Loading page...</p>}>
                        <StatisticsPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/most-played"
                    element={
                      <Suspense fallback={<p className="text-sm text-textSoft">Loading page...</p>}>
                        <MostPlayedPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/recently-played"
                    element={
                      <Suspense fallback={<p className="text-sm text-textSoft">Loading page...</p>}>
                        <RecentlyPlayedPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <Suspense fallback={<p className="text-sm text-textSoft">Loading page...</p>}>
                        <SettingsPage />
                      </Suspense>
                    }
                  />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
            </div>
            <QueueSidebar />
          </div>
        </div>

        <PlayerBar
          currentSong={currentSong}
          currentTime={currentTime}
          duration={duration}
          buffered={buffered}
          seek={seek}
          next={next}
        />
      </div>
    </MainScrollProvider>
  );
}
