import { useCallback, useId, useMemo, useState } from "react";
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

function buildTickIndices(length, desiredCount = 6) {
  if (length <= 1) {
    return [0];
  }

  const step = Math.max(1, Math.floor((length - 1) / Math.max(1, desiredCount - 1)));
  const ticks = [];
  for (let index = 0; index < length; index += step) {
    ticks.push(index);
  }

  if (ticks[ticks.length - 1] !== length - 1) {
    ticks.push(length - 1);
  }

  return ticks;
}

function formatTimelineTick(point) {
  if (Number.isInteger(point?.hour)) {
    const hour = Number(point.hour);
    return `${String(hour).padStart(2, "0")}:00`;
  }

  const source = String(point?.day || "");
  const [year, month, day] = source.split("-").map((token) => Number(token));
  if (!year || !month || !day) {
    return source;
  }

  return `${month}/${day}`;
}

function formatTooltipLabel(point) {
  if (Number.isInteger(point?.hour)) {
    const hour = Number(point.hour);
    return `${String(hour).padStart(2, "0")}:00`;
  }

  const source = String(point?.day || "");
  const [year, month, day] = source.split("-").map((token) => Number(token));
  if (!year || !month || !day) {
    return source;
  }

  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function TrendChart({ series }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const gradientId = useId().replace(/:/g, "");
  const width = 900;
  const height = 260;
  const padding = {
    top: 16,
    right: 18,
    bottom: 40,
    left: 44
  };
  const maxValue = Math.max(1, ...series.map((point) => Number(point.plays) || 0));
  const minValue = 0;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const chartBottom = height - padding.bottom;

  const plottedPoints = series.map((point, index) => {
    const x = padding.left + (index / Math.max(1, series.length - 1)) * chartWidth;
    const y =
      chartBottom -
      ((Number(point.plays) || 0) - minValue) / Math.max(1, maxValue - minValue) * chartHeight;

    return {
      index,
      x,
      y,
      value: Number(point.plays) || 0,
      point
    };
  });

  const linePath = plottedPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = plottedPoints.length
    ? `M ${plottedPoints[0].x} ${chartBottom} ${linePath.slice(1)} L ${
      plottedPoints[plottedPoints.length - 1].x
    } ${chartBottom} Z`
    : "";

  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const value = Math.round((1 - ratio) * maxValue);
    const y = padding.top + ratio * chartHeight;
    return { value, y };
  });
  const xTickIndices = buildTickIndices(
    series.length,
    Number.isInteger(series[0]?.hour) ? 7 : 6
  );
  const hoveredPoint = hoveredIndex == null ? null : plottedPoints[hoveredIndex] || null;

  const setHoverFromEvent = (clientX, boundsLeft, boundsWidth) => {
    if (!series.length || !boundsWidth) {
      return;
    }

    const ratio = Math.max(0, Math.min(1, (clientX - boundsLeft) / boundsWidth));
    const index = Math.round(ratio * (series.length - 1));
    setHoveredIndex(index);
  };

  return (
    <section className="rounded-2xl border border-[color:var(--border)] bg-panel/70 p-4">
      <div className="relative">
        {hoveredPoint && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-[color:var(--border)] bg-panel px-2.5 py-1.5 text-xs shadow-xl shadow-black/20"
            style={{
              left: `${(hoveredPoint.x / width) * 100}%`,
              top: `${(hoveredPoint.y / height) * 100}%`,
              transform: "translate(-50%, -115%)"
            }}
          >
            <p className="font-semibold text-text">{formatLargeNumber(hoveredPoint.value)} plays</p>
            <p className="text-textSoft">{formatTooltipLabel(hoveredPoint.point)}</p>
          </div>
        )}

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          onMouseLeave={() => setHoveredIndex(null)}
        >
        <defs>
          <linearGradient id={`trend-fill-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--color-accent) / 0.38)" />
            <stop offset="100%" stopColor="rgb(var(--color-accent) / 0.03)" />
          </linearGradient>
        </defs>

          {yTicks.map((tick) => (
            <g key={`y-${tick.y}`}>
              <line
                x1={padding.left}
                y1={tick.y}
                x2={width - padding.right}
                y2={tick.y}
                stroke="rgb(var(--color-panel-soft))"
                strokeOpacity="0.5"
                strokeWidth="1"
              />
              <text
                x={padding.left - 8}
                y={tick.y + 4}
                textAnchor="end"
                fill="rgb(var(--color-text-soft))"
                fontSize="10"
              >
                {formatLargeNumber(tick.value)}
              </text>
            </g>
          ))}

          <path
            d={areaPath}
            fill={`url(#trend-fill-${gradientId})`}
            stroke="none"
          />
          <path
            d={linePath}
            fill="none"
            stroke="rgb(var(--color-accent))"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {hoveredPoint && (
            <>
              <line
                x1={hoveredPoint.x}
                y1={padding.top}
                x2={hoveredPoint.x}
                y2={chartBottom}
                stroke="rgb(var(--color-accent))"
                strokeOpacity="0.45"
                strokeDasharray="4 4"
              />
              <circle
                cx={hoveredPoint.x}
                cy={hoveredPoint.y}
                r="4.2"
                fill="rgb(var(--color-accent))"
                stroke="rgb(var(--color-panel))"
                strokeWidth="2"
              />
            </>
          )}

          {xTickIndices.map((index) => {
            const point = plottedPoints[index];
            if (!point) {
              return null;
            }

            return (
              <text
                key={`x-${index}`}
                x={point.x}
                y={height - 12}
                textAnchor="middle"
                fill="rgb(var(--color-text-soft))"
                fontSize="10"
              >
                {formatTimelineTick(point.point)}
              </text>
            );
          })}

          <rect
            x={padding.left}
            y={padding.top}
            width={chartWidth}
            height={chartHeight}
            fill="transparent"
            onMouseMove={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect();
              setHoverFromEvent(event.clientX, bounds.left, bounds.width);
            }}
            onTouchStart={(event) => {
              const touch = event.touches?.[0];
              if (!touch) {
                return;
              }
              const bounds = event.currentTarget.getBoundingClientRect();
              setHoverFromEvent(touch.clientX, bounds.left, bounds.width);
            }}
            onTouchMove={(event) => {
              const touch = event.touches?.[0];
              if (!touch) {
                return;
              }
              const bounds = event.currentTarget.getBoundingClientRect();
              setHoverFromEvent(touch.clientX, bounds.left, bounds.width);
            }}
            onTouchEnd={() => setHoveredIndex(null)}
          />
        </svg>
      </div>
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

      <TrendChart series={playsByDay} />

      <TrendChart series={playsByHour} />

      <div className="grid gap-4 lg:grid-cols-2">
        <HorizontalBarChart
          rows={topArtistsByTotalPlays}
          title="Top Artists (All-Time Total Plays)"
          subtitle="Ranked by song play count totals"
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
