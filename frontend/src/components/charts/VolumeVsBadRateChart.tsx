import React, { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { THIN_COLOR, THICK_COLOR } from './BankingMetricsTrendChart';

Chart.register(...registerables);

export interface VolumeDataPoint {
  label: string;
  volume: number;
  badRate: number;
}

interface VolumeVsBadRateChartProps {
  data: VolumeDataPoint[];
  /** Compare mode: renders Training vs Monitoring side-by-side */
  baselineData?: VolumeDataPoint[];
  height?: number;
  /**
   * "All segments" dual mode: renders a single combined All Segments bar + bad-rate line.
   * When both are provided, `data` (combined aggregate) is used if available.
   */
  thinFileData?: VolumeDataPoint[];
  thickFileData?: VolumeDataPoint[];
  /**
   * "All segments" + compare mode: baseline (training) series per segment.
   * When provided alongside thinFileData/thickFileData, renders 8-series combined chart.
   */
  thinFileBaselineData?: VolumeDataPoint[];
  thickFileBaselineData?: VolumeDataPoint[];
  /** Shown as chart subtitle when a single segment is active */
  segmentLabel?: string;
}

export const VolumeVsBadRateChart: React.FC<VolumeVsBadRateChartProps> = ({
  data,
  baselineData,
  height = 300,
  thinFileData,
  thickFileData,
  thinFileBaselineData,
  thickFileBaselineData,
  segmentLabel,
}) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  const isDualSegment = !!(thinFileData?.length && thickFileData?.length);

  useEffect(() => {
    if (!chartRef.current) return;
    if (!isDualSegment && !data.length) return;

    if (chartInstanceRef.current) chartInstanceRef.current.destroy();
    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    const toRates = (arr: VolumeDataPoint[]) =>
      arr.map(d => parseFloat((d.badRate * 100).toFixed(2)));

    const datasets: any[] = [];
    let labels: string[];

    if (isDualSegment && (thinFileBaselineData?.length || thickFileBaselineData?.length)) {
      // ── "All segments" + Compare mode: ONE combined Monitoring vs ONE combined Baseline ──
      const combinedMon = data.length > 0 ? data : thinFileData!;
      // Aggregate thinFile + thickFile baselines into a single combined series
      const combinedBase: VolumeDataPoint[] = (() => {
        if (thinFileBaselineData?.length && thickFileBaselineData?.length) {
          return thinFileBaselineData.map((t, i) => {
            const k = thickFileBaselineData[i] ?? { volume: 0, badRate: 0, label: t.label };
            const vol = t.volume + k.volume;
            const br = vol > 0 ? (t.badRate * t.volume + k.badRate * k.volume) / vol : 0;
            return { label: t.label, volume: vol, badRate: parseFloat(br.toFixed(4)) };
          });
        }
        return thinFileBaselineData ?? thickFileBaselineData ?? [];
      })();
      const allColor = '#6366f1';
      const baseColor = '#f59e0b';
      labels = combinedMon.map(d => d.label);
      datasets.push({ label: 'All Segments — Volume (Monitoring)', data: combinedMon.map(d => d.volume), backgroundColor: `${allColor}55`, borderColor: allColor, borderWidth: 2, yAxisID: 'yVolume', type: 'bar', order: 3 });
      if (combinedBase.length) datasets.push({ label: 'All Segments — Volume (Baseline)', data: combinedBase.map(d => d.volume), backgroundColor: `${baseColor}44`, borderColor: baseColor, borderWidth: 2, yAxisID: 'yVolume', type: 'bar', order: 3 });
      datasets.push({ label: 'All Segments — Bad Rate — Monitoring (%)', data: toRates(combinedMon), type: 'line', borderColor: allColor, backgroundColor: 'transparent', borderWidth: 2.5, tension: 0.4, fill: false, yAxisID: 'yBadRate', pointRadius: 5, pointHoverRadius: 7, pointBackgroundColor: allColor, pointBorderColor: '#fff', pointBorderWidth: 2, order: 1 });
      if (combinedBase.length) datasets.push({ label: 'All Segments — Bad Rate — Baseline (%)', data: toRates(combinedBase), type: 'line', borderColor: baseColor, backgroundColor: 'transparent', borderWidth: 2, borderDash: [8, 4], tension: 0.4, fill: false, yAxisID: 'yBadRate', pointRadius: 4, pointHoverRadius: 6, pointBackgroundColor: baseColor, pointBorderColor: '#fff', pointBorderWidth: 2, order: 1 });
    } else if (isDualSegment) {
      // ── "All segments" mode: ONE combined bar + ONE bad-rate line ──────────
      const combinedVol = data.length > 0 ? data : thinFileData!;
      const allColor = '#6366f1';
      labels = combinedVol.map(d => d.label);
      datasets.push({
        label: 'All Segments — Volume',
        data: combinedVol.map(d => d.volume),
        backgroundColor: `${allColor}55`,
        borderColor: allColor,
        borderWidth: 2,
        yAxisID: 'yVolume',
        type: 'bar',
        order: 3,
      });
      datasets.push({
        label: 'All Segments — Bad Rate (%)',
        data: toRates(combinedVol),
        type: 'line',
        borderColor: allColor,
        backgroundColor: 'transparent',
        borderWidth: 2.5,
        tension: 0.4,
        fill: false,
        yAxisID: 'yBadRate',
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: allColor,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        order: 1,
      });
    } else {
      labels = data.map(d => d.label);
      const volumes   = data.map(d => d.volume);
      const badRates  = toRates(data);
      const isCompareMode = !!baselineData?.length;

      if (isCompareMode) {
        datasets.push({
          label: 'Volume — Training',
          data: baselineData!.map(d => d.volume),
          backgroundColor: '#6366f155',
          borderColor: '#6366f1',
          borderWidth: 2,
          yAxisID: 'yVolume',
          type: 'bar',
          order: 2,
        });
        datasets.push({
          label: 'Volume — Monitoring',
          data: volumes,
          backgroundColor: '#3b82f699',
          borderColor: '#3b82f6',
          borderWidth: 2,
          yAxisID: 'yVolume',
          type: 'bar',
          order: 2,
        });
        datasets.push({
          label: 'Bad Rate — Training',
          data: toRates(baselineData!),
          type: 'line',
          borderColor: '#f59e0b',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [6, 3],
          tension: 0.4,
          fill: false,
          yAxisID: 'yBadRate',
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#f59e0b',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          order: 1,
        });
        datasets.push({
          label: 'Bad Rate — Monitoring',
          data: badRates,
          type: 'line',
          borderColor: '#ef4444',
          backgroundColor: '#ef444422',
          borderWidth: 2,
          tension: 0.4,
          fill: false,
          yAxisID: 'yBadRate',
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#ef4444',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          order: 1,
        });
      } else {
        // Single mode
        const segColor = segmentLabel === 'Current' ? THIN_COLOR
          : segmentLabel === 'Delinquent' ? THICK_COLOR : '#3b82f6';
        datasets.push({
          label: segmentLabel ? `Volume — ${segmentLabel}` : 'Volume',
          data: volumes,
          backgroundColor: `${segColor}99`,
          borderColor: segColor,
          borderWidth: 2,
          yAxisID: 'yVolume',
          type: 'bar',
          order: 2,
        });
        datasets.push({
          label: segmentLabel ? `Bad Rate — ${segmentLabel} (%)` : 'Bad Rate (%)',
          data: badRates,
          type: 'line',
          borderColor: '#ef4444',
          backgroundColor: '#ef444422',
          borderWidth: 2,
          tension: 0.4,
          fill: false,
          yAxisID: 'yBadRate',
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#ef4444',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          order: 1,
        });
      }
    }

    const hasDualBaseline = !!(thinFileBaselineData?.length || thickFileBaselineData?.length);
    const subtitleText = (isDualSegment && hasDualBaseline)
      ? 'All Segments — Monitoring (indigo) vs Baseline (amber)'
      : isDualSegment
        ? 'All Segments — combined view (indigo)'
        : segmentLabel
          ? `Segment: ${segmentLabel}`
          : undefined;

    const rafId = requestAnimationFrame(() => {
      if (!chartRef.current) return;
      chartInstanceRef.current = new Chart(ctx, {
        type: 'bar',
        data: { labels: labels!, datasets },
        options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: { size: 11, family: 'Inter, system-ui, sans-serif' },
              padding: 10,
              usePointStyle: true,
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
                const lbl = context.dataset.label || '';
                const val = context.parsed.y;
                return lbl.includes('Volume') ? `${lbl}: ${val.toLocaleString()}` : `${lbl}: ${val.toFixed(2)}%`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 12, family: 'Inter, system-ui, sans-serif' } },
          },
          yVolume: {
            type: 'linear',
            position: 'left',
            beginAtZero: true,
            grid: { color: '#e5e7eb' },
            ticks: {
              font: { size: 11, family: 'Inter, system-ui, sans-serif' },
              callback: (v: any) => (v as number).toLocaleString(),
            },
            title: {
              display: true,
              text: 'Volume',
              font: { size: 12, weight: 'bold', family: 'Inter, system-ui, sans-serif' },
            },
          },
          yBadRate: {
            type: 'linear',
            position: 'right',
            beginAtZero: true,
            grid: { drawOnChartArea: false },
            ticks: {
              font: { size: 11, family: 'Inter, system-ui, sans-serif' },
              callback: (v: any) => `${(v as number).toFixed(1)}%`,
            },
            title: {
              display: true,
              text: 'Bad Rate (%)',
              font: { size: 12, weight: 'bold', family: 'Inter, system-ui, sans-serif' },
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
  }, [data, baselineData, thinFileData, thickFileData, thinFileBaselineData, thickFileBaselineData, segmentLabel, height, isDualSegment]);

  return (
    <div style={{ height: `${height}px` }} className="w-full p-4">
      <canvas ref={chartRef}></canvas>
    </div>
  );
};
