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
  CA_at_10: {
    label: 'Capture Rate at 10%',
    formula: 'CA@10 = Cumulative Bads in top 10% of scores / Total Bads',
    overview:
      'The percentage of all bads captured in the top 10% worst-scoring accounts. This is a business-critical metric for resource allocation — a high CA@10 means actions targeting the top risk decile will capture a large proportion of future bads.',
    thresholds: {
      green: '> 0.30 — High capture efficiency',
      amber: '0.20 – 0.30 — Moderate capture',
      red: '< 0.20 — Low capture, operational efficiency concern',
    },
    higherIsBetter: true,
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
    label: 'Risk-Ordered Band (ROB) Chart',
    formula: 'Bad Rate per Score Band = Bad Count / Total Count in Band',
    overview:
      'The ROB chart plots bad rate across ordered score bands (0.0–1.0 probability of default or risk). Well-functioning models show a monotonically increasing bad rate as scores increase, confirming the model correctly rank-orders risk. Non-monotonic patterns indicate calibration or segmentation issues.',
    thresholds: {
      green: 'Monotonically increasing bad rate across bands',
      amber: 'Minor inversions in 1–2 bands',
      red: 'Multiple non-monotonic inversions',
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
    label: 'Hit Rate at Level (HRL)',
    formula: 'HRL = Bads captured above score threshold / Total Bads',
    overview:
      'Hit Rate at Level measures the proportion of actual bad accounts captured by the model when a fixed score threshold (level) is applied. It quantifies the operational effectiveness of the model at a specific cut-off — e.g., what fraction of future defaults are flagged before they occur. HRL is critical for deployment: a high HRL at a given threshold means fewer missed-bad losses.',
    thresholds: {
      green: '> 0.70 — High capture at threshold level',
      amber: '0.55 – 0.70 — Moderate capture, review threshold',
      red: '< 0.55 — Low capture, model may need recalibration',
    },
    higherIsBetter: true,
  },
};

export const ALL_METRIC_KEYS = Object.keys(METRIC_DESCRIPTIONS);

export const DEFAULT_SELECTED_METRICS = ['KS', 'PSI', 'AUC'];

