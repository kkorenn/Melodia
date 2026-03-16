import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ImagePlus,
  PencilLine,
  Plus,
  Trash2,
  X
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
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
import {
  isSettingsAuthRequiredError,
  useSettingsAccess
} from "../hooks/useSettingsAccess";
import { useSongActions } from "../hooks/useSongActions";
import { usePlayerStore, selectCurrentSong } from "../store/playerStore";

function normalizeSortText(value) {
  return String(value || "").trim().toLocaleLowerCase();
}

function normalizeSortNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function compareNullable(left, right) {
  if (left == null && right == null) {
    return 0;
  }
  if (left == null) {
    return 1;
  }
  if (right == null) {
    return -1;
  }

  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  return String(left).localeCompare(String(right), undefined, {
    sensitivity: "base",
    numeric: true
  });
}

function getSongSortValue(song, sortBy) {
  switch (sortBy) {
    case "title":
      return normalizeSortText(song.title || song.filename);
    case "artist":
      return normalizeSortText(song.artist);
    case "album":
      return normalizeSortText(song.album);
    case "duration":
      return normalizeSortNumber(song.duration);
    case "year":
      return normalizeSortNumber(song.year);
    case "dateAdded":
      return normalizeSortNumber(song.dateAdded);
    case "addedAt":
      return normalizeSortNumber(song.addedAt);
    case "position":
    default:
      return normalizeSortNumber(song.playlistPosition);
  }
}

