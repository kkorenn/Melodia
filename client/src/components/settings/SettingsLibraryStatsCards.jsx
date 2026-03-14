import { formatLargeNumber, formatTotalDuration } from "../../utils/format";

export function SettingsLibraryStatsCards({ stats }) {
  return (
    <section className="grid grid-cols-2 gap-3 rounded-2xl border border-[color:var(--border)] bg-panel/70 p-4 lg:grid-cols-4">
      <div className="rounded-xl bg-panelSoft/70 p-3">
        <p className="text-xs uppercase tracking-[0.14em] text-textSoft">Songs</p>
        <p className="mt-1 text-xl font-semibold text-text">
          {formatLargeNumber(stats?.totalSongs || 0)}
        </p>
      </div>
      <div className="rounded-xl bg-panelSoft/70 p-3">
        <p className="text-xs uppercase tracking-[0.14em] text-textSoft">Artists</p>
        <p className="mt-1 text-xl font-semibold text-text">
          {formatLargeNumber(stats?.totalArtists || 0)}
        </p>
      </div>
      <div className="rounded-xl bg-panelSoft/70 p-3">
        <p className="text-xs uppercase tracking-[0.14em] text-textSoft">Albums</p>
        <p className="mt-1 text-xl font-semibold text-text">
          {formatLargeNumber(stats?.totalAlbums || 0)}
        </p>
      </div>
      <div className="rounded-xl bg-panelSoft/70 p-3">
        <p className="text-xs uppercase tracking-[0.14em] text-textSoft">Total Duration</p>
        <p className="mt-1 text-xl font-semibold text-text">
          {formatTotalDuration(stats?.totalDuration || 0)}
        </p>
      </div>
    </section>
  );
}
