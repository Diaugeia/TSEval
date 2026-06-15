"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { Seg } from "./ui/seg";
import { orderDatasets } from "./lib/datasets";
import type { LeaderboardDict } from "./types";
import modelMeta from "@/data/model-meta.json";

// echarts-for-react touches `window` on init, so load it client-only.
const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

type Meta = Record<string, { year: number | null; venue: string | null; arxiv: string | null }>;
const META = modelMeta as Meta;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Datasets = Record<string, { horizons: Record<string, any[]> }>;

type Point = {
  year: number; // true publication year
  x: number; // logical column (years < 2020 collapse to 2019 → "<2020")
  jx: number; // plotted x with horizontal fan-out so equal-MSE dots don't stack
  mse: number;
  model: string;
  venue: string | null;
  isTop: boolean;
};

const PRE_CUTOFF = 2020;
const xOf = (year: number) => (year < PRE_CUTOFF ? PRE_CUTOFF - 1 : year);

// Case-insensitive lookup into the ModernTSF metadata map.
const metaLookup = (() => {
  const lower: Record<string, keyof Meta> = {};
  for (const k of Object.keys(META)) lower[k.toLowerCase()] = k;
  return (model: string) => META[lower[model.toLowerCase()]];
})();

/**
 * "Method evolution" chart for static datasets: publication year (x) vs MSE (y),
 * one point per model, rendered with ECharts for smooth animated transitions,
 * hover-to-enlarge + name, and a gold best-so-far (SOTA) frontier line.
 */
