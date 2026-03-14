import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchActiveArtists } from "../lib/api";
import { CoverArt } from "../components/CoverArt";
import { ListSkeleton } from "../components/LoadingSkeletons";
import { formatLargeNumber, formatRelativeDate } from "../utils/format";

const ACTIVE_ARTIST_DAY_OPTIONS = [7, 30, 90];

export function ActiveArtistsPage() {
  const [artists, setArtists] = useState([]);
  const [days, setDays] = useState(ACTIVE_ARTIST_DAY_OPTIONS[1]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();
    const initialLoad = loading;

    if (!initialLoad) {
      setRefreshing(true);
    }
    setError("");

    fetchActiveArtists({ limit: 120, days, signal: controller.signal })
      .then((payload) => {
        setArtists(payload?.rows || []);
        setDays(Number(payload?.days) || 30);
      })
      .catch((err) => {
        if (err?.name === "AbortError") {
          return;
        }
        setError(err.message || "Could not load active artists");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => controller.abort();
  }, [days]);

  if (loading) {
    return <ListSkeleton rows={10} withArt />;
  }

  if (error) {
    return <p className="text-sm text-rose-300">{error}</p>;
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-text">Recently Active Artists</h2>
        <p className="text-sm text-textSoft">
          Ranked by listening momentum in the last {days} days.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {ACTIVE_ARTIST_DAY_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setDays(option)}
              className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                days === option
                  ? "border-accent/50 bg-accent/15 text-text"
                  : "border-[color:var(--border)] bg-panel text-textSoft hover:text-text"
              }`}
              aria-pressed={days === option}
            >
              {option}d
            </button>
          ))}
          {refreshing && <span className="text-xs text-textSoft">Updating...</span>}
        </div>
      </div>

      {artists.length === 0 ? (
        <div className="rounded-2xl border border-[color:var(--border)] bg-panel/70 p-8 text-center">
          <p className="text-sm text-textSoft">No artist activity in the last {days} days yet.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {artists.map((artist, index) => (
            <button
              key={artist.artist}
              type="button"
              onClick={() => navigate(`/artists/${encodeURIComponent(artist.artist)}`)}
              className="flex w-full items-center gap-3 rounded-xl border border-[color:var(--border)] bg-panel px-3 py-2 text-left transition hover:border-accent/40 hover:bg-panelSoft/80"
            >
              <span className="w-6 text-xs tabular-nums text-textSoft">{index + 1}</span>
              <CoverArt songId={artist.artSongId} className="h-12 w-12 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text">{artist.artist}</p>
                <p className="truncate text-xs text-textSoft">
                  {formatLargeNumber(Number(artist.recentPlays) || 0)} recent plays · {" "}
                  {formatLargeNumber(Number(artist.uniqueSongs) || 0)} songs
                </p>
              </div>
              <div className="text-right text-xs text-textSoft">
                <p>{formatLargeNumber(Number(artist.totalPlays) || 0)} total plays</p>
                <p>Last: {formatRelativeDate(artist.lastPlayed)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
