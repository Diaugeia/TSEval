# TS-Eval leaderboard

The **TS-Eval** time-series forecasting leaderboard — a standalone, self-contained
static site plus the community submission store and validation pipeline.

**Live:** [tseval.diaugeia.ai](https://tseval.diaugeia.ai) · mirror on
[Hugging Face Space](https://huggingface.co/spaces/Diaugeia/TSEval).

## How it works

```
GitHub  Diaugeia/tseval-leaderboard   (this repo — single source of truth)
  ├ app/, src/, lib/, components/   self-contained Next app (UI + en/zh copy + tokens)
  ├ data/                           leaderboard.json + visualization_data.json (the board)
  ├ submissions/                    community submission bundles (small JSON, no weights)
  ├ pipeline/                       TSF-Core contract schema + validate.py + build_leaderboard.py
  └ .github/workflows/              validate (PRs) + deploy (build once → 2 targets)
        push main → build static `out/` → deploy to:
          ├─► Cloudflare Pages  →  tseval.diaugeia.ai
          └─► Hugging Face Space (static)  →  diaugeia-tseval.static.hf.space
```

Build is **once** in CI, then the same artifact ships to both targets, so they stay
identical. Both are static (CDN, no cold start).

## Develop

```bash
bun install
bun run dev      # http://localhost:3000
bun run build    # static export → out/
```

## Submitting (community)

Run your model in [ModernTSF](https://github.com/Diaugeia/ModernTSF); it emits a
submission bundle per the **TSF-Core contract** (`submission.json` + `report.md` +
`trajectory.jsonl`, no weights). Open a PR adding it under `submissions/`. CI
(`pipeline/validate.py`) checks the contract schema and the ModernTSF binding before
merge; on merge the board redeploys.

```bash
python3 pipeline/validate.py        # schema + ModernTSF-binding check
```

## Data

`data/leaderboard.json` is the served board. Regression tracks originate from the
ModernTSF/HF submission pipeline; the air-quality + stock-quant tracks are a curated
snapshot (their raw backtest inputs are no longer available) and are kept in place
until replaced by real submissions. Model weights live in the private
`Diaugeia/TSEval-Weights` repo — never in submissions.

## Layout details

- UI components in `src/` (`<Leaderboard>`, `quant-visualization`); the app shell in
  `app/` adds a client-side EN/中文 toggle, theme toggle, and the hero.
- `lib/dict.ts` carries the en/zh copy; `app/globals.css` the design tokens.
- `visualization_data.json` is copied into `public/` at dev/build (`sync:data`).
