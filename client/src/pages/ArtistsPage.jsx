import { useCallback, useState } from "react";
import clsx from "clsx";
import { useNavigate } from "react-router-dom";
import { fetchArtists } from "../lib/api";
import { CoverArt } from "../components/CoverArt";
import { GridSkeleton, ListSkeleton } from "../components/LoadingSkeletons";
import { ViewModeToggle } from "../components/ViewModeToggle";
import { useAbortableRequest } from "../hooks/useAbortableRequest";
import { useAppStore } from "../store/appStore";
import { formatLargeNumber, formatRelativeDate } from "../utils/format";

export function ArtistsPage() {
  const [artists, setArtists] = useState([]);
  const [stats, setStats] = useState({
    artistCount: 0,
    totalSongs: 0,
    totalAlbums: 0,
    totalPlays: 0,
    activeArtists30d: 0
  });
  const navigate = useNavigate();
  const viewMode = useAppStore((state) => state.viewModes?.artists || "grid");
  const setViewMode = useAppStore((state) => state.setViewMode);
  const gridSize = useAppStore((state) => state.gridSize);
  const setGridSize = useAppStore((state) => state.setGridSize);

  const loadArtists = useCallback((signal) => {
    return fetchArtists({ signal }).then((data) => {
      setArtists(data.rows || []);
      setStats(
        data.stats || {
          artistCount: 0,
          totalSongs: 0,
          totalAlbums: 0,
          totalPlays: 0,
          activeArtists30d: 0
        }
      );
    });
  }, []);

  const {
    loading,
    error
  } = useAbortableRequest(loadArtists, [loadArtists], {
    fallbackErrorMessage: "Failed to load artists"
  });

  if (loading) {
    return viewMode === "list" ? (
      <ListSkeleton rows={8} withArt />
    ) : (
      <GridSkeleton cards={10} gridSize={gridSize} />
    );
  }

  if (error) {
    return <p className="text-sm text-rose-300">{error}</p>;
  }

  const handleLayoutChange = (nextMode, nextGridSize) => {
    setViewMode("artists", nextMode);
    if (nextMode === "grid" && nextGridSize) {
      setGridSize(nextGridSize);
    }
  };

  const artistCountLabel = `${artists.length.toLocaleString()} artist${
    artists.length === 1 ? "" : "s"
  } in total`;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-text">Artists</h2>
        <p className="text-sm text-textSoft">{artistCountLabel}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-xl border border-[color:var(--border)] bg-panel px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-[0.08em] text-textSoft">Artists</p>
          <p className="mt-1 text-base font-semibold text-text">
            {formatLargeNumber(Number(stats.artistCount) || artists.length)}
          </p>
        </div>
        <div className="rounded-xl border border-[color:var(--border)] bg-panel px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-[0.08em] text-textSoft">Songs</p>
          <p className="mt-1 text-base font-semibold text-text">
            {formatLargeNumber(Number(stats.totalSongs) || 0)}
          </p>
        </div>
        <div className="rounded-xl border border-[color:var(--border)] bg-panel px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-[0.08em] text-textSoft">Albums</p>
          <p className="mt-1 text-base font-semibold text-text">
            {formatLargeNumber(Number(stats.totalAlbums) || 0)}
          </p>
        </div>
        <div className="rounded-xl border border-[color:var(--border)] bg-panel px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-[0.08em] text-textSoft">Total Plays</p>
          <p className="mt-1 text-base font-semibold text-text">
            {formatLargeNumber(Number(stats.totalPlays) || 0)}
          </p>
        </div>
        <div className="rounded-xl border border-[color:var(--border)] bg-panel px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-[0.08em] text-textSoft">Active 30d</p>
          <p className="mt-1 text-base font-semibold text-text">
            {formatLargeNumber(Number(stats.activeArtists30d) || 0)}
          </p>
        </div>
      </div>

      <ViewModeToggle
        mode={viewMode}
        gridSize={gridSize}
        onChange={handleLayoutChange}
      />

      <div
        key={`${viewMode}-${viewMode === "grid" ? gridSize : "list"}`}
        className="view-mode-viewport"
      >
        {viewMode === "list" ? (
          <div className="space-y-1">
            {artists.map((artist, index) => (
              <button
                key={artist.artist}
                type="button"
                onClick={() => navigate(`/artists/${encodeURIComponent(artist.artist)}`)}
                className="view-mode-item flex w-full items-center gap-3 rounded-xl border border-[color:var(--border)] bg-panel px-3 py-2 text-left transition hover:border-accent/40 hover:bg-panelSoft/80"
                style={{ "--vm-item-index": Math.min(index, 10) }}
              >
                <CoverArt songId={artist.artSongId} className="h-12 w-12 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text">{artist.artist}</p>
                  <p className="text-xs text-textSoft">
                    {formatLargeNumber(Number(artist.songCount) || 0)} songs · {" "}
                    {formatLargeNumber(Number(artist.albumCount) || 0)} albums
                  </p>
                </div>
                <div className="text-right text-xs text-textSoft">
                  <p>{formatLargeNumber(Number(artist.totalPlays) || 0)} plays</p>
                  <p>Last: {formatRelativeDate(artist.lastPlayed)}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div
            className={clsx(
              "grid",
              gridSize === "small"
                ? "grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
                : "grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
            )}
          >
            {artists.map((artist, index) => (
              <button
                key={artist.artist}
                type="button"
                onClick={() => navigate(`/artists/${encodeURIComponent(artist.artist)}`)}
                className="view-mode-item overflow-hidden rounded-xl border border-[color:var(--border)] bg-panel text-left transition hover:border-accent/40"
                style={{ "--vm-item-index": Math.min(index, 10) }}
              >
                <CoverArt
                  songId={artist.artSongId}
                  frame={false}
                  className="aspect-square w-full"
                />
                <div className={clsx(gridSize === "small" ? "p-2.5" : "p-3")}>
                  <h3
                    className={clsx(
                      "truncate font-semibold text-text",
                      gridSize === "small" ? "text-xs" : "text-sm"
                    )}
                  >
                    {artist.artist}
                  </h3>
                    <p
                      className={clsx(
                        "mt-1 text-textSoft",
                        gridSize === "small" ? "text-[11px]" : "text-xs"
                      )}
                    >
                      {formatLargeNumber(Number(artist.songCount) || 0)} songs · {" "}
                      {formatLargeNumber(Number(artist.albumCount) || 0)} albums
                    </p>
                    <p className={clsx("mt-1 text-textSoft", gridSize === "small" ? "text-[11px]" : "text-xs") }>
                      {formatLargeNumber(Number(artist.totalPlays) || 0)} plays
                    </p>
                  </div>
                </button>
              ))}
          </div>
        )}
      </div>
    </section>
  );
}
