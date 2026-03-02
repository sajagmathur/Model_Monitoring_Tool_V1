import React, { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface ROBChartProps {
  isDark?: boolean;
}

const ROB_DATA = [
  { band: '0.0–0.2', total: 400, bad: 8, badRate: 2 },
  { band: '0.2–0.4', total: 300, bad: 15, badRate: 5 },
  { band: '0.4–0.6', total: 200, bad: 30, badRate: 15 },
  { band: '0.6–0.8', total: 80, bad: 28, badRate: 35 },
  { band: '0.8–1.0', total: 20, bad: 12, badRate: 60 },
];

const ROBChart: React.FC<ROBChartProps> = ({ isDark = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const textColor = isDark ? '#cbd5e1' : '#475569';
    const gridColor = isDark ? 'rgba(148,163,184,0.15)' : 'rgba(100,116,139,0.1)';

    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ROB_DATA.map(d => d.band),
        datasets: [
          {
            label: 'Total',
            data: ROB_DATA.map(d => d.total),
            backgroundColor: isDark ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.6)',
            borderColor: isDark ? 'rgba(99,102,241,0.8)' : 'rgba(99,102,241,0.9)',
            borderWidth: 1,
            yAxisID: 'yVolume',
            order: 2,
          },
          {
            label: 'Bad Count',
            data: ROB_DATA.map(d => d.bad),
            backgroundColor: isDark ? 'rgba(245,158,11,0.5)' : 'rgba(245,158,11,0.6)',
            borderColor: isDark ? 'rgba(245,158,11,0.8)' : 'rgba(245,158,11,0.9)',
            borderWidth: 1,
            yAxisID: 'yVolume',
            order: 2,
          },
          {
            label: 'Bad Rate (%)',
            data: ROB_DATA.map(d => d.badRate),
            type: 'line',
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239,68,68,0.12)',
            pointBackgroundColor: '#ef4444',
            pointRadius: 5,
            pointHoverRadius: 7,
            borderWidth: 2.5,
            fill: false,
            tension: 0.35,
            yAxisID: 'yBadRate',
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: { color: textColor, usePointStyle: true, padding: 16, font: { size: 12 } },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const y = ctx.parsed.y ?? 0;
                if (ctx.dataset.label === 'Bad Rate (%)') return ` Bad Rate: ${y}%`;
                return ` ${ctx.dataset.label}: ${y.toLocaleString()}`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { color: textColor },
            grid: { color: gridColor },
            title: { display: true, text: 'Score Band', color: textColor, font: { size: 12 } },
          },
          yVolume: {
            type: 'linear',
            position: 'left',
            ticks: { color: textColor },
            grid: { color: gridColor },
            title: { display: true, text: 'Count', color: textColor, font: { size: 12 } },
          },
          yBadRate: {
            type: 'linear',
            position: 'right',
            min: 0,
            max: 100,
            ticks: { color: '#ef4444', callback: (v) => `${v}%` },
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'Bad Rate (%)', color: '#ef4444', font: { size: 12 } },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [isDark]);

  return (
    <div>
      <div style={{ height: 300 }}>
        <canvas ref={canvasRef} />
      </div>
      {/* Data table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className={isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-700'}>
              <th className="px-3 py-2 text-left font-semibold">Score Band</th>
              <th className="px-3 py-2 text-right font-semibold">Total</th>
              <th className="px-3 py-2 text-right font-semibold">Bad</th>
              <th className="px-3 py-2 text-right font-semibold">Bad Rate</th>
              <th className="px-3 py-2 text-left font-semibold">Risk Level</th>
            </tr>
          </thead>
          <tbody>
            {ROB_DATA.map((row, i) => {
              const riskLevel = row.badRate <= 5 ? 'Low' : row.badRate <= 20 ? 'Medium' : 'High';
              const riskColor = riskLevel === 'Low' ? 'text-green-500' : riskLevel === 'Medium' ? 'text-amber-500' : 'text-red-500';
              return (
                <tr key={i} className={isDark ? 'hover:bg-slate-700 border-b border-slate-700' : 'hover:bg-slate-50 border-b border-slate-100'}>
                  <td className={`px-3 py-2 font-mono ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>{row.band}</td>
                  <td className={`px-3 py-2 text-right ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>{row.total.toLocaleString()}</td>
                  <td className={`px-3 py-2 text-right ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>{row.bad.toLocaleString()}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${riskColor}`}>{row.badRate}%</td>
                  <td className={`px-3 py-2 font-medium text-xs ${riskColor}`}>{riskLevel}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ROBChart;
