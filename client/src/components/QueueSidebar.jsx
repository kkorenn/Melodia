import { useLayoutEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { ListMusic, Shuffle, X } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { getQueueDisplayOrder, usePlayerStore } from "../store/playerStore";
import { CoverArt } from "./CoverArt";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

export function QueueSidebar() {
  const {
    queue,
    currentIndex,
    shuffle,
    shuffleOrder,
    shufflePointer,
    queueOpen,
    setQueueOpen,
    setCurrentIndex,
    reorderQueue,
    removeFromQueue,
    clearQueue
  } = usePlayerStore(
    useShallow((state) => ({
      queue: state.queue,
      currentIndex: state.currentIndex,
      shuffle: state.shuffle,
      shuffleOrder: state.shuffleOrder,
      shufflePointer: state.shufflePointer,
      queueOpen: state.queueOpen,
      setQueueOpen: state.setQueueOpen,
      setCurrentIndex: state.setCurrentIndex,
      reorderQueue: state.reorderQueue,
      removeFromQueue: state.removeFromQueue,
      clearQueue: state.clearQueue
    }))
  );

  const [dragIndex, setDragIndex] = useState(null);
  const itemRefs = useRef(new Map());
  const previousTopByIndexRef = useRef(new Map());
  const hasMeasuredRef = useRef(false);

  const queueOrder = useMemo(() => {
    return getQueueDisplayOrder({
      queue,
      currentIndex,
      shuffle,
      shuffleOrder,
      shufflePointer
    });
  }, [queue, currentIndex, shuffle, shuffleOrder, shufflePointer]);

  const orderSignature = useMemo(() => queueOrder.join(","), [queueOrder]);

  useLayoutEffect(() => {
    const nextTopByIndex = new Map();
    for (const queueIndex of queueOrder) {
      const node = itemRefs.current.get(queueIndex);
      if (!node) {
        continue;
      }
      nextTopByIndex.set(queueIndex, node.getBoundingClientRect().top);
    }

    if (queueOpen && hasMeasuredRef.current) {
      for (const queueIndex of queueOrder) {
        const node = itemRefs.current.get(queueIndex);
        const previousTop = previousTopByIndexRef.current.get(queueIndex);
        const nextTop = nextTopByIndex.get(queueIndex);
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

    previousTopByIndexRef.current = nextTopByIndex;
    hasMeasuredRef.current = true;
  }, [orderSignature, queue.length, queueOpen, queueOrder]);

  return (
    <>
      {queueOpen && (
        <button
          type="button"
          aria-label="Close queue"
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setQueueOpen(false)}
        />
      )}

      <aside
        className={clsx(
          "z-30 flex flex-col overflow-hidden bg-panel transition-all duration-300 ease-out will-change-transform",
          "fixed inset-x-3 bottom-24 top-24 rounded-2xl border border-[color:var(--border)] shadow-xl shadow-black/20",
          "lg:relative lg:inset-auto lg:h-full lg:rounded-none lg:shadow-none",
          queueOpen
            ? "translate-y-0 scale-100 opacity-100 lg:w-80 lg:translate-x-0 lg:scale-100 lg:border-l lg:border-[color:var(--border)]"
            : "pointer-events-none translate-y-8 scale-95 opacity-0 lg:w-0 lg:translate-y-0 lg:scale-100 lg:opacity-0 lg:border-0"
        )}
      >
        <div className="flex items-center justify-between border-b border-[color:var(--border)] px-4 py-3">
          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-text">
              <ListMusic className="h-4 w-4 text-accent" strokeWidth={2.2} aria-hidden="true" />
              <span>Queue</span>
            </h3>
            <div className="mt-1">
              {shuffle ? (
                <Badge variant="default" className="gap-1">
                  <Shuffle className="h-3 w-3" strokeWidth={2.2} aria-hidden="true" />
                  Shuffled
                </Badge>
              ) : (
                <p className="text-xs text-textSoft">Drag to reorder</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => clearQueue()}
            >
              Clear
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setQueueOpen(false)}
              className="lg:hidden"
            >
              Close
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {!queue.length && (
            <p className="p-4 text-sm text-textSoft">Queue is empty. Add songs from the library.</p>
          )}

          {queueOrder.map((queueIndex) => {
            const song = queue[queueIndex];
            if (!song) {
              return null;
            }

            return (
              <div
                key={`${song.id}-${queueIndex}`}
                draggable={!shuffle}
                ref={(node) => {
                  if (node) {
                    itemRefs.current.set(queueIndex, node);
                  } else {
                    itemRefs.current.delete(queueIndex);
                  }
                }}
                onDragStart={() => {
                  if (!shuffle) {
                    setDragIndex(queueIndex);
                  }
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (shuffle || dragIndex === null) {
                    return;
                  }
                  reorderQueue(dragIndex, queueIndex);
                  setDragIndex(null);
                }}
                onDragEnd={() => setDragIndex(null)}
                className={clsx(
                  "mb-1 flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-colors duration-200",
                  currentIndex === queueIndex
                    ? "border-accent/40 bg-accent/10"
                    : "border-transparent hover:border-[color:var(--border)] hover:bg-panelSoft/80"
                )}
              >
                <button
                  type="button"
                  onClick={() => setCurrentIndex(queueIndex, true)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  <CoverArt songId={song.id} className="h-11 w-11 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">{song.title || song.filename}</p>
                    <p className="truncate text-xs text-textSoft">{song.artist || "Unknown Artist"}</p>
                  </div>
                </button>
                <button
                  type="button"
                  className="rounded p-1 text-xs text-textSoft hover:bg-panelSoft hover:text-text"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeFromQueue(queueIndex);
                  }}
                >
                  <X className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
                  <span className="sr-only">Remove from queue</span>
                </button>
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}
