import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { Sidebar } from "./components/Sidebar";
import { MobileNav } from "./components/MobileNav";
import { TopBar } from "./components/TopBar";
import { PlayerBar } from "./components/PlayerBar";
import { QueueSidebar } from "./components/QueueSidebar";
import { LibraryPage } from "./pages/LibraryPage";
import { PlaylistsPage } from "./pages/PlaylistsPage";
import { PlaylistDetailPage } from "./pages/PlaylistDetailPage";
import { ArtistsPage } from "./pages/ArtistsPage";
import { ArtistDetailPage } from "./pages/ArtistDetailPage";
import { AlbumsPage } from "./pages/AlbumsPage";
import { AlbumDetailPage } from "./pages/AlbumDetailPage";
import { MostPlayedPage } from "./pages/MostPlayedPage";
import { RecentlyPlayedPage } from "./pages/RecentlyPlayedPage";
import { RediscoverPage } from "./pages/RediscoverPage";
import { ActiveArtistsPage } from "./pages/ActiveArtistsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { useAudioEngine } from "./hooks/useAudioEngine";
import { useScanEvents } from "./hooks/useScanEvents";
import { fetchPublicSettings, fetchStats } from "./lib/api";
import { applyColorScheme } from "./lib/colorScheme";
import { useAppStore } from "./store/appStore";

export default function App() {
  const { currentSong, currentTime, duration, buffered, seek, next } = useAudioEngine();
  useScanEvents();

  const { theme, colorScheme, setPublicSettings, setStats } = useAppStore(
    useShallow((state) => ({
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

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />

        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <TopBar />
            <MobileNav />
            <main className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-4 md:px-6">
              <Routes>
                <Route path="/" element={<LibraryPage />} />
                <Route path="/playlists" element={<PlaylistsPage />} />
                <Route path="/playlists/:playlistId" element={<PlaylistDetailPage />} />
                <Route path="/artists" element={<ArtistsPage />} />
                <Route path="/artists/:artist" element={<ArtistDetailPage />} />
                <Route path="/albums" element={<AlbumsPage />} />
                <Route path="/albums/:albumArtist/:album" element={<AlbumDetailPage />} />
                <Route path="/rediscover" element={<RediscoverPage />} />
                <Route path="/active-artists" element={<ActiveArtistsPage />} />
                <Route path="/most-played" element={<MostPlayedPage />} />
                <Route path="/recently-played" element={<RecentlyPlayedPage />} />
                <Route path="/settings" element={<SettingsPage />} />
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
  );
}
