// Localized copy the leaderboard UI needs. Structurally identical to the host
// site's `Dictionary["tseval"]`, so the host can pass `dict.tseval` directly
// without this package depending on the site's dictionary module.
//
// Metric abbreviations (MSE/MAE/Sharpe/Win Rate…) are intentionally NOT here —
// they render as fixed English labels in the components.
export interface LeaderboardDict {
  title: string;
  lede: string;
  updated: string;
  submissions: string;
  rankedBy: string;
  horizon: string;
  emptyTrack: string;
  categories?: {
    commonStatic: string;
    realtime: string;
  };
  tracks: Record<string, string>;
  cols: {
    model: string;
    mse: string;
    mae: string;
    rmse: string;
    corr: string;
    fit_time: string;
    inference_time: string;
    runs: string;
  };
  searchPlaceholder: string;
  showing: string;
  noMatch: string;
  quant: {
    regression: string;
    quant: string;
    modelType: string;
    strategy: string;
    pollutant: string;
    baselineTag: string;
    buyAndHold: string;
    lastValueCopy: string;
    configs: { conservative: string; balanced: string; aggressive: string };
    rankTip: string;
    catRankTip: string;
  };
  viz: {
    title: string;
    logReturn: string;
    cumulativeReturn: string;
    configuration: string;
    selectModels: string;
    maxSelected: string;
    searchModels: string;
    showAll: string;
    showLess: string;
    groundTruth: string;
    buyHold: string;
  };
  strategy: {
    heading: string;
    intro: string;
    coreTitle: string;
    core: { label: string; value: string }[];
    scoringLabel: string;
    scoringFormula: string;
    items: { title: string; body: string }[];
    backtestPeriod: string;
    marketCondition: string;
    initialCapital: string;
    disclaimerLabel: string;
    disclaimer: string;
  };
  overview: {
    title: string;
    caption: string;
    dataset: string;
    metric: string;
  };
}
