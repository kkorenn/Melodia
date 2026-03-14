import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  Check,
  ImagePlus,
  PencilLine,
  Plus,
  Trash2,
  X
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import {
  addSongToPlaylist,
  clearPlaylistCover,
  deletePlaylist,
  fetchPlaylist,
  fetchPlaylistSongs,
  fetchSearch,
  fetchSongs,
  removeSongFromPlaylist,
  setPlaylistCover,
  sortPlaylistSongs,
  updatePlaylist
} from "../lib/api";
import { getPlaylistWriteErrorMessage } from "../lib/playlistErrors";
import { PlaylistArt } from "../components/PlaylistArt";
import { CoverArt } from "../components/CoverArt";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useSongActions } from "../hooks/useSongActions";
import { usePlayerStore, selectCurrentSong } from "../store/playerStore";

export function PlaylistDetailPage() {
  const params = useParams();
  const playlistId = Number.parseInt(params.playlistId || "", 10);
  const navigate = useNavigate();

  const [playlist, setPlaylist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [libraryCandidates, setLibraryCandidates] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const debouncedQuery = useDebouncedValue(searchInput, 300);

  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [updatingSongs, setUpdatingSongs] = useState(false);
  const [sortingPlaylist, setSortingPlaylist] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [sortBy, setSortBy] = useState("position");
  const [sortDirection, setSortDirection] = useState("asc");

  const currentSongId = usePlayerStore((state) => selectCurrentSong(state)?.id);
  const { playSong } = useSongActions();

  const songIdsInPlaylist = useMemo(() => new Set(songs.map((song) => song.id)), [songs]);

  const loadPlaylist = (signal) => {
    if (!Number.isFinite(playlistId)) {
      return Promise.reject(new Error("Invalid playlist id"));
    }

    return Promise.all([
      fetchPlaylist(playlistId, { signal }),
      fetchPlaylistSongs(playlistId, { signal })
    ]).then(
      ([playlistPayload, songsPayload]) => {
        const detail = playlistPayload?.playlist || null;
        const rows = songsPayload?.rows || [];
        setPlaylist(detail);
        setSongs(rows);
        setNameDraft(detail?.name || "");
      }
    );
  };

  const loadDefaultCandidates = (signal) => {
    return fetchSongs({
      offset: 0,
      limit: 160,
      sort: "dateAdded",
      direction: "desc",
      signal
    })
      .then((payload) => {
        setLibraryCandidates(payload?.rows || []);
      })
      .catch(() => {
        setLibraryCandidates([]);
      });
  };

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError("");
    Promise.all([loadPlaylist(controller.signal), loadDefaultCandidates(controller.signal)])
      .catch((err) => {
        if (err?.name === "AbortError") {
          return;
        }
        setError(err.message || "Could not load playlist");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [playlistId]);

  useEffect(() => {
    const controller = new AbortController();

    if (!debouncedQuery.trim()) {
      loadDefaultCandidates(controller.signal);
      return () => controller.abort();
    }

    fetchSearch(debouncedQuery, { signal: controller.signal })
      .then((payload) => {
        setLibraryCandidates(payload?.songs || []);
      })
      .catch((err) => {
        if (err?.name === "AbortError") {
          return;
        }
        setLibraryCandidates([]);
      });

    return () => controller.abort();
  }, [debouncedQuery]);

  const refreshPlaylistOnly = () => {
    return loadPlaylist().catch((err) => {
      setError(err.message || "Could not refresh playlist");
    });
  };

  const saveName = () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || !playlist || savingName || trimmed === playlist.name) {
      return;
    }

    setSavingName(true);
    setError("");
    updatePlaylist(playlist.id, { name: trimmed })
      .then(() => refreshPlaylistOnly())
      .catch((err) =>
        setError(getPlaylistWriteErrorMessage(err, "Could not rename playlist"))
      )
      .finally(() => setSavingName(false));
  };

  const onCoverFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file || !playlist || uploadingCover) {
      return;
    }

    const reader = new FileReader();
    setUploadingCover(true);
    setError("");

    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      setPlaylistCover(playlist.id, dataUrl)
        .then(() => refreshPlaylistOnly())
        .catch((err) =>
          setError(getPlaylistWriteErrorMessage(err, "Could not update cover art"))
        )
        .finally(() => {
          setUploadingCover(false);
          event.target.value = "";
        });
    };

    reader.onerror = () => {
      setUploadingCover(false);
      setError("Could not read image file");
      event.target.value = "";
    };

    reader.readAsDataURL(file);
  };

  const removeCustomCover = () => {
    if (!playlist || uploadingCover) {
      return;
    }

    setUploadingCover(true);
    setError("");
    clearPlaylistCover(playlist.id)
      .then(() => refreshPlaylistOnly())
      .catch((err) =>
        setError(getPlaylistWriteErrorMessage(err, "Could not clear cover art"))
      )
      .finally(() => setUploadingCover(false));
  };

  const addSong = (songId) => {
    if (!playlist || updatingSongs) {
      return;
    }

    setUpdatingSongs(true);
    setError("");
    addSongToPlaylist(playlist.id, songId)
      .then(() => refreshPlaylistOnly())
      .catch((err) =>
        setError(getPlaylistWriteErrorMessage(err, "Could not add song to playlist"))
      )
      .finally(() => setUpdatingSongs(false));
  };

  const removeSong = (songId) => {
    if (!playlist || updatingSongs) {
      return;
    }

    setUpdatingSongs(true);
    setError("");
    removeSongFromPlaylist(playlist.id, songId)
      .then(() => refreshPlaylistOnly())
      .catch((err) =>
        setError(getPlaylistWriteErrorMessage(err, "Could not remove song"))
      )
      .finally(() => setUpdatingSongs(false));
  };

  const destroyPlaylist = () => {
    if (!playlist || deleting) {
      return;
    }

    setDeleting(true);
    setError("");
    deletePlaylist(playlist.id)
      .then(() => navigate("/playlists"))
      .catch((err) => {
        setError(getPlaylistWriteErrorMessage(err, "Could not delete playlist"));
        setDeleting(false);
      });
  };

  const applyPlaylistSort = () => {
    if (!playlist || sortingPlaylist || !songs.length) {
      return;
    }

    setSortingPlaylist(true);
    setError("");
    sortPlaylistSongs(playlist.id, { by: sortBy, direction: sortDirection })
      .then(() => refreshPlaylistOnly())
      .catch((err) =>
        setError(getPlaylistWriteErrorMessage(err, "Could not sort playlist"))
      )
      .finally(() => setSortingPlaylist(false));
  };

  if (!Number.isFinite(playlistId)) {
    return <p className="text-sm text-rose-300">Invalid playlist id.</p>;
  }

  if (loading) {
    return <p className="text-sm text-textSoft">Loading playlist...</p>;
  }

  if (error && !playlist) {
    return <p className="text-sm text-rose-300">{error}</p>;
  }

  if (!playlist) {
    return <p className="text-sm text-rose-300">Playlist not found.</p>;
  }

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-[color:var(--border)] bg-panel/70 p-4">
        <div className="flex flex-wrap gap-4">
          <PlaylistArt
            playlistId={playlist.id}
            refreshKey={playlist.updatedAt}
            eager
            className="h-44 w-44"
          />

          <div className="min-w-0 flex-1 space-y-3">
            <div className="text-xs uppercase tracking-[0.15em] text-textSoft">Playlist</div>

            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                className="min-w-[220px] rounded-xl text-2xl font-semibold"
              />
              <Button
                type="button"
                onClick={saveName}
                disabled={savingName || !nameDraft.trim()}
                variant="outline"
                className="h-10 rounded-xl"
              >
                <PencilLine className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
                <span>{savingName ? "Saving..." : "Rename"}</span>
              </Button>
            </div>

            <p className="text-sm text-textSoft">{songs.length} songs</p>

            <div className="flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[color:var(--border)] px-3 py-2 text-sm text-textSoft transition hover:border-accent/40 hover:text-text">
                <ImagePlus className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
                <span>{uploadingCover ? "Uploading..." : "Set Cover"}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onCoverFileChange}
                  disabled={uploadingCover}
                />
              </label>
              <Button
                type="button"
                onClick={removeCustomCover}
                disabled={uploadingCover}
                variant="outline"
                className="h-10 rounded-xl"
              >
                <X className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
                <span>Use First Song Cover</span>
              </Button>
              <Button
                type="button"
                onClick={destroyPlaylist}
                disabled={deleting}
                variant="outline"
                className="h-10 rounded-xl border-rose-400/40 text-rose-300 hover:bg-rose-500/15 hover:text-rose-200"
              >
                <Trash2 className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
                <span>{deleting ? "Deleting..." : "Delete Playlist"}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}

      <section className="space-y-3 rounded-2xl border border-[color:var(--border)] bg-panel/70 p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-sm uppercase tracking-[0.14em] text-textSoft">Songs In Playlist</h3>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="rounded-xl border border-[color:var(--border)] bg-panelSoft px-2.5 py-1.5 text-xs text-text outline-none focus:border-accent"
            >
              <option value="position">Current Order</option>
              <option value="title">Title</option>
              <option value="artist">Artist</option>
              <option value="album">Album</option>
              <option value="duration">Duration</option>
              <option value="year">Year</option>
              <option value="dateAdded">Date Added</option>
              <option value="addedAt">Added To Playlist</option>
            </select>
            <select
              value={sortDirection}
              onChange={(event) => setSortDirection(event.target.value)}
              className="rounded-xl border border-[color:var(--border)] bg-panelSoft px-2.5 py-1.5 text-xs text-text outline-none focus:border-accent"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
            <Button
              type="button"
              onClick={applyPlaylistSort}
              disabled={!songs.length || sortingPlaylist}
              variant="outline"
              size="sm"
              className="h-8 rounded-xl"
            >
              <ArrowUpDown className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
              <span>{sortingPlaylist ? "Sorting..." : "Sort"}</span>
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (songs.length) {
                  playSong(songs[0], 0, songs);
                }
              }}
              disabled={!songs.length}
              size="sm"
              className="h-8 rounded-xl"
            >
              Play Playlist
            </Button>
          </div>
        </div>

        {!songs.length && (
          <p className="rounded-xl border border-[color:var(--border)] bg-panelSoft/60 p-4 text-sm text-textSoft">
            This playlist is empty.
          </p>
        )}

        <div className="space-y-1">
          {songs.map((song, index) => (
            <div
              key={song.id}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition ${
                currentSongId === song.id
                  ? "border-accent/40 bg-accent/10"
                  : "border-[color:var(--border)] bg-panelSoft/40 hover:bg-panelSoft/70"
              }`}
            >
              <button
                type="button"
                onClick={() => playSong(song, index, songs)}
                className="w-8 text-left text-xs text-textSoft"
              >
                {index + 1}
              </button>
              <CoverArt songId={song.id} className="h-10 w-10" />
              <button
                type="button"
                onClick={() => playSong(song, index, songs)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-sm font-medium text-text">{song.title || song.filename}</p>
                <p className="truncate text-xs text-textSoft">{song.artist || "Unknown Artist"}</p>
              </button>
              <button
                type="button"
                onClick={() => removeSong(song.id)}
                disabled={updatingSongs}
                className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--border)] px-2 py-1 text-xs text-textSoft transition hover:border-accent/40 hover:text-text disabled:opacity-60"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
                <span>Remove</span>
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-[color:var(--border)] bg-panel/70 p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-sm uppercase tracking-[0.14em] text-textSoft">Add Songs</h3>
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search songs by title, artist, album"
            className="h-10 w-full rounded-xl md:w-80"
          />
        </div>

        <div className="max-h-[360px] space-y-1 overflow-y-auto pr-1">
          {libraryCandidates.map((song) => (
            <div
              key={song.id}
              className="flex items-center gap-3 rounded-xl border border-[color:var(--border)] bg-panelSoft/40 px-3 py-2"
            >
              <CoverArt songId={song.id} className="h-9 w-9" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text">{song.title || song.filename}</p>
                <p className="truncate text-xs text-textSoft">
                  {song.artist || "Unknown Artist"} · {song.album || "Unknown Album"}
                </p>
              </div>

              {songIdsInPlaylist.has(song.id) ? (
                <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300">
                  <Check className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
                  Added
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => addSong(song.id)}
                  disabled={updatingSongs}
                  className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--border)] px-2 py-1 text-xs text-textSoft transition hover:border-accent/40 hover:text-text disabled:opacity-60"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
                  Add
                </button>
              )}
            </div>
          ))}

          {!libraryCandidates.length && (
            <p className="rounded-xl border border-[color:var(--border)] bg-panelSoft/40 p-4 text-sm text-textSoft">
              No songs found for that search.
            </p>
          )}
        </div>
      </section>
    </section>
  );
}
