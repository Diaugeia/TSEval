# TSEval

**An open, reproducible leaderboard for time-series forecasting.** Every entry is a
community submission — one agent trajectory and one verified result — ranked
transparently across tracks, datasets, and horizons.

🔗 **Live:** **[tseval.diaugeia.ai](https://tseval.diaugeia.ai)**
&nbsp;·&nbsp; Mirror: [Hugging Face Space](https://huggingface.co/spaces/Diaugeia/TSEval)

This repository is the **single source of truth** for TSEval: the website, the
community submission store, and the build pipeline that turns submissions into the
ranked board. Push a submission → CI validates, aggregates, and redeploys.

## Datasets on Hugging Face

The benchmark datasets and trained checkpoints live on the Hugging Face Hub:

- 📦 **Datasets** — [`Diaugeia/TSEval-Static`](https://huggingface.co/datasets/Diaugeia/TSEval-Static)
  (the static benchmark sets: ETT, electricity, solar, traffic, weather, …)
- 🧠 **Model weights** — [`Diaugeia/TSEval-Weights`](https://huggingface.co/datasets/Diaugeia/TSEval-Weights)
  (checkpoints, referenced from submissions by `weights://` path + sha256; never stored in this repo)

This repo holds only the lightweight **evidence** of each run (small JSON), so it
stays cheap to clone and to rebuild the board from.

## Tracks & datasets

| Category | Track | Datasets | Source |
|---|---|---|---|
| Common / static | `time_series` | ETTh1, ETTm1, ETTh2, ETTm2, electricity, solar, traffic, weather | submission-driven |
| Real-time | `stock` | Stock-HS300 (CSI-300) — regression + quant backtest views | regression from submissions; quant curated |
| Real-time | `air_quality` | Air-CHNCities (6 pollutants) | curated |

Each block is ranked per `(track, dataset, horizon)` by **MSE** (lower is better).
The "Method Evolution" chart plots publication year vs MSE using per-model metadata
in [`data/model-meta.json`](data/model-meta.json) (harvested from ModernTSF).

## How to submit & how to upload data

> Full format, field reference, and the multi-seed averaging rules:
> **[`SUBMITTING.md`](SUBMITTING.md)**.

**1. How to submit a result.** Run your model in
[ModernTSF](https://github.com/Diaugeia/ModernTSF), which emits a submission bundle
per the **TSF-Core contract** (`submission.json` + `report.md` + `trajectory.jsonl`,
no weights). Add it under `submissions/<track>/<dataset>/<model>/<run_id>/` and open a
PR. CI checks the contract schema + the ModernTSF binding before merge.

**2. How to upload data.** Commit one `submission.json` per run, then push to `main`:

```bash
# preview locally
python3 pipeline/build_leaderboard.py --no-write
git add submissions/…/submission.json
git push    # CI: validate → aggregate → deploy to both targets
```

`submission.json` (flat shape):

```jsonc
{
  "model": "PatchTST",        // must match a ModernTSF model name
  "dataset_id": "ETTh1",      // ETTh1 … weather, or stock_hs300
  "track": "time_series",     // "time_series" | "realtime"
  "seed": 2021,               // one seed per file
  "results": [{ "horizon": 192, "metrics": { "mse": 0.45, "mae": 0.43, "corr": 0.62 } }]
}
```

**Averaging across seeds:** submit several files with the same `model`/`dataset`/
`horizon` and different `seed` — the board reports the **mean**, plus `n_runs` and
`<metric>_std`. No configuration needed.

## How the board is built

```
push main
  └─ .github/workflows/deploy.yml
       ├ python3 pipeline/build_leaderboard.py   validate → aggregate submissions/ → data/leaderboard.json
       ├ bun run build                           Next static export → out/
       └ deploy the SAME out/ to two static targets:
            ├─► Cloudflare Pages          →  tseval.diaugeia.ai   (primary)
            └─► Hugging Face Space (static) →  TSEval space        (mirror)
```

- `pipeline/validate.py` — TSF-Core contract schema + ModernTSF-binding check.
- `pipeline/build_leaderboard.py` — aggregates submissions (mean/std/`n_runs`) and
  ranks by MSE; preserves a **curated overlay** for blocks without raw submissions
  yet (air-quality, the stock quant view).
- `pipeline/build_model_meta.py` — regenerates `data/model-meta.json` from a
  ModernTSF checkout.

Build is **once** in CI; the same artifact ships to both targets, so they stay
identical (static, CDN, no cold start).

## Develop

```bash
bun install
bun run dev      # http://localhost:3000
bun run build    # static export → out/
```

## Repository layout

```
app/, src/, lib/, components/   self-contained Next app (UI + en/中文 copy + design tokens)
  src/leaderboard.tsx           orchestrator (category/track/view + URL state)
  src/dataset-card.tsx          per-dataset card (filters + chart slot + table)
  src/results-table.tsx         the ranked table
  src/evolution-chart.tsx       Method Evolution chart (ECharts)
  src/quant-visualization.tsx   stock P&L + prediction-accuracy charts
  src/lib/, src/ui/             metrics, model types, dataset order, shared UI
data/                           leaderboard.json + model-meta.json + visualization_data.json
submissions/                    community submission bundles (small JSON, no weights)
pipeline/                       contract schema + validate + build_leaderboard + build_model_meta
.github/workflows/              validate (PRs) + deploy (build once → 2 targets)
```

## Related

- [ModernTSF](https://github.com/Diaugeia/ModernTSF) — the forecasting library that
  produces submissions and supplies model metadata.
- [Diaugeia](https://diaugeia.ai) — open infrastructure for AI research.

---

διαύγεια · open, reproducible time-series forecasting.
