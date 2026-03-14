import { useEffect, useState } from "react";
import { fetchMostPlayed } from "../lib/api";
import { ListSkeleton } from "../components/LoadingSkeletons";
import { SongTable } from "../components/SongTable";
import { useSongActions } from "../hooks/useSongActions";
import { usePlayerStore, selectCurrentSong } from "../store/playerStore";

export function MostPlayedPage() {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const currentSongId = usePlayerStore((state) => selectCurrentSong(state)?.id);
  const { playSong, queueSong, goToArtist, goToAlbum } = useSongActions();

  useEffect(() => {
    const controller = new AbortController();

    fetchMostPlayed(300, { signal: controller.signal })
      .then((data) => setSongs(data.rows || []))
      .catch((err) => {
        if (err?.name === "AbortError") {
          return;
        }
        setError(err.message || "Could not load most played");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  if (loading) {
    return <ListSkeleton rows={10} withArt />;
  }

  if (error) {
    return <p className="text-sm text-rose-300">{error}</p>;
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-text">Most Played</h2>
        <p className="text-sm text-textSoft">Top songs ranked by play count</p>
      </div>
      <SongTable
        songs={songs}
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
