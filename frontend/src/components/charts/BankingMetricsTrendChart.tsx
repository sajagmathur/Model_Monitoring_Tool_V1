import React, { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { BankingMetrics } from '../../utils/bankingMetricsMock';

Chart.register(...registerables);

// Shared segment colours (also used by VolumeVsBadRateChart)
export const THIN_COLOR  = '#3b82f6'; // blue
export const THICK_COLOR = '#14b8a6'; // teal

interface BankingMetricsTrendChartProps {
  metrics: BankingMetrics[];
  metricKey: 'KS' | 'PSI' | 'AUC' | 'bad_rate' | 'Gini' | 'MAPE' | 'volume'
    | 'accuracy' | 'precision' | 'recall' | 'f1_score' | 'HRL' | 'change_in_KS';
  title?: string;
  height?: number;
  isDark?: boolean;
  /** When provided, renders a second dashed series for baseline comparison */
  baselineMetrics?: BankingMetrics[];
  currentLabel?: string;
  baselineLabel?: string;
  /**
   * "All segments" dual-line mode — pass both thin + thick series; the chart
   * renders THIN_COLOR + THICK_COLOR lines instead of a single aggregate line.
   */
  thinFileMetrics?: BankingMetrics[];
  thickFileMetrics?: BankingMetrics[];
  thinFileBaselineMetrics?: BankingMetrics[];
  thickFileBaselineMetrics?: BankingMetrics[];
  /** Shown as a subtitle badge when exactly one segment is active */
  segmentLabel?: string;
  /**
   * Compare mode: when true, x-axis labels are shown as Q1, Q2, …
   * allVintagesSorted provides the full ordered list for building the mapping.
   */
  compareMode?: boolean;
  allVintagesSorted?: string[];
  /** Displayed in the vintage legend footer when compareMode is true */
  trainingLatestVintage?: string;
  monitoringLatestVintage?: string;
  /** Override the auto-derived line color */
  lineColor?: string;
}

export const BankingMetricsTrendChart: React.FC<BankingMetricsTrendChartProps> = ({
  metrics,
  metricKey,
  title,
  height = 300,
  baselineMetrics,
  currentLabel = 'Monitoring',
  baselineLabel = 'Training (Baseline)',
  thinFileMetrics,
  thickFileMetrics,
  thinFileBaselineMetrics,
  thickFileBaselineMetrics,
  segmentLabel,
  compareMode = false,
  allVintagesSorted,
  trainingLatestVintage,
  monitoringLatestVintage,
  lineColor,
  isDark = false,
}) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  const isDualSegment = !!(thinFileMetrics?.length && thickFileMetrics?.length);

  const textColor = isDark ? '#94a3b8' : '#475569';
  const gridColor = isDark ? 'rgba(148,163,184,0.12)' : '#e5e7eb';
  const titleColor = isDark ? '#cbd5e1' : '#6b7280';

  useEffect(() => {
    if (!chartRef.current) return;
    if (!isDualSegment && !metrics.length) return;

    const sortBy = (arr: BankingMetrics[]) =>
      [...arr].sort((a, b) => a.vintage.localeCompare(b.vintage));
    const extract = (arr: BankingMetrics[]) =>
      sortBy(arr).map(m =>
        metricKey === 'volume' ? m.volume
        : metricKey === 'change_in_KS' ? ((m.metrics as any).change_in_KS ?? null)
        : (m.metrics[metricKey] ?? null)
      );

    if (chartInstanceRef.current) chartInstanceRef.current.destroy();
    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    const metricColor = () => {
      switch (metricKey) {
        case 'KS':        return '#3b82f6';
        case 'PSI':       return '#f59e0b';
        case 'AUC':       return '#10b981';
        case 'bad_rate':  return '#ef4444';
        case 'Gini':      return '#8b5cf6';
        case 'MAPE':      return '#06b6d4';
        case 'volume':    return '#6366f1';
        case 'accuracy':  return '#22c55e';
        case 'precision': return '#f97316';
        case 'recall':    return '#ec4899';
        case 'f1_score':  return '#a855f7';
        case 'HRL':       return '#14b8a6';
        case 'change_in_KS': return '#0ea5e9';
        default:          return '#6b7280';
      }
    };

    // Build vintage → Q-label map for compare mode x-axis
    const vintToQ = (v: string): string => {
      if (!compareMode || !allVintagesSorted?.length) return v;
      const idx = allVintagesSorted.indexOf(v);
      return idx >= 0 ? `Q${idx + 1}` : v;
    };

    const labels = (isDualSegment
      ? sortBy(thinFileMetrics!).map(m => m.vintage)
      : sortBy(metrics).map(m => m.vintage)
    ).map(vintToQ);

    const datasets: any[] = [];

    if (isDualSegment) {
      // ── "All Segments" mode: ONE combined line ─────────────────────────
      const combinedData = metrics.length > 0 ? metrics : thinFileMetrics!;
      const allColor = '#6366f1';
      datasets.push({
        label: 'All Segments',
        data: extract(combinedData),
        borderColor: allColor,
        backgroundColor: `${allColor}22`,
        borderWidth: 2.5,
        tension: 0.4,
        fill: false,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: allColor,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      });
    } else {
      // ── Single-segment / aggregate mode ───────────────────────────────────
      const isCompareMode = !!baselineMetrics?.length;
      const color = lineColor ?? (
        segmentLabel === 'Current' ? THIN_COLOR
        : segmentLabel === 'Delinquent' ? THICK_COLOR
        : segmentLabel === 'All Segments' ? '#6366f1'
        : metricColor()
      );
      const lbl = isCompareMode
        ? currentLabel
        : (segmentLabel ? `${segmentLabel}` : (title || metricKey));

      datasets.push({
        label: lbl,
        data: extract(metrics),
        borderColor: color,
        backgroundColor: `${color}33`,
        borderWidth: 2,
        tension: 0.4,
        fill: !isCompareMode,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: color,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      });
      if (isCompareMode) {
        datasets.push({
          label: baselineLabel,
          data: extract(baselineMetrics!),
          borderColor: '#f59e0b',           // amber — clearly distinct from all segment & metric colors
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [8, 4],
          tension: 0.4,
          fill: false,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#f59e0b',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointStyle: 'triangle',
        });
      }
    }

    const hasDualBaseline = false;
    const subtitleText = isDualSegment
      ? 'All Segments — combined view (indigo line)'
        : (segmentLabel && !!baselineMetrics?.length)
          ? `Segment: ${segmentLabel}   │   Current (solid line) vs Baseline (amber ▲ dashed)`
          : segmentLabel
            ? `Segment: ${segmentLabel}`
            : !!baselineMetrics?.length
              ? 'All Segments — Current (solid line)  vs  Baseline (amber ▲ dashed)'
              : undefined;

    const rafId = requestAnimationFrame(() => {
      if (!chartRef.current) return;
      chartInstanceRef.current = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              font: { size: 11, family: 'Inter, system-ui, sans-serif' },
              padding: 10,
              usePointStyle: true,
              pointStyleWidth: 16,
              color: textColor,
            },
          },
          title: subtitleText ? {
            display: true,
            text: subtitleText,
            font: { size: 10, family: 'Inter, system-ui, sans-serif', style: 'italic' },
            color: titleColor,
            padding: { bottom: 4 },
          } : { display: false },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const val = context.parsed.y;
                if (val === null) return `${context.dataset.label}: —`;
                if (metricKey === 'volume') return `${context.dataset.label}: ${val.toLocaleString()}`;
                const isPct = ['KS','accuracy','precision','recall','f1_score','HRL','bad_rate'].includes(metricKey);
                if (isPct) return `${context.dataset.label}: ${(val * 100).toFixed(1)}%`;
                if (metricKey === 'change_in_KS') return `${context.dataset.label}: ${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
                return `${context.dataset.label}: ${val.toFixed(4)}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 11, family: 'Inter, system-ui, sans-serif' },
              maxRotation: 45,
              minRotation: 45,
              color: textColor,
            },
          },
          y: {
            beginAtZero: metricKey === 'volume',
            grid: { color: gridColor },
            ticks: {
              font: { size: 11, family: 'Inter, system-ui, sans-serif' },
              color: textColor,
              callback: (value: any) => {
                if (metricKey === 'volume') return (value as number).toLocaleString();
                const isPct = ['KS','accuracy','precision','recall','f1_score','HRL','bad_rate'].includes(metricKey);
                if (isPct) return `${((value as number) * 100).toFixed(1)}%`;
                if (metricKey === 'change_in_KS') return `${(value as number) >= 0 ? '+' : ''}${(value as number).toFixed(1)}%`;
                return (value as number).toFixed(2);
              },
            },
          },
        },
      },
      });
    });

    return () => {
      cancelAnimationFrame(rafId);
      if (chartInstanceRef.current) chartInstanceRef.current.destroy();
    };
  }, [
    metrics, metricKey, title, height,
    baselineMetrics, currentLabel, baselineLabel,
    thinFileMetrics, thickFileMetrics,
    thinFileBaselineMetrics, thickFileBaselineMetrics,
    segmentLabel, isDualSegment,
    compareMode, allVintagesSorted,
    isDark, lineColor,
  ]);

  const showVintageLegend = compareMode && (trainingLatestVintage || monitoringLatestVintage);

  return (
    <div className="w-full">
      <div style={{ height: `${height}px` }}>
        <canvas ref={chartRef}></canvas>
      </div>
      {showVintageLegend && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px',
          marginTop: '6px', paddingLeft: '4px', color: textColor,
        }}>
          {trainingLatestVintage && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: '#f59e0b', fontWeight: 600 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                <svg width="22" height="8" viewBox="0 0 22 8">
                  <line x1="0" y1="4" x2="22" y2="4" stroke="#f59e0b" strokeWidth="2" strokeDasharray="6,3" />
                </svg>
              </span>
              Training (Baseline) — Latest Vintage: {trainingLatestVintage}
            </span>
          )}
          {monitoringLatestVintage && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: '#3b82f6', fontWeight: 600 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                <svg width="22" height="8" viewBox="0 0 22 8">
                  <line x1="0" y1="4" x2="22" y2="4" stroke="#3b82f6" strokeWidth="2" />
                </svg>
              </span>
              Monitoring (Current) — Latest Vintage: {monitoringLatestVintage}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
