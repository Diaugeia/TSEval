"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { LeaderboardDict } from "./types";
import { QuantVisualization, TradingStrategyDescription } from "./quant-visualization";

// ---------------------------------------------------------------------------
//  Model type classification based on work_dirs structure
// ---------------------------------------------------------------------------
const SPATIOTEMPORAL_MODELS = new Set([
  'AGCRN', 'BiST', 'BigST', 'D2STGNN', 'DCRNN', 'DFDGCN', 'DGCRN', 'DSTAGNN',
  'GTS', 'GWNet', 'HimNet', 'LSTM', 'MAGE', 'MTGNN', 'MegaCRN',
  'RPMixer', 'STAEformer', 'STDN', 'STGCN', 'STGODE', 'STID', 'STNorm',
  'STOP', 'STPGNN', 'STTN', 'STWave', 'StemGNN', 'Sumba'
]);

// Air quality specific models (covariate mode)
const AIR_QUALITY_MODELS = new Set([
  'AirCade', 'AirFormer', 'CauAir', 'DeepAir', 'PM25GNN'
]);

// Baseline models - always shown regardless of filter
const BASELINE_MODELS = ['baseline', 'HL'];

const TIME_SERIES_MODELS = new Set([
  'AMRC', 'APN', 'Amplifier', 'Aurora', 'Autoformer', 'BiMamba', 'CARD', 'CATS',
  'CMoS', 'COSA', 'CoRA', 'CrossGNN', 'CrossLinear', 'Crossformer', 'CycleNet',
  'DLinear', 'DSFormer', 'DTAF', 'DUET', 'DeepAR', 'DistDF', 'DynamicTMoE',
  'ETSformer', 'FEDformer', 'FITS', 'FTP', 'FeTS', 'FiLM', 'FreTS', 'Fredformer',
  'GOTSF', 'GTR', 'HDMixer', 'HMformer', 'HN_MVTS', 'ImplicitForecaster',
  'Informer', 'InterPDN', 'Koopa', 'Kronos', 'LatentTSF', 'LightTS', 'Linear',
  'MAFS', 'MICN', 'MMPD', 'MSGNet', 'MTSMixer', 'MambaSimple', 'MixLinear',
  'MoFo', 'ModernTCN', 'MultiPatchFormer', 'NBeats', 'NHiTS', 'NLinear',
  'NSTransformer', 'OLinear', 'OccamVTS', 'PAttn', 'PHAT', 'PMDformer', 'PULSE',
  'PWS', 'PaiFilter', 'PatchMLP', 'PatchTST', 'Pathformer', 'PhaseFormer',
  'Pyraformer', 'RLinear', 'Reformer', 'S4', 'SCINet', 'SEMPO', 'SOFTS', 'SRSNet',
  'SVTime', 'S_Mamba', 'SegRNN', 'Sonnet', 'SparseTSF', 'Sumba', 'SymTime',
  'TSMixer', 'TSRAG', 'TexFilter', 'TiDE', 'TiRex', 'TimeAlign', 'TimeBase',
  'TimeBridge', 'TimeCAP', 'TimeEmb', 'TimeFilter', 'TimeKAN', 'TimeMixer',
  'TimeMosaic', 'TimeO1', 'TimePerceiver', 'TimeXer', 'TimesNet', 'Transformer',
  'UMixer', 'WPMixer', 'WaveNet', 'iTransformer', 'xPatch'
]);

function getModelType(modelName: string): 'ts' | 'st' | 'aq' | 'baseline' {
  // Handle baseline models
  if (BASELINE_MODELS.includes(modelName)) return 'baseline';
  
  // Extract base model name (remove suffix like " (Pro6000)")
  const baseModelName = modelName.replace(/\s*\([^)]+\)\s*$/, '');
  
  // Check model type sets
  if (AIR_QUALITY_MODELS.has(baseModelName)) return 'aq';
  if (SPATIOTEMPORAL_MODELS.has(baseModelName)) return 'st';
  if (TIME_SERIES_MODELS.has(baseModelName)) return 'ts';
  
  return 'ts'; // default to time series if unknown
}

// ---------------------------------------------------------------------------
//  Shape of leaderboard.json (produced by `tsf leaderboard-build`).
// ---------------------------------------------------------------------------
export interface LeaderRow {
  model: string;
  mse: number | null;
  mae: number | null;
  rmse?: number | null;
  wape?: number | null;
  rse?: number | null;
  corr: number | null;
  n_runs: number;
  submission_ids: string[];
  rank?: number;
  displayRank?: number;
  categoryRank?: number;
  modelType?: 'ts' | 'st' | 'aq' | 'baseline';
  // Quant (trading) metrics — present on stock-track quant rows
  total_return?: number | null;
  annualized_return?: number | null;
  sharpe?: number | null;
  max_drawdown?: number | null;
  win_rate?: number | null;
  avg_turnover?: number | null;
}

