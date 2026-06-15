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
python pipeline/build_leaderboard.py            # validate → aggregate → write data/leaderboard.json
python pipeline/build_leaderboard.py --no-write # dry-run summary
```

Stdlib-only (no torch). Every `submission.json` is schema-validated (`pipeline/validate.py`),
then rows are aggregated per `(track, dataset, horizon, model)` — metrics **averaged across
runs/seeds** with `n_runs` + `<metric>_std` — and ranked by MSE. Blocks with no raw submissions
yet (air-quality, the stock *quant* view) are preserved as a curated overlay.

**See [`SUBMITTING.md`](../SUBMITTING.md) for the full submission format + multi-seed averaging rules.**

## Current contents

- `realtime/stock_hs300/` — the "百模大战" run: **108 models** × CSI-300 (seq 20 → pred 5), 124 submissions.
