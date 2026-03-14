import { useCallback, useState } from "react";
import { fetchMostPlayed } from "../lib/api";
import { ListSkeleton } from "../components/LoadingSkeletons";
import { SongTable } from "../components/SongTable";
import { useSongActions } from "../hooks/useSongActions";
import { useAbortableRequest } from "../hooks/useAbortableRequest";
import { usePlayerStore, selectCurrentSong } from "../store/playerStore";

export function MostPlayedPage() {
  const [songs, setSongs] = useState([]);

  const currentSongId = usePlayerStore((state) => selectCurrentSong(state)?.id);
  const { playSong, queueSong, goToArtist, goToAlbum } = useSongActions();

  const loadMostPlayed = useCallback((signal) => {
    return fetchMostPlayed(300, { signal }).then((data) => {
      setSongs(data.rows || []);
    });
  }, []);

  const {
    loading,
    error
  } = useAbortableRequest(loadMostPlayed, [loadMostPlayed], {
    fallbackErrorMessage: "Could not load most played"
  });

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
