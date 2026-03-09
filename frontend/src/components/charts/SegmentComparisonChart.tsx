import React, { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { SegmentMetrics } from '../../utils/bankingMetricsMock';

Chart.register(...registerables);

type SegmentMetricKey = 'KS' | 'PSI' | 'AUC' | 'bad_rate' | 'accuracy' | 'precision' | 'recall' | 'f1_score' | 'HRL' | 'Gini' | 'MAPE';

interface SegmentComparisonChartProps {
  segmentData: SegmentMetrics;
  metricKeys?: SegmentMetricKey[];
  /** When set, filters the chart to only show that segment's bar group */
  activeSegment?: 'thin_file' | 'thick_file' | 'all';
  /** When provided (compare mode), renders lighter baseline bars alongside current */
  baselineSegmentData?: SegmentMetrics;
  /** Explicit label shown as chart subtitle */
  segmentLabel?: string;
}

export const SegmentComparisonChart: React.FC<SegmentComparisonChartProps> = ({
  segmentData,
  metricKeys = ['KS', 'PSI', 'AUC', 'bad_rate'] as SegmentMetricKey[],
  activeSegment = 'all',
  baselineSegmentData,
  segmentLabel,
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

    // Consistent segment colours: Thin File = blue, Thick File = teal
    const segColor = (seg: { segment: string }) =>
      seg.segment === 'thin_file' ? '#3b82f6'
      : seg.segment === 'thick_file' ? '#14b8a6'
      : '#10b981';

    // Build current datasets
    const datasets = visibleSegments.map((seg) => {
      const color = segColor(seg);
      return {
        label: `${seg.label} (Monitoring)`,
        data: metricKeys.map(key => (seg.metrics as any)[key] || 0),
        backgroundColor: `${color}99`,
        borderColor: color,
        borderWidth: 2,
      };
    });

    // Add baseline datasets when in compare mode
    if (visibleBaseline.length > 0) {
      visibleBaseline.forEach((seg) => {
        // Warm amber/orange for baseline bars — clearly distinct from cool blue/teal monitoring bars
        const baselineColor = seg.segment === 'thin_file' ? '#f59e0b' : '#f97316';
        datasets.push({
          label: `${seg.label} (Training)`,
          data: metricKeys.map(key => (seg.metrics as any)[key] || 0),
          backgroundColor: `${baselineColor}99`,
          borderColor: baselineColor,
          borderWidth: 2,
        });
      });
    }

    const rafId = requestAnimationFrame(() => {
      if (!chartRef.current) return;
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
          title: {
            display: true,
            text: (() => {
              const isCompare = visibleBaseline.length > 0;
              if (activeSegment === 'all') {
                return isCompare
                  ? 'All Segments: Monitoring (blue/teal)  │  Training Baseline (amber/orange)'
                  : 'All Segments — Thin File (blue) vs Thick File (teal)';
              }
              const segName = activeSegment === 'thin_file' ? 'Thin File' : 'Thick File';
              return isCompare
                ? `${segName}: Monitoring (blue) vs Training Baseline (amber)`
                : (segmentLabel ? `Segment: ${segmentLabel}` : `${segName} Only`);
            })(),
            font: { size: 11, family: 'Inter, system-ui, sans-serif', style: 'italic' },
            color: '#6b7280',
            padding: { bottom: 6 },
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

    });

    return () => {
      cancelAnimationFrame(rafId);
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [segmentData, metricKeys, activeSegment, baselineSegmentData, segmentLabel]);

  return (
    <div className="h-full w-full p-4">
      <canvas ref={chartRef}></canvas>
    </div>
  );
};
