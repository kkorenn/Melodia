import { useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { markSongPlayed, streamUrl } from "../lib/api";
import {
  selectCurrentSong,
  usePlayerStore,
  predictNextIndex
} from "../store/playerStore";

function getBufferedEnd(audio) {
  if (!audio || !audio.buffered || audio.buffered.length === 0) {
    return 0;
  }
  return audio.buffered.end(audio.buffered.length - 1);
}

function isEditableTarget(target) {
  if (!target) {
    return false;
  }

  const tagName = target.tagName?.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select"
  );
}

export function useAudioEngine() {
  const {
    queue,
    currentIndex,
    isPlaying,
    volume,
    muted,
    shuffle,
    repeatMode,
    setIsPlaying,
    setCurrentIndex,
    previous,
    togglePlayPause,
    toggleMute,
    toggleShuffle,
    cycleRepeat
  } = usePlayerStore(
    useShallow((state) => ({
      queue: state.queue,
      currentIndex: state.currentIndex,
      isPlaying: state.isPlaying,
      volume: state.volume,
      muted: state.muted,
      shuffle: state.shuffle,
      repeatMode: state.repeatMode,
      setIsPlaying: state.setIsPlaying,
      setCurrentIndex: state.setCurrentIndex,
      previous: state.previous,
      togglePlayPause: state.togglePlayPause,
      toggleMute: state.toggleMute,
      toggleShuffle: state.toggleShuffle,
      cycleRepeat: state.cycleRepeat
    }))
  );

  const currentSong = useMemo(
    () => selectCurrentSong({ queue, currentIndex }),
    [queue, currentIndex]
  );

  const activeAudioRef = useRef(null);
  const preloadAudioRef = useRef(null);
  const preloadedSongIdRef = useRef(null);
  const playedSongIdRef = useRef(null);

  const [position, setPosition] = useState({
    currentTime: 0,
    duration: 0,
    buffered: 0
  });

  function syncAudioState() {
    const active = activeAudioRef.current;
    if (!active) {
      return;
    }

    setPosition({
      currentTime: Number.isFinite(active.currentTime) ? active.currentTime : 0,
      duration: Number.isFinite(active.duration) ? active.duration : 0,
      buffered: getBufferedEnd(active)
    });
  }

  function moveToNextSong() {
    const state = usePlayerStore.getState();
    const nextIndex = predictNextIndex(state);

    if (nextIndex === -1) {
      state.setIsPlaying(false);
      return;
    }

    if (nextIndex === state.currentIndex) {
      const active = activeAudioRef.current;
      if (active) {
        active.currentTime = 0;
        active.play().catch(() => {
          state.setIsPlaying(false);
        });
      }
      return;
    }

    state.setCurrentIndex(nextIndex, true);
  }

  function maybeSwapToPreloadedSong(songId) {
    if (preloadedSongIdRef.current !== songId) {
      return false;
    }

    const active = activeAudioRef.current;
    const standby = preloadAudioRef.current;

    if (!active || !standby) {
      return false;
    }

    activeAudioRef.current = standby;
    preloadAudioRef.current = active;

    preloadAudioRef.current.pause();
    preloadAudioRef.current.removeAttribute("src");
    preloadAudioRef.current.load();

    return true;
  }

  useEffect(() => {
    const primary = new Audio();
    const standby = new Audio();

    primary.preload = "auto";
    standby.preload = "auto";

    activeAudioRef.current = primary;
    preloadAudioRef.current = standby;

    const audios = [primary, standby];

    const onTimeUpdate = (event) => {
      if (event.currentTarget !== activeAudioRef.current) {
        return;
      }
      syncAudioState();
    };

    const onLoadedMetadata = (event) => {
      if (event.currentTarget !== activeAudioRef.current) {
        return;
      }
      syncAudioState();
    };

    const onProgress = (event) => {
      if (event.currentTarget !== activeAudioRef.current) {
        return;
      }
      syncAudioState();
    };

    const onPlay = (event) => {
      if (event.currentTarget !== activeAudioRef.current) {
        return;
      }
      usePlayerStore.getState().setIsPlaying(true);
    };

    const onPause = (event) => {
      if (event.currentTarget !== activeAudioRef.current) {
        return;
      }
      usePlayerStore.getState().setIsPlaying(false);
    };

    const onEnded = (event) => {
      if (event.currentTarget !== activeAudioRef.current) {
        return;
      }
      moveToNextSong();
    };

    const onError = (event) => {
      if (event.currentTarget !== activeAudioRef.current) {
        return;
      }
      console.error("Audio playback error", event.currentTarget.error);
      moveToNextSong();
    };

    for (const audio of audios) {
      audio.addEventListener("timeupdate", onTimeUpdate);
      audio.addEventListener("loadedmetadata", onLoadedMetadata);
      audio.addEventListener("progress", onProgress);
      audio.addEventListener("play", onPlay);
      audio.addEventListener("pause", onPause);
      audio.addEventListener("ended", onEnded);
      audio.addEventListener("error", onError);
    }

    return () => {
      for (const audio of audios) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
        audio.removeEventListener("timeupdate", onTimeUpdate);
        audio.removeEventListener("loadedmetadata", onLoadedMetadata);
        audio.removeEventListener("progress", onProgress);
        audio.removeEventListener("play", onPlay);
        audio.removeEventListener("pause", onPause);
        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("error", onError);
      }
    };
  }, []);

  useEffect(() => {
    const active = activeAudioRef.current;
    const standby = preloadAudioRef.current;

    if (!active || !standby) {
      return;
    }

    active.volume = volume;
    standby.volume = volume;
    active.muted = muted;
    standby.muted = muted;
  }, [volume, muted]);

  useEffect(() => {
    const active = activeAudioRef.current;
    if (!active) {
      return;
    }

    if (!currentSong) {
      active.pause();
      active.removeAttribute("src");
      active.load();
      preloadedSongIdRef.current = null;
      setPosition({ currentTime: 0, duration: 0, buffered: 0 });
      return;
    }

    const swapped = maybeSwapToPreloadedSong(currentSong.id);

    if (!swapped) {
      const activeAudio = activeAudioRef.current;
      const nextUrl = streamUrl(currentSong.id);
      if (!activeAudio.src.includes(`/api/stream/${currentSong.id}`)) {
        activeAudio.pause();
        activeAudio.src = nextUrl;
        activeAudio.preload = "auto";
        activeAudio.load();
      }
    }

    if (playedSongIdRef.current !== currentSong.id) {
      playedSongIdRef.current = currentSong.id;
      markSongPlayed(currentSong.id).catch(() => {
        // no-op: playback should continue even if analytics fails
      });
    }

    const state = usePlayerStore.getState();
    const nextIndex = predictNextIndex(state);
    const nextSong = nextIndex >= 0 ? state.queue[nextIndex] : null;
    const standbyAudio = preloadAudioRef.current;

    if (nextSong) {
      const nextUrl = streamUrl(nextSong.id);
      if (!standbyAudio.src.includes(`/api/stream/${nextSong.id}`)) {
        standbyAudio.src = nextUrl;
        standbyAudio.preload = "auto";
        standbyAudio.load();
      }
      preloadedSongIdRef.current = nextSong.id;
    } else {
      standbyAudio.pause();
      standbyAudio.removeAttribute("src");
      standbyAudio.load();
      preloadedSongIdRef.current = null;
    }

    if (isPlaying) {
      activeAudioRef.current.play().catch(() => {
        setIsPlaying(false);
      });
    } else {
      activeAudioRef.current.pause();
    }

    syncAudioState();
  }, [currentSong?.id, currentIndex, queue, isPlaying, setIsPlaying, shuffle, repeatMode]);

  useEffect(() => {
    const active = activeAudioRef.current;
    if (!active || !currentSong) {
      return;
    }

    if (isPlaying) {
      active.play().catch(() => {
        setIsPlaying(false);
      });
    } else {
      active.pause();
    }
  }, [isPlaying, currentSong?.id, setIsPlaying]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        togglePlayPause();
        return;
      }

      if (event.code === "ArrowRight") {
        event.preventDefault();
        const state = usePlayerStore.getState();
        const nextIndex = predictNextIndex(state);
        if (nextIndex >= 0) {
          setCurrentIndex(nextIndex, true);
        }
        return;
      }

      if (event.code === "ArrowLeft") {
        event.preventDefault();
        previous();
        return;
      }

      if (event.key.toLowerCase() === "m") {
        event.preventDefault();
        toggleMute();
        return;
      }

      if (event.key.toLowerCase() === "l") {
        event.preventDefault();
        cycleRepeat();
        return;
      }

      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        toggleShuffle();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    setCurrentIndex,
    previous,
    togglePlayPause,
    toggleMute,
    cycleRepeat,
    toggleShuffle
  ]);

  const seek = (percent) => {
    const active = activeAudioRef.current;
    if (!active || !Number.isFinite(active.duration) || active.duration <= 0) {
      return;
    }

    const safePercent = Math.max(0, Math.min(1, percent));
    active.currentTime = active.duration * safePercent;
    syncAudioState();
  };

  return {
    currentSong,
    currentTime: position.currentTime,
    duration: position.duration,
    buffered: position.buffered,
    seek,
    next: moveToNextSong
  };
}
