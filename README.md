# @diaugeia/tseval-leaderboard

The **TS-Eval leaderboard** — UI components and the leaderboard data (single source
of truth). Extracted from the Diaugeia website so it can evolve independently.

Consumed by [`Diaugeia/HomePageSourceCode`](https://github.com/Diaugeia/HomePageSourceCode)
as a **git submodule** at `vendor/tseval-leaderboard`, compiled as source by the host's
Next.js / Tailwind toolchain (no separate build step).

## Layout

```
src/
  leaderboard.tsx          # <Leaderboard> — tracks, datasets, regression/quant views
  quant-visualization.tsx  # recharts performance chart + trading-strategy copy
  types.ts                 # LeaderboardDict (i18n shape) + re-exports
  index.ts                 # public entry: Leaderboard, LeaderboardData, LeaderboardDict
data/
  leaderboard.json         # the board — single source of truth (curated snapshot)
  visualization_data.json  # cumulative/log-return series for the chart
```

## Host integration (git submodule)

```bash
git submodule add git@github.com:Diaugeia/tseval-leaderboard.git vendor/tseval-leaderboard
```

In the host:

- `tsconfig.json` paths: `"@tseval": ["vendor/tseval-leaderboard/src/index.ts"]`,
  `"@tseval/*": ["vendor/tseval-leaderboard/src/*"]`.
- `app/globals.css`: `@source "../vendor/tseval-leaderboard/src";` so Tailwind keeps the
  component class names.
- Copy the chart data into `public/` before build:
  `"prebuild": "cp vendor/tseval-leaderboard/data/visualization_data.json public/"`.
- Import and render:

  ```tsx
  import { Leaderboard, type LeaderboardData } from "@tseval";
  import data from "vendor/tseval-leaderboard/data/leaderboard.json";
  // copy = your dictionary's `tseval` slice (structurally a LeaderboardDict)
  <Leaderboard data={data as unknown as LeaderboardData} copy={copy} />
  ```

Clone the host with `--recurse-submodules` (or run `git submodule update --init`); CI
must enable submodule checkout.

## Required host CSS tokens

The components use Tailwind utilities backed by these CSS variables (define them in the
host, light + dark): `--color-paper`, `--color-paper-2`, `--color-surface`,
`--color-border`, `--color-border-strong`, `--color-ink`, `--color-muted`,
`--color-faint`, `--color-accent`, `--color-accent-fg`, `--color-accent-soft`.

Peer deps (provided by the host): `react`, `react-dom`, `next`, `next-themes`, `recharts`.

## Localization

The UI is fully localized through the `LeaderboardDict` object the host passes as `copy`.
Metric abbreviations (MSE / MAE / Sharpe / Win Rate …) stay English by convention.

## Data provenance

`data/leaderboard.json` and `data/visualization_data.json` are the **single source of
truth** for the board and are edited here directly.

- **Regression tracks** (time_series / spatiotemporal / air_quality) originated from the
  HF `Diaugeia/TSEval-Submissions` pipeline.
- **Stock quant block + the chart series** are a frozen snapshot of an offline backtest;
  the raw backtest inputs are no longer available, so these are curated in place rather
  than regenerated.

To update the board, edit the JSON in `data/` (keep the shape in `src/types.ts` /
`LeaderboardData`) and commit — the host site picks it up by bumping the submodule.
