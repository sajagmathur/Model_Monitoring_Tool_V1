import React from 'react';
import { BankingMetrics } from '../../utils/bankingMetricsMock';

interface ConfusionMatrixChartProps {
  latestMetric?: BankingMetrics;
  isDark?: boolean;
}

interface CMValues {
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  precision: number;
  recall: number;
  f1: number;
  accuracy: number;
  specificity: number;
  fpr: number;
}

function deriveConfusionMatrix(metrics: BankingMetrics['metrics']): CMValues {
  // Use known metrics if available, otherwise derive plausible values
  const precision = metrics.precision ?? (metrics.AUC ? metrics.AUC * 0.92 : 0.82);
  const recall = metrics.recall ?? (metrics.KS ? Math.min(0.95, metrics.KS * 1.7) : 0.78);
  const accuracy = metrics.accuracy ?? (metrics.AUC ? (metrics.AUC * 0.97) : 0.88);
  const f1 = metrics.f1_score ?? (precision > 0 && recall > 0 ? (2 * precision * recall) / (precision + recall) : 0.80);
  const badRate = metrics.bad_rate ?? 0.08;

  // Back-calculate confusion matrix from precision/recall/accuracy
  // Total N = 1000 (normalized)
  const N = 1000;
  const actualPos = Math.round(N * badRate);
  const actualNeg = N - actualPos;

  const tp = Math.round(actualPos * recall);
  const fn = actualPos - tp;
  const fp = Math.round(tp / precision - tp);
  const tn = actualNeg - fp;

  const safeTP = Math.max(tp, 0);
  const safeFP = Math.max(fp, 0);
  const safeFN = Math.max(fn, 0);
  const safeTN = Math.max(tn, 0);
  const total = safeTP + safeFP + safeFN + safeTN || 1;

  const derivedAcc = (safeTP + safeTN) / total;
  const specificity = safeTN / (safeTN + safeFP || 1);
  const fpr = safeFP / (safeFP + safeTN || 1);

  return {
    tp: safeTP,
    fp: safeFP,
    fn: safeFN,
    tn: safeTN,
    precision,
    recall,
    f1,
    accuracy: derivedAcc || accuracy,
    specificity,
    fpr,
  };
}

