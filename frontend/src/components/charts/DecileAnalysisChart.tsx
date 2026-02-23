import React, { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { DecileData } from '../../utils/bankingMetricsMock';

Chart.register(...registerables);

interface DecileAnalysisChartProps {
  deciles: DecileData[];
}

export const DecileAnalysisChart: React.FC<DecileAnalysisChartProps> = ({ deciles }) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current || !deciles.length) return;

    // Destroy existing chart
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    const labels = deciles.map(d => `D${d.decile}`);
    const badRates = deciles.map(d => d.bad_rate * 100); // Convert to percentage
    const ksValues = deciles.map(d => d.ks * 100); // Convert to percentage

    chartInstanceRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Bad Rate (%)',
            data: badRates,
            backgroundColor: '#ef444499',
            borderColor: '#ef4444',
            borderWidth: 2,
            yAxisID: 'y',
          },
          {
            label: 'KS (%)',
            data: ksValues,
            type: 'line',
            borderColor: '#3b82f6',
            backgroundColor: '#3b82f633',
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            yAxisID: 'y',
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#3b82f6',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
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
                return `${label}: ${value.toFixed(2)}%`;
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
            type: 'linear',
            position: 'left',
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
                return value + '%';
              },
            },
            title: {
              display: true,
              text: 'Percentage (%)',
              font: {
                size: 12,
                weight: 'bold',
                family: 'Inter, system-ui, sans-serif',
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
  }, [deciles]);

  return (
    <div className="h-full w-full p-4">
      <canvas ref={chartRef}></canvas>
    </div>
  );
};