interface DatasetBlock {
  horizons: Record<string, LeaderRow[]>;
  // Stock track only: backtest_91d_{conservative|balanced|aggressive} → rows
  quant?: Record<string, LeaderRow[]>;
}

interface TrackBlock {
  datasets: Record<string, DatasetBlock>;
}

export interface LeaderboardData {
  schema_version: string;
  generated_at: string;
  primary_metric: string;
  n_submissions: number;
  n_rejected: number;
  tracks: Record<string, TrackBlock>;
}

// Numeric, sortable metric columns. `corr` is higher-is-better; the rest are
// errors (lower-is-better) — captured by `betterDir` so the default sort and
// the arrow glyph stay honest.
const METRICS = [
  { key: "mse", betterDir: 1 },
  { key: "mae", betterDir: 1 },
  { key: "wape", betterDir: 1 },
  { key: "rse", betterDir: 1 },
  { key: "corr", betterDir: -1 },
] as const;

const QUANT_METRICS = [
  { key: "total_return", label: "Total Return", betterDir: -1 },
  { key: "annualized_return", label: "Annualized", betterDir: -1 },
  { key: "sharpe", label: "Sharpe", betterDir: -1 },
  { key: "max_drawdown", label: "Max DD", betterDir: 1 },
  { key: "win_rate", label: "Win Rate", betterDir: -1 },
  { key: "avg_turnover", label: "Avg Turnover", betterDir: 1 },
] as const;

type SortKey = (typeof METRICS)[number]["key"] | (typeof QUANT_METRICS)[number]["key"];

function fmt(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : v.toFixed(4);
}

// Percentage display for ratio-style metrics (returns, drawdown, win rate).
function fmtPct(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : `${(v * 100).toFixed(2)}%`;
}

// Compact decimal for unit-less ratios (Sharpe, turnover).
function fmtRatio(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : v.toFixed(2);
}

// Per-column formatter for the quant view.
const QUANT_FORMAT: Record<string, (v: number | null | undefined) => string> = {
  total_return: fmtPct,
  annualized_return: fmtPct,
  sharpe: fmtRatio,
  max_drawdown: fmtPct,
  win_rate: fmtPct,
  avg_turnover: fmtRatio,
};

// Financial colour semantics: green = gain, red = loss. Applied to the
// return/Sharpe columns; drawdown reads red (always a loss); win-rate splits
// at 50%; turnover stays neutral.
function quantColor(key: string, v: number | null | undefined): string {
  if (v === null || v === undefined) return "text-muted";
  const up = "text-emerald-600 dark:text-emerald-400";
  const down = "text-rose-600 dark:text-rose-400";
  switch (key) {
    case "total_return":
    case "annualized_return":
    case "sharpe":
      return v > 0 ? up : v < 0 ? down : "text-muted";
    case "max_drawdown":
      return v < 0 ? down : "text-muted";
    case "win_rate":
      return v >= 0.5 ? up : down;
    default:
      return "text-muted";
  }
}

// Air-quality pollutant labels with proper chemical subscripts.
const POLLUTANT_LABELS: Record<string, string> = {
  pm2_5: "PM2.5",
  pm10: "PM10",
  ozone: "O₃",
  no2: "NO₂",
  so2: "SO₂",
  co: "CO",
};

function formatPollutant(h: string): string {
  return POLLUTANT_LABELS[h.toLowerCase()] ?? h.toUpperCase().replace("_", ".");
}

