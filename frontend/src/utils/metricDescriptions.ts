export interface MetricDescription {
  label: string;
  formula: string;
  overview: string;
  thresholds?: { green: string; amber: string; red: string };
  higherIsBetter?: boolean;
}

export const METRIC_DESCRIPTIONS: Record<string, MetricDescription> = {
  KS: {
    label: 'KS Statistic',
    formula: 'KS = max(TPR − FPR) across all classification thresholds',
    overview:
      'Kolmogorov-Smirnov statistic measures the maximum separation between the cumulative distribution of good and bad accounts across score bands. A higher KS indicates better discriminatory power — the model can more clearly separate risk segments.',
    thresholds: {
      green: '> 0.35 — Good discrimination',
      amber: '0.25 – 0.35 — Acceptable, monitor closely',
      red: '< 0.25 — Poor discrimination, review required',
    },
    higherIsBetter: true,
  },
  PSI: {
    label: 'Population Stability Index',
    formula: 'PSI = Σ (Actual% − Expected%) × ln(Actual% / Expected%)',
    overview:
      'PSI measures how much the score distribution has shifted between development (baseline) and current production populations. A low PSI indicates the model is seeing similar applicant profiles; a high PSI signals population drift that may degrade model performance.',
    thresholds: {
      green: '< 0.10 — Stable, no action required',
      amber: '0.10 – 0.25 — Moderate shift, investigation recommended',
      red: '> 0.25 — Significant drift, redevelopment may be needed',
    },
    higherIsBetter: false,
  },
  AUC: {
    label: 'AUC-ROC',
    formula: 'Area under the Receiver Operating Characteristic curve',
    overview:
      'AUC-ROC represents the probability that a randomly chosen positive (bad) account is ranked higher than a randomly chosen negative (good) account. An AUC of 0.5 is equivalent to random guessing; 1.0 is perfect discrimination.',
    thresholds: {
      green: '> 0.75 — Good model performance',
      amber: '0.65 – 0.75 — Moderate performance',
      red: '< 0.65 — Poor performance, recalibration needed',
    },
    higherIsBetter: true,
  },
  Gini: {
    label: 'Gini Coefficient',
    formula: 'Gini = 2 × AUC − 1',
    overview:
      'Gini is a linear transformation of AUC. It ranges from −1 to +1, where 0 indicates random performance and 1 indicates perfect discrimination. Often preferred in credit risk as it directly maps to the separation between good and bad distributions.',
    thresholds: {
      green: '> 0.50 — Strong model',
      amber: '0.30 – 0.50 — Acceptable',
      red: '< 0.30 — Weak model',
    },
    higherIsBetter: true,
  },
  bad_rate: {
    label: 'Bad Rate',
    formula: 'Bad Rate = Number of Bads / Total Population',
    overview:
      'The proportion of accounts in the portfolio that are classified as "bad" (defaulted, delinquent, or fraudulent). Bad rate is a key portfolio health indicator. Significant deviations from development bad rate may signal population drift or macroeconomic changes.',
    thresholds: {
      green: 'Stable within ±15% of baseline bad rate',
      amber: '15–30% deviation from baseline',
      red: '>30% deviation from baseline',
    },
    higherIsBetter: false,
  },
  MAPE: {
    label: 'MAPE (Mean Absolute Percentage Error)',
    formula: 'MAPE = (1/n) × Σ |Actual − Forecast| / |Actual| × 100%',
    overview:
      'Mean Absolute Percentage Error measures the average percentage deviation between model predictions and actual outcomes. Lower MAPE indicates better predictive accuracy. It is scale-independent and particularly useful for comparing forecast accuracy across models with different magnitudes.',
    thresholds: {
      green: '< 10% — Excellent forecast accuracy',
      amber: '10% – 20% — Acceptable deviation, monitor closely',
      red: '> 20% — High forecast error, model review required',
    },
    higherIsBetter: false,
  },
  accuracy: {
    label: 'Accuracy',
    formula: 'Accuracy = (TP + TN) / Total',
    overview:
      'Overall fraction of correctly classified instances. Caution: accuracy can be misleading for highly imbalanced datasets (e.g., fraud detection). Consider precision, recall, and AUC as complementary metrics.',
    thresholds: {
      green: '> 0.85 — High accuracy',
      amber: '0.70 – 0.85 — Moderate',
      red: '< 0.70 — Low accuracy',
    },
    higherIsBetter: true,
  },
  precision: {
    label: 'Precision',
    formula: 'Precision = TP / (TP + FP)',
    overview:
      'Of all accounts the model predicted as positive (bad/fraud), what fraction were actually positive. High precision minimises false alarms and wasted intervention costs.',
    thresholds: {
      green: '> 0.80 — Low false-positive cost',
      amber: '0.65 – 0.80 — Moderate false-positive rate',
      red: '< 0.65 — High false-positive cost',
    },
    higherIsBetter: true,
  },
  recall: {
    label: 'Recall (Sensitivity)',
    formula: 'Recall = TP / (TP + FN)',
    overview:
      'Of all actual positive (bad/fraud) cases, what fraction were correctly identified. High recall minimises missed bad accounts at the cost of more false positives.',
    thresholds: {
      green: '> 0.75 — High detection rate',
      amber: '0.60 – 0.75 — Moderate detection',
      red: '< 0.60 — High miss rate',
    },
    higherIsBetter: true,
  },
  f1_score: {
    label: 'F1 Score',
    formula: 'F1 = 2 × (Precision × Recall) / (Precision + Recall)',
    overview:
      'Harmonic mean of precision and recall. Provides a single balanced score when both false positives and false negatives carry costs. Particularly valuable for imbalanced classification problems.',
    thresholds: {
      green: '> 0.75 — Well-balanced model',
      amber: '0.60 – 0.75 — Acceptable balance',
      red: '< 0.60 — Poor balance',
    },
    higherIsBetter: true,
  },
  ROB: {
    label: 'Rank Order Break (ROB) Chart',
    formula: 'ROB = |Monitoring Node Rank − Reference Node Rank| where rank is assigned by descending bad rate',
    overview:
      'The Rank Order Break chart compares node bad-rate rankings between a reference vintage and a monitoring vintage. A ROB occurs when a node\'s rank in the monitoring period differs from its reference rank — indicating the model no longer correctly separates risk. The total ROB % = (number of nodes with rank inversions) / (total nodes) × 100.',
    thresholds: {
      green: 'ROB = 0% — Perfect rank ordering maintained',
      amber: 'ROB 1–25% — Minor rank inversions, review recommended',
      red: 'ROB > 25% — Significant rank disorder, escalate to Model Governance',
    },
    higherIsBetter: undefined,
  },
  ConfusionMatrix: {
    label: 'Confusion Matrix',
    formula: '2×2 matrix of TP, FP, FN, TN outcomes',
    overview:
      'A confusion matrix summarises the four possible classification outcomes: True Positives (correctly predicted bads), True Negatives (correctly predicted goods), False Positives (goods incorrectly flagged as bad), and False Negatives (bads missed by the model). Use it alongside precision, recall, and F1 to understand the trade-off between miss rate and false-alarm rate.',
    higherIsBetter: undefined,
  },
  HRL: {
    label: 'Hit Rate Lift (HRL) — Fraud Models',
    formula: 'HRL = Bads captured above score threshold / Total Bads',
    overview:
      'Hit Rate Lift (formerly Hit Rate at Level) measures the proportion of actual fraudulent or bad accounts captured by the model when a fixed score threshold is applied. Applicable to fraud detection models. A high HRL at a given threshold means fewer missed-fraud losses and higher operational effectiveness.',
    thresholds: {
      green: '> 70% — High capture at threshold level',
      amber: '55% – 70% — Moderate capture, review threshold',
      red: '< 55% — Low capture, model may need recalibration',
    },
    higherIsBetter: true,
  },
  change_in_KS: {
    label: 'Change in KS% vs Reference',
    formula: 'ΔKS% = (KS_monitoring − KS_reference) / KS_reference × 100',
    overview:
      'Tracks the percentage change in KS Statistic relative to the reference (training) vintage. A negative ΔKS% indicates the model is losing discriminatory power over time. A value near zero means the model is stable. Trend direction is more important than a single observation — sustained decline warrants investigation.',
    thresholds: {
      green: 'ΔKS% > −5% — Stable discrimination',
      amber: 'ΔKS% −5% to −15% — Moderate degradation, review recommended',
      red: 'ΔKS% < −15% — Significant degradation, escalate',
    },
    higherIsBetter: true,
  },
};

export const ALL_METRIC_KEYS = Object.keys(METRIC_DESCRIPTIONS);

export const DEFAULT_SELECTED_METRICS = ['volume_bad_rate', 'KS', 'PSI', 'AUC', 'Gini', 'bad_rate', 'MAPE', 'ROB', 'ConfusionMatrix'];

