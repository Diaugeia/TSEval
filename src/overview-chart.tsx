"use client";

import { useMemo, useState } from "react";
import { useTheme } from "next-themes";
import {
  ComposedChart,
  Scatter,
  Line,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
  ResponsiveContainer,
} from "recharts";
import { Seg } from "./leaderboard";
import type { LeaderboardDict } from "./types";
import modelMeta from "@/data/model-meta.json";

type Meta = Record<string, { year: number | null; venue: string | null; arxiv: string | null }>;
const META = modelMeta as Meta;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Datasets = Record<string, { horizons: Record<string, any[]> }>;

type Point = {
  year: number;
  mse: number;
  model: string;
  venue: string | null;
  isTop: boolean;
};

// Case-insensitive lookup into the ModernTSF metadata map.
const metaLookup = (() => {
  const lower: Record<string, keyof Meta> = {};
  for (const k of Object.keys(META)) lower[k.toLowerCase()] = k;
  return (model: string) => META[lower[model.toLowerCase()]];
})();

/**
 * "Method evolution" chart for static datasets: publication year (x) vs MSE (y),
 * one point per model. The lowest-MSE methods are labelled directly; clicking any
 * point reveals its method/venue. A gold "best-so-far" frontier line traces how the
 * state of the art improved over the years.
 */
