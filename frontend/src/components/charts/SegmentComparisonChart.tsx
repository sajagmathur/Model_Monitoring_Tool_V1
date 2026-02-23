import React, { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { SegmentMetrics } from '../../utils/bankingMetricsMock';

Chart.register(...registerables);

interface SegmentComparisonChartProps {
  segmentData: SegmentMetrics;
  metricKeys?: ('KS' | 'PSI' | 'AUC' | 'bad_rate')[];
}

export const SegmentComparisonChart: React.FC<SegmentComparisonChartProps> = ({ 
  segmentData,
  metricKeys = ['KS', 'PSI', 'AUC', 'bad_rate']
}) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current || !segmentData.segments.length) return;

    // Destroy existing chart
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    const datasets = segmentData.segments.map((seg, idx) => {
      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
      const color = colors[idx % colors.length];
      
      return {
        label: seg.label,
        data: metricKeys.map(key => seg.metrics[key] || 0),
        backgroundColor: `${color}99`,
        borderColor: color,
        borderWidth: 2,
      };
    });

    chartInstanceRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: metricKeys,
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: {
                size: 12,
                family: 'Inter, system-ui, sans-serif',
              },
              padding: 15,
              usePointStyle: true,
            },
          },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const label = context.dataset.label || '';
                const value = context.parsed.y;
                return `${label}: ${value.toFixed(4)}`;
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
                size: 12,
                family: 'Inter, system-ui, sans-serif',
              },
            },
          },
          y: {
            beginAtZero: true,
            grid: {
              color: '#e5e7eb',
            },
            ticks: {
              font: {
                size: 11,
                family: 'Inter, system-ui, sans-serif',
              },
              callback: function(value: any) {
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
  }, [segmentData, metricKeys]);

  return (
    <div className="h-full w-full p-4">
      <canvas ref={chartRef}></canvas>
    </div>
  );
};
