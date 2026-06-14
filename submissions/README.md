---
license: mit
pretty_name: TSEval Submissions
tags: [time-series, forecasting, leaderboard, benchmark]
---

# TSEval — Submissions

Append-only index of **leaderboard submissions** for the [Diaugeia](https://diaugeia.ai) TSEval benchmark.
This repo holds only the lightweight **evidence** of each run so it stays cheap to clone and to rebuild the
leaderboard from. Model weights live separately in [`Diaugeia/TSEval-Weights`](https://huggingface.co/datasets/Diaugeia/TSEval-Weights).

## Layout

```
<track>/<dataset>/<model>/<submission_id>/
    submission.json     # tsf_core.SubmissionReport: manifest + DatasetSpec + RunRecord(s) + refs
    trajectory.jsonl    # the agent's experiment process (synthetic for bulk imports)
    report.html         # human-readable per-submission summary
```

`submission.json` references its checkpoint in `TSEval-Weights` by `weights://` path + sha256 (manifest `files[].role = "weight"`).

## Tracks

- `realtime/` — live, periodically-refreshed datasets (e.g. `stock_hs300`, CSI-300, seq_len 20 → pred_len 5).
- `time_series/`, `spatiotemporal/`, `covariate/` — static benchmark datasets (see `Diaugeia/TSEval-Static`).

## How the leaderboard is built

```bash
uv run python tool/tsf.py leaderboard-build --source . --out leaderboard.json
```

Deterministic, `tsf_core` + stdlib only (no torch). Each bundle is checked (result + trajectory present, schema-valid),
then collated and ranked per `(track, dataset, horizon)` by MSE. See `Diaugeia/ModernTSF` `docs/*/tseval-submit.md`.

## Current contents

- `realtime/stock_hs300/` — the "百模大战" run: **108 models** × CSI-300 (seq 20 → pred 5), 124 submissions.
