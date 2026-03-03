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
   * "All segments" dual mode: renders Thin File + Thick File bars and lines.
   * When both are provided, `data` is ignored.
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
      // ── "All segments" + Compare mode: 8 series ───────────────────────
      labels = thinFileData!.map(d => d.label);
      datasets.push({ label: 'Thin File Current — Volume',  data: thinFileData!.map(d => d.volume),  backgroundColor: `${THIN_COLOR}88`,  borderColor: THIN_COLOR,  borderWidth: 2, yAxisID: 'yVolume', type: 'bar', order: 3 });
      datasets.push({ label: 'Thick File Current — Volume', data: thickFileData!.map(d => d.volume), backgroundColor: `${THICK_COLOR}88`, borderColor: THICK_COLOR, borderWidth: 2, yAxisID: 'yVolume', type: 'bar', order: 3 });
      if (thinFileBaselineData?.length)  datasets.push({ label: 'Thin File Baseline — Volume',  data: thinFileBaselineData.map(d => d.volume),  backgroundColor: '#f59e0b44', borderColor: '#f59e0b', borderWidth: 2, yAxisID: 'yVolume', type: 'bar', order: 3 });
      if (thickFileBaselineData?.length) datasets.push({ label: 'Thick File Baseline — Volume', data: thickFileBaselineData.map(d => d.volume), backgroundColor: '#f9731644', borderColor: '#f97316', borderWidth: 2, yAxisID: 'yVolume', type: 'bar', order: 3 });
      datasets.push({ label: 'Thin File Current — Bad Rate (%)',  data: toRates(thinFileData!),  type: 'line', borderColor: THIN_COLOR,  backgroundColor: 'transparent', borderWidth: 2.5, tension: 0.4, fill: false, yAxisID: 'yBadRate', pointRadius: 5, pointHoverRadius: 7, pointBackgroundColor: THIN_COLOR,  pointBorderColor: '#fff', pointBorderWidth: 2, order: 1 });
      datasets.push({ label: 'Thick File Current — Bad Rate (%)', data: toRates(thickFileData!), type: 'line', borderColor: THICK_COLOR, backgroundColor: 'transparent', borderWidth: 2.5, borderDash: [6, 3], tension: 0.4, fill: false, yAxisID: 'yBadRate', pointRadius: 5, pointHoverRadius: 7, pointBackgroundColor: THICK_COLOR, pointBorderColor: '#fff', pointBorderWidth: 2, order: 1 });
      if (thinFileBaselineData?.length)  datasets.push({ label: 'Thin File Baseline — Bad Rate (%)',  data: toRates(thinFileBaselineData),  type: 'line', borderColor: '#f59e0b', backgroundColor: 'transparent', borderWidth: 2, borderDash: [8, 4], tension: 0.4, fill: false, yAxisID: 'yBadRate', pointRadius: 4, pointHoverRadius: 6, pointBackgroundColor: '#f59e0b', pointBorderColor: '#fff', pointBorderWidth: 2, pointStyle: 'triangle', order: 1 });
      if (thickFileBaselineData?.length) datasets.push({ label: 'Thick File Baseline — Bad Rate (%)', data: toRates(thickFileBaselineData), type: 'line', borderColor: '#f97316', backgroundColor: 'transparent', borderWidth: 2, borderDash: [8, 4], tension: 0.4, fill: false, yAxisID: 'yBadRate', pointRadius: 4, pointHoverRadius: 6, pointBackgroundColor: '#f97316', pointBorderColor: '#fff', pointBorderWidth: 2, pointStyle: 'rectRot', order: 1 });
    } else if (isDualSegment) {
      // ── "All segments" mode: Thin File + Thick File ───────────────────────
      labels = thinFileData!.map(d => d.label);
      datasets.push({
        label: 'Thin File — Volume',
        data: thinFileData!.map(d => d.volume),
        backgroundColor: `${THIN_COLOR}88`,
        borderColor: THIN_COLOR,
        borderWidth: 2,
        yAxisID: 'yVolume',
        type: 'bar',
        order: 3,
      });
      datasets.push({
        label: 'Thick File — Volume',
        data: thickFileData!.map(d => d.volume),
        backgroundColor: `${THICK_COLOR}88`,
        borderColor: THICK_COLOR,
        borderWidth: 2,
        yAxisID: 'yVolume',
        type: 'bar',
        order: 3,
      });
      datasets.push({
        label: 'Thin File — Bad Rate (%)',
        data: toRates(thinFileData!),
        type: 'line',
        borderColor: THIN_COLOR,
        backgroundColor: 'transparent',
        borderWidth: 2.5,
        tension: 0.4,
        fill: false,
        yAxisID: 'yBadRate',
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: THIN_COLOR,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        order: 1,
      });
      datasets.push({
        label: 'Thick File — Bad Rate (%)',
        data: toRates(thickFileData!),
        type: 'line',
        borderColor: THICK_COLOR,
        backgroundColor: 'transparent',
        borderWidth: 2.5,
        borderDash: [6, 3],
        tension: 0.4,
        fill: false,
        yAxisID: 'yBadRate',
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: THICK_COLOR,
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
        const segColor = segmentLabel === 'Thin File' ? THIN_COLOR
          : segmentLabel === 'Thick File' ? THICK_COLOR : '#3b82f6';
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
      ? 'All Segments: Current → Thin (blue) / Thick (teal)  │  Baseline → Thin (amber ▲) / Thick (orange ◆)'
      : isDualSegment
        ? 'All Segments — Thin File (blue bars/solid)  vs  Thick File (teal bars/dashed)'
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