export function OverviewChart({ datasets, copy }: { datasets: Datasets; copy: LeaderboardDict }) {
  const names = Object.keys(datasets);
  const [dataset, setDataset] = useState(names[0]);
  const [selected, setSelected] = useState<Point | null>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const { points, frontier, yCap } = useMemo(() => {
    const block = datasets[dataset] ?? datasets[names[0]];
    const h = block ? Object.keys(block.horizons)[0] : undefined;
    const rows = (h && block ? block.horizons[h] : []) ?? [];

    const all: Point[] = rows
      .filter((r) => typeof r.mse === "number")
      .map((r) => {
        const m = metaLookup(r.model);
        return m && typeof m.year === "number"
          ? { year: m.year, mse: r.mse as number, model: r.model, venue: m.venue, isTop: false }
          : null;
      })
      .filter((p): p is Point => p !== null);

    // Robust upper cap so a couple of divergent baselines (MSE in the tens) don't
    // flatten the whole competitive field. Keep everything up to max(p95, 6×median);
    // the few points above clip out of view but stay clickable nowhere — that's fine,
    // they're degenerate runs, not part of the evolution story.
    const sorted = all.map((p) => p.mse).sort((a, b) => a - b);
    const q = (f: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(f * sorted.length))] : 1);
    const cap = sorted.length ? Math.max(q(0.95), q(0.5) * 6) : 1;

    // Best-so-far frontier + which method *set* each new SOTA. We label only those
    // frontier-setters: they're spread across years (and distinct MSE levels), so
    // their names don't collide the way the tightly-clustered lowest-MSE pack does.
    const yearsSorted = Array.from(new Set(all.map((p) => p.year))).sort((a, b) => a - b);
    let best = Infinity;
    const front: { year: number; mse: number }[] = [];
    const setters = new Set<string>();
    for (const y of yearsSorted) {
      const inYear = all.filter((p) => p.year === y);
      const champ = inYear.reduce((a, b) => (b.mse < a.mse ? b : a));
      if (champ.mse < best) {
        best = champ.mse;
        setters.add(champ.model);
      }
      front.push({ year: y, mse: best });
    }
    all.forEach((p) => (p.isTop = setters.has(p.model)));
    return { points: all, frontier: front, yCap: cap };
  }, [datasets, dataset, names]);

  const topPoints = points.filter((p) => p.isTop);
  const restPoints = points.filter((p) => !p.isTop);

  const grid = isDark ? "#2f2f2f" : "#e5e7eb";
  const axis = isDark ? "#9ca3af" : "#6b7280";
  const gold = isDark ? "#d6b25e" : "#8c6f24";
  const dim = isDark ? "#6b7280" : "#9ca3af";

  const years = points.map((p) => p.year);
  const minYear = years.length ? Math.min(...years) : 2016;
  const maxYear = years.length ? Math.max(...years) : 2026;
  const yearTicks: number[] = [];
  for (let y = minYear; y <= maxYear; y++) yearTicks.push(y);

  return (
    <div className="mb-6 rounded-2xl border border-border bg-surface p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-serif text-lg tracking-[-0.01em] text-ink">{copy.overview.title}</h3>
        <div className="flex items-center gap-1.5">
          <span className="mr-1 text-xs text-muted">{copy.overview.dataset}:</span>
          {names.map((n) => (
            <Seg
              key={n}
              active={dataset === n}
              onClick={() => {
                setDataset(n);
                setSelected(null);
              }}
            >
              {n}
            </Seg>
          ))}
        </div>
      </div>
      <p className="mb-3 text-xs text-faint">
        {copy.overview.caption.replace("{dataset}", dataset)}
      </p>

      {/* Selection readout / click hint */}
      <div className="mb-3 flex min-h-[1.5rem] items-center gap-2 text-xs">
        {selected ? (
          <span className="inline-flex items-center gap-2 rounded-md border border-border bg-paper-2 px-2.5 py-1">
            <span className="font-medium text-ink">{selected.model}</span>
            {selected.venue && <span className="text-muted">· {selected.venue}</span>}
            <span className="text-muted">· {selected.year}</span>
            <span className="font-mono text-accent">MSE {selected.mse.toFixed(4)}</span>
          </span>
        ) : (
          <span className="text-faint">{copy.overview.clickHint}</span>
        )}
        <span className="ml-auto inline-flex items-center gap-1.5 text-faint">
          <span className="inline-block h-0.5 w-5" style={{ backgroundColor: gold }} />
          {copy.overview.frontier}
        </span>
      </div>

      <div className="h-[340px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={{ top: 12, right: 24, left: 4, bottom: 28 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis
              type="number"
              dataKey="year"
              domain={[minYear - 0.5, maxYear + 0.5]}
              ticks={yearTicks}
              tick={{ fontSize: 12, fill: axis }}
              stroke={grid}
              allowDecimals={false}
              label={{ value: copy.overview.xAxis, position: "insideBottom", offset: -14, fontSize: 12, fill: axis }}
            />
            <YAxis
              type="number"
              dataKey="mse"
              domain={[0, yCap]}
              allowDataOverflow
              tick={{ fontSize: 12, fill: axis }}
              stroke={grid}
              tickFormatter={(v) => Number(v).toFixed(2)}
              label={{ value: "MSE", angle: -90, position: "insideLeft", fontSize: 12, fill: axis }}
            />
            <ZAxis range={[60, 60]} />
            <Tooltip
              cursor={{ stroke: grid }}
              contentStyle={
                isDark ? { backgroundColor: "#1c1c1c", border: `1px solid ${grid}`, color: "#e5e7eb" } : undefined
              }
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              content={({ payload }: any) => {
                const p: Point | undefined = payload?.[0]?.payload;
                if (!p || !p.model) return null;
                return (
                  <div className="rounded-md border border-border bg-paper px-3 py-2 text-xs shadow-sm">
                    <div className="font-medium text-ink">{p.model}</div>
                    {p.venue && <div className="text-muted">{p.venue}</div>}
                    <div className="mt-0.5 font-mono text-accent">MSE {p.mse.toFixed(4)}</div>
                  </div>
                );
              }}
            />
            {/* Best-so-far frontier line */}
            <Line
              data={frontier}
              dataKey="mse"
              type="stepAfter"
              stroke={gold}
              strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
              legendType="none"
            />
            {/* Non-top methods: muted dots */}
            <Scatter
              data={restPoints}
              fill={dim}
              fillOpacity={0.65}
              onClick={(d: unknown) => setSelected((d as { payload?: Point })?.payload ?? (d as Point))}
              isAnimationActive={false}
            />
            {/* Top methods: gold dots + direct labels */}
            <Scatter
              data={topPoints}
              fill={gold}
              onClick={(d: unknown) => setSelected((d as { payload?: Point })?.payload ?? (d as Point))}
              isAnimationActive={false}
            >
              <LabelList dataKey="model" position="top" style={{ fontSize: 10, fill: axis }} />
            </Scatter>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
