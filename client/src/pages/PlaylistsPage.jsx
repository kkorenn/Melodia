import { useCallback, useState } from "react";
import clsx from "clsx";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPlaylist, fetchPlaylists } from "../lib/api";
import { getPlaylistWriteErrorMessage } from "../lib/playlistErrors";
import { PlaylistArt } from "../components/PlaylistArt";
import { GridSkeleton, ListSkeleton } from "../components/LoadingSkeletons";
import { ViewModeToggle } from "../components/ViewModeToggle";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useAbortableRequest } from "../hooks/useAbortableRequest";
import { useAppStore } from "../store/appStore";

export function PlaylistsPage() {
  const [playlists, setPlaylists] = useState([]);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const viewMode = useAppStore((state) => state.viewModes?.playlists || "grid");
  const setViewMode = useAppStore((state) => state.setViewMode);
  const gridSize = useAppStore((state) => state.gridSize);
  const setGridSize = useAppStore((state) => state.setGridSize);

  const loadPlaylists = useCallback((signal) => {
    return fetchPlaylists({ signal }).then((data) => {
      setPlaylists(data.rows || []);
    });
  }, []);

  const {
    loading,
    error,
    setError
  } = useAbortableRequest(loadPlaylists, [loadPlaylists], {
    fallbackErrorMessage: "Could not load playlists"
  });

  const createNewPlaylist = () => {
    const trimmed = name.trim();
    if (!trimmed || creating) {
      return;
    }

    setCreating(true);
    setError("");
    createPlaylist(trimmed)
      .then((payload) => {
        setName("");
        const playlistId = payload?.playlist?.id;
        if (playlistId) {
          navigate(`/playlists/${playlistId}`);
          return;
        }
        loadPlaylists();
      })
      .catch((err) => {
        setError(getPlaylistWriteErrorMessage(err, "Could not create playlist"));
      })
      .finally(() => setCreating(false));
  };

  const handleLayoutChange = (nextMode, nextGridSize) => {
    setViewMode("playlists", nextMode);
    if (nextMode === "grid" && nextGridSize) {
      setGridSize(nextGridSize);
    }
  };

  if (loading) {
    return viewMode === "list" ? (
      <ListSkeleton rows={8} withArt />
    ) : (
      <GridSkeleton cards={10} gridSize={gridSize} />
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-text">Playlists</h2>
          <p className="text-sm text-textSoft">Create custom collections and manage songs locally</p>
        </div>

        <div className="flex items-center gap-2">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                createNewPlaylist();
              }
            }}
            placeholder="New playlist name"
            className="h-10 w-[220px] rounded-xl"
          />
          <Button
            type="button"
            onClick={createNewPlaylist}
            disabled={!name.trim() || creating}
            className="h-10 rounded-xl"
          >
            <Plus className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
            <span>{creating ? "Creating..." : "Create"}</span>
          </Button>
        </div>
      </div>

      <ViewModeToggle
        mode={viewMode}
        gridSize={gridSize}
        onChange={handleLayoutChange}
      />

      {error && <p className="text-sm text-rose-300">{error}</p>}

      {!playlists.length && (
        <div className="rounded-2xl border border-[color:var(--border)] bg-panel p-10 text-center text-sm text-textSoft">
          No playlists yet. Create one and start adding songs.
        </div>
      )}

      <div
        key={`${viewMode}-${viewMode === "grid" ? gridSize : "list"}`}
        className="view-mode-viewport"
      >
        {viewMode === "list" ? (
          <div className="space-y-1">
            {playlists.map((playlist, index) => (
              <button
                key={playlist.id}
                type="button"
                onClick={() => navigate(`/playlists/${playlist.id}`)}
                className="view-mode-item flex w-full items-center gap-3 rounded-xl border border-[color:var(--border)] bg-panel px-3 py-2 text-left transition hover:border-accent/40 hover:bg-panelSoft/80"
                style={{ "--vm-item-index": Math.min(index, 10) }}
              >
                <PlaylistArt playlistId={playlist.id} className="h-12 w-12 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text">{playlist.name}</p>
                  <p className="text-xs text-textSoft">{playlist.songCount || 0} songs</p>
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
            {playlists.map((playlist, index) => (
              <button
                key={playlist.id}
                type="button"
                onClick={() => navigate(`/playlists/${playlist.id}`)}
                className="view-mode-item overflow-hidden rounded-xl border border-[color:var(--border)] bg-panel text-left transition hover:border-accent/40"
                style={{ "--vm-item-index": Math.min(index, 10) }}
              >
                <PlaylistArt
                  playlistId={playlist.id}
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
                    {playlist.name}
                  </h3>
                  <p
                    className={clsx(
                      "mt-1 text-textSoft",
                      gridSize === "small" ? "text-[11px]" : "text-xs"
                    )}
                  >
                    {playlist.songCount || 0} songs
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
