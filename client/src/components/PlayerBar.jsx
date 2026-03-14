import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import {
  ArrowUp,
  ListMusic,
  Pause,
  Play,
  RefreshCw,
  Repeat,
  Repeat1,
  ScrollText,
  SkipBack,
  SkipForward,
  Shuffle,
  Volume2,
  VolumeX,
  X
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { fetchLyrics } from "../lib/api";
import { usePlayerStore } from "../store/playerStore";
import { CoverArt } from "./CoverArt";
import { formatDuration } from "../utils/format";

const repeatLabels = {
  off: "Repeat Off",
  all: "Repeat All",
  one: "Repeat One"
};
const LYRICS_LOCAL_CACHE_KEY = "melodia_lyrics_cache_v1";
const LYRICS_LOCAL_CACHE_MAX_ENTRIES = 160;

function loadLyricsLocalCache() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(LYRICS_LOCAL_CACHE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function persistLyricsLocalCache(cache) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(LYRICS_LOCAL_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // no-op
  }
}

function normalizeLyricsCache(cache) {
  const entries = Object.entries(cache || {})
    .filter(([, value]) => value && typeof value === "object" && value.payload)
    .sort(
      ([, left], [, right]) =>
        Number(right?.updatedAt || 0) - Number(left?.updatedAt || 0)
    )
    .slice(0, LYRICS_LOCAL_CACHE_MAX_ENTRIES);

  return Object.fromEntries(entries);
}

export function PlayerBar({ currentSong, currentTime, duration, buffered, seek, next }) {
  const [artExpanded, setArtExpanded] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [seekPreview, setSeekPreview] = useState({
    visible: false,
    percent: 0,
    seconds: 0
  });
  const [lyricsState, setLyricsState] = useState({
    songId: null,
    loading: false,
    payload: null,
    error: ""
  });
  const lyricsLocalCacheRef = useRef(loadLyricsLocalCache());
  const lyricsRequestIdRef = useRef(0);
  const navigate = useNavigate();

  const {
    isPlaying,
    volume,
    muted,
    shuffle,
    repeatMode,
    queueOpen,
    togglePlayPause,
    previous,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    toggleQueueOpen
  } = usePlayerStore(
    useShallow((state) => ({
      isPlaying: state.isPlaying,
      volume: state.volume,
      muted: state.muted,
      shuffle: state.shuffle,
      repeatMode: state.repeatMode,
      queueOpen: state.queueOpen,
      togglePlayPause: state.togglePlayPause,
      previous: state.previous,
      setVolume: state.setVolume,
      toggleMute: state.toggleMute,
      toggleShuffle: state.toggleShuffle,
      cycleRepeat: state.cycleRepeat,
      toggleQueueOpen: state.toggleQueueOpen
    }))
  );

  const progress = duration > 0 ? currentTime / duration : 0;
  const bufferedProgress = duration > 0 ? buffered / duration : 0;
  const artistName = currentSong?.artist || "Unknown Artist";
  const albumName = currentSong?.album || "Unknown Album";
  const albumArtistName = currentSong?.albumArtist || artistName;
  const artPanelOpen = artExpanded && !lyricsOpen && !queueOpen;
  const isCurrentSongLyricsLoaded =
    currentSong?.id && lyricsState.songId === currentSong.id && lyricsState.payload;

  const getCachedLyrics = useCallback((songId) => {
    if (!songId) {
      return null;
    }

    const entry = lyricsLocalCacheRef.current?.[String(songId)];
    if (!entry || typeof entry !== "object" || !entry.payload) {
      return null;
    }

    return entry.payload;
  }, []);

  const storeCachedLyrics = useCallback((songId, payload) => {
    if (!songId || !payload || typeof payload !== "object") {
      return;
    }

    const key = String(songId);
    const nextCache = normalizeLyricsCache({
      ...(lyricsLocalCacheRef.current || {}),
      [key]: {
        payload,
        updatedAt: Date.now()
      }
    });

    lyricsLocalCacheRef.current = nextCache;
    persistLyricsLocalCache(nextCache);
  }, []);

  const loadLyricsForSong = useCallback(async (songId, { refresh = false } = {}) => {
    if (!songId) {
      setLyricsState({
        songId: null,
        loading: false,
        payload: null,
        error: ""
      });
      return;
    }

    const requestId = lyricsRequestIdRef.current + 1;
    lyricsRequestIdRef.current = requestId;
    const cachedPayload = !refresh ? getCachedLyrics(songId) : null;

    setLyricsState((previous) => ({
      songId,
      loading: true,
      payload:
        previous.songId === songId
          ? previous.payload || cachedPayload
          : cachedPayload,
      error: ""
    }));

    try {
      const payload = await fetchLyrics(songId, { refresh });
      if (lyricsRequestIdRef.current !== requestId) {
        return;
      }

      setLyricsState({
        songId,
        loading: false,
        payload,
        error: ""
      });
      storeCachedLyrics(songId, payload);
    } catch (error) {
      if (lyricsRequestIdRef.current !== requestId) {
        return;
      }

      setLyricsState((previous) => ({
        songId,
        loading: false,
        payload:
          previous.songId === songId
            ? previous.payload || cachedPayload
            : cachedPayload,
        error: error instanceof Error ? error.message : "Failed to load lyrics"
      }));
    }
  }, [getCachedLyrics, storeCachedLyrics]);

  useEffect(() => {
    if (!artExpanded && !lyricsOpen) {
      return undefined;
    }

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setArtExpanded(false);
        setLyricsOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [artExpanded, lyricsOpen]);

  useEffect(() => {
    setArtExpanded(false);
  }, [currentSong?.id]);

  useEffect(() => {
    if (lyricsOpen || queueOpen) {
      setArtExpanded(false);
    }
  }, [lyricsOpen, queueOpen]);

  useEffect(() => {
    if (!currentSong?.id) {
      setLyricsOpen(false);
      setLyricsState({
        songId: null,
        loading: false,
        payload: null,
        error: ""
      });
      return;
    }

    loadLyricsForSong(currentSong.id);
  }, [currentSong?.id, loadLyricsForSong]);

  useEffect(() => {
    if (!lyricsOpen || !currentSong?.id) {
      return undefined;
    }

    const refreshNow = () => {
      loadLyricsForSong(currentSong.id, { refresh: true });
    };

    const initialRefresh = window.setTimeout(refreshNow, 1500);
    const intervalId = window.setInterval(refreshNow, 45_000);

    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(intervalId);
    };
  }, [lyricsOpen, currentSong?.id, loadLyricsForSong]);

  function renderLyricsBody() {
    if (!currentSong) {
      return <p className="text-sm text-textSoft">Start playing a song to view lyrics.</p>;
    }

    if (lyricsState.loading && !isCurrentSongLyricsLoaded) {
      return <p className="text-sm text-textSoft">Loading lyrics...</p>;
    }

    if (lyricsState.error && !isCurrentSongLyricsLoaded) {
      return (
        <p className="text-sm text-rose-300">
          {lyricsState.error}
        </p>
      );
    }

    const payload = isCurrentSongLyricsLoaded ? lyricsState.payload : null;
    if (!payload) {
      return <p className="text-sm text-textSoft">Lyrics are not available for this track yet.</p>;
    }

    if (payload.status === "ok" && payload.lyrics) {
      return (
        <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-text">
          {payload.lyrics}
        </pre>
      );
    }

    if (payload.status === "no_match") {
      return (
        <p className="text-sm text-textSoft">
          We couldn&apos;t find a matching song in the lyrics provider.
        </p>
      );
    }

    if (payload.status === "no_lyrics") {
      return <p className="text-sm text-textSoft">No lyrics were returned for this song.</p>;
    }

    return (
      <p className="text-sm text-rose-300">
        {payload.error || lyricsState.error || "Lyrics are currently unavailable."}
      </p>
    );
  }

  function updateSeekPreviewFromEvent(event) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const percent = Math.max(
      0,
      Math.min(1, (event.clientX - bounds.left) / bounds.width)
    );
    setSeekPreview({
      visible: true,
      percent,
      seconds: duration * percent
    });
    return percent;
  }

  return (
    <footer className="z-40 shrink-0 border-t border-[color:var(--border)] bg-[color:var(--bg-main)] px-3 pt-2.5 pb-[calc(max(env(safe-area-inset-bottom),0px)+0.75rem)] md:px-6 md:py-3">
      <div className="grid grid-cols-1 items-center gap-2.5 lg:grid-cols-[300px_1fr_260px]">
        <div className="flex min-w-0 items-center gap-3">
          <div className="group relative shrink-0">
            <button
              type="button"
              onClick={() => {
                if (currentSong) {
                  setArtExpanded((previous) => !previous);
                }
              }}
              className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              title={artPanelOpen ? "Collapse cover art" : "Expand cover art"}
            >
              <CoverArt songId={currentSong?.id} eager className="h-12 w-12 shrink-0 sm:h-14 sm:w-14" />
            </button>
            {currentSong && (
              <button
                type="button"
                title={artExpanded ? "Collapse cover art" : "Expand cover art"}
                onClick={() => setArtExpanded((previous) => !previous)}
                className="absolute -right-1 -top-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-[color:var(--border)] bg-panel text-text opacity-0 transition-all duration-200 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 hover:border-accent/50 hover:text-accent"
              >
                <ArrowUp
                  className={clsx("h-3.5 w-3.5 transition-transform", artPanelOpen && "rotate-180")}
                  strokeWidth={2.4}
                  aria-hidden="true"
                />
                <span className="sr-only">
                  {artPanelOpen ? "Collapse cover art" : "Expand cover art"}
                </span>
              </button>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text">
              {currentSong?.title || "Nothing playing"}
            </p>
            <p className="truncate text-xs text-textSoft">
              {currentSong ? (
                <>
                  <button
                    type="button"
                    onClick={() => navigate(`/artists/${encodeURIComponent(artistName)}`)}
                    className="inline truncate transition-colors hover:text-text hover:underline"
                  >
                    {artistName}
                  </button>
                  <span className="px-1.5">·</span>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/albums/${encodeURIComponent(albumArtistName)}/${encodeURIComponent(
                          albumName
                        )}`
                      )
                    }
                    className="inline truncate transition-colors hover:text-text hover:underline"
                  >
                    {albumName}
                  </button>
                </>
              ) : (
                "Queue a track to start"
              )}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              title="Toggle shuffle (S)"
              onClick={toggleShuffle}
              className={clsx(
                "hidden h-9 items-center justify-center rounded-lg border px-2 text-xs font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 sm:inline-flex",
                shuffle
                  ? "border-accent/40 bg-accent/15 text-text"
                  : "border-[color:var(--border)] text-textSoft hover:border-accent/40 hover:bg-panelSoft/70 hover:text-text"
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                <Shuffle className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
                <span className="sr-only">Shuffle</span>
              </span>
            </button>
            <button
              type="button"
              title="Previous (←)"
              onClick={previous}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--border)] text-textSoft transition hover:border-accent/40 hover:text-text"
            >
              <SkipBack className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
              <span className="sr-only">Previous</span>
            </button>
            <button
              type="button"
              title="Play / Pause (Space)"
              onClick={togglePlayPause}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-accent/50 bg-accent text-shell"
            >
              {isPlaying ? (
                <Pause
                  className="h-4 w-4 translate-y-[1px]"
                  fill="currentColor"
                  stroke="none"
                  aria-hidden="true"
                />
              ) : (
                <Play
                  className="h-4 w-4 translate-y-[1px]"
                  fill="currentColor"
                  stroke="none"
                  aria-hidden="true"
                />
              )}
              <span className="sr-only">{isPlaying ? "Pause" : "Play"}</span>
            </button>
            <button
              type="button"
              title="Next (→)"
              onClick={next}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--border)] text-textSoft transition hover:border-accent/40 hover:text-text"
            >
              <SkipForward className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
              <span className="sr-only">Next</span>
            </button>
            <button
              type="button"
              title="Toggle repeat (L)"
              onClick={cycleRepeat}
              className={clsx(
                "hidden h-9 items-center justify-center rounded-lg border px-2 text-xs font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 sm:inline-flex",
                repeatMode !== "off"
                  ? "border-accent/40 bg-accent/15 text-text"
                  : "border-[color:var(--border)] text-textSoft hover:border-accent/40 hover:bg-panelSoft/70 hover:text-text"
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                {repeatMode === "one" ? (
                  <Repeat1 className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
                ) : (
                  <Repeat className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
                )}
                <span className="sr-only">{repeatLabels[repeatMode]}</span>
              </span>
            </button>
          </div>

          <div className="mx-auto flex w-full max-w-[860px] items-center gap-2 text-xs text-textSoft">
            <span className="w-[46px] shrink-0 text-right tabular-nums">
              {formatDuration(currentTime)}
            </span>
            <button
              type="button"
              className="relative h-6 min-w-0 flex-1"
              onMouseEnter={updateSeekPreviewFromEvent}
              onMouseMove={updateSeekPreviewFromEvent}
              onMouseLeave={() =>
                setSeekPreview((previous) => ({
                  ...previous,
                  visible: false
                }))
              }
              onClick={(event) => {
                const percent = updateSeekPreviewFromEvent(event);
                seek(percent);
              }}
            >
              {seekPreview.visible && duration > 0 && (
                <span
                  className="pointer-events-none absolute -top-7 rounded-full border border-[color:var(--border)] bg-panel px-2 py-0.5 text-[11px] font-semibold text-text shadow-lg shadow-black/20"
                  style={{
                    left: `${seekPreview.percent * 100}%`,
                    transform: "translateX(-50%)"
                  }}
                >
                  {formatDuration(seekPreview.seconds)}
                </span>
              )}

              <span className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 overflow-hidden rounded-full border border-[color:var(--border)] bg-panelSoft">
                <span
                  className="absolute inset-y-0 left-0 bg-textSoft/30"
                  style={{ width: `${Math.max(0, Math.min(bufferedProgress, 1)) * 100}%` }}
                />
                <span
                  className="absolute inset-y-0 left-0 bg-accent"
                  style={{ width: `${Math.max(0, Math.min(progress, 1)) * 100}%` }}
                />
              </span>
            </button>
            <span className="w-[46px] shrink-0 tabular-nums">{formatDuration(duration)}</span>
          </div>
        </div>

        <div className="flex min-w-[220px] shrink-0 items-center justify-end gap-2 text-sm">
          <button
            type="button"
            title="Lyrics"
            disabled={!currentSong}
            onClick={() => {
              setArtExpanded(false);
              setLyricsOpen((previous) => !previous);
            }}
            className={clsx(
              "inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-panel/40 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
              !currentSong &&
                "cursor-not-allowed border-[color:var(--border)] text-textSoft/50",
              currentSong &&
                (lyricsOpen
                  ? "border-accent/70 bg-accent/15 text-text"
                  : "border-[color:var(--border)] text-textSoft hover:border-accent/40 hover:bg-panelSoft/65 hover:text-text")
            )}
          >
            <ScrollText className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
            <span className="sr-only">Lyrics</span>
          </button>
          <button
            type="button"
            title="Mute (M)"
            onClick={toggleMute}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--border)] bg-panel/40 text-textSoft transition hover:border-accent/40 hover:bg-panelSoft/65 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            {muted ? (
              <VolumeX className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
            ) : (
              <Volume2 className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
            )}
            <span className="sr-only">{muted ? "Unmute" : "Mute"}</span>
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={(event) => {
              const nextVolume = Number(event.target.value);
              setVolume(nextVolume);
            }}
            className="volume-slider hidden w-[108px] lg:block"
            style={{
              "--range-progress": `${Math.round((muted ? 0 : volume) * 100)}%`
            }}
          />
          <button
            type="button"
            title="Toggle queue"
            onClick={() => {
              setArtExpanded(false);
              toggleQueueOpen();
            }}
            className={clsx(
              "inline-flex h-9 w-9 items-center justify-center rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
              queueOpen
                ? "border-accent/70 bg-accent/15 text-text"
                : "border-[color:var(--border)] bg-panel/35 text-textSoft hover:border-accent/40 hover:bg-panelSoft/65 hover:text-text"
            )}
          >
            <ListMusic className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
            <span className="sr-only">Queue</span>
          </button>
        </div>
      </div>

      {currentSong && (
        <aside
          className={clsx(
            "pointer-events-none fixed bottom-52 left-1/2 z-50 w-[min(92vw,360px)] -translate-x-1/2 rounded-2xl border border-[color:var(--border)] bg-panel/95 p-4 shadow-2xl shadow-black/35 transition-all duration-300 ease-out sm:bottom-36 md:bottom-24 md:left-6 md:translate-x-0",
            artPanelOpen
              ? "translate-y-0 scale-100 opacity-100 pointer-events-auto"
              : "translate-y-8 scale-95 opacity-0"
          )}
        >
          <CoverArt songId={currentSong.id} eager className="aspect-square w-full" />
          <div className="mt-3">
            <p className="truncate text-base font-semibold text-text">{currentSong.title}</p>
            <p className="truncate text-sm text-textSoft">
              {currentSong.artist || "Unknown Artist"}
            </p>
            <p className="truncate text-xs text-textSoft">{currentSong.album || "Unknown Album"}</p>
          </div>
        </aside>
      )}

      <aside
        className={clsx(
          "pointer-events-none fixed bottom-24 left-1/2 z-50 w-[min(94vw,760px)] -translate-x-1/2 rounded-2xl border border-[color:var(--border)] bg-panel/95 p-4 shadow-2xl shadow-black/40 transition-all duration-300 ease-out md:p-5",
          lyricsOpen && currentSong
            ? "translate-y-0 opacity-100 pointer-events-auto"
            : "translate-y-8 opacity-0"
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[color:var(--border)] pb-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text">Lyrics</p>
            <p className="truncate text-xs text-textSoft">
              {currentSong?.title || "No track selected"}
              {currentSong && ` · ${currentSong.artist || "Unknown Artist"}`}
            </p>
            {isCurrentSongLyricsLoaded && lyricsState.loading && (
              <p className="mt-1 truncate text-[11px] text-textSoft/80">Updating lyrics...</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              title="Refresh lyrics"
              disabled={!currentSong || lyricsState.loading}
              onClick={() => {
                if (currentSong?.id) {
                  loadLyricsForSong(currentSong.id, { refresh: true });
                }
              }}
              className={clsx(
                "rounded-lg border border-[color:var(--border)] p-1.5 text-textSoft transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                !currentSong || lyricsState.loading
                  ? "cursor-not-allowed opacity-50"
                  : "hover:border-accent/40 hover:text-text"
              )}
            >
              <RefreshCw
                className={clsx("h-4 w-4", lyricsState.loading && "animate-spin")}
                strokeWidth={2.2}
                aria-hidden="true"
              />
              <span className="sr-only">Refresh lyrics</span>
            </button>
            <button
              type="button"
              title="Close lyrics"
              onClick={() => setLyricsOpen(false)}
              className="rounded-lg border border-[color:var(--border)] p-1.5 text-textSoft transition hover:border-accent/40 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <X className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
              <span className="sr-only">Close lyrics</span>
            </button>
          </div>
        </div>
        <div
          className={clsx(
            "mt-3 max-h-[52vh] overflow-y-auto pr-1 transition-opacity duration-300",
            isCurrentSongLyricsLoaded && lyricsState.loading ? "opacity-90" : "opacity-100"
          )}
        >
          {renderLyricsBody()}
        </div>
      </aside>
    </footer>
  );
}
