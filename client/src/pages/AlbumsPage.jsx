import { useEffect, useState } from "react";
import clsx from "clsx";
import { useNavigate } from "react-router-dom";
import { fetchAlbums } from "../lib/api";
import { CoverArt } from "../components/CoverArt";
import { GridSkeleton, ListSkeleton } from "../components/LoadingSkeletons";
import { ViewModeToggle } from "../components/ViewModeToggle";
import { useAppStore } from "../store/appStore";

export function AlbumsPage() {
  const [albums, setAlbums] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const viewMode = useAppStore((state) => state.viewModes?.albums || "grid");
  const setViewMode = useAppStore((state) => state.setViewMode);
  const gridSize = useAppStore((state) => state.gridSize);
  const setGridSize = useAppStore((state) => state.setGridSize);

  const loadInitial = (signal) => {
    setLoading(true);
    fetchAlbums({ offset: 0, limit: 200, signal })
      .then((data) => {
        const rows = data.rows || [];
        setAlbums(rows);
        setOffset(rows.length);
        setHasMore(Boolean(data.hasMore));
      })
      .catch((err) => {
        if (err?.name === "AbortError") {
          return;
        }
        setError(err.message || "Failed to load albums");
      })
      .finally(() => {
        if (!signal?.aborted) {
          setLoading(false);
        }
      });
  };

  useEffect(() => {
    const controller = new AbortController();
    loadInitial(controller.signal);
    return () => controller.abort();
  }, []);

  const loadMore = () => {
    if (!hasMore || loadingMore) {
      return;
    }

    setLoadingMore(true);
    fetchAlbums({ offset, limit: 200 })
      .then((data) => {
        const rows = data.rows || [];
        setAlbums((previous) => [...previous, ...rows]);
        setOffset((previous) => previous + rows.length);
        setHasMore(Boolean(data.hasMore));
      })
      .catch((err) => setError(err.message || "Could not load more albums"))
      .finally(() => setLoadingMore(false));
  };

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
    setViewMode("albums", nextMode);
    if (nextMode === "grid" && nextGridSize) {
      setGridSize(nextGridSize);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-text">Albums</h2>
          <p className="text-sm text-textSoft">Sorted by newest year first</p>
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
            {albums.map((album, index) => (
              <button
                key={`${album.albumArtist}-${album.album}`}
                type="button"
                onClick={() =>
                  navigate(
                    `/albums/${encodeURIComponent(album.albumArtist)}/${encodeURIComponent(
                      album.album
                    )}`
                  )
                }
                className="view-mode-item flex w-full items-center gap-3 rounded-xl border border-[color:var(--border)] bg-panel px-3 py-2 text-left transition hover:border-accent/40 hover:bg-panelSoft/80"
                style={{ "--vm-item-index": Math.min(index, 10) }}
              >
                <CoverArt songId={album.artSongId} className="h-12 w-12 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text">{album.album}</p>
                  <p className="truncate text-xs text-textSoft">{album.albumArtist}</p>
                </div>
                <p className="text-xs text-textSoft">
                  {album.year || "Unknown year"} · {album.songCount} tracks
                </p>
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
            {albums.map((album, index) => (
              <button
                key={`${album.albumArtist}-${album.album}`}
                type="button"
                onClick={() =>
                  navigate(
                    `/albums/${encodeURIComponent(album.albumArtist)}/${encodeURIComponent(
                      album.album
                    )}`
                  )
                }
                className="view-mode-item overflow-hidden rounded-xl border border-[color:var(--border)] bg-panel text-left transition hover:border-accent/40"
                style={{ "--vm-item-index": Math.min(index, 10) }}
              >
                <CoverArt songId={album.artSongId} frame={false} className="aspect-square w-full" />
                <div className={clsx(gridSize === "small" ? "p-2.5" : "p-3")}>
                  <h3
                    className={clsx(
                      "truncate font-semibold text-text",
                      gridSize === "small" ? "text-xs" : "text-sm"
                    )}
                  >
                    {album.album}
                  </h3>
                  <p
                    className={clsx(
                      "mt-1 truncate text-textSoft",
                      gridSize === "small" ? "text-[11px]" : "text-xs"
                    )}
                  >
                    {album.albumArtist}
                  </p>
                  <p
                    className={clsx(
                      "mt-1 text-textSoft",
                      gridSize === "small" ? "text-[11px]" : "text-xs"
                    )}
                  >
                    {album.year || "Unknown year"} · {album.songCount} tracks
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="rounded-xl border border-[color:var(--border)] px-4 py-2 text-sm text-textSoft transition hover:border-accent/40 hover:text-text disabled:opacity-60"
        >
          {loadingMore ? "Loading..." : "Load More Albums"}
        </button>
      )}
    </section>
  );
}
