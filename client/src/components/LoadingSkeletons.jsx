import clsx from "clsx";
import { Skeleton } from "./ui/skeleton";

export function ListSkeleton({ rows = 8, withArt = true }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 rounded-xl border border-[color:var(--border)] bg-panel px-3 py-2"
        >
          {withArt && <Skeleton className="h-12 w-12 shrink-0 rounded-lg" />}
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-24 bg-panelSoft/80" />
          </div>
          <Skeleton className="h-3 w-16 bg-panelSoft/70" />
        </div>
      ))}
    </div>
  );
}

export function GridSkeleton({ cards = 10, gridSize = "large" }) {
  return (
    <div
      className={clsx(
        "grid",
        gridSize === "small"
          ? "grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
          : "grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      )}
    >
      {Array.from({ length: cards }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-panel"
        >
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3 w-2/3 bg-panelSoft/80" />
            <Skeleton className="h-3 w-1/3 bg-panelSoft/70" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SongTableSkeleton({ rows = 10 }) {
  return (
    <div className="space-y-2">
      <div className="hidden md:block">
        <Skeleton className="mb-2 h-10 rounded-xl border border-[color:var(--border)] bg-panelSoft/50" />
        <div className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-panel">
          {Array.from({ length: rows }).map((_, index) => (
            <div
              key={index}
              className="grid grid-cols-[40px_52px_minmax(220px,2.1fr)_minmax(140px,1.2fr)_minmax(160px,1.3fr)_64px_62px] items-center gap-3 border-b border-[color:var(--border)] px-3.5 py-2.5"
            >
              <Skeleton className="h-3.5 w-4" />
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-3.5 w-3/4 bg-panelSoft/90" />
              <Skeleton className="h-3.5 w-4/5 bg-panelSoft/80" />
              <Skeleton className="ml-auto h-3.5 w-6 bg-panelSoft/70" />
              <Skeleton className="ml-auto h-3.5 w-10 bg-panelSoft/70" />
            </div>
          ))}
        </div>
      </div>
      <div className="md:hidden">
        <ListSkeleton rows={Math.min(rows, 8)} withArt />
      </div>
    </div>
  );
}
