import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchAlbumTracks } from "../lib/api";
import { ListSkeleton } from "../components/LoadingSkeletons";
import { SongTable } from "../components/SongTable";
import { CoverArt } from "../components/CoverArt";
import { useSongActions } from "../hooks/useSongActions";
import { usePlayerStore, selectCurrentSong } from "../store/playerStore";

export function AlbumDetailPage() {
  const params = useParams();
  const albumArtist = decodeURIComponent(params.albumArtist || "Unknown Artist");
  const album = decodeURIComponent(params.album || "Unknown Album");

  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const currentSongId = usePlayerStore((state) => selectCurrentSong(state)?.id);
  const { playSong, queueSong, goToArtist, goToAlbum } = useSongActions();

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError("");

    fetchAlbumTracks(album, albumArtist, { signal: controller.signal })
      .then((data) => setSongs(data.rows || []))
      .catch((err) => {
        if (err?.name === "AbortError") {
          return;
        }
        setError(err.message || "Could not load album tracks");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [album, albumArtist]);

  if (loading) {
    return (
      <section className="space-y-5">
        <div className="flex animate-pulse flex-wrap items-end gap-4 rounded-2xl border border-[color:var(--border)] bg-panel p-4">
          <div className="h-44 w-44 rounded-xl bg-panelSoft" />
          <div className="space-y-2">
            <div className="h-4 w-20 rounded bg-panelSoft" />
            <div className="h-8 w-48 rounded bg-panelSoft" />
            <div className="h-4 w-32 rounded bg-panelSoft" />
            <div className="h-4 w-24 rounded bg-panelSoft" />
            <div className="h-9 w-28 rounded-xl bg-panelSoft" />
          </div>
        </div>
        <ListSkeleton rows={9} withArt />
      </section>
    );
  }

  if (error) {
    return <p className="text-sm text-rose-300">{error}</p>;
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-[color:var(--border)] bg-panel p-4">
        <CoverArt songId={songs[0]?.id} eager className="h-44 w-44" />
        <div>
          <p className="text-xs font-medium text-textSoft">Album</p>
          <h2 className="text-3xl font-semibold text-text">{album}</h2>
          <p className="text-sm text-textSoft">{albumArtist}</p>
          <p className="mt-2 text-sm text-textSoft">{songs.length} tracks</p>
          <button
            type="button"
            onClick={() => {
              if (songs.length) {
                playSong(songs[0], 0, songs);
              }
            }}
            className="mt-3 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-shell"
          >
            Play Album
          </button>
        </div>
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
