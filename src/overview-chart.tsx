"use client";

import { useMemo, useState } from "react";
import { useTheme } from "next-themes";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Seg } from "./leaderboard";
import type { LeaderboardDict } from "./types";

const TOP_N = 12;
const METRICS = ["mse", "mae", "corr"] as const;
type Metric = (typeof METRICS)[number];
const HIGHER_BETTER = new Set<Metric>(["corr"]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Datasets = Record<string, { horizons: Record<string, any[]> }>;

/**
 * Top-of-section overview chart for static datasets — a quick visual of the
 * top-N models' MSE/MAE/Corr on a chosen dataset, before the detailed tables.
 */
export function OverviewChart({ datasets, copy }: { datasets: Datasets; copy: LeaderboardDict }) {
  const names = Object.keys(datasets);
  const [dataset, setDataset] = useState(names[0]);
  const [metric, setMetric] = useState<Metric>("mse");
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const chartData = useMemo(() => {
    const block = datasets[dataset] ?? datasets[names[0]];
    const h = block ? Object.keys(block.horizons)[0] : undefined;
    const rows = (h && block ? block.horizons[h] : []) ?? [];
    const higher = HIGHER_BETTER.has(metric);
    return rows
      .filter((r) => typeof r[metric] === "number")
      .slice()
      .sort((a, b) =>
        higher ? (b[metric] as number) - (a[metric] as number) : (a[metric] as number) - (b[metric] as number),
      )
      .slice(0, TOP_N)
      .map((r) => ({ model: r.model, value: r[metric] as number }));
  }, [datasets, dataset, metric, names]);

  const grid = isDark ? "#2f2f2f" : "#e5e7eb";
  const axis = isDark ? "#9ca3af" : "#6b7280";
  const line = isDark ? "#d6b25e" : "#8c6f24"; // gold accent

  const metricLabel = (m: Metric) =>
    m === "mse" ? copy.cols.mse : m === "mae" ? copy.cols.mae : copy.cols.corr;

  return (
    <div className="mb-6 rounded-2xl border border-border bg-surface p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-serif text-lg tracking-[-0.01em] text-ink">{copy.overview.title}</h3>
        <div className="flex items-center gap-1.5">
          <span className="mr-1 text-xs text-muted">{copy.overview.metric}:</span>
          {METRICS.map((m) => (
            <Seg key={m} active={metric === m} onClick={() => setMetric(m)}>
              {metricLabel(m)}
            </Seg>
          ))}
        </div>
      </div>
      <p className="mb-3 text-xs text-faint">
        {copy.overview.caption.replace("{n}", String(TOP_N)).replace("{dataset}", dataset)}
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-muted">{copy.overview.dataset}:</span>
        {names.map((n) => (
          <Seg key={n} active={dataset === n} onClick={() => setDataset(n)}>
            {n}
          </Seg>
        ))}
      </div>

      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 20, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis
              dataKey="model"
              tick={{ fontSize: 11, fill: axis }}
              stroke={grid}
              angle={-35}
              textAnchor="end"
              interval={0}
              height={60}
            />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fontSize: 12, fill: axis }}
              stroke={grid}
              tickFormatter={(v) => Number(v).toFixed(3)}
            />
            <Tooltip
              contentStyle={
                isDark ? { backgroundColor: "#1c1c1c", border: `1px solid ${grid}`, color: "#e5e7eb" } : undefined
              }
              formatter={(v: unknown) => [Number(v).toFixed(4), metricLabel(metric)] as [string, string]}
            />
            <Line type="monotone" dataKey="value" stroke={line} strokeWidth={2} dot={{ r: 3, fill: line }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
