import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createIndexArray(length) {
  return Array.from({ length }, (_, index) => index);
}

function arraysEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function shuffleArray(values) {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function buildShuffleOrder(queueLength, currentIndex = -1) {
  if (queueLength <= 0) {
    return [];
  }

  if (queueLength === 1) {
    return [0];
  }

  const indices = createIndexArray(queueLength);

  if (currentIndex < 0 || currentIndex >= queueLength) {
    return shuffleArray(indices);
  }

  const rest = indices.filter((index) => index !== currentIndex);
  return [currentIndex, ...shuffleArray(rest)];
}

function buildDistinctShuffleOrder(queueLength, currentIndex, avoidOrders = []) {
  const normalizedAvoid = avoidOrders
    .filter((order) => Array.isArray(order))
    .map((order) => sanitizeShuffleOrder(order, queueLength));

  let candidate = buildShuffleOrder(queueLength, currentIndex);
  let attempt = 0;

  while (
    attempt < 10 &&
    normalizedAvoid.some((order) => arraysEqual(order, candidate))
  ) {
    candidate = buildShuffleOrder(queueLength, currentIndex);
    attempt += 1;
  }

  if (!normalizedAvoid.some((order) => arraysEqual(order, candidate))) {
    return candidate;
  }

  if (candidate.length > 2) {
    const [head, firstTail, secondTail, ...restTail] = candidate;
    const fallback = [head, secondTail, firstTail, ...restTail];
    if (!normalizedAvoid.some((order) => arraysEqual(order, fallback))) {
      return fallback;
    }
  }

  return candidate;
}

function sanitizeShuffleOrder(order, queueLength) {
  if (queueLength <= 0) {
    return [];
  }

  const seen = new Set();
  const safe = [];

  if (Array.isArray(order)) {
    for (const value of order) {
      const index = Number(value);
      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= queueLength ||
        seen.has(index)
      ) {
        continue;
      }
      seen.add(index);
      safe.push(index);
    }
  }

  for (let index = 0; index < queueLength; index += 1) {
    if (!seen.has(index)) {
      safe.push(index);
    }
  }

  return safe;
}

function getShuffleContext(state) {
  const queueLength = state.queue.length;
  if (
    !queueLength ||
    state.currentIndex < 0 ||
    state.currentIndex >= queueLength
  ) {
    return {
      order: [],
      pointer: -1
    };
  }

  const safeOrder = sanitizeShuffleOrder(state.shuffleOrder, queueLength);
  const pointer = safeOrder.indexOf(state.currentIndex);

  if (pointer >= 0) {
    return {
      order: safeOrder,
      pointer
    };
  }

  return {
    order: buildShuffleOrder(queueLength, state.currentIndex),
    pointer: 0
  };
}

function getNextResult(state) {
  const { queue, currentIndex, shuffle, repeatMode } = state;
  if (!queue.length || currentIndex < 0) {
    return { index: -1 };
  }

  if (repeatMode === "one") {
    if (shuffle) {
      const { order, pointer } = getShuffleContext(state);
      return {
        index: currentIndex,
        order,
        pointer
      };
    }

    return { index: currentIndex };
  }

  if (shuffle) {
    const { order, pointer } = getShuffleContext(state);
    const nextPointer = pointer + 1;

    if (nextPointer < order.length) {
      return {
        index: order[nextPointer],
        order,
        pointer: nextPointer
      };
    }

    if (repeatMode === "all") {
      return {
        index: order[0] ?? -1,
        order,
        pointer: 0
      };
    }

    return {
      index: -1,
      order,
      pointer
    };
  }

  const sequential = currentIndex + 1;
  if (sequential < queue.length) {
    return { index: sequential };
  }

  return {
    index: repeatMode === "all" ? 0 : -1
  };
}

function getPreviousResult(state) {
  const { queue, currentIndex, shuffle, repeatMode } = state;
  if (!queue.length || currentIndex < 0) {
    return { index: -1 };
  }

  if (repeatMode === "one") {
    if (shuffle) {
      const { order, pointer } = getShuffleContext(state);
      return {
        index: currentIndex,
        order,
        pointer
      };
    }

    return { index: currentIndex };
  }

  if (shuffle) {
    const { order, pointer } = getShuffleContext(state);
    const previousPointer = pointer - 1;

    if (previousPointer >= 0) {
      return {
        index: order[previousPointer],
        order,
        pointer: previousPointer
      };
    }

    if (repeatMode === "all") {
      return {
        index: order[order.length - 1] ?? -1,
        order,
        pointer: Math.max(order.length - 1, 0)
      };
    }

    return {
      index: -1,
      order,
      pointer
    };
  }

  const sequential = currentIndex - 1;
  if (sequential >= 0) {
    return { index: sequential };
  }

  return {
    index: repeatMode === "all" ? queue.length - 1 : -1
  };
}

