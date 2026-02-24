import React, { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { BankingMetrics } from '../../utils/bankingMetricsMock';

Chart.register(...registerables);

interface BankingMetricsTrendChartProps {
  metrics: BankingMetrics[];
  metricKey: 'KS' | 'PSI' | 'AUC' | 'bad_rate' | 'Gini' | 'CA_at_10' | 'volume';
  title?: string;
  height?: number;
  /** When provided, renders a second dashed series for baseline comparison */
  baselineMetrics?: BankingMetrics[];
  currentLabel?: string;
  baselineLabel?: string;
}

export const BankingMetricsTrendChart: React.FC<BankingMetricsTrendChartProps> = ({ 
  metrics, 
  metricKey, 
  title,
  height = 300,
  baselineMetrics,
  currentLabel = 'Monitoring',
  baselineLabel = 'Training (Baseline)',
}) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current || !metrics.length) return;

    // Sort by vintage
    const sortedMetrics = [...metrics].sort((a, b) => a.vintage.localeCompare(b.vintage));

    // Extract data
    const labels = sortedMetrics.map(m => m.vintage);
    const dataPoints = sortedMetrics.map(m => {
      if (metricKey === 'volume') {
        return m.volume;
      }
      return m.metrics[metricKey] || null;
    });

    // Destroy existing chart
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    // Determine color based on metric
    const getColor = () => {
      switch (metricKey) {
        case 'KS': return '#3b82f6'; // blue
        case 'PSI': return '#f59e0b'; // amber
        case 'AUC': return '#10b981'; // green
        case 'bad_rate': return '#ef4444'; // red
        case 'Gini': return '#8b5cf6'; // purple
        case 'CA_at_10': return '#06b6d4'; // cyan
        case 'volume': return '#6366f1'; // indigo
        default: return '#6b7280'; // gray
      }
    };

    const color = getColor();

    const isCompareMode = !!baselineMetrics && baselineMetrics.length > 0;
    const sortedBaseline = isCompareMode
      ? [...baselineMetrics!].sort((a, b) => a.vintage.localeCompare(b.vintage))
      : [];
    const baselineDataPoints = sortedBaseline.map(m => {
      if (metricKey === 'volume') return m.volume;
      return m.metrics[metricKey] || null;
    });

    const datasets: any[] = [
      {
        label: isCompareMode ? currentLabel : (title || metricKey),
        data: dataPoints,
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
      },
    ];

    if (isCompareMode) {
      datasets.push({
        label: baselineLabel,
        data: baselineDataPoints,
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

    chartInstanceRef.current = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const value = context.parsed.y;
                if (metricKey === 'volume') {
                  return `Volume: ${value.toLocaleString()}`;
                }
                return `${metricKey}: ${value.toFixed(4)}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: {
              display: false,
            },
            ticks: {
              font: {
                size: 11,
                family: 'Inter, system-ui, sans-serif',
              },
              maxRotation: 45,
              minRotation: 45,
            },
          },
          y: {
            beginAtZero: metricKey === 'volume',
            grid: {
              color: '#e5e7eb',
            },
            ticks: {
              font: {
                size: 11,
                family: 'Inter, system-ui, sans-serif',
              },
              callback: function(value: any) {
                if (metricKey === 'volume') {
                  return (value as number).toLocaleString();
                }
                return (value as number).toFixed(2);
              },
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
  }, [metrics, metricKey, title, height, baselineMetrics, currentLabel, baselineLabel]);

  return (
    <div style={{ height: `${height}px` }} className="w-full">
      <canvas ref={chartRef}></canvas>
    </div>
  );
};