const ConfusionMatrixChart: React.FC<ConfusionMatrixChartProps> = ({ latestMetric, isDark = false }) => {
  const cm = latestMetric ? deriveConfusionMatrix(latestMetric.metrics) : {
    tp: 78, fp: 14, fn: 22, tn: 886,
    precision: 0.848, recall: 0.780, f1: 0.813,
    accuracy: 0.964, specificity: 0.984, fpr: 0.016,
  };

  const total = cm.tp + cm.fp + cm.fn + cm.tn;

  interface ClassMetricRow {
    metric: string;
    value: number;
    formula: string;
    description: string;
    threshold: number | null;
    lowerIsBetter?: boolean;
  }

  const classMetrics: ClassMetricRow[] = [
    {
      metric: 'Precision',
      value: cm.precision,
      formula: 'TP / (TP + FP)',
      description: 'Of all predicted positives, how many were actually positive.',
      threshold: 0.75,
    },
    {
      metric: 'Recall (Sensitivity)',
      value: cm.recall,
      formula: 'TP / (TP + FN)',
      description: 'Of all actual positives, how many were correctly identified.',
      threshold: 0.70,
    },
    {
      metric: 'F1 Score',
      value: cm.f1,
      formula: '2 × (Precision × Recall) / (Precision + Recall)',
      description: 'Harmonic mean of precision and recall. Good for imbalanced datasets.',
      threshold: 0.72,
    },
    {
      metric: 'Accuracy',
      value: cm.accuracy,
      formula: '(TP + TN) / Total',
      description: 'Overall fraction of correctly classified instances.',
      threshold: 0.80,
    },
    {
      metric: 'Specificity',
      value: cm.specificity,
      formula: 'TN / (TN + FP)',
      description: 'True negative rate. Of all actual negatives, how many were correctly identified.',
      threshold: 0.85,
    },
    {
      metric: 'False Positive Rate',
      value: cm.fpr,
      formula: 'FP / (FP + TN)',
      description: 'Fraction of actual negatives incorrectly classified as positive. Lower is better.',
      threshold: null,
      lowerIsBetter: true,
    },
    {
      metric: 'AUC-ROC',
      value: latestMetric?.metrics.AUC ?? 0.88,
      formula: 'Area Under the ROC Curve',
      description: 'Probability that a randomly chosen positive instance is ranked higher than a negative one.',
      threshold: 0.75,
    },
    {
      metric: 'KS Statistic',
      value: latestMetric?.metrics.KS ?? 0.55,
      formula: 'max(TPR − FPR)',
      description: 'Maximum separation between cumulative distribution of good and bad accounts.',
      threshold: 0.35,
    },
  ];

  const getStatusColors = (value: number, threshold: number | null, lowerIsBetter?: boolean) => {
    if (threshold === null) return { badge: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' };
    const isGood = lowerIsBetter ? value <= threshold : value >= threshold;
    return isGood
      ? { badge: 'bg-green-100 text-green-700', dot: 'bg-green-500' }
      : { badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' };
  };

  // Heat-map cells: intensity based on count share
  const maxCell = Math.max(cm.tp, cm.fp, cm.fn, cm.tn);
  const cellBg = (val: number, isCorrect: boolean) => {
    const intensity = Math.round((val / maxCell) * 200);
    if (isCorrect) return isDark ? `rgba(16,185,129,${0.15 + (val / maxCell) * 0.55})` : `rgba(16,185,129,${0.08 + (val / maxCell) * 0.45})`;
    return isDark ? `rgba(239,68,68,${0.15 + (val / maxCell) * 0.55})` : `rgba(239,68,68,${0.08 + (val / maxCell) * 0.45})`;
  };

  const borderCls = isDark ? 'border-slate-600' : 'border-slate-200';
  const headerCls = isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-700';
  const textCls = isDark ? 'text-slate-200' : 'text-slate-800';
  const subCls = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="space-y-6">
      {/* Confusion Matrix Heatmap */}
      <div>
        <div className="flex items-start gap-6">
          <div>
            <p className={`text-xs font-semibold mb-3 uppercase tracking-wide ${subCls}`}>
              Confusion Matrix (N = {total.toLocaleString()} normalised)
            </p>
            <div className="inline-block">
              {/* Column headers */}
              <div className="flex">
                <div style={{ width: 80 }} />
                <div className={`flex-1 text-center text-xs font-semibold py-1 pr-2 `} style={{ minWidth: 100 }}>
                  <span className={subCls}>Predicted Positive</span>
                </div>
                <div className={`flex-1 text-center text-xs font-semibold py-1`} style={{ minWidth: 100 }}>
                  <span className={subCls}>Predicted Negative</span>
                </div>
              </div>
              {/* Row 1 */}
              <div className="flex items-center">
                <div style={{ width: 80 }} className={`text-xs font-semibold py-1 ${subCls}`}>Actual Pos</div>
                <div
                  className={`border ${borderCls} rounded-tl flex flex-col items-center justify-center p-4`}
                  style={{ minWidth: 100, minHeight: 80, background: cellBg(cm.tp, true) }}
                >
                  <span className={`text-2xl font-bold ${isDark ? 'text-green-300' : 'text-green-700'}`}>{cm.tp}</span>
                  <span className={`text-xs mt-1 ${isDark ? 'text-green-400' : 'text-green-600'}`}>TP</span>
                  <span className={`text-xs ${subCls}`}>{((cm.tp / total) * 100).toFixed(1)}%</span>
                </div>
                <div
                  className={`border ${borderCls} rounded-tr flex flex-col items-center justify-center p-4`}
                  style={{ minWidth: 100, minHeight: 80, background: cellBg(cm.fn, false) }}
                >
                  <span className={`text-2xl font-bold ${isDark ? 'text-red-300' : 'text-red-700'}`}>{cm.fn}</span>
                  <span className={`text-xs mt-1 ${isDark ? 'text-red-400' : 'text-red-600'}`}>FN</span>
                  <span className={`text-xs ${subCls}`}>{((cm.fn / total) * 100).toFixed(1)}%</span>
                </div>
              </div>
              {/* Row 2 */}
              <div className="flex items-center">
                <div style={{ width: 80 }} className={`text-xs font-semibold py-1 ${subCls}`}>Actual Neg</div>
                <div
                  className={`border ${borderCls} rounded-bl flex flex-col items-center justify-center p-4`}
                  style={{ minWidth: 100, minHeight: 80, background: cellBg(cm.fp, false) }}
                >
                  <span className={`text-2xl font-bold ${isDark ? 'text-red-300' : 'text-red-700'}`}>{cm.fp}</span>
                  <span className={`text-xs mt-1 ${isDark ? 'text-red-400' : 'text-red-600'}`}>FP</span>
                  <span className={`text-xs ${subCls}`}>{((cm.fp / total) * 100).toFixed(1)}%</span>
                </div>
                <div
                  className={`border ${borderCls} rounded-br flex flex-col items-center justify-center p-4`}
                  style={{ minWidth: 100, minHeight: 80, background: cellBg(cm.tn, true) }}
                >
                  <span className={`text-2xl font-bold ${isDark ? 'text-green-300' : 'text-green-700'}`}>{cm.tn}</span>
                  <span className={`text-xs mt-1 ${isDark ? 'text-green-400' : 'text-green-600'}`}>TN</span>
                  <span className={`text-xs ${subCls}`}>{((cm.tn / total) * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
          {/* Quick stats from CM */}
          <div className="flex-1 space-y-2 pt-6">
            {[
              { label: 'True Positives (TP)', val: cm.tp, desc: 'Correctly predicted bads' },
              { label: 'True Negatives (TN)', val: cm.tn, desc: 'Correctly predicted goods' },
              { label: 'False Positives (FP)', val: cm.fp, desc: 'Predicted bad, actually good' },
              { label: 'False Negatives (FN)', val: cm.fn, desc: 'Predicted good, actually bad' },
            ].map(item => (
              <div key={item.label} className={`flex items-center justify-between p-2 rounded border ${borderCls}`}>
                <div>
                  <span className={`text-xs font-semibold ${textCls}`}>{item.label}</span>
                  <p className={`text-xs ${subCls}`}>{item.desc}</p>
                </div>
                <span className={`text-lg font-bold ${textCls}`}>{item.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Classification Metrics Table */}
      <div>
        <p className={`text-xs font-semibold mb-3 uppercase tracking-wide ${subCls}`}>
          Classification Metrics
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={headerCls}>
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Metric</th>
                <th className="px-3 py-2 text-right font-semibold">Value</th>
                <th className="px-3 py-2 text-left font-semibold">Formula</th>
                <th className="px-3 py-2 text-left font-semibold">Threshold</th>
                <th className="px-3 py-2 text-center font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {classMetrics.map((row, i) => {
                const { badge, dot } = getStatusColors(row.value, row.threshold, row.lowerIsBetter);
                const displayValue = row.lowerIsBetter ? `${(row.value * 100).toFixed(2)}%` : row.value.toFixed(3);
                const thresholdDisplay = row.threshold === null
                  ? '—'
                  : row.lowerIsBetter
                  ? `≤ ${(row.threshold * 100).toFixed(0)}%`
                  : `≥ ${row.threshold.toFixed(2)}`;
                return (
                  <tr
                    key={i}
                    className={`border-b ${borderCls} ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}
                    title={row.description}
                  >
                    <td className={`px-3 py-2 font-medium ${textCls}`}>{row.metric}</td>
                    <td className={`px-3 py-2 text-right font-mono font-bold ${textCls}`}>{displayValue}</td>
                    <td className={`px-3 py-2 font-mono text-xs ${subCls}`}>{row.formula}</td>
                    <td className={`px-3 py-2 text-xs ${subCls}`}>{thresholdDisplay}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                        {row.threshold === null ? '—' : getStatusColors(row.value, row.threshold, row.lowerIsBetter).dot === 'bg-green-500' ? 'Pass' : 'Below Target'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ConfusionMatrixChart;