export const usePlayerStore = create(
  persist(
    (set, get) => ({
      queue: [],
      currentIndex: -1,
      isPlaying: false,
      shuffle: false,
      shuffleOrder: [],
      shufflePointer: -1,
      repeatMode: "off",
      volume: 0.9,
      muted: false,
      queueOpen: false,
      lastActionAt: Date.now(),
      lastShuffleOrder: [],

      setQueue: (songs, startIndex = 0, autoplay = true) =>
        set((state) => {
          const safeIndex = songs.length
            ? clamp(startIndex, 0, songs.length - 1)
            : -1;

          const shuffleOrder = state.shuffle
            ? buildShuffleOrder(songs.length, safeIndex)
            : [];
          const shufflePointer = state.shuffle
            ? shuffleOrder.indexOf(safeIndex)
            : -1;

          return {
            queue: songs,
            currentIndex: safeIndex,
            isPlaying: autoplay && safeIndex >= 0,
            shuffleOrder,
            shufflePointer,
            lastActionAt: Date.now()
          };
        }),

      setCurrentIndex: (index, autoplay = true) =>
        set((state) => {
          if (!state.queue.length) {
            return state;
          }

          if (index < 0 || index >= state.queue.length) {
            return state;
          }

          const shuffleContext = state.shuffle
            ? getShuffleContext({ ...state, currentIndex: index })
            : null;

          return {
            currentIndex: index,
            isPlaying: autoplay,
            shuffleOrder: shuffleContext ? shuffleContext.order : [],
            shufflePointer: shuffleContext ? shuffleContext.pointer : -1,
            lastActionAt: Date.now()
          };
        }),

      setIsPlaying: (isPlaying) => set(() => ({ isPlaying })),
      togglePlayPause: () =>
        set((state) => ({ isPlaying: !state.isPlaying, lastActionAt: Date.now() })),

      next: () =>
        set((state) => {
          const result = getNextResult(state);
          const nextIndex = result.index;

          if (nextIndex === -1) {
            return {
              isPlaying: false,
              shuffleOrder: state.shuffle ? result.order : state.shuffleOrder,
              shufflePointer: state.shuffle ? result.pointer : state.shufflePointer,
              lastActionAt: Date.now()
            };
          }

          return {
            currentIndex: nextIndex,
            isPlaying: true,
            shuffleOrder: state.shuffle ? result.order : state.shuffleOrder,
            shufflePointer: state.shuffle ? result.pointer : state.shufflePointer,
            lastActionAt: Date.now()
          };
        }),

      previous: () =>
        set((state) => {
          const result = getPreviousResult(state);
          const prevIndex = result.index;

          if (prevIndex === -1) {
            return state;
          }

          return {
            currentIndex: prevIndex,
            isPlaying: true,
            shuffleOrder: state.shuffle ? result.order : state.shuffleOrder,
            shufflePointer: state.shuffle ? result.pointer : state.shufflePointer,
            lastActionAt: Date.now()
          };
        }),

      addToQueue: (song, mode = "end") =>
        set((state) => {
          const queue = [...state.queue];

          if (mode === "next" && state.currentIndex >= 0) {
            queue.splice(state.currentIndex + 1, 0, song);
          } else {
            queue.push(song);
          }

          const shouldStart = state.currentIndex === -1 && queue.length > 0;
          const nextCurrentIndex = shouldStart ? 0 : state.currentIndex;
          const shuffleOrder = state.shuffle
            ? buildShuffleOrder(queue.length, nextCurrentIndex)
            : [];
          const shufflePointer = state.shuffle
            ? shuffleOrder.indexOf(nextCurrentIndex)
            : -1;

          return {
            queue,
            currentIndex: nextCurrentIndex,
            isPlaying: shouldStart ? true : state.isPlaying,
            shuffleOrder,
            shufflePointer,
            lastActionAt: Date.now()
          };
        }),

      removeFromQueue: (index) =>
        set((state) => {
          if (index < 0 || index >= state.queue.length) {
            return state;
          }

          const queue = [...state.queue];
          queue.splice(index, 1);

          let currentIndex = state.currentIndex;
          if (index < currentIndex) {
            currentIndex -= 1;
          } else if (index === currentIndex) {
            currentIndex = queue.length ? Math.min(index, queue.length - 1) : -1;
          }

          const shuffleOrder = state.shuffle
            ? buildShuffleOrder(queue.length, currentIndex)
            : [];
          const shufflePointer = state.shuffle
            ? shuffleOrder.indexOf(currentIndex)
            : -1;

          return {
            queue,
            currentIndex,
            isPlaying: queue.length ? state.isPlaying : false,
            shuffleOrder,
            shufflePointer,
            lastActionAt: Date.now()
          };
        }),

      reorderQueue: (fromIndex, toIndex) =>
        set((state) => {
          if (
            fromIndex < 0 ||
            toIndex < 0 ||
            fromIndex >= state.queue.length ||
            toIndex >= state.queue.length ||
            fromIndex === toIndex
          ) {
            return state;
          }

          const queue = [...state.queue];
          const [moved] = queue.splice(fromIndex, 1);
          queue.splice(toIndex, 0, moved);

          let currentIndex = state.currentIndex;
          if (state.currentIndex === fromIndex) {
            currentIndex = toIndex;
          } else if (fromIndex < state.currentIndex && toIndex >= state.currentIndex) {
            currentIndex -= 1;
          } else if (fromIndex > state.currentIndex && toIndex <= state.currentIndex) {
            currentIndex += 1;
          }

          const shuffleOrder = state.shuffle
            ? buildShuffleOrder(queue.length, currentIndex)
            : [];
          const shufflePointer = state.shuffle
            ? shuffleOrder.indexOf(currentIndex)
            : -1;

          return {
            queue,
            currentIndex,
            shuffleOrder,
            shufflePointer,
            lastActionAt: Date.now()
          };
        }),

      clearQueue: () =>
        set(() => ({
          queue: [],
          currentIndex: -1,
          isPlaying: false,
          shuffleOrder: [],
          shufflePointer: -1,
          lastActionAt: Date.now()
        })),

      setVolume: (volume) =>
        set(() => ({ volume: clamp(volume, 0, 1), muted: volume === 0 })),
      setMuted: (muted) => set(() => ({ muted })),
      toggleMute: () => set((state) => ({ muted: !state.muted })),
      toggleShuffle: () =>
        set((state) => {
          const nextShuffle = !state.shuffle;
          const currentDisplayOrder = getQueueDisplayOrder({
            ...state,
            shuffle: false
          });
          const shuffleOrder = nextShuffle
            ? buildDistinctShuffleOrder(state.queue.length, state.currentIndex, [
                state.lastShuffleOrder,
                currentDisplayOrder
              ])
            : [];
          const shufflePointer = nextShuffle
            ? shuffleOrder.indexOf(state.currentIndex)
            : -1;

          return {
            shuffle: nextShuffle,
            shuffleOrder,
            shufflePointer,
            lastShuffleOrder: nextShuffle
              ? shuffleOrder
              : sanitizeShuffleOrder(state.shuffleOrder, state.queue.length),
            lastActionAt: Date.now()
          };
        }),
      cycleRepeat: () =>
        set((state) => {
          const nextMode =
            state.repeatMode === "off"
              ? "all"
              : state.repeatMode === "all"
                ? "one"
                : "off";
          return { repeatMode: nextMode };
        }),

      setQueueOpen: (open) => set(() => ({ queueOpen: Boolean(open) })),
      toggleQueueOpen: () => set((state) => ({ queueOpen: !state.queueOpen }))
    }),
    {
      name: "melodia-player",
      storage: createJSONStorage(() => localStorage),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState || {}),
        queueOpen: false
      }),
      partialize: (state) => ({
        queue: state.queue,
        currentIndex: state.currentIndex,
        shuffle: state.shuffle,
        shuffleOrder: state.shuffleOrder,
        shufflePointer: state.shufflePointer,
        repeatMode: state.repeatMode,
        volume: state.volume,
        muted: state.muted,
        lastShuffleOrder: state.lastShuffleOrder
      })
    }
  )
);

export function selectCurrentSong(state) {
  if (state.currentIndex < 0 || state.currentIndex >= state.queue.length) {
    return null;
  }
  return state.queue[state.currentIndex];
}

export function predictNextIndex(state) {
  return getNextResult(state).index;
}

export function getQueueDisplayOrder(state) {
  if (!state.queue.length) {
    return [];
  }

  if (!state.shuffle) {
    return createIndexArray(state.queue.length);
  }

  if (state.currentIndex < 0 || state.currentIndex >= state.queue.length) {
    return sanitizeShuffleOrder(state.shuffleOrder, state.queue.length);
  }

  const { order, pointer } = getShuffleContext(state);
  if (!order.length || pointer < 0) {
    return order;
  }

  return [...order.slice(pointer), ...order.slice(0, pointer)];
}