export function Leaderboard({
  data,
  copy,
}: {
  data: LeaderboardData;
  copy: LeaderboardDict;
}) {

  // Load visualization data dynamically
  const [visualizationData, setVisualizationData] = useState<any>(null);
  useEffect(() => {
    fetch('/visualization_data.json')
      .then(res => res.json())
      .then(data => setVisualizationData(data))
      .catch(err => console.error('Failed to load visualization data:', err));
  }, []);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Two-tier classification
  const staticTracks = ['time_series', 'spatiotemporal', 'covariate'];
  const realtimeTracks = ['stock', 'traffic', 'air_quality'];
  const trackHasData = (t: string) =>
    !!(data.tracks[t] && Object.keys(data.tracks[t]?.datasets ?? {}).length > 0);

  // View state is restored from the URL query so it survives a language switch
  // / refresh and is deep-linkable (?cat=realtime&track=air_quality&view=quant).
  const initialCategory: 'static' | 'realtime' =
    searchParams.get('cat') === 'realtime' ? 'realtime' : 'static';
  const [category, setCategory] = useState<'static' | 'realtime'>(initialCategory);
  const [query, setQuery] = useState("");

  // Dataset selection for stock track
  const stockDatasets = data.tracks['stock'] ? Object.keys(data.tracks['stock'].datasets) : [];
  const [selectedStockDataset, setSelectedStockDataset] = useState(() => {
    const ds = searchParams.get('ds');
    return ds && stockDatasets.includes(ds) ? ds : (stockDatasets[0] || 'Stock-HS300');
  });

  // View mode for stock track: regression (prediction) vs quant (trading)
  const [view, setView] = useState<'regression' | 'quant'>(
    searchParams.get('view') === 'quant' ? 'quant' : 'regression',
  );

  const [track, setTrack] = useState(() => {
    const tracks = initialCategory === 'static' ? staticTracks : realtimeTracks;
    const t = searchParams.get('track');
    if (t && tracks.includes(t) && trackHasData(t)) return t;
    return tracks.find(trackHasData) ?? tracks[0];
  });

  // Mirror state back into the URL (replace = no history spam, scroll preserved).
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('cat', category);
    params.set('track', track);
    if (track === 'stock') params.set('view', view);
    else params.delete('view');
    if (track === 'stock' && stockDatasets.length > 1) params.set('ds', selectedStockDataset);
    else params.delete('ds');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, track, view, selectedStockDataset]);

  // Get tracks for current category
  const currentTracks = category === 'static' ? staticTracks : realtimeTracks;

  const current = data.tracks[track];
  const datasets = current ? Object.entries(current.datasets) : [];

  return (
    <>
      {/* Category selection (two main categories) */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Seg
          size="lg"
          active={category === 'static'}
          onClick={() => {
            setCategory('static');
            setTrack(staticTracks.find(t => data.tracks[t]) ?? staticTracks[0]);
          }}
        >
          {copy.categories?.commonStatic ?? "Common Static Dataset"}
        </Seg>
        <Seg
          size="lg"
          active={category === 'realtime'}
          onClick={() => {
            setCategory('realtime');
            setTrack(realtimeTracks.find(t => data.tracks[t]) ?? realtimeTracks[0]);
          }}
        >
          {copy.categories?.realtime ?? "Real-Time Dataset"}
        </Seg>
      </div>

      {/* Track tabs (sub-categories) */}
      <div className="flex flex-wrap items-center gap-2">
        {currentTracks.map((t) => {
          const active = t === track;
          const hasData = data.tracks[t] && Object.keys(data.tracks[t]?.datasets ?? {}).length > 0;
          return (
            <Seg
              key={t}
              size="md"
              active={active}
              disabled={!hasData}
              onClick={() => setTrack(t)}
            >
              {copy.tracks[t] ?? t}
            </Seg>
          );
        })}
      </div>

      {/* Dataset selector for stock track — only when there's a real choice */}
      {track === 'stock' && stockDatasets.length > 1 && (
        <div className="mt-5 flex items-center gap-2">
          {stockDatasets.map((datasetName) => (
            <Seg
              key={datasetName}
              size="md"
              active={selectedStockDataset === datasetName}
              onClick={() => setSelectedStockDataset(datasetName)}
            >
              {datasetName}
            </Seg>
          ))}
        </div>
      )}

      {/* Model filter */}
      <div className="mt-5">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={copy.searchPlaceholder}
          aria-label={copy.searchPlaceholder}
          className="w-full max-w-sm rounded-lg border border-border bg-paper-2 px-3.5 py-2 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none"
        />
      </div>

      {/* View selector for stock track: Regression vs Quant */}
      {track === 'stock' && (
        <div className="mt-5 flex items-center gap-2">
          <Seg size="md" active={view === 'regression'} onClick={() => setView('regression')}>
            {copy.quant.regression}
          </Seg>
          <Seg size="md" active={view === 'quant'} onClick={() => setView('quant')}>
            {copy.quant.quant}
          </Seg>
        </div>
      )}

      {datasets.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-border bg-surface px-6 py-16 text-center text-muted">
          {copy.emptyTrack}
        </p>
      ) : track === 'stock' ? (
        // Stock track: single card
        <div className="mt-6">
          {current?.datasets[selectedStockDataset] && (
            <DatasetCard
              track={track}
              name={selectedStockDataset}
              ds={current.datasets[selectedStockDataset]}
              copy={copy}
              query={query}
              hideTitle={true}
              view={view}
              visualizationData={visualizationData}
            />
          )}
        </div>
      ) : (
        // Other tracks: loop through all datasets
        <div className="mt-6 space-y-6">
          {datasets.map(([name, ds]) => (
            <DatasetCard
              key={`${track}/${name}`}
              track={track}
              name={name}
              ds={ds}
              copy={copy}
              query={query}
            />
          ))}
        </div>
      )}
    </>
  );
}

