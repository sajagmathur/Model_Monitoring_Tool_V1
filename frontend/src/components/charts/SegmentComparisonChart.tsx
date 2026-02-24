import React, { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { SegmentMetrics } from '../../utils/bankingMetricsMock';

Chart.register(...registerables);

interface SegmentComparisonChartProps {
  segmentData: SegmentMetrics;
  metricKeys?: ('KS' | 'PSI' | 'AUC' | 'bad_rate')[];
  /** When set, filters the chart to only show that segment's bar group */
  activeSegment?: 'thin_file' | 'thick_file' | 'all';
  /** When provided (compare mode), renders lighter baseline bars alongside current */
  baselineSegmentData?: SegmentMetrics;
}

export const SegmentComparisonChart: React.FC<SegmentComparisonChartProps> = ({ 
  segmentData,
  metricKeys = ['KS', 'PSI', 'AUC', 'bad_rate'],
  activeSegment = 'all',
  baselineSegmentData,
}) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current || !segmentData.segments.length) return;

    // Filter segments based on activeSegment
    const visibleSegments = activeSegment === 'all'
      ? segmentData.segments
      : segmentData.segments.filter(s => s.segment === activeSegment);

    const visibleBaseline = baselineSegmentData
      ? (activeSegment === 'all'
          ? baselineSegmentData.segments
          : baselineSegmentData.segments.filter(s => s.segment === activeSegment))
      : [];

    // Destroy existing chart
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

    // Build current datasets
    const datasets = visibleSegments.map((seg, idx) => {
      const color = colors[idx % colors.length];
      return {
        label: `${seg.label} (Monitoring)`,
        data: metricKeys.map(key => seg.metrics[key] || 0),
        backgroundColor: `${color}99`,
        borderColor: color,
        borderWidth: 2,
      };
    });

    // Add baseline datasets when in compare mode
    if (visibleBaseline.length > 0) {
      visibleBaseline.forEach((seg, idx) => {
        const color = colors[idx % colors.length];
        datasets.push({
          label: `${seg.label} (Training)`,
          data: metricKeys.map(key => seg.metrics[key] || 0),
          backgroundColor: `${color}33`,
          borderColor: `${color}88`,
          borderWidth: 2,
        });
      });
    }

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
  }, [segmentData, metricKeys, activeSegment, baselineSegmentData]);

  return (
    <div className="h-full w-full p-4">
      <canvas ref={chartRef}></canvas>
    </div>
  );
};
