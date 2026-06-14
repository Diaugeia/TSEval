"use client";

import { useState, useMemo } from "react";
import { useTheme } from "next-themes";
import type { LeaderboardDict } from "./types";
import { Seg } from "./leaderboard";
import {
  LineChart,
  Line,
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
  view?: 'regression' | 'quant';
  copy: LeaderboardDict;
};

const COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6"];

export function QuantVisualization({ data, availableModels, view = 'quant', copy }: Props) {
  const gtLabel = copy.viz.groundTruth;
  const bhLabel = copy.viz.buyHold;
  // 根据 view 自动选择初始视图模式
  const defaultViewMode = view === 'regression' ? 'log_return' : 'cumulative_return';
  const [viewMode, setViewMode] = useState<"log_return" | "cumulative_return">(defaultViewMode);
  const [selectedModels, setSelectedModels] = useState<string[]>([
    availableModels[0],
    availableModels[1],
  ].filter(Boolean));
  const [config, setConfig] = useState<"conservative" | "balanced" | "aggressive">("conservative");
  const [modelSearchQuery, setModelSearchQuery] = useState("");
  const [showAllModels, setShowAllModels] = useState(false);

  // Theme-aware chart colours so axes/grid and the dashed baseline line stay
  // legible in dark mode (the baseline was hard-coded black before).
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const gridStroke = isDark ? "#2f2f2f" : "#e5e7eb";
  const axisColor = isDark ? "#9ca3af" : "#6b7280";
  const baselineStroke = isDark ? "#d1d5db" : "#111111";

  const toggleModel = (model: string) => {
    setSelectedModels((prev) => {
      if (prev.includes(model)) {
        return prev.filter((m) => m !== model);
      } else if (prev.length < 5) {
        return [...prev, model];
      }
      return prev;
    });
  };

  const chartData = useMemo(() => {
    if (viewMode === "log_return") {
      return data.log_return.dates.map((date, idx) => {
        const point: Record<string, any> = { date };
        point[gtLabel] = data.log_return.true_avg[idx];

        selectedModels.forEach((model) => {
          // Try to find model data with different prefixes
          let modelData = null;
          if (data.log_return.models[model]) {
            modelData = data.log_return.models[model];
          } else if (data.log_return.models[`st_${model}`]) {
            modelData = data.log_return.models[`st_${model}`];
          } else if (data.log_return.models[`ts_${model}`]) {
            modelData = data.log_return.models[`ts_${model}`];
          }
          
          if (modelData) {
            point[model] = modelData[idx];
          }
        });
        return point;
      });
    } else {
      return data.cumulative_return.dates.map((date, idx) => {
        const point: Record<string, any> = { date };
        point[bhLabel] = data.cumulative_return.baseline[config][idx];

        selectedModels.forEach((model) => {
          // Try to find model data with different prefixes
          let fullKey = null;
          if (data.cumulative_return.models[`${model}_${config}`]) {
            fullKey = `${model}_${config}`;
          } else if (data.cumulative_return.models[`st_${model}_${config}`]) {
            fullKey = `st_${model}_${config}`;
          } else if (data.cumulative_return.models[`ts_${model}_${config}`]) {
            fullKey = `ts_${model}_${config}`;
          }
          
          if (fullKey && data.cumulative_return.models[fullKey]) {
            point[model] = data.cumulative_return.models[fullKey][idx];
          }
        });
        return point;
      });
    }
  }, [viewMode, selectedModels, config, data, gtLabel, bhLabel]);

  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h3 className="font-serif text-xl tracking-[-0.01em] text-ink">
          {copy.viz.title}
        </h3>
        <div className="flex items-center gap-2">
          <Seg size="md" active={viewMode === "log_return"} onClick={() => setViewMode("log_return")}>
            {copy.viz.logReturn}
          </Seg>
          <Seg size="md" active={viewMode === "cumulative_return"} onClick={() => setViewMode("cumulative_return")}>
            {copy.viz.cumulativeReturn}
          </Seg>
        </div>
      </div>

      {viewMode === "cumulative_return" && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-muted">{copy.viz.configuration}:</span>
          {(["conservative", "balanced", "aggressive"] as const).map((cfg) => (
            <Seg key={cfg} active={config === cfg} onClick={() => setConfig(cfg)}>
              {copy.quant.configs[cfg]}
            </Seg>
          ))}
        </div>
      )}

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
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
              !isSearching ||
              model.toLowerCase().includes(modelSearchQuery.trim().toLowerCase()),
          );
          const COLLAPSED = 24;
          // Always keep selected chips visible; collapse the long tail otherwise.
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

      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: axisColor }} stroke={gridStroke} tickFormatter={(val) => val.slice(5)} />
            <YAxis tick={{ fontSize: 12, fill: axisColor }} stroke={gridStroke} tickFormatter={(val) => `${(val * 100).toFixed(1)}%`} />
            <Tooltip
              contentStyle={isDark ? { backgroundColor: "#1c1c1c", border: `1px solid ${gridStroke}`, color: "#e5e7eb" } : undefined}
              formatter={(value: any) => `${(value * 100).toFixed(2)}%`}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey={viewMode === "log_return" ? gtLabel : bhLabel}
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
        </ResponsiveContainer>
      </div>
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
