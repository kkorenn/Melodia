import { useEffect, useMemo, useRef, useState } from "react";
import { fetchRecentlyPlayed } from "../lib/api";
import { ListSkeleton } from "../components/LoadingSkeletons";
import { SongTable } from "../components/SongTable";
import { useSongActions } from "../hooks/useSongActions";
import { usePlayerStore, selectCurrentSong } from "../store/playerStore";

function dedupeRecentlyPlayed(rows) {
  const input = Array.isArray(rows) ? rows : [];
  const sorted = [...input].sort(
    (left, right) => Number(right?.playedAt || 0) - Number(left?.playedAt || 0)
  );
  const seen = new Set();
  const deduped = [];

  for (const row of sorted) {
    const id = Number(row?.id);
    if (!Number.isFinite(id) || seen.has(id)) {
      continue;
    }
    seen.add(id);
    deduped.push(row);
  }

  return deduped;
}

export function RecentlyPlayedPage() {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const lastInjectedSongIdRef = useRef(null);

  const currentSong = usePlayerStore((state) => selectCurrentSong(state));
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const currentSongId = currentSong?.id;
  const { playSong, queueSong, goToArtist, goToAlbum } = useSongActions();

  useEffect(() => {
    const controller = new AbortController();

    fetchRecentlyPlayed(300, { signal: controller.signal })
      .then((data) => setSongs(dedupeRecentlyPlayed(data.rows || [])))
      .catch((err) => {
        if (err?.name === "AbortError") {
          return;
        }
        setError(err.message || "Could not load recently played songs");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!isPlaying || !currentSong?.id) {
      return;
    }

    if (lastInjectedSongIdRef.current === currentSong.id) {
      return;
    }

    lastInjectedSongIdRef.current = currentSong.id;
    const now = Date.now();

    setSongs((previous) => {
      const withoutCurrent = previous.filter((entry) => entry.id !== currentSong.id);
      const existing = previous.find((entry) => entry.id === currentSong.id);

      return dedupeRecentlyPlayed([
        {
          ...(existing || {}),
          ...currentSong,
          playedAt: now,
          lastPlayed: now
        },
        ...withoutCurrent
      ]).slice(0, 300);
    });
  }, [currentSong?.id, isPlaying]);

  const stableSongs = useMemo(() => dedupeRecentlyPlayed(songs), [songs]);

  if (loading) {
    return <ListSkeleton rows={10} withArt />;
  }

  if (error) {
    return <p className="text-sm text-rose-300">{error}</p>;
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-text">Recently Played</h2>
        <p className="text-sm text-textSoft">Your most recent listening history</p>
      </div>
      <SongTable
        songs={stableSongs}
        currentSongId={currentSongId}
        onPlaySong={playSong}
        onAddToQueue={queueSong}
        onGoToArtist={goToArtist}
        onGoToAlbum={goToAlbum}
        hasMore={false}
        loadingMore={false}
      />
    </section>
  );
}
