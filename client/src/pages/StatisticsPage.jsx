import { useCallback, useMemo, useState } from "react";
import { fetchStatistics } from "../lib/api";
import { ListSkeleton } from "../components/LoadingSkeletons";
import { useAbortableRequest } from "../hooks/useAbortableRequest";
import {
  formatDateTime,
  formatLargeNumber,
  formatRelativeDate,
  formatTotalDuration
} from "../utils/format";

function normalizeSeriesByLastDays(rows, days) {
  const byDay = new Map((rows || []).map((row) => [String(row.day), Number(row.plays) || 0]));
  const output = [];

  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(Date.now() - index * 24 * 60 * 60 * 1000);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate()
    ).padStart(2, "0")}`;
    output.push({
      day: key,
      plays: byDay.get(key) || 0
    });
  }

  return output;
}

function normalizeHourSeries(rows) {
  const byHour = new Map((rows || []).map((row) => [Number(row.hour), Number(row.plays) || 0]));
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    plays: byHour.get(hour) || 0
  }));
}

function TrendChart({ series, title, subtitle }) {
  const width = 860;
  const height = 220;
  const padding = 24;
  const maxValue = Math.max(1, ...series.map((point) => Number(point.plays) || 0));
  const points = series
    .map((point, index) => {
      const x =
        padding + (index / Math.max(1, series.length - 1)) * (width - padding * 2);
      const y =
        height -
        padding -
        ((Number(point.plays) || 0) / maxValue) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <section className="rounded-2xl border border-[color:var(--border)] bg-panel/70 p-4">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-text">{title}</h3>
        <p className="text-xs text-textSoft">{subtitle}</p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--color-accent) / 0.28)" />
            <stop offset="100%" stopColor="rgb(var(--color-accent) / 0.02)" />
          </linearGradient>
        </defs>
        <polyline
          fill="none"
          stroke="rgb(var(--color-accent))"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    </section>
  );
}

function HorizontalBarChart({ rows, title, subtitle, valueLabel = "plays" }) {
  const maxValue = Math.max(1, ...rows.map((row) => Number(row.plays) || 0));

  return (
    <section className="rounded-2xl border border-[color:var(--border)] bg-panel/70 p-4">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-text">{title}</h3>
        <p className="text-xs text-textSoft">{subtitle}</p>
      </div>
      <div className="space-y-2">
        {rows.map((row) => {
          const value = Number(row.plays) || 0;
          const widthPercent = (value / maxValue) * 100;
          return (
            <div key={row.artist} className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm text-text">{row.artist}</p>
                <p className="shrink-0 text-xs text-textSoft">
                  {formatLargeNumber(value)} {valueLabel}
                </p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-panelSoft">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent to-accentWarm"
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function StatisticsPage() {
  const [payload, setPayload] = useState(null);

  const loadStatistics = useCallback((signal) => {
    return fetchStatistics({ signal }).then((response) => {
      setPayload(response || null);
    });
  }, []);

  const { loading, error } = useAbortableRequest(loadStatistics, [loadStatistics], {
    fallbackErrorMessage: "Could not load statistics"
  });

  const overview = payload?.overview || {};
  const playsByDay = useMemo(
    () => normalizeSeriesByLastDays(payload?.charts?.playsByDay || [], 30),
    [payload?.charts?.playsByDay]
  );
  const playsByHour = useMemo(
    () => normalizeHourSeries(payload?.charts?.playsByHour || []),
    [payload?.charts?.playsByHour]
  );
  const topArtistsByTotalPlays = payload?.charts?.topArtistsByTotalPlays || [];
  const topArtistsRecent30d = payload?.charts?.topArtistsRecent30d || [];
  const generatedAt = payload?.generatedAt || null;
  const playedSongs = Number(overview.playedSongs) || 0;
  const totalSongs = Number(overview.totalSongs) || 0;
  const playedPercent = totalSongs ? Math.round((playedSongs / totalSongs) * 100) : 0;

  if (loading) {
    return <ListSkeleton rows={10} withArt={false} />;
  }

  if (error) {
    return <p className="text-sm text-rose-300">{error}</p>;
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-text">Statistics</h2>
          <p className="text-sm text-textSoft">
            Snapshot generated {formatRelativeDate(generatedAt)} ({formatDateTime(generatedAt)})
          </p>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-xl border border-[color:var(--border)] bg-panel px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-[0.08em] text-textSoft">Songs</p>
          <p className="mt-1 text-base font-semibold text-text">
            {formatLargeNumber(Number(overview.totalSongs) || 0)}
          </p>
        </div>
        <div className="rounded-xl border border-[color:var(--border)] bg-panel px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-[0.08em] text-textSoft">Artists</p>
          <p className="mt-1 text-base font-semibold text-text">
            {formatLargeNumber(Number(overview.totalArtists) || 0)}
          </p>
        </div>
        <div className="rounded-xl border border-[color:var(--border)] bg-panel px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-[0.08em] text-textSoft">Albums</p>
          <p className="mt-1 text-base font-semibold text-text">
            {formatLargeNumber(Number(overview.totalAlbums) || 0)}
          </p>
        </div>
        <div className="rounded-xl border border-[color:var(--border)] bg-panel px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-[0.08em] text-textSoft">Total Plays</p>
          <p className="mt-1 text-base font-semibold text-text">
            {formatLargeNumber(Number(overview.totalPlays) || 0)}
          </p>
        </div>
        <div className="rounded-xl border border-[color:var(--border)] bg-panel px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-[0.08em] text-textSoft">Duration</p>
          <p className="mt-1 text-base font-semibold text-text">
            {formatTotalDuration(Number(overview.totalDuration) || 0)}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        <div className="rounded-xl border border-[color:var(--border)] bg-panel px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-[0.08em] text-textSoft">Played Songs</p>
          <p className="mt-1 text-base font-semibold text-text">
            {formatLargeNumber(playedSongs)} ({playedPercent}%)
          </p>
        </div>
        <div className="rounded-xl border border-[color:var(--border)] bg-panel px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-[0.08em] text-textSoft">Unplayed Songs</p>
          <p className="mt-1 text-base font-semibold text-text">
            {formatLargeNumber(Number(overview.unplayedSongs) || 0)}
          </p>
        </div>
        <div className="rounded-xl border border-[color:var(--border)] bg-panel px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-[0.08em] text-textSoft">Active Artists 30d</p>
          <p className="mt-1 text-base font-semibold text-text">
            {formatLargeNumber(Number(overview.activeArtists30d) || 0)}
          </p>
        </div>
        <div className="rounded-xl border border-[color:var(--border)] bg-panel px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-[0.08em] text-textSoft">Plays 24h</p>
          <p className="mt-1 text-base font-semibold text-text">
            {formatLargeNumber(Number(overview.plays24h) || 0)}
          </p>
        </div>
      </section>

      <TrendChart
        series={playsByDay}
        title="Plays Trend (Last 30 Days)"
        subtitle="Daily play history volume"
      />

      <TrendChart
        series={playsByHour}
        title="Hourly Listening Pattern (Last 30 Days)"
        subtitle="Play concentration by hour of day"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <HorizontalBarChart
          rows={topArtistsByTotalPlays}
          title="Top Artists (All-Time Total Plays)"
          subtitle="Ranked by song play_count totals"
        />
        <HorizontalBarChart
          rows={topArtistsRecent30d}
          title="Top Artists (Recent 30 Days)"
          subtitle="Ranked by recent play events"
        />
      </div>
    </section>
  );
}
