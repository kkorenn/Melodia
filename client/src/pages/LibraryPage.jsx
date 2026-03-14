import { useEffect, useState } from "react";
import { fetchSongs } from "../lib/api";
import { GridSkeleton, ListSkeleton } from "../components/LoadingSkeletons";
import { SongTable } from "../components/SongTable";
import { SongGrid } from "../components/SongGrid";
import { ViewModeToggle } from "../components/ViewModeToggle";
import { useSongActions } from "../hooks/useSongActions";
import { useAppStore } from "../store/appStore";
import { usePlayerStore, selectCurrentSong } from "../store/playerStore";

export function LibraryPage() {
  const [songs, setSongs] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [sort, setSort] = useState("title");
  const [direction, setDirection] = useState("asc");

  const { playSong, queueSong, goToArtist, goToAlbum } = useSongActions();
  const currentSongId = usePlayerStore((state) => selectCurrentSong(state)?.id);
  const viewMode = useAppStore((state) => state.viewModes?.library || "list");
  const setViewMode = useAppStore((state) => state.setViewMode);
  const gridSize = useAppStore((state) => state.gridSize);
  const setGridSize = useAppStore((state) => state.setGridSize);

  const loadInitial = (signal) => {
    setLoading(true);
    setError("");

    fetchSongs({ offset: 0, limit: 200, sort, direction, signal })
      .then((data) => {
        setSongs(data.rows || []);
        setOffset((data.rows || []).length);
        setHasMore(Boolean(data.hasMore));
        setTotal(data.total || 0);
      })
      .catch((err) => {
        if (err?.name === "AbortError") {
          return;
        }
        setError(err.message || "Could not load songs");
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
  }, [sort, direction]);

  const loadMore = () => {
    if (loadingMore || !hasMore) {
      return;
    }

    setLoadingMore(true);
    fetchSongs({ offset, limit: 200, sort, direction })
      .then((data) => {
        const nextRows = data.rows || [];
        setSongs((previous) => [...previous, ...nextRows]);
        setOffset((previous) => previous + nextRows.length);
        setHasMore(Boolean(data.hasMore));
        setTotal(data.total || 0);
      })
      .catch((err) => {
        setError(err.message || "Could not load more songs");
      })
      .finally(() => setLoadingMore(false));
  };

  const handleSort = (nextSort, nextDirection) => {
    setSort(nextSort);
    setDirection(nextDirection);
  };

  const handleViewModeChange = (nextMode, nextGridSize) => {
    setViewMode("library", nextMode);
    if (nextMode === "grid" && nextGridSize) {
      setGridSize(nextGridSize);
    }
  };

  if (loading) {
    return viewMode === "list" ? (
      <ListSkeleton rows={10} withArt />
    ) : (
      <GridSkeleton cards={12} gridSize={gridSize} />
    );
  }

  if (error) {
    return <p className="text-sm text-rose-300">{error}</p>;
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-text">All Songs</h2>
          <p className="text-sm text-textSoft">{total} tracks indexed locally</p>
        </div>
        <ViewModeToggle
          mode={viewMode}
          gridSize={gridSize}
          onChange={handleViewModeChange}
        />
      </div>

      <div
        key={`${viewMode}-${viewMode === "grid" ? gridSize : "list"}`}
        className="view-mode-viewport"
      >
        {viewMode === "list" ? (
          <SongTable
            songs={songs}
            currentSongId={currentSongId}
            sort={sort}
            direction={direction}
            playOnRowClick
            onSortChange={handleSort}
            onPlaySong={playSong}
            onAddToQueue={queueSong}
            onGoToArtist={goToArtist}
            onGoToAlbum={goToAlbum}
            onLoadMore={loadMore}
            hasMore={hasMore}
            loadingMore={loadingMore}
          />
        ) : (
          <SongGrid
            songs={songs}
            gridSize={gridSize}
            onPlaySong={playSong}
            onGoToArtist={goToArtist}
            onGoToAlbum={goToAlbum}
          />
        )}
      </div>
    </section>
  );
}
