import { useCallback, useState } from "react";
import { fetchRediscover } from "../lib/api";
import { SongTable } from "../components/SongTable";
import { SongTableSkeleton } from "../components/LoadingSkeletons";
import { useAbortableRequest } from "../hooks/useAbortableRequest";
import { useSongActions } from "../hooks/useSongActions";
import { usePlayerStore, selectCurrentSong } from "../store/playerStore";

const REDISCOVER_DAY_OPTIONS = [30, 90, 180];

export function RediscoverPage() {
  const [unheard, setUnheard] = useState([]);
  const [rediscover, setRediscoverSongs] = useState([]);
  const [staleDays, setStaleDays] = useState(REDISCOVER_DAY_OPTIONS[1]);

  const currentSongId = usePlayerStore((state) => selectCurrentSong(state)?.id);
  const { playSong, queueSong, goToArtist, goToAlbum } = useSongActions();

  const loadRediscover = useCallback(
    (signal) => {
      return fetchRediscover({ limit: 160, staleDays, signal }).then((payload) => {
        setUnheard(payload?.unheard || []);
        setRediscoverSongs(payload?.rediscover || []);
        setStaleDays(Number(payload?.staleDays) || 90);
      });
    },
    [staleDays]
  );

  const {
    loading,
    refreshing,
    error
  } = useAbortableRequest(loadRediscover, [loadRediscover], {
    fallbackErrorMessage: "Could not load rediscover lists"
  });

  if (loading) {
    return <SongTableSkeleton rows={10} />;
  }

  if (error) {
    return <p className="text-sm text-rose-300">{error}</p>;
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-text">Rediscover</h2>
        <p className="text-sm text-textSoft">
          Unplayed tracks and songs not played in the last {staleDays} days.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {REDISCOVER_DAY_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setStaleDays(option)}
              className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                staleDays === option
                  ? "border-accent/50 bg-accent/15 text-text"
                  : "border-[color:var(--border)] bg-panel text-textSoft hover:text-text"
              }`}
              aria-pressed={staleDays === option}
            >
              {option}d
            </button>
          ))}
          {refreshing && <span className="text-xs text-textSoft">Updating...</span>}
        </div>
      </div>

      {!unheard.length && !rediscover.length && (
        <div className="rounded-2xl border border-[color:var(--border)] bg-panel/70 p-8 text-center">
          <p className="text-sm text-textSoft">
            Nothing to show yet. Play more tracks and this page will surface forgotten gems.
          </p>
        </div>
      )}

      {unheard.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-textSoft">Never Played</h3>
          <SongTable
            songs={unheard}
            currentSongId={currentSongId}
            onPlaySong={playSong}
            onAddToQueue={queueSong}
            onGoToArtist={goToArtist}
            onGoToAlbum={goToAlbum}
            hasMore={false}
            loadingMore={false}
            height="min(46vh, 440px)"
          />
        </section>
      )}

      {rediscover.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-textSoft">Not Played Recently</h3>
          <SongTable
            songs={rediscover}
            currentSongId={currentSongId}
            onPlaySong={playSong}
            onAddToQueue={queueSong}
            onGoToArtist={goToArtist}
            onGoToAlbum={goToAlbum}
            hasMore={false}
            loadingMore={false}
            height="min(46vh, 440px)"
          />
        </section>
      )}
    </section>
  );
}
