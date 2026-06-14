# @diaugeia/tseval-leaderboard

The **TS-Eval leaderboard** — UI components, leaderboard data, and the data-generation
pipeline. Extracted from the Diaugeia website so it can evolve independently.

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
  leaderboard.json         # the board (regenerated from HF Diaugeia/TSEval-Submissions)
  visualization_data.json  # cumulative/log-return series for the chart
scripts/
  generate_tseval_json.py  # build leaderboard.json from submissions
  merge_quant_data.py      # merge quant backtest results into the board
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

## Data regeneration

```bash
python scripts/generate_tseval_json.py   # HF submissions -> data/leaderboard.json
python scripts/merge_quant_data.py        # + quant backtest columns
```