function DatasetCard({
  track,
  name,
  ds,
  copy,
  query,
  hideTitle = false,
  view: viewProp,
  visualizationData,
}: {
  track: string;
  name: string;
  ds: DatasetBlock;
  copy: LeaderboardDict;
  query: string;
  hideTitle?: boolean;
  view?: 'regression' | 'quant';
  visualizationData?: any;
}) {
  const horizons = useMemo(
    () => Object.keys(ds.horizons).sort((a, b) => Number(a) - Number(b)),
    [ds],
  );
  const [horizon, setHorizon] = useState(horizons[0]);
  
  // Use view from parent (Leaderboard) if provided, otherwise default to regression
  const view = viewProp ?? 'regression';
  const hasQuantData = track === 'stock' && ds.quant && Object.keys(ds.quant).length > 0;
  
  // 根据 view 选择默认排序指标和指标列表
  const defaultSortKey = (view === 'quant' ? 'total_return' : 'mse') as SortKey;
  const [sortKey, setSortKey] = useState<SortKey>(defaultSortKey);
  const [sortDir, setSortDir] = useState(1); // 1 = ascending
  const currentMetrics = view === 'quant' ? QUANT_METRICS : METRICS;
  
  // Configuration for quant view (conservative / balanced / aggressive)
  const [quantConfig, setQuantConfig] = useState<'conservative' | 'balanced' | 'aggressive'>('conservative');

  // Model type filter - at least one must be selected
  const [showTimeSeries, setShowTimeSeries] = useState(true);
  const [showSpatiotemporal, setShowSpatiotemporal] = useState(true);
  const [showAirQuality, setShowAirQuality] = useState(true);

  // Toggle with constraint: at least one must be selected
  const toggleTimeSeries = () => {
    if (!showTimeSeries || showSpatiotemporal || showAirQuality) {
      setShowTimeSeries(!showTimeSeries);
    }
  };

  const toggleSpatiotemporal = () => {
    if (!showSpatiotemporal || showTimeSeries || showAirQuality) {
      setShowSpatiotemporal(!showSpatiotemporal);
    }
  };

  const toggleAirQuality = () => {
    if (!showAirQuality || showTimeSeries || showSpatiotemporal) {
      setShowAirQuality(!showAirQuality);
    }
  };

  function toggleSort(k: SortKey) {
    const better = METRICS.find((m) => m.key === k)?.betterDir ?? 1;
    if (k === sortKey) {
      setSortDir((d) => -d);
    } else {
      setSortKey(k);
      setSortDir(better); // start "best-first" for the chosen metric
    }
  }

  // Get data for selected horizon and view
  const all = (() => {
    if (view === 'quant' && ds.quant) {
      const key = `backtest_91d_${quantConfig}` as keyof typeof ds.quant;
      return ds.quant[key] || ds.horizons[horizon];
    }
    return ds.horizons[horizon] || [];
  })();

  // Check if showing single type or multiple
  const activeTypeCount = [showTimeSeries, showSpatiotemporal, showAirQuality].filter(Boolean).length;
  const showingBoth = activeTypeCount === 2;
  const showingSingle = activeTypeCount === 1;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let filtered = q
      ? all.filter((r) => r.model.toLowerCase().includes(q))
      : all;

    // Add model type to each row
    const withTypes = filtered.map(r => ({
      ...r,
      modelType: getModelType(r.model)
    }));

    // Sort ALL models (including baseline) by the current metric
    const allSorted = withTypes.slice().sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      return (av - bv) * sortDir;
    });

    const metric = METRICS.find((m) => m.key === sortKey);
    const betterDir = metric?.betterDir ?? 1;
    const isNaturalOrder = sortDir === betterDir;

    // Assign ranks to NON-baseline models only (1-135)
    // Baseline gets undefined rank and doesn't affect others' ranks
    let rankCounter = 0;
    const withRanks = allSorted.map((row) => {
      if (row.modelType === 'baseline') {
        return {
          ...row,
          displayRank: undefined,  // Baseline shows "—" for rank
          categoryRank: undefined,
        };
      }
      
      rankCounter++;
      return {
        ...row,
        displayRank: isNaturalOrder ? rankCounter : (135 - rankCounter + 1),
      };
    });

    // Now filter by model type (baseline is always shown)
    const typeFiltered = withRanks.filter((r) => {
      if (r.modelType === 'baseline') return true;  // Always show baseline
      if (r.modelType === 'st' && !showSpatiotemporal) return false;
      if (r.modelType === 'ts' && !showTimeSeries) return false;
      if (r.modelType === 'aq' && !showAirQuality) return false;
      return true;
    });

    // Calculate category ranks for real-time datasets
    // #Cat shows the sequential rank within the currently displayed table
    if (track === 'stock' || track === 'traffic' || track === 'air_quality') {
      let catRank = 0;
      typeFiltered.forEach((row) => {
        if (row.modelType === 'baseline') {
          row.categoryRank = undefined;
        } else {
          catRank++;
          row.categoryRank = catRank;
        }
      });
    }

    return typeFiltered;
  }, [all, query, sortKey, sortDir, showTimeSeries, showSpatiotemporal, showAirQuality, showingSingle]);


  // Baselines (e.g. "Last Value Copy") are shown but excluded from the model
  // count — datasets without a baseline subtract nothing.
  const nBaselines = all.filter((r) => getModelType(r.model) === "baseline").length;
  const showCount = copy.showing
    .replace("{n}", String(rows.filter((r) => r.modelType !== "baseline").length))
    .replace("{total}", String(all.length - nBaselines));

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-3 flex-wrap">
          {!hideTitle && (
            <span className="font-serif text-lg tracking-[-0.01em] text-ink">
              {name}
            </span>
          )}

          {/* Model type filter buttons - show for stock and air_quality tracks */}
          {(track === 'stock' || track === 'air_quality') && (
            <div className="flex items-center gap-1.5">
              <span className="mr-1 text-xs text-muted">{copy.quant.modelType}:</span>
              <Seg
                active={showTimeSeries}
                disabled={showTimeSeries && !showSpatiotemporal && !showAirQuality}
                onClick={toggleTimeSeries}
              >
                {copy.tracks.time_series}
              </Seg>
              <Seg
                active={showSpatiotemporal}
                disabled={showSpatiotemporal && !showTimeSeries && !showAirQuality}
                onClick={toggleSpatiotemporal}
              >
                {copy.tracks.spatiotemporal}
              </Seg>
              {track === 'air_quality' && (
                <Seg
                  active={showAirQuality}
                  disabled={showAirQuality && !showTimeSeries && !showSpatiotemporal}
                  onClick={toggleAirQuality}
                >
                  {copy.tracks.air_quality}
                </Seg>
              )}
            </div>
          )}

          {/* Config selector for quant view - show after model type filters */}
          {track === 'stock' && view === 'quant' && hasQuantData && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted mr-1">{copy.quant.strategy}:</span>
              <Seg active={quantConfig === 'conservative'} onClick={() => setQuantConfig('conservative')}>
                {copy.quant.configs.conservative}
              </Seg>
              <Seg active={quantConfig === 'balanced'} onClick={() => setQuantConfig('balanced')}>
                {copy.quant.configs.balanced}
              </Seg>
              <Seg active={quantConfig === 'aggressive'} onClick={() => setQuantConfig('aggressive')}>
                {copy.quant.configs.aggressive}
              </Seg>
            </div>
          )}

          <span className="text-xs text-faint [font-variant-numeric:tabular-nums]">
            {showCount}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          {/* Date range - for stock and air_quality tracks */}
          {track === 'stock' && (
            <span className="rounded-md border border-border bg-paper-2 px-2.5 py-1 text-xs text-muted">
              2026/01/01 ~ 05/31
            </span>
          )}
          {track === 'air_quality' && (
            <span className="rounded-md border border-border bg-paper-2 px-2.5 py-1 text-xs text-muted">
              2026/01 ~ 05/31
            </span>
          )}
          {/* seq_len/pred_len - different for each track */}
          {track === 'time_series' ? (
            <>
              <span className="rounded-md border border-border bg-paper-2 px-2.5 py-1 text-xs text-muted">
                seq_len: 336
              </span>
              <span className="rounded-md border border-border bg-paper-2 px-2.5 py-1 text-xs text-muted">
                pred_len: 192
              </span>
            </>
          ) : track === 'air_quality' ? (
            <>
              <span className="rounded-md border border-border bg-paper-2 px-2.5 py-1 text-xs text-muted">
                seq_len: 24
              </span>
              <span className="rounded-md border border-border bg-paper-2 px-2.5 py-1 text-xs text-muted">
                pred_len: 24
              </span>
            </>
          ) : (
            <span className="rounded-md border border-border bg-paper-2 px-2.5 py-1 text-xs text-muted">
              seq_len: 20
            </span>
          )}
          {/* Horizon buttons live here for non air-quality tracks; air quality
              gets its own dedicated pollutant selector row below. */}
          {track !== 'air_quality' && horizons.map((h) => (
            <Seg key={h} active={h === horizon} onClick={() => setHorizon(h)}>
              {`${copy.horizon} ${h}`}
            </Seg>
          ))}
        </div>
      </div>

      {/* Pollutant selector — air quality only, on its own labelled row */}
      {track === 'air_quality' && horizons.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-paper-2/40 px-5 py-2.5">
          <span className="mr-1 text-[0.7rem] font-medium uppercase tracking-[0.04em] text-faint">
            {copy.quant.pollutant}
          </span>
          {horizons.map((h) => (
            <Seg key={h} active={h === horizon} onClick={() => setHorizon(h)}>
              {formatPollutant(h)}
            </Seg>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-muted">
          {copy.noMatch}
        </p>
      ) : (
        <div className="max-h-[34rem] overflow-auto">
          <table className="w-full border-collapse [font-variant-numeric:tabular-nums]">
            <thead className="sticky top-0 z-10 bg-surface">
              <tr>
                <Th className="w-12" title={copy.quant.rankTip}>#</Th>
                {/* Show #Cat for real-time datasets (multiple model types) */}
                {(track === 'stock' || track === 'traffic' || track === 'air_quality') && (
                  <Th className="w-12 text-accent" title={copy.quant.catRankTip}>#Cat</Th>
                )}
                <Th>{copy.cols.model}</Th>
                
                {/* Dynamic columns based on view for stock track */}
                {track === 'stock' && view === 'quant' ? (
                  // Quant metrics
                  <>
                    {QUANT_METRICS.map((m) => (
                      <SortTh
                        key={m.key}
                        label={m.label}
                        active={sortKey === m.key}
                        dir={sortDir}
                        onClick={() => toggleSort(m.key)}
                      />
                    ))}
                  </>
                ) : (
                  // Regression metrics (default for all tracks)
                  <>
                    <SortTh
                      label={copy.cols.mse}
                      active={sortKey === "mse"}
                      dir={sortDir}
                      onClick={() => toggleSort("mse")}
                    />
                    <SortTh
                      label={copy.cols.mae}
                      active={sortKey === "mae"}
                      dir={sortDir}
                      onClick={() => toggleSort("mae")}
                    />
                    {track === 'time_series' && (
                      <>
                        <SortTh
                          label="WAPE"
                          active={sortKey === "wape"}
                          dir={sortDir}
                          onClick={() => toggleSort("wape")}
                        />
                        <SortTh
                          label="RSE"
                          active={sortKey === "rse"}
                          dir={sortDir}
                          onClick={() => toggleSort("rse")}
                        />
                      </>
                    )}

                    <SortTh
                      label={copy.cols.corr}
                      active={sortKey === "corr"}
                      dir={sortDir}
                      onClick={() => toggleSort("corr")}
                    />
                  </>
                )}
                <Th>{copy.cols.runs}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const rank = r.displayRank;
                const catRank = r.categoryRank;
                const isBaseline = r.modelType === 'baseline';
                // For quant view on stock track, show "Buy and Hold" for baseline
                const displayName = isBaseline
                  ? (track === 'stock' && view === 'quant' ? copy.quant.buyAndHold : copy.quant.lastValueCopy)
                  : r.model;

                // Bar width = min-max normalized magnitude of the active sort
                // metric across visible rows. Works for any sign (handles the
                // negative quant returns/Sharpe values gracefully).
                const sortVals = rows
                  .map((row) => row[sortKey])
                  .filter((v): v is number => typeof v === 'number');
                const minV = sortVals.length ? Math.min(...sortVals) : 0;
                const maxV = sortVals.length ? Math.max(...sortVals) : 1;
                const cur = r[sortKey];
                const w =
                  typeof cur === 'number' && maxV > minV
                    ? (((cur - minV) / (maxV - minV)) * 100).toFixed(0)
                    : '0';

                return (
                  <tr
                    key={r.model}
                    className={`border-b border-border last:border-0 transition-colors ${
                      isBaseline
                        ? 'bg-accent/10 hover:bg-accent/15'
                        : 'hover:bg-paper-2'
                    }`}
                  >
                    <td className="px-5 py-2.5">
                      {rank ? (
                        <RankBadge rank={rank} />
                      ) : (
                        <span className="text-sm text-muted">—</span>
                      )}
                    </td>
                    {/* Show #Cat for real-time datasets */}
                    {(track === 'stock' || track === 'traffic' || track === 'air_quality') && (
                      <td className="px-5 py-2.5">
                        {catRank ? (
                          <span className="text-sm text-accent font-medium [font-variant-numeric:tabular-nums]">
                            {catRank}
                          </span>
                        ) : (
                          <span className="text-sm text-muted">—</span>
                        )}
                      </td>
                    )}
                    <td className="px-5 py-2.5 text-sm font-semibold">
                      <span className={isBaseline ? 'text-accent' : 'text-ink'}>
                        {displayName}
                      </span>
                      {isBaseline && (
                        <span className="ml-2 rounded border border-accent/40 bg-accent-soft px-1.5 py-0.5 text-[0.6rem] font-medium uppercase tracking-wide text-accent">
                          {copy.quant.baselineTag}
                        </span>
                      )}
                    </td>
                    
                    {/* Dynamic data columns based on view for stock track */}
                    {track === 'stock' && view === 'quant' ? (
                      // Quant metrics columns
                      <>
                        {QUANT_METRICS.map((m) => {
                          const v = r[m.key];
                          const active = sortKey === m.key;
                          return (
                            <td
                              key={m.key}
                              className={`relative px-5 py-2.5 font-mono text-sm ${quantColor(m.key, v)} ${active ? 'font-semibold' : ''}`}
                            >
                              {QUANT_FORMAT[m.key](v)}
                              {active && (
                                <span
                                  aria-hidden="true"
                                  className="absolute inset-x-0 bottom-0 h-px bg-accent/40"
                                  style={{ width: `${w}%` }}
                                />
                              )}
                            </td>
                          );
                        })}
                      </>
                    ) : (
                      // Regression metrics columns (default)
                      <>
                        <td className={`relative px-5 py-2.5 font-mono text-sm ${sortKey === 'mse' ? 'text-accent' : 'text-muted'}`}>
                          {fmt(r.mse)}
                          {sortKey === 'mse' && (
                            <span
                              aria-hidden="true"
                              className="absolute inset-x-0 bottom-0 h-px bg-accent/40"
                              style={{ width: `${w}%` }}
                            />
                          )}
                        </td>
                        <td className={`relative px-5 py-2.5 font-mono text-sm ${sortKey === 'mae' ? 'text-accent' : 'text-muted'}`}>
                          {fmt(r.mae)}
                          {sortKey === 'mae' && (
                            <span
                              aria-hidden="true"
                              className="absolute inset-x-0 bottom-0 h-px bg-accent/40"
                              style={{ width: `${w}%` }}
                            />
                          )}
                        </td>
                        {track === 'time_series' && (
                      <>
                        <td className={`relative px-5 py-2.5 font-mono text-sm ${sortKey === 'wape' ? 'text-accent' : 'text-muted'}`}>
                          {fmt(r.wape)}
                          {sortKey === 'wape' && (
                            <span
                              aria-hidden="true"
                              className="absolute inset-x-0 bottom-0 h-px bg-accent/40"
                              style={{ width: `${w}%` }}
                            />
                          )}
                        </td>
                        <td className={`relative px-5 py-2.5 font-mono text-sm ${sortKey === 'rse' ? 'text-accent' : 'text-muted'}`}>
                          {fmt(r.rse)}
                          {sortKey === 'rse' && (
                            <span
                              aria-hidden="true"
                              className="absolute inset-x-0 bottom-0 h-px bg-accent/40"
                              style={{ width: `${w}%` }}
                            />
                          )}
                        </td>
                      </>
                    )}

                        <td className={`relative px-5 py-2.5 font-mono text-sm ${sortKey === 'corr' ? 'text-accent' : 'text-muted'}`}>
                          {fmt(r.corr)}
                          {sortKey === 'corr' && (
                            <span
                              aria-hidden="true"
                              className="absolute inset-x-0 bottom-0 h-px bg-accent/40"
                              style={{ width: `${w}%` }}
                            />
                          )}
                        </td>
                      </>
                    )}
                    <td className="px-5 py-2.5 text-sm text-muted">
                      {isBaseline ? '—' : r.n_runs}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Visualization component for stock track - show in both regression and quant views */}
      {track === 'stock' && visualizationData && (
        <>
          <QuantVisualization
            data={visualizationData}
            availableModels={['AGCRN', 'AMRC', 'APN', 'Amplifier', 'Aurora', 'Autoformer', 'BiMamba', 'BiST', 'BigST', 'CARD', 'CATS', 'CMoS', 'COSA', 'CoRA', 'CrossGNN', 'CrossLinear', 'Crossformer', 'CycleNet', 'D2STGNN', 'DCRNN', 'DFDGCN', 'DGCRN', 'DLinear', 'DSFormer', 'DSTAGNN', 'DTAF', 'DUET', 'DeepAR', 'DistDF', 'DynamicTMoE', 'ETSformer', 'FEDformer', 'FITS', 'FTP', 'FeTS', 'FiLM', 'FreTS', 'Fredformer', 'GOTSF', 'GTR', 'GTS', 'GWNet', 'HDMixer', 'HL', 'HMformer', 'HN_MVTS', 'HimNet', 'ImplicitForecaster', 'Informer', 'InterPDN', 'Koopa', 'Kronos', 'LSTM', 'LatentTSF', 'LightTS', 'Linear', 'MAFS', 'MAGE', 'MICN', 'MMPD', 'MSGNet', 'MTGNN', 'MTSMixer', 'MambaSimple', 'MixLinear', 'MoFo', 'ModernTCN', 'MultiPatchFormer', 'NBeats', 'NHiTS', 'NLinear', 'NSTransformer', 'OLinear', 'OccamVTS', 'PAttn', 'PHAT', 'PMDformer', 'PULSE', 'PWS', 'PaiFilter', 'PatchMLP', 'PatchTST', 'Pathformer', 'PhaseFormer', 'Pyraformer', 'RLinear', 'RPMixer', 'Reformer', 'S4', 'SCINet', 'SEMPO', 'SOFTS', 'SRSNet', 'STAEformer', 'STDN', 'STGCN', 'STGODE', 'STID', 'STNorm', 'STOP', 'STPGNN', 'STTN', 'STWave', 'SVTime', 'S_Mamba', 'SegRNN', 'Sonnet', 'SparseTSF', 'StemGNN', 'Sumba', 'SymTime', 'TSMixer', 'TSRAG', 'TexFilter', 'TiDE', 'TiRex', 'TimeAlign', 'TimeBase', 'TimeBridge', 'TimeCAP', 'TimeEmb', 'TimeFilter', 'TimeKAN', 'TimeMixer', 'TimeMosaic', 'TimeO1', 'TimePerceiver', 'TimeXer', 'TimesNet', 'Transformer', 'UMixer', 'WPMixer', 'WaveNet', 'iTransformer', 'xPatch']}
            view={view}
            copy={copy}
          />

          {/* Trading strategy description - only show in Quant view */}
          {view === 'quant' && <TradingStrategyDescription copy={copy} />}
        </>
      )}
    </div>
  );
}

// Unified segmented toggle button. One active treatment (filled accent) and
// one shape (rounded-md) across every "pick one" control on the page; only the
// size varies — lg (primary categories), md (tracks/views), sm (filters).
export function Seg({
  active,
  onClick,
  disabled = false,
  size = "sm",
  className = "",
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  size?: "lg" | "md" | "sm";
  className?: string;
  children: React.ReactNode;
}) {
  const sizes = {
    lg: "px-5 py-2 text-sm font-medium",
    md: "px-3 py-1.5 text-sm font-medium",
    sm: "px-2.5 py-1 text-xs font-medium",
  } as const;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border transition-colors ${sizes[size]} ${
        active
          ? "border-accent bg-accent text-accent-fg shadow-sm"
          : "border-border bg-surface text-muted hover:text-ink hover:border-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
      } ${className}`}
    >
      {children}
    </button>
  );
}

// Top-3 get a gold-tinted badge; everyone else a plain muted rank. No emoji —
// the medal is carried by the accent, on-brand with the rest of the site.
function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-accent/50 bg-accent-soft text-xs font-semibold text-accent [font-variant-numeric:tabular-nums]">
        {rank}
      </span>
    );
  }
  return (
    <span className="text-sm text-muted [font-variant-numeric:tabular-nums]">
      {rank}
    </span>
  );
}

function Th({
  children,
  className = "",
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <th
      title={title}
      className={`border-b border-border bg-surface px-5 py-2.5 text-left text-[0.7rem] font-medium uppercase tracking-[0.04em] text-faint ${title ? 'cursor-help' : ''} ${className}`}
    >
      {children}
    </th>
  );
}

function SortTh({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: number;
  onClick: () => void;
}) {
  return (
    <th className="border-b border-border bg-surface px-5 py-2.5 text-left text-[0.7rem] font-medium uppercase tracking-[0.04em]">
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 uppercase tracking-[0.04em] transition-colors ${
          active ? "text-accent" : "text-faint hover:text-ink"
        }`}
      >
        {label}
        {active ? (dir > 0 ? "↑" : "↓") : ""}
      </button>
    </th>
  );
}
