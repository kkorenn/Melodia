import { useCallback, useState } from "react";
import clsx from "clsx";
import { useNavigate, useParams } from "react-router-dom";
import { fetchArtistAlbums, fetchArtistSongs } from "../lib/api";
import { SongTable } from "../components/SongTable";
import { CoverArt } from "../components/CoverArt";
import { GridSkeleton, ListSkeleton } from "../components/LoadingSkeletons";
import { ViewModeToggle } from "../components/ViewModeToggle";
import { useAbortableRequest } from "../hooks/useAbortableRequest";
import { useSongActions } from "../hooks/useSongActions";
import { useAppStore } from "../store/appStore";
import { usePlayerStore, selectCurrentSong } from "../store/playerStore";

export function ArtistDetailPage() {
  const params = useParams();
  const artist = decodeURIComponent(params.artist || "Unknown Artist");
  const [songs, setSongs] = useState([]);
  const [albums, setAlbums] = useState([]);

  const navigate = useNavigate();
  const currentSongId = usePlayerStore((state) => selectCurrentSong(state)?.id);
  const albumsViewMode = useAppStore((state) => state.viewModes?.artistAlbums || "grid");
  const setViewMode = useAppStore((state) => state.setViewMode);
  const gridSize = useAppStore((state) => state.gridSize);
  const setGridSize = useAppStore((state) => state.setGridSize);
  const { playSong, queueSong, goToArtist, goToAlbum } = useSongActions();

  const loadArtistDetails = useCallback(
    (signal) => {
      return Promise.all([
        fetchArtistSongs(artist, { signal }),
        fetchArtistAlbums(artist, { signal })
      ]).then(([songsData, albumsData]) => {
        setSongs(songsData.rows || []);
        setAlbums(albumsData.rows || []);
      });
    },
    [artist]
  );

  const {
    loading,
    error
  } = useAbortableRequest(loadArtistDetails, [loadArtistDetails], {
    fallbackErrorMessage: "Could not load artist details"
  });

  if (loading) {
    return (
      <section className="space-y-4">
        <div>
          <div className="mb-2 h-7 w-48 animate-pulse rounded bg-panelSoft" />
          <div className="h-4 w-40 animate-pulse rounded bg-panelSoft/80" />
        </div>
        {albumsViewMode === "list" ? (
          <ListSkeleton rows={6} withArt />
        ) : (
          <GridSkeleton cards={8} gridSize={gridSize} />
        )}
      </section>
    );
  }

  if (error) {
    return <p className="text-sm text-rose-300">{error}</p>;
  }

  const handleAlbumsLayoutChange = (nextMode, nextGridSize) => {
    setViewMode("artistAlbums", nextMode);
    if (nextMode === "grid" && nextGridSize) {
      setGridSize(nextGridSize);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-text">{artist}</h2>
          <p className="text-sm text-textSoft">{songs.length} songs in this library</p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (songs.length) {
              playSong(songs[0], 0, songs);
            }
          }}
          className="rounded-xl border border-accent/50 bg-accent px-4 py-2 text-sm font-semibold text-shell"
        >
          Play Artist
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-textSoft">Albums</h3>
          <ViewModeToggle
            mode={albumsViewMode}
            gridSize={gridSize}
            onChange={handleAlbumsLayoutChange}
          />
        </div>
        <div
          key={`${albumsViewMode}-${albumsViewMode === "grid" ? gridSize : "list"}`}
          className="view-mode-viewport"
        >
          {albumsViewMode === "list" ? (
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
                    <p className="text-xs text-textSoft">{album.year || "Unknown year"}</p>
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
                  <CoverArt
                    songId={album.artSongId}
                    frame={false}
                    className="aspect-square w-full"
                  />
                  <div className={clsx(gridSize === "small" ? "p-2.5" : "p-3")}>
                    <p
                      className={clsx(
                        "truncate font-semibold text-text",
                        gridSize === "small" ? "text-xs" : "text-sm"
                      )}
                    >
                      {album.album}
                    </p>
                    <p
                      className={clsx(
                        "mt-1 text-textSoft",
                        gridSize === "small" ? "text-[11px]" : "text-xs"
                      )}
                    >
                      {album.year || "Unknown year"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
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