export function EvolutionChart({ datasets, copy }: { datasets: Datasets; copy: LeaderboardDict }) {
  const names = orderDatasets(Object.keys(datasets));
  const [dataset, setDataset] = useState(names[0]);
  const [yScale, setYScale] = useState<"linear" | "log">("linear");
  const [selected, setSelected] = useState<Point | null>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const isLog = yScale === "log";

  const model = useMemo(() => {
    const block = datasets[dataset] ?? datasets[names[0]];
    const h = block ? Object.keys(block.horizons)[0] : undefined;
    const rows = (h && block ? block.horizons[h] : []) ?? [];

    const all: Point[] = rows
      .filter((r) => typeof r.mse === "number")
      .map((r) => {
        const m = metaLookup(r.model);
        return m && typeof m.year === "number"
          ? { year: m.year, x: xOf(m.year), jx: xOf(m.year), mse: r.mse as number, model: r.model, venue: m.venue, isTop: false }
          : null;
      })
      .filter((p): p is Point => p !== null);

    const sortedMse = all.map((p) => p.mse).sort((a, b) => a - b);
    const q = (f: number) => (sortedMse.length ? sortedMse[Math.min(sortedMse.length - 1, Math.floor(f * sortedMse.length))] : 1);
    const cap = sortedMse.length ? Math.max(q(0.9), q(0.5) * 3) : 1; // linear upper bound
    const floor = sortedMse.length ? sortedMse[0] : 0.1;
    const dataMax = sortedMse.length ? sortedMse[sortedMse.length - 1] : 1;

    // Best-so-far frontier + the methods that set each new SOTA (labelled).
    const xsSorted = Array.from(new Set(all.map((p) => p.x))).sort((a, b) => a - b);
    let best = Infinity;
    const frontier: [number, number][] = [];
    const setters = new Set<string>();
    for (const x of xsSorted) {
      const champ = all.filter((p) => p.x === x).reduce((a, b) => (b.mse < a.mse ? b : a));
      if (champ.mse < best) {
        best = champ.mse;
        setters.add(champ.model);
      }
      frontier.push([x, best]);
    }
    all.forEach((p) => (p.isTop = setters.has(p.model)));

    // Fan points out horizontally within each column (ordered by name to decorrelate from MSE).
    const FAN = 0.72;
    for (const x of xsSorted) {
      const g = all.filter((p) => p.x === x).sort((a, b) => (a.model < b.model ? -1 : 1));
      const n = g.length;
      g.forEach((p, i) => (p.jx = n <= 1 ? x : x - FAN / 2 + (FAN * i) / (n - 1)));
    }

    const hasPre = all.some((p) => p.year < PRE_CUTOFF);
    const xsAll = all.map((p) => p.x);
    const minX = xsAll.length ? Math.min(...xsAll) : PRE_CUTOFF - 1;
    const maxX = xsAll.length ? Math.max(...xsAll) : 2026;
    return { all, frontier, cap, floor, dataMax, hasPre, minX, maxX };
  }, [datasets, dataset, names]);

  const grid = isDark ? "#2f2f2f" : "#e5e7eb";
  const axis = isDark ? "#9ca3af" : "#6b7280";
  const ink = isDark ? "#e5e7eb" : "#1f2937";
  const gold = isDark ? "#d6b25e" : "#8c6f24";
  const dim = isDark ? "#6b7280" : "#9ca3af";

  const toItem = (p: Point) => ({ value: [p.jx, p.mse], name: p.model, venue: p.venue, year: p.year, mse: p.mse });

  const option = useMemo(() => {
    const { all, frontier, cap, floor, hasPre, minX, maxX } = model;
    const rest = all.filter((p) => !p.isTop).map(toItem);
    const top = all.filter((p) => p.isTop).map(toItem);
    // Both scales frame the competitive band (cap excludes divergent baselines) so
    // the dense low cluster gets the height instead of being squeezed under the
    // outliers. Log additionally widens the spacing of the low end.
    const linLo = Math.max(0, floor - (cap - floor) * 0.06);

    return {
      animationDuration: 600,
      animationDurationUpdate: 500,
      animationEasing: "cubicOut",
      grid: { left: 52, right: 22, top: 18, bottom: 46 },
      tooltip: {
        trigger: "item",
        backgroundColor: isDark ? "#1c1c1c" : "#ffffff",
        borderColor: grid,
        borderWidth: 1,
        padding: [7, 11],
        textStyle: { color: ink, fontSize: 13, fontWeight: 500 },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter: (p: any) => {
          const d = p.data || {};
          const venue = d.venue ? `<div style="color:${axis};font-size:11px">${d.venue} · ${d.year}</div>` : `<div style="color:${axis};font-size:11px">${d.year}</div>`;
          return `<b>${d.name}</b>${venue}<div style="color:${gold};font-family:monospace;margin-top:2px">MSE ${Number(d.mse).toFixed(4)}</div>`;
        },
      },
      xAxis: {
        type: "value",
        min: minX - 1,
        max: maxX + 1,
        interval: 1,
        name: copy.overview.xAxis,
        nameLocation: "middle",
        nameGap: 30,
        nameTextStyle: { color: axis, fontSize: 13, fontWeight: 600 },
        axisLine: { lineStyle: { color: grid } },
        axisTick: { show: false },
        splitLine: { show: true, lineStyle: { color: grid, type: "dashed" } },
        axisLabel: {
          color: axis,
          fontSize: 13,
          fontWeight: 500,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter: (v: any) => {
            const n = Number(v);
            if (n < minX || n > maxX) return "";
            return hasPre && n === PRE_CUTOFF - 1 ? `<${PRE_CUTOFF}` : String(n);
          },
        },
      },
      yAxis: {
        type: isLog ? "log" : "value",
        name: "MSE",
        nameLocation: "end",
        nameGap: 10,
        nameTextStyle: { color: axis, fontSize: 13, fontWeight: 600, align: "left" },
        ...(isLog
          ? { min: Number((floor * 0.92).toPrecision(2)), max: Number(cap.toPrecision(3)) }
          : { min: linLo, max: cap }),
        axisLine: { lineStyle: { color: grid } },
        axisTick: { show: false },
        splitLine: { show: true, lineStyle: { color: grid, type: "dashed" } },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        axisLabel: { color: axis, fontSize: 13, fontWeight: 500, formatter: (v: any) => Number(v).toFixed(2) },
      },
      series: [
        {
          name: "frontier",
          type: "line",
          step: "end",
          data: frontier,
          showSymbol: false,
          silent: true,
          lineStyle: { color: gold, width: 1.5, type: "dashed" },
          z: 1,
        },
        {
          name: "methods",
          type: "scatter",
          data: rest,
          symbolSize: 9,
          itemStyle: { color: dim, opacity: 0.7 },
          emphasis: {
            scale: 2.2,
            itemStyle: { opacity: 1 },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            label: { show: true, formatter: (p: any) => p.data.name, position: "top", color: ink, fontSize: 13, fontWeight: 700 },
          },
          z: 2,
        },
        {
          name: "sota",
          type: "scatter",
          data: top,
          symbolSize: 12,
          itemStyle: { color: gold },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: { show: true, formatter: (p: any) => p.data.name, position: "top", color: ink, fontSize: 12, fontWeight: 600 },
          emphasis: { scale: 1.6, label: { show: true, color: ink, fontSize: 13, fontWeight: 700 } },
          z: 3,
        },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, isDark, isLog, copy]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onEvents = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    click: (p: any) => {
      const d = p?.data;
      if (d?.name) setSelected({ year: d.year, x: 0, jx: 0, mse: d.mse, model: d.name, venue: d.venue ?? null, isTop: false });
    },
  };

  return (
    <div className="mb-6 rounded-2xl border border-border bg-surface p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-serif text-lg tracking-[-0.01em] text-ink">{copy.overview.title}</h3>
        <div className="flex items-center gap-1.5">
          <span className="mr-1 text-xs text-muted">{copy.overview.dataset}:</span>
          {names.map((n) => (
            <Seg key={n} active={dataset === n} onClick={() => { setDataset(n); setSelected(null); }}>
              {n}
            </Seg>
          ))}
        </div>
      </div>
      <p className="mb-3 text-xs text-faint">{copy.overview.caption.replace("{dataset}", dataset)}</p>

      <div className="mb-3 flex items-center gap-1.5">
        <span className="mr-1 text-xs text-muted">{copy.overview.scale}:</span>
        <Seg active={!isLog} onClick={() => setYScale("linear")}>{copy.overview.scaleLinear}</Seg>
        <Seg active={isLog} onClick={() => setYScale("log")}>{copy.overview.scaleLog}</Seg>
      </div>

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

      <ReactECharts
        key={isLog ? "log" : "lin"}
        option={option}
        onEvents={onEvents}
        style={{ height: 360, width: "100%" }}
        opts={{ renderer: "canvas" }}
        notMerge={false}
        lazyUpdate
      />
    </div>
  );
}