function sortPlaylistRowsLocal(rows, sortBy, sortDirection) {
  const direction = sortDirection === "desc" ? -1 : 1;
  const withIndex = rows.map((song, index) => ({ song, index }));

  withIndex.sort((left, right) => {
    const primary = compareNullable(
      getSongSortValue(left.song, sortBy),
      getSongSortValue(right.song, sortBy)
    );
    if (primary !== 0) {
      return primary * direction;
    }

    const positionTieBreak = compareNullable(
      normalizeSortNumber(left.song.playlistPosition),
      normalizeSortNumber(right.song.playlistPosition)
    );
    if (positionTieBreak !== 0) {
      return positionTieBreak;
    }

    return left.index - right.index;
  });

  return withIndex.map((entry) => entry.song);
}

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
  const songItemRefs = useRef(new Map());
  const playlistSongsScrollRef = useRef(null);
  const libraryCandidatesScrollRef = useRef(null);
  const previousTopBySongIdRef = useRef(new Map());
  const hasMeasuredSongPositionsRef = useRef(false);

  const currentSongId = usePlayerStore((state) => selectCurrentSong(state)?.id);
  const { playSong } = useSongActions();
  const {
    loading: permissionLoading,
    canManageProtectedActions,
    markLocked
  } = useSettingsAccess();
  const canEditPlaylist = !permissionLoading && canManageProtectedActions;

  const songIdsInPlaylist = useMemo(() => new Set(songs.map((song) => song.id)), [songs]);
  const songOrderSignature = useMemo(
    () => songs.map((song) => song.id).join(","),
    [songs]
  );
  const playlistSongsVirtualizer = useVirtualizer({
    count: songs.length,
    getScrollElement: () => playlistSongsScrollRef.current,
    estimateSize: () => 66,
    overscan: 10
  });
  const playlistSongsVirtualRows = playlistSongsVirtualizer.getVirtualItems();
  const usePlaylistVirtualRows = false;
  const libraryCandidatesVirtualizer = useVirtualizer({
    count: libraryCandidates.length,
    getScrollElement: () => libraryCandidatesScrollRef.current,
    estimateSize: () => 62,
    overscan: 12
  });
  const libraryCandidateVirtualRows = libraryCandidatesVirtualizer.getVirtualItems();
  const useLibraryCandidateVirtualRows = false;

  const handlePlaylistWriteError = (err, fallbackMessage) => {
    if (isSettingsAuthRequiredError(err)) {
      markLocked();
    }
    setError(getPlaylistWriteErrorMessage(err, fallbackMessage));
  };

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

  useEffect(() => {
    previousTopBySongIdRef.current = new Map();
    hasMeasuredSongPositionsRef.current = false;
  }, [playlistId]);

  useLayoutEffect(() => {
    const nextTopBySongId = new Map();
    for (const song of songs) {
      const node = songItemRefs.current.get(song.id);
      if (!node) {
        continue;
      }
      nextTopBySongId.set(song.id, node.getBoundingClientRect().top);
    }

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // FLIP-style animation for row reordering (sorting, etc.).
    if (hasMeasuredSongPositionsRef.current && !prefersReducedMotion) {
      for (const song of songs) {
        const node = songItemRefs.current.get(song.id);
        const previousTop = previousTopBySongIdRef.current.get(song.id);
        const nextTop = nextTopBySongId.get(song.id);
        if (!node || previousTop == null || nextTop == null) {
          continue;
        }

        const deltaY = previousTop - nextTop;
        if (Math.abs(deltaY) < 1) {
          continue;
        }

        node.animate(
          [
            { transform: `translateY(${deltaY}px)` },
            { transform: "translateY(0)" }
          ],
          {
            duration: 380,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)"
          }
        );
      }
    }

    previousTopBySongIdRef.current = nextTopBySongId;
    hasMeasuredSongPositionsRef.current = true;
  }, [songOrderSignature, songs.length]);

  const refreshPlaylistOnly = () => {
    return loadPlaylist().catch((err) => {
      setError(err.message || "Could not refresh playlist");
    });
  };

  const saveName = () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || !playlist || savingName || trimmed === playlist.name || !canEditPlaylist) {
      return;
    }

    setSavingName(true);
    setError("");
    updatePlaylist(playlist.id, { name: trimmed })
      .then(() => refreshPlaylistOnly())
      .catch((err) => handlePlaylistWriteError(err, "Could not rename playlist"))
      .finally(() => setSavingName(false));
  };

  const onCoverFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file || !playlist || uploadingCover || !canEditPlaylist) {
      return;
    }

    const reader = new FileReader();
    setUploadingCover(true);
    setError("");

    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      setPlaylistCover(playlist.id, dataUrl)
        .then(() => refreshPlaylistOnly())
        .catch((err) => handlePlaylistWriteError(err, "Could not update cover art"))
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
    if (!playlist || uploadingCover || !canEditPlaylist) {
      return;
    }

    setUploadingCover(true);
    setError("");
    clearPlaylistCover(playlist.id)
      .then(() => refreshPlaylistOnly())
      .catch((err) => handlePlaylistWriteError(err, "Could not clear cover art"))
      .finally(() => setUploadingCover(false));
  };

  const addSong = (songId) => {
    if (!playlist || updatingSongs || !canEditPlaylist) {
      return;
    }

    setUpdatingSongs(true);
    setError("");
    addSongToPlaylist(playlist.id, songId)
      .then(() => refreshPlaylistOnly())
      .catch((err) => handlePlaylistWriteError(err, "Could not add song to playlist"))
      .finally(() => setUpdatingSongs(false));
  };

  const removeSong = (songId) => {
    if (!playlist || updatingSongs || !canEditPlaylist) {
      return;
    }

    setUpdatingSongs(true);
    setError("");
    removeSongFromPlaylist(playlist.id, songId)
      .then(() => refreshPlaylistOnly())
      .catch((err) => handlePlaylistWriteError(err, "Could not remove song"))
      .finally(() => setUpdatingSongs(false));
  };

  const destroyPlaylist = () => {
    if (!playlist || deleting || !canEditPlaylist) {
      return;
    }

    setDeleting(true);
    setError("");
    deletePlaylist(playlist.id)
      .then(() => navigate("/playlists"))
      .catch((err) => {
        handlePlaylistWriteError(err, "Could not delete playlist");
        setDeleting(false);
      });
  };

  const applyPlaylistSort = (nextSortBy = sortBy, nextSortDirection = sortDirection) => {
    if (!songs.length) {
      return;
    }

    if (!canEditPlaylist) {
      setError("");
      setSongs((previous) =>
        sortPlaylistRowsLocal(previous, nextSortBy, nextSortDirection)
      );
      return;
    }

    if (!playlist || sortingPlaylist) {
      return;
    }

    setSortingPlaylist(true);
    setError("");
    sortPlaylistSongs(playlist.id, { by: nextSortBy, direction: nextSortDirection })
      .then(() => refreshPlaylistOnly())
      .catch((err) => handlePlaylistWriteError(err, "Could not sort playlist"))
      .finally(() => setSortingPlaylist(false));
  };

  const onSortByChange = (event) => {
    const nextSortBy = event.target.value;
    setSortBy(nextSortBy);
    applyPlaylistSort(nextSortBy, sortDirection);
  };

  const onSortDirectionChange = (event) => {
    const nextSortDirection = event.target.value;
    setSortDirection(nextSortDirection);
    applyPlaylistSort(sortBy, nextSortDirection);
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

            {canEditPlaylist ? (
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
            ) : (
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold text-text">{playlist.name}</h1>
              </div>
            )}

            <p className="text-sm text-textSoft">{songs.length} songs</p>

            {canEditPlaylist && (
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
            )}
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
              onChange={onSortByChange}
              disabled={!songs.length || sortingPlaylist}
              className="rounded-xl border border-[color:var(--border)] bg-panelSoft px-2.5 py-1.5 text-xs text-text outline-none focus:border-accent disabled:opacity-60"
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
              onChange={onSortDirectionChange}
              disabled={!songs.length || sortingPlaylist}
              className="rounded-xl border border-[color:var(--border)] bg-panelSoft px-2.5 py-1.5 text-xs text-text outline-none focus:border-accent disabled:opacity-60"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
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

        <div
          ref={playlistSongsScrollRef}
          className={`${canEditPlaylist ? "max-h-[460px]" : "max-h-[68vh] min-h-[52vh]"} overflow-y-auto`}
        >
          {usePlaylistVirtualRows ? (
            <div
              className="relative"
              style={{ height: playlistSongsVirtualizer.getTotalSize() }}
            >
              {playlistSongsVirtualRows.map((virtualRow) => {
                const song = songs[virtualRow.index];
                if (!song) {
                  return null;
                }

                const index = virtualRow.index;
                return (
                  <div
                    key={`${song.id}-${index}`}
                    ref={(node) => {
                      if (node) {
                        songItemRefs.current.set(song.id, node);
                      } else {
                        songItemRefs.current.delete(song.id);
                      }
                    }}
                    className={`absolute left-0 top-0 flex w-full items-center gap-3 rounded-xl border px-3 py-2 transition ${
                      currentSongId === song.id
                        ? "border-accent/40 bg-accent/10"
                        : "border-[color:var(--border)] bg-panelSoft/40 hover:bg-panelSoft/70"
                    }`}
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
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
                      <p className="truncate text-sm font-medium text-text">
                        {song.title || song.filename}
                      </p>
                      <p className="truncate text-xs text-textSoft">{song.artist || "Unknown Artist"}</p>
                    </button>
                    {canEditPlaylist && (
                      <button
                        type="button"
                        onClick={() => removeSong(song.id)}
                        disabled={updatingSongs}
                        className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--border)] px-2 py-1 text-xs text-textSoft transition hover:border-accent/40 hover:text-text disabled:opacity-60"
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-1">
              {songs.map((song, index) => (
                <div
                  key={`${song.id}-${index}`}
                  ref={(node) => {
                    if (node) {
                      songItemRefs.current.set(song.id, node);
                    } else {
                      songItemRefs.current.delete(song.id);
                    }
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 transition ${
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
                  {canEditPlaylist && (
                    <button
                      type="button"
                      onClick={() => removeSong(song.id)}
                      disabled={updatingSongs}
                      className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--border)] px-2 py-1 text-xs text-textSoft transition hover:border-accent/40 hover:text-text disabled:opacity-60"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {canEditPlaylist && (
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

          <div
            ref={libraryCandidatesScrollRef}
            className="max-h-[360px] overflow-y-auto pr-1"
          >
            {useLibraryCandidateVirtualRows ? (
              <div
                className="relative"
                style={{ height: libraryCandidatesVirtualizer.getTotalSize() }}
              >
                {libraryCandidateVirtualRows.map((virtualRow) => {
                  const song = libraryCandidates[virtualRow.index];
                  if (!song) {
                    return null;
                  }

                  return (
                    <div
                      key={`${song.id}-${virtualRow.index}`}
                      className="absolute left-0 top-0 flex w-full items-center gap-3 rounded-xl border border-[color:var(--border)] bg-panelSoft/40 px-3 py-2"
                      style={{ transform: `translateY(${virtualRow.start}px)` }}
                    >
                      <CoverArt songId={song.id} className="h-9 w-9" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text">
                          {song.title || song.filename}
                        </p>
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
                  );
                })}
              </div>
            ) : (
              <div className="space-y-1">
                {libraryCandidates.map((song, index) => (
                  <div
                    key={`${song.id}-${index}`}
                    className="flex w-full items-center gap-3 rounded-xl border border-[color:var(--border)] bg-panelSoft/40 px-3 py-2"
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
              </div>
            )}

            {!libraryCandidates.length && (
              <p className="rounded-xl border border-[color:var(--border)] bg-panelSoft/40 p-4 text-sm text-textSoft">
                No songs found for that search.
              </p>
            )}
          </div>
        </section>
      )}
    </section>
  );
}
