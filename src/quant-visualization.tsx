"use client";

import { useState, useMemo } from "react";
import { useTheme } from "next-themes";
import type { LeaderboardDict } from "./types";
import { Seg } from "./leaderboard";
import {
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type VisualizationData = {
  log_return: {
    dates: string[];
    true_avg: number[];
    models: Record<string, number[]>;
  };
  cumulative_return: {
    dates: string[];
    baseline: Record<string, number[]>;
    models: Record<string, number[]>;
  };
};

type Props = {
  data: VisualizationData;
  availableModels: string[];
  view?: "regression" | "quant";
  copy: LeaderboardDict;
};

const COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6"];

// Resolve a model's series in the viz data, tolerating st_/ts_ prefixes.
function resolveModel<T>(models: Record<string, T>, model: string, suffix = ""): T | null {
  const keys = [`${model}${suffix}`, `st_${model}${suffix}`, `ts_${model}${suffix}`];
  for (const k of keys) if (models[k]) return models[k];
  return null;
}

export function QuantVisualization({ data, availableModels, view = "quant", copy }: Props) {
  const bhLabel = copy.viz.buyHold;
  // The chart is chosen by which leaderboard view we're in — no in-chart toggle.
  // Quant view → strategy P&L (cumulative return); Regression view → prediction
  // accuracy (predicted vs actual scatter).
  const mode: "cumulative" | "scatter" = view === "regression" ? "scatter" : "cumulative";

  const [selectedModels, setSelectedModels] = useState<string[]>(
    [availableModels[0], availableModels[1]].filter(Boolean),
  );
  const [config, setConfig] = useState<"conservative" | "balanced" | "aggressive">("conservative");
  const [modelSearchQuery, setModelSearchQuery] = useState("");
  const [showAllModels, setShowAllModels] = useState(false);

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const gridStroke = isDark ? "#2f2f2f" : "#e5e7eb";
  const axisColor = isDark ? "#9ca3af" : "#6b7280";
  const baselineStroke = isDark ? "#d1d5db" : "#111111";

  const toggleModel = (model: string) => {
    setSelectedModels((prev) => {
      if (prev.includes(model)) return prev.filter((m) => m !== model);
      if (prev.length < 5) return [...prev, model];
      return prev;
    });
  };

  // ---- Cumulative-return (Quant view) line data ----
  const cumulativeData = useMemo(() => {
    return data.cumulative_return.dates.map((date, idx) => {
      const point: Record<string, number | string> = { date };
      point[bhLabel] = data.cumulative_return.baseline[config][idx];
      selectedModels.forEach((model) => {
        const series = resolveModel(data.cumulative_return.models, model, `_${config}`);
        if (series) point[model] = series[idx];
      });
      return point;
    });
  }, [selectedModels, config, data, bhLabel]);

  // ---- Predicted-vs-actual (Regression view) scatter data ----
  const scatterSeries = useMemo(() => {
    return selectedModels.map((model) => {
      const series = resolveModel(data.log_return.models, model);
      const points = series
        ? data.log_return.dates.map((date, idx) => ({
            date,
            actual: data.log_return.true_avg[idx],
            predicted: series[idx],
          }))
        : [];
      return { model, points };
    });
  }, [selectedModels, data]);

  // Symmetric square domain so the 45° "perfect prediction" line reads true.
  const scatterDomain = useMemo(() => {
    let m = 0;
    scatterSeries.forEach((s) =>
      s.points.forEach((p) => {
        m = Math.max(m, Math.abs(p.actual), Math.abs(p.predicted));
      }),
    );
    m = m > 0 ? m * 1.05 : 0.05;
    return [-m, m] as [number, number];
  }, [scatterSeries]);

  const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;

  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-4">
        <h3 className="font-serif text-xl tracking-[-0.01em] text-ink">
          {mode === "cumulative" ? copy.viz.cumulativeTitle : copy.viz.scatterTitle}
        </h3>
        {mode === "cumulative" && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">{copy.viz.configuration}:</span>
            {(["conservative", "balanced", "aggressive"] as const).map((cfg) => (
              <Seg key={cfg} active={config === cfg} onClick={() => setConfig(cfg)}>
                {copy.quant.configs[cfg]}
              </Seg>
            ))}
          </div>
        )}
      </div>

      {/* Reading guide */}
      <p className="mb-5 rounded-lg border border-border bg-paper-2 px-4 py-2.5 text-xs leading-relaxed text-muted">
        {mode === "cumulative" ? copy.viz.cumulativeCaption : copy.viz.scatterCaption}
      </p>

      {/* Model selector (shared) */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm text-muted">
            {copy.viz.selectModels}{" "}
            <span className="text-faint">
              {copy.viz.maxSelected.replace("{n}", String(selectedModels.length))}
            </span>
          </div>
          <input
            type="search"
            value={modelSearchQuery}
            onChange={(e) => setModelSearchQuery(e.target.value)}
            placeholder={copy.viz.searchModels}
            className="w-64 rounded-md border border-border bg-paper-2 px-3 py-1.5 text-xs text-ink placeholder:text-faint focus:border-accent focus:outline-none"
          />
        </div>
        {(() => {
          const isSearching = modelSearchQuery.trim() !== "";
          const filtered = availableModels.filter(
            (model) =>
              !isSearching || model.toLowerCase().includes(modelSearchQuery.trim().toLowerCase()),
          );
          const COLLAPSED = 24;
          const visible =
            showAllModels || isSearching
              ? filtered
              : filtered.filter((m, i) => selectedModels.includes(m) || i < COLLAPSED);
          const hidden = filtered.length - visible.length;
          return (
            <div className="flex flex-wrap gap-2">
              {visible.map((model) => (
                <Seg
                  key={model}
                  active={selectedModels.includes(model)}
                  disabled={!selectedModels.includes(model) && selectedModels.length >= 5}
                  onClick={() => toggleModel(model)}
                >
                  {model}
                </Seg>
              ))}
              {!isSearching && hidden > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllModels(true)}
                  className="rounded-md border border-dashed border-border px-2.5 py-1 text-xs font-medium text-accent hover:border-accent/50"
                >
                  + {copy.viz.showAll.replace("{n}", String(filtered.length))}
                </button>
              )}
              {!isSearching && showAllModels && (
                <button
                  type="button"
                  onClick={() => setShowAllModels(false)}
                  className="rounded-md border border-dashed border-border px-2.5 py-1 text-xs font-medium text-muted hover:text-ink"
                >
                  {copy.viz.showLess}
                </button>
              )}
            </div>
          );
        })()}
      </div>

      {/* Chart */}
      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          {mode === "cumulative" ? (
            <LineChart data={cumulativeData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: axisColor }}
                stroke={gridStroke}
                tickFormatter={(val) => String(val).slice(5)}
              />
              <YAxis
                tick={{ fontSize: 12, fill: axisColor }}
                stroke={gridStroke}
                tickFormatter={(val) => pct(val)}
              />
              <Tooltip
                contentStyle={
                  isDark ? { backgroundColor: "#1c1c1c", border: `1px solid ${gridStroke}`, color: "#e5e7eb" } : undefined
                }
                formatter={(value) => pct(Number(value), 2)}
                labelFormatter={(label) => `${label}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey={bhLabel}
                stroke={baselineStroke}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              />
              {selectedModels.map((model, idx) => (
                <Line
                  key={model}
                  type="monotone"
                  dataKey={model}
                  stroke={COLORS[idx % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          ) : (
            <ScatterChart margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis
                type="number"
                dataKey="actual"
                domain={scatterDomain}
                tick={{ fontSize: 12, fill: axisColor }}
                stroke={gridStroke}
                tickFormatter={(val) => pct(val)}
                label={{ value: copy.viz.actual, position: "insideBottom", offset: -10, fontSize: 12, fill: axisColor }}
              />
              <YAxis
                type="number"
                dataKey="predicted"
                domain={scatterDomain}
                tick={{ fontSize: 12, fill: axisColor }}
                stroke={gridStroke}
                tickFormatter={(val) => pct(val)}
                label={{ value: copy.viz.predicted, angle: -90, position: "insideLeft", fontSize: 12, fill: axisColor }}
              />
              {/* 45° perfect-prediction reference */}
              <ReferenceLine
                stroke={baselineStroke}
                strokeDasharray="5 5"
                segment={[
                  { x: scatterDomain[0], y: scatterDomain[0] },
                  { x: scatterDomain[1], y: scatterDomain[1] },
                ]}
                ifOverflow="extendDomain"
              />
              <Tooltip
                cursor={{ stroke: gridStroke }}
                contentStyle={
                  isDark ? { backgroundColor: "#1c1c1c", border: `1px solid ${gridStroke}`, color: "#e5e7eb" } : undefined
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                content={({ payload }: any) => {
                  const p = payload?.[0]?.payload;
                  if (!p) return null;
                  return (
                    <div className="rounded-md border border-border bg-paper px-3 py-2 text-xs shadow-sm">
                      <div className="font-medium text-ink">{p.date}</div>
                      <div className="text-muted">{copy.viz.actual}: {pct(p.actual, 2)}</div>
                      <div className="text-muted">{copy.viz.predicted}: {pct(p.predicted, 2)}</div>
                    </div>
                  );
                }}
              />
              {/* Legend at top so it doesn't collide with the x-axis label below. */}
              <Legend verticalAlign="top" align="center" wrapperStyle={{ paddingBottom: 8 }} />
              {scatterSeries.map((s, idx) => (
                <Scatter
                  key={s.model}
                  name={s.model}
                  data={s.points}
                  fill={COLORS[idx % COLORS.length]}
                  fillOpacity={0.6}
                  isAnimationActive={false}
                />
              ))}
            </ScatterChart>
          )}
        </ResponsiveContainer>
      </div>
      {mode === "scatter" && (
        <p className="mt-2 text-center text-xs text-faint">— — — {copy.viz.perfectLine}</p>
      )}
    </div>
  );
}

// Trading Strategy Description Component
export function TradingStrategyDescription({ copy }: { copy: LeaderboardDict }) {
  const s = copy.strategy;
  return (
    <div className="rounded-lg border border-border bg-surface p-6 mt-8">
      <h3 className="text-lg font-semibold text-ink mb-4">{s.heading}</h3>

      <div className="space-y-4 text-sm text-muted leading-relaxed">
        <p>{s.intro}</p>

        <div className="rounded-md bg-paper-2 p-4 mb-4">
          <h4 className="font-medium text-ink mb-2">{s.coreTitle}</h4>
          <ul className="space-y-1.5 text-sm">
            {s.core.map((item) => (
              <li key={item.label}>
                • <strong>{item.label}</strong>：{item.value}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-1 mb-3">
          <p className="font-medium text-ink">{s.scoringLabel}</p>
          <code className="block bg-paper-2 px-3 py-2 rounded text-xs font-mono">
            {s.scoringFormula}
          </code>
        </div>

        <div className="space-y-3">
          {s.items.map((item) => (
            <div key={item.title} className="pl-4 border-l-2 border-accent/30">
              <h4 className="font-medium text-ink mb-1">{item.title}</h4>
              <p>{item.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-border space-y-2">
          <div className="text-xs text-muted">
            <p>{s.backtestPeriod}</p>
            <p>{s.marketCondition}</p>
            <p>{s.initialCapital}</p>
          </div>

          <p className="text-xs text-faint italic mt-3">
            ⚠️ <strong>{s.disclaimerLabel}</strong>：{s.disclaimer}
          </p>
        </div>
      </div>
    </div>
  );
}
