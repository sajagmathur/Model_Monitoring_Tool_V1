import React, { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { BankingMetrics } from '../../utils/bankingMetricsMock';

Chart.register(...registerables);

// Shared segment colours (also used by VolumeVsBadRateChart)
export const THIN_COLOR  = '#3b82f6'; // blue
export const THICK_COLOR = '#14b8a6'; // teal

interface BankingMetricsTrendChartProps {
  metrics: BankingMetrics[];
  metricKey: 'KS' | 'PSI' | 'AUC' | 'bad_rate' | 'Gini' | 'CA_at_10' | 'volume';
  title?: string;
  height?: number;
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
}) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  const isDualSegment = !!(thinFileMetrics?.length && thickFileMetrics?.length);

  useEffect(() => {
    if (!chartRef.current) return;
    if (!isDualSegment && !metrics.length) return;

    const sortBy = (arr: BankingMetrics[]) =>
      [...arr].sort((a, b) => a.vintage.localeCompare(b.vintage));
    const extract = (arr: BankingMetrics[]) =>
      sortBy(arr).map(m =>
        metricKey === 'volume' ? m.volume : (m.metrics[metricKey] ?? null)
      );

    if (chartInstanceRef.current) chartInstanceRef.current.destroy();
    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    const metricColor = () => {
      switch (metricKey) {
        case 'KS':       return '#3b82f6';
        case 'PSI':      return '#f59e0b';
        case 'AUC':      return '#10b981';
        case 'bad_rate': return '#ef4444';
        case 'Gini':     return '#8b5cf6';
        case 'CA_at_10': return '#06b6d4';
        case 'volume':   return '#6366f1';
        default:         return '#6b7280';
      }
    };

    const labels = isDualSegment
      ? sortBy(thinFileMetrics!).map(m => m.vintage)
      : sortBy(metrics).map(m => m.vintage);

    const datasets: any[] = [];

    if (isDualSegment) {
      // ── "All" mode: two solid lines, one per segment ──────────────────────
      datasets.push({
        label: 'Thin File',
        data: extract(thinFileMetrics!),
        borderColor: THIN_COLOR,
        backgroundColor: `${THIN_COLOR}33`,
        borderWidth: 2.5,
        tension: 0.4,
        fill: false,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: THIN_COLOR,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      });
      datasets.push({
        label: 'Thick File',
        data: extract(thickFileMetrics!),
        borderColor: THICK_COLOR,
        backgroundColor: `${THICK_COLOR}33`,
        borderWidth: 2.5,
        tension: 0.4,
        fill: false,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: THICK_COLOR,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      });
      if (thinFileBaselineMetrics?.length) {
        datasets.push({
          label: 'Thin File — Baseline',
          data: extract(thinFileBaselineMetrics),
          borderColor: THIN_COLOR,
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [6, 3],
          tension: 0.4,
          fill: false,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: THIN_COLOR,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
        });
      }
      if (thickFileBaselineMetrics?.length) {
        datasets.push({
          label: 'Thick File — Baseline',
          data: extract(thickFileBaselineMetrics),
          borderColor: THICK_COLOR,
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [6, 3],
          tension: 0.4,
          fill: false,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: THICK_COLOR,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
        });
      }
    } else {
      // ── Single-segment / aggregate mode ───────────────────────────────────
      const isCompareMode = !!baselineMetrics?.length;
      const color = segmentLabel === 'Thin File' ? THIN_COLOR
        : segmentLabel === 'Thick File' ? THICK_COLOR
        : metricColor();
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
          borderColor: '#9ca3af',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [6, 3],
          tension: 0.4,
          fill: false,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#9ca3af',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
        });
      }
    }

    const subtitleText = isDualSegment
      ? 'All Segments — Thin File (blue)  vs  Thick File (teal)'
      : segmentLabel
        ? `Segment: ${segmentLabel}`
        : undefined;

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
            },
          },
          title: subtitleText ? {
            display: true,
            text: subtitleText,
            font: { size: 10, family: 'Inter, system-ui, sans-serif', style: 'italic' },
            color: '#6b7280',
            padding: { bottom: 4 },
          } : { display: false },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const val = context.parsed.y;
                if (val === null) return `${context.dataset.label}: —`;
                if (metricKey === 'volume') return `${context.dataset.label}: ${val.toLocaleString()}`;
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
            },
          },
          y: {
            beginAtZero: metricKey === 'volume',
            grid: { color: '#e5e7eb' },
            ticks: {
              font: { size: 11, family: 'Inter, system-ui, sans-serif' },
              callback: (value: any) =>
                metricKey === 'volume'
                  ? (value as number).toLocaleString()
                  : (value as number).toFixed(2),
            },
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) chartInstanceRef.current.destroy();
    };
  }, [
    metrics, metricKey, title, height,
    baselineMetrics, currentLabel, baselineLabel,
    thinFileMetrics, thickFileMetrics,
    thinFileBaselineMetrics, thickFileBaselineMetrics,
    segmentLabel, isDualSegment,
  ]);

  return (
    <div style={{ height: `${height}px` }} className="w-full">
      <canvas ref={chartRef}></canvas>
    </div>
  );
};
