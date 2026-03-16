import { CoverArt } from "./CoverArt";
import { formatDuration } from "../utils/format";
import clsx from "clsx";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";

export function SongGrid({
  songs,
  onPlaySong,
  onGoToArtist,
  onGoToAlbum,
  gridSize = "large",
  onLoadMore,
  hasMore = false,
  loadingMore = false
}) {
  if (!songs.length) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div
        className={clsx(
          "grid",
          gridSize === "small"
            ? "grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
            : "grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        )}
      >
        {songs.map((song, index) => (
          <Card className="group overflow-hidden transition hover:border-accent/40">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onPlaySong?.(song, index, songs)}
              className="h-auto w-full rounded-none p-0"
            >
              <CoverArt songId={song.id} frame={false} className="aspect-square w-full" />
            </Button>

            <CardContent className={clsx("pt-2", gridSize === "small" ? "p-2.5" : "p-3")}>
              <button
                type="button"
                onClick={() => onPlaySong?.(song, index, songs)}
                className={clsx(
                  "block w-full truncate bg-transparent p-0 text-left font-semibold text-text transition hover:text-accent focus-visible:outline-none",
                  gridSize === "small" ? "text-xs" : "text-sm"
                )}
              >
                {song.title || song.filename}
              </button>

              <div className="mt-1 flex items-center gap-2">
                <button
                  type="button"
                  className={clsx(
                    "min-w-0 flex-1 truncate bg-transparent p-0 text-left text-textSoft transition hover:text-text focus-visible:outline-none",
                    gridSize === "small" ? "text-[11px]" : "text-xs"
                  )}
                  onClick={() => onGoToArtist?.(song.artist || "Unknown Artist")}
                >
                  {song.artist || "Unknown Artist"}
                </button>
                <span className="shrink-0 text-[11px] tabular-nums text-textSoft">
                  {formatDuration(song.duration)}
                </span>
              </div>

              {song.album &&
                (song.album || "").trim().toLowerCase() !==
                  (song.title || song.filename || "").trim().toLowerCase() && (
                  <button
                    type="button"
                    onClick={() =>
                      onGoToAlbum?.(
                        song.album || "Unknown Album",
                        song.albumArtist || song.artist || "Unknown Artist"
                      )
                    }
                    className={clsx(
                      "mt-1 block w-full truncate bg-transparent p-0 text-left text-textSoft/90 transition hover:text-text focus-visible:outline-none",
                      gridSize === "small" ? "text-[11px]" : "text-xs"
                    )}
                  >
                    {song.album}
                  </button>
                )}
            </CardContent>
          </Card>
        ))}
      </div>

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
  );
}
