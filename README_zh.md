<div align="center">

# 📊 TSEval

**开放、可复现的时间序列预测榜单**

[![Live](https://img.shields.io/badge/live-tseval.diaugeia.ai-8c6f24.svg)](https://tseval.diaugeia.ai)
[![🤗 Space](https://img.shields.io/badge/🤗%20Space-Diaugeia/TSEval-yellow.svg)](https://huggingface.co/spaces/Diaugeia/TSEval)
[![🤗 Datasets](https://img.shields.io/badge/🤗%20Datasets-TSEval--Static-orange.svg)](https://huggingface.co/datasets/Diaugeia/TSEval-Static)
[![Next.js](https://img.shields.io/badge/Next.js-static%20export-black.svg?logo=next.js)](https://nextjs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

每一条结果都来自社区提交——一段智能体轨迹 + 一份经校验的结果——按赛道、数据集与预测步长透明排名。

[**English**](README.md) | [**中文**](README_zh.md)

</div>

---

## 🧭 TSEval 是什么

TSEval 是 [ModernTSF](https://github.com/Diaugeia/ModernTSF) 的公开榜单:一个开放、**可复现**的
时间序列预测方法排名。这里没有「手填的表格」——每一行都从一份提交(`submission.json`:指标 +
智能体轨迹 + 运行元数据)**重新生成**,因此结果之间可比、可审计。

本仓库是**唯一真源**:网站、社区提交库、以及把提交变成榜单的构建管线。
推一份提交 → CI 自动校验、聚合、重新部署。

---

## ✨ 特性

- 🏆 **提交驱动** —— 每次 push 都从 `submissions/` 重建榜单,没有任何手工编辑。
- 🔬 **可复现可审计** —— 每份提交含指标 + 轨迹 + 运行元数据;多 seed 自动取均值并记录 `n_runs` 与标准差。
- 📈 **方法演进图** —— 100+ 方法的「发表年份 vs MSE」,带历年最优(SOTA)前沿线(ECharts,支持缩放/悬停/对数轴)。
- 💹 **不止回归** —— 股票赛道同时给出预测指标 *和* 量化回测视图(盈亏、夏普、回撤),另有空气质量赛道。
- 🌏 **双语 + 主题** —— 完整中英文、明暗模式,自包含静态站点(无后端、无冷启动)。
- ⚡ **构建一次、部署两端** —— 同一份 CI 产物部署到 Cloudflare Pages(主)和 Hugging Face Space(镜像)。

---

## 🔗 在线与数据

- 🌐 **网站:** [tseval.diaugeia.ai](https://tseval.diaugeia.ai) · 镜像:[Hugging Face Space](https://huggingface.co/spaces/Diaugeia/TSEval)
- 📦 **数据集**(在 Hugging Face):[`Diaugeia/TSEval-Static`](https://huggingface.co/datasets/Diaugeia/TSEval-Static) —— 基准数据集(ETT、electricity、solar、traffic、weather…)
- 🧠 **权重:** [`Diaugeia/TSEval-Weights`](https://huggingface.co/datasets/Diaugeia/TSEval-Weights) —— 模型 checkpoint,由提交用 `weights://` + sha256 引用(不存本仓库)

---

## 📊 赛道与数据集

| 类别 | 赛道 | 数据集 | 来源 |
|---|---|---|---|
| 通用 / 静态 | `time_series` | ETTh1、ETTm1、ETTh2、ETTm2、electricity、solar、traffic、weather | 提交驱动 |
| 实时 | `stock` | Stock-HS300(沪深 300)—— 回归 + 量化回测 | 回归来自提交;量化为 curated |
| 实时 | `air_quality` | Air-CHNCities(6 种污染物) | curated |

每个区块按 `(赛道, 数据集, 步长)` 以 **MSE** 排名(越低越好)。

---

## 📤 提交与上传

> 完整格式 + 多 seed 取均值规则见 **[SUBMITTING.md](SUBMITTING.md)**。

每个 run 写一份 `submission.json`,然后 push:

```bash
python3 pipeline/build_leaderboard.py --no-write   # 本地预览
git add submissions/…/submission.json && git push  # CI:校验 → 聚合 → 部署
```

```jsonc
{
  "model": "PatchTST",        // 需与 ModernTSF 模型名一致
  "dataset_id": "ETTh1",      // ETTh1 … weather,或 stock_hs300
  "track": "time_series",     // "time_series" | "realtime"
  "seed": 2021,
  "results": [{ "horizon": 192, "metrics": { "mse": 0.45, "mae": 0.43, "corr": 0.62 } }]
}
```

**取均值:** 同一 `model`/`dataset`/`horizon` 交多份不同 `seed` 的文件,该行会显示**均值**、`n_runs` 和 `<metric>_std`。

---

## ⚙️ 榜单怎么构建

```
push main
  └─ .github/workflows/deploy.yml
       ├ python3 pipeline/build_leaderboard.py   校验 → 聚合 submissions/ → data/leaderboard.json
       ├ bun run build                           Next 静态导出 → out/
       └ 同一份 out/ 部署到两个静态目标:
            ├─► Cloudflare Pages           →  tseval.diaugeia.ai   (主)
            └─► Hugging Face Space (static) →  TSEval space         (镜像)
```

- `pipeline/validate.py` —— TSF-Core 合约 schema + ModernTSF 绑定校验。
- `pipeline/build_leaderboard.py` —— 聚合提交(均值 / 标准差 / `n_runs`),按 MSE 排名;尚无原始提交的区块(空气质量、股票量化)用 curated 兜底。
- `pipeline/build_model_meta.py` —— 从 ModernTSF 检出重新生成 `data/model-meta.json`(发表年份)。

---

## 🛠️ 本地开发

```bash
bun install
bun run dev      # http://localhost:3000
bun run build    # 静态导出 → out/
```

---

## 🗂️ 仓库结构

```
app/, src/, lib/, components/   自包含 Next 应用(UI + 中英文文案 + 设计 token)
  src/leaderboard.tsx           编排器(类别/赛道/视图 + URL 状态)
  src/dataset-card.tsx          单数据集卡片(筛选 + 图表位 + 表格)
  src/results-table.tsx         排名表格
  src/evolution-chart.tsx       方法演进图(ECharts)
  src/quant-visualization.tsx   股票盈亏 + 预测准度图
  src/lib/, src/ui/             指标、模型类型、数据集顺序、共享 UI
data/                           leaderboard.json + model-meta.json + visualization_data.json
submissions/                    社区提交(小 JSON,不含权重)
pipeline/                       合约 schema + validate + build_leaderboard + build_model_meta
.github/workflows/              validate(PR)+ deploy(构建一次 → 两端)
```

---

## 🔗 相关

- [ModernTSF](https://github.com/Diaugeia/ModernTSF) —— 产出提交、并提供模型元数据的预测库。
- [Diaugeia](https://diaugeia.ai) —— 面向 AI 研究的开放基础设施。

---

## 📜 License

基于 [MIT License](LICENSE) 开源。版权所有 © 2026 **Diaugeia.AI**。

<div align="center">

διαύγεια · 开放、可复现的时间序列预测。

</div>
