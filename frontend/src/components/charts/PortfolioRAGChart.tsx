import React, { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { BankingMetrics } from '../../utils/bankingMetricsMock';

Chart.register(...registerables);

interface PortfolioRAGChartProps {
  metrics: BankingMetrics[];
  onRAGClick?: (ragStatus: 'green' | 'amber' | 'red') => void;
}

export const PortfolioRAGChart: React.FC<PortfolioRAGChartProps> = ({ metrics, onRAGClick }) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current || !metrics.length) return;

    // Calculate RAG distribution
    const ragCounts = {
      green: metrics.filter(m => m.rag_status === 'green').length,
      amber: metrics.filter(m => m.rag_status === 'amber').length,
      red: metrics.filter(m => m.rag_status === 'red').length,
    };

    const total = ragCounts.green + ragCounts.amber + ragCounts.red;

    // Destroy existing chart
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    chartInstanceRef.current = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Green', 'Amber', 'Red'],
        datasets: [{
          data: [ragCounts.green, ragCounts.amber, ragCounts.red],
          backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
          borderColor: ['#059669', '#d97706', '#dc2626'],
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
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
                const label = context.label || '';
                const value = context.parsed || 0;
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                return `${label}: ${value} models (${percentage}%)`;
              },
            },
          },
        },
        onClick: (event: any, elements: any) => {
          if (elements.length > 0 && onRAGClick) {
            const index = elements[0].index;
            const ragStatus = ['green', 'amber', 'red'][index] as 'green' | 'amber' | 'red';
            onRAGClick(ragStatus);
          }
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [metrics, onRAGClick]);

  return (
    <div className="h-full w-full flex items-center justify-center p-4">
      <canvas ref={chartRef}></canvas>
    </div>
  );
};
