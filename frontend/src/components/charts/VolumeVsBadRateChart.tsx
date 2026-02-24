import React, { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export interface VolumeDataPoint {
  label: string;
  volume: number;
  badRate: number;
}

interface VolumeVsBadRateChartProps {
  data: VolumeDataPoint[];
  /** When provided (compare mode), renders side-by-side grouped bars + dual bad-rate lines */
  baselineData?: VolumeDataPoint[];
  height?: number;
}

export const VolumeVsBadRateChart: React.FC<VolumeVsBadRateChartProps> = ({
  data,
  baselineData,
  height = 300,
}) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current || !data.length) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    const labels = data.map(d => d.label);
    const volumes = data.map(d => d.volume);
    const badRates = data.map(d => parseFloat((d.badRate * 100).toFixed(2)));

    const isCompareMode = !!baselineData && baselineData.length > 0;
    const baselineVolumes = isCompareMode ? baselineData!.map(d => d.volume) : [];
    const baselineBadRates = isCompareMode ? baselineData!.map(d => parseFloat((d.badRate * 100).toFixed(2))) : [];

    const datasets: any[] = [];

    if (isCompareMode) {
      // Grouped bars: Training (baseline) + Monitoring (current)
      datasets.push({
        label: 'Volume — Training',
        data: baselineVolumes,
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
      // Bad rate lines
      datasets.push({
        label: 'Bad Rate — Training',
        data: baselineBadRates,
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
      datasets.push({
        label: 'Volume',
        data: volumes,
        backgroundColor: '#3b82f699',
        borderColor: '#3b82f6',
        borderWidth: 2,
        yAxisID: 'yVolume',
        type: 'bar',
        order: 2,
      });
      datasets.push({
        label: 'Bad Rate (%)',
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

    chartInstanceRef.current = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: { size: 12, family: 'Inter, system-ui, sans-serif' },
              padding: 12,
              usePointStyle: true,
            },
          },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const label = context.dataset.label || '';
                const value = context.parsed.y;
                if (label.includes('Volume')) {
                  return `${label}: ${value.toLocaleString()}`;
                }
                return `${label}: ${value.toFixed(2)}%`;
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

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [data, baselineData, height]);

  return (
    <div style={{ height: `${height}px` }} className="w-full p-4">
      <canvas ref={chartRef}></canvas>
    </div>
  );
};
