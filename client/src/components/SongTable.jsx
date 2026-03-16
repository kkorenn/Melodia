import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, ChevronUp, Play } from "lucide-react";
import { formatDuration } from "../utils/format";
import { CoverArt } from "./CoverArt";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

const sortableColumns = [
  { key: "title", label: "Title" },
  { key: "artist", label: "Artist" },
  { key: "album", label: "Album" },
  { key: "playCount", label: "Plays" }
];

export function SongTable({
  songs,
  currentSongId,
  sort,
  direction,
  onSortChange,
  onPlaySong,
  onAddToQueue,
  onGoToArtist,
  onGoToAlbum,
  onLoadMore,
  hasMore,
  loadingMore,
  playOnRowClick = false,
  height = "calc(100vh - 250px)"
}) {
  const [contextMenu, setContextMenu] = useState(null);
  const desktopScrollRef = useRef(null);

  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
    };
  }, []);

  const sortLabel = useMemo(() => {
    if (!sort) {
      return "";
    }
    return `${sort} ${direction}`;
  }, [sort, direction]);

  function canTriggerRowPlay(event) {
    if (!playOnRowClick) {
      return false;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return true;
    }

    return !target.closest("button, a, input, select, textarea, [role='button']");
  }

  const rowVirtualizer = useVirtualizer({
    count: songs.length,
    getScrollElement: () => desktopScrollRef.current,
    estimateSize: () => 57,
    overscan: 12
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
      : 0;

  useEffect(() => {
    if (!hasMore || loadingMore || !onLoadMore || !virtualRows.length) {
      return;
    }

    const lastVirtualRow = virtualRows[virtualRows.length - 1];
    if (lastVirtualRow.index >= songs.length - 8) {
      onLoadMore();
    }
  }, [hasMore, loadingMore, onLoadMore, songs.length, virtualRows]);

  if (!songs.length) {
    return (
      <Card className="p-10 text-center text-sm text-textSoft">
        No songs found yet. Run a library scan or check your root music folder path.
      </Card>
    );
  }

  return (
    <div className="relative">
      <div className="space-y-2 md:hidden">
        {songs.map((song, index) => {
          const isCurrent = currentSongId === song.id;
          return (
            <article
              key={song.id}
              className={clsx(
                "rounded-xl border p-2.5 transition",
                playOnRowClick &&
                  "cursor-pointer hover:border-accent/40 hover:bg-panelSoft/80 active:scale-[0.995]",
                isCurrent
                  ? "border-accent/35 bg-accent/10"
                  : "border-[color:var(--border)] bg-panel"
              )}
              onClick={(event) => {
                if (canTriggerRowPlay(event)) {
                  onPlaySong?.(song, index, songs);
                }
              }}
            >
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => onPlaySong?.(song, index, songs)}
                  className="shrink-0"
                >
                  <CoverArt songId={song.id} className="h-12 w-12" />
                </button>

                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => onPlaySong?.(song, index, songs)}
                    className="block w-full truncate text-left text-sm font-semibold text-text"
                  >
                    {song.title || song.filename}
                  </button>
                  <button
                    type="button"
                    onClick={() => onGoToArtist?.(song.artist || "Unknown Artist")}
                    className="block truncate text-left text-xs text-textSoft"
                  >
                    {song.artist || "Unknown Artist"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onGoToAlbum?.(
                        song.album || "Unknown Album",
                        song.albumArtist || song.artist || "Unknown Artist"
                      )
                    }
                    className="block truncate text-left text-xs text-textSoft/90"
                  >
                    {song.album || "Unknown Album"}
                  </button>
                </div>

                <span className="shrink-0 text-xs tabular-nums text-textSoft">
                  {formatDuration(song.duration)}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {playOnRowClick && (
                  <span className="mr-1 text-[11px] text-textSoft/80">Tap row to play</span>
                )}
                {!playOnRowClick && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onPlaySong?.(song, index, songs)}
                    className="h-7"
                  >
                    Play
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onAddToQueue?.(song, "next")}
                  className="h-7"
                >
                  Next
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onAddToQueue?.(song, "end")}
                  className="h-7"
                >
                  Queue
                </Button>
              </div>
            </article>
          );
        })}

        {hasMore && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => onLoadMore?.()}
            disabled={loadingMore}
            className="w-full"
          >
            {loadingMore ? "Loading more..." : "Load more songs"}
          </Button>
        )}
      </div>

      <div className="hidden md:block">
        <div className="w-full">
          <Card
            ref={desktopScrollRef}
            className="overflow-auto rounded-2xl"
            style={{ height }}
          >
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-panel">
                <tr className="border-b border-[color:var(--border)] text-xs font-medium text-textSoft">
                  <th className="w-10 px-3 py-2 text-left">#</th>
                  <th className="w-[54px] px-3 py-2 text-left">Art</th>
                  {sortableColumns.map((column) => (
                    <th key={column.key} className="px-3 py-2 text-left">
                      <button
                        type="button"
                        onClick={() => {
                          if (!onSortChange) {
                            return;
                          }
                          const nextDirection =
                            sort === column.key && direction === "asc" ? "desc" : "asc";
                          onSortChange(column.key, nextDirection);
                        }}
                        className="inline-flex items-center gap-1 transition hover:text-text"
                        title={`Sort by ${column.label}`}
                      >
                        <span>{column.label}</span>
                        {sort === column.key &&
                          (direction === "asc" ? (
                            <ChevronUp className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
                          ))}
                      </button>
                    </th>
                  ))}
                  <th className="w-16 px-3 py-2 text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {paddingTop > 0 && (
                  <tr>
                    <td colSpan={7} style={{ height: paddingTop }} />
                  </tr>
                )}

                {virtualRows.map((virtualRow) => {
                  const song = songs[virtualRow.index];
                  const index = virtualRow.index;
                  if (!song) {
                    return null;
                  }
                  const isCurrent = currentSongId === song.id;

                  return (
                    <Fragment key={`${song.id}-${index}`}>
                      <tr
                        className={clsx(
                          "group border-b border-[color:var(--border)] align-middle",
                          isCurrent
                            ? "bg-accent/15"
                            : playOnRowClick
                              ? "cursor-pointer hover:bg-panelSoft/95"
                              : "hover:bg-panelSoft/80"
                        )}
                        onClick={(event) => {
                          if (canTriggerRowPlay(event)) {
                            onPlaySong?.(song, index, songs);
                          }
                        }}
                        onDoubleClick={() => onPlaySong?.(song, index, songs)}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          setContextMenu({
                            x: event.clientX,
                            y: event.clientY,
                            song,
                            index
                          });
                        }}
                      >
                        <td className="px-3 py-2 text-textSoft">
                          {playOnRowClick ? (
                            index + 1
                          ) : (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 rounded-full border border-accent/30 bg-accent/15 text-text hover:bg-accent/25"
                              onClick={(event) => {
                                event.stopPropagation();
                                onPlaySong?.(song, index, songs);
                              }}
                            >
                              <Play
                                className="h-3.5 w-3.5"
                                fill="currentColor"
                                stroke="none"
                                aria-hidden="true"
                              />
                              <span className="sr-only">Play song</span>
                            </Button>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <CoverArt songId={song.id} className="h-10 w-10" />
                        </td>
                        <td className="px-3 py-2 font-medium text-text">
                          <div className="max-w-[440px] truncate">{song.title || song.filename}</div>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onGoToArtist?.(song.artist || "Unknown Artist");
                            }}
                            className="max-w-[260px] truncate text-left text-textSoft transition hover:text-text"
                          >
                            {song.artist || "Unknown Artist"}
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onGoToAlbum?.(
                                song.album || "Unknown Album",
                                song.albumArtist || song.artist || "Unknown Artist"
                              );
                            }}
                            className="max-w-[300px] truncate text-left text-textSoft transition hover:text-text"
                          >
                            {song.album || "Unknown Album"}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-right text-textSoft">{song.playCount || 0}</td>
                        <td className="px-3 py-2 text-right text-textSoft">
                          {formatDuration(song.duration)}
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}

                {paddingBottom > 0 && (
                  <tr>
                    <td colSpan={7} style={{ height: paddingBottom }} />
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </div>
      </div>

      {loadingMore && <p className="mt-2 text-right text-xs text-textSoft">Loading more songs...</p>}

      {!loadingMore && hasMore && (
        <p className="mt-2 text-right text-xs text-textSoft">Scroll to load more · {sortLabel}</p>
      )}

      {contextMenu && (
        <Card
          className="fixed z-50 w-52 rounded-xl p-1.5 shadow-2xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start"
            onClick={() => {
              onPlaySong?.(contextMenu.song, contextMenu.index, songs);
              setContextMenu(null);
            }}
          >
            Play Now
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start"
            onClick={() => {
              onAddToQueue?.(contextMenu.song, "next");
              setContextMenu(null);
            }}
          >
            Play Next
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start"
            onClick={() => {
              onAddToQueue?.(contextMenu.song, "end");
              setContextMenu(null);
            }}
          >
            Add to Queue
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start"
            onClick={() => {
              onGoToArtist?.(contextMenu.song.artist || "Unknown Artist");
              setContextMenu(null);
            }}
          >
            Go to Artist
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start"
            onClick={() => {
              onGoToAlbum?.(
                contextMenu.song.album || "Unknown Album",
                contextMenu.song.albumArtist ||
                  contextMenu.song.artist ||
                  "Unknown Artist"
              );
              setContextMenu(null);
            }}
          >
            Go to Album
          </Button>
        </Card>
      )}
    </div>
  );
}
