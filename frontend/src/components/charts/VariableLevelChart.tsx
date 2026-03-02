import React, { useEffect, useRef, useMemo } from 'react';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface VariableLevelChartProps {
  modelId: string;
  variable: string;
  vintage?: string;
  isDark?: boolean;
  height?: number;
}

/** Seeded pseudo-random for reproducible mock distributions */
function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function hashStr(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(h);
}

/** Generate baseline and current bin distributions for a variable */
function generateDistribution(
  variable: string,
  modelId: string,
  vintage: string,
  bins = 10
): { binLabels: string[]; baseline: number[]; current: number[]; psi: number } {
  const rng1 = seededRng(hashStr(`${variable}-${modelId}-baseline`));
  const rng2 = seededRng(hashStr(`${variable}-${modelId}-${vintage}-current`));

  // Generate raw weights and normalise to sum to 1
  const raw1 = Array.from({ length: bins }, () => rng1() + 0.1);
  const raw2 = Array.from({ length: bins }, () => rng2() + 0.1);
  const sum1 = raw1.reduce((a, b) => a + b, 0);
  const sum2 = raw2.reduce((a, b) => a + b, 0);
  const baseline = raw1.map(v => parseFloat((v / sum1).toFixed(4)));
  const current  = raw2.map(v => parseFloat((v / sum2).toFixed(4)));

  // PSI = Σ (actual − expected) × ln(actual / expected)
  const psi = baseline.reduce((acc, b, i) => {
    const c = current[i];
    if (b === 0 || c === 0) return acc;
    return acc + (c - b) * Math.log(c / b);
  }, 0);

  // Generate human-readable bin labels based on variable name
  const isScoreVar = variable.toLowerCase().includes('score') || variable.toLowerCase().includes('rating');
  const binLabels = Array.from({ length: bins }, (_, i) => {
    if (isScoreVar) return `${i * 100}–${(i + 1) * 100}`;
    return `B${i + 1}`;
  });

  return { binLabels, baseline, current, psi: parseFloat(psi.toFixed(4)) };
}

const VariableLevelChart: React.FC<VariableLevelChartProps> = ({
  modelId,
  variable,
  vintage = '2025-01',
  isDark = false,
  height = 280,
}) => {
  const distChartRef   = useRef<HTMLCanvasElement>(null);
  const psiChartRef    = useRef<HTMLCanvasElement>(null);
  const distChartInst  = useRef<Chart | null>(null);
  const psiChartInst   = useRef<Chart | null>(null);

  const { binLabels, baseline, current, psi } = useMemo(
    () => generateDistribution(variable, modelId, vintage),
    [variable, modelId, vintage]
  );

  // Generate PSI trend over multiple vintages
  const psiTrend = useMemo(() => {
    const vintages = ['2024-01','2024-02','2024-03','2024-04','2024-05','2024-06',
                      '2024-07','2024-08','2024-09','2024-10','2024-11','2024-12','2025-01'];
    return vintages.map(v => ({
      vintage: v,
      psi: generateDistribution(variable, modelId, v).psi,
    }));
  }, [variable, modelId]);

  const textColor = isDark ? '#94a3b8' : '#475569';
  const gridColor = isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.08)';

  // Distribution chart
  useEffect(() => {
    if (!distChartRef.current) return;
    if (distChartInst.current) distChartInst.current.destroy();
    const ctx = distChartRef.current.getContext('2d');
    if (!ctx) return;

    distChartInst.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: binLabels,
        datasets: [
          {
            label: 'Baseline (Training)',
            data: baseline,
            backgroundColor: 'rgba(59,130,246,0.7)',
            borderColor: '#3b82f6',
            borderWidth: 1,
          },
          {
            label: 'Current (Monitoring)',
            data: current,
            backgroundColor: 'rgba(16,185,129,0.7)',
            borderColor: '#10b981',
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: textColor, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${(Number(ctx.raw) * 100).toFixed(1)}%`,
            },
          },
        },
        scales: {
          x: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } },
          y: {
            ticks: {
              color: textColor,
              font: { size: 10 },
              callback: v => `${(Number(v) * 100).toFixed(0)}%`,
            },
            grid: { color: gridColor },
          },
        },
      },
    });

    return () => { distChartInst.current?.destroy(); };
  }, [binLabels, baseline, current, textColor, gridColor]);

  // PSI trend line chart
  useEffect(() => {
    if (!psiChartRef.current) return;
    if (psiChartInst.current) psiChartInst.current.destroy();
    const ctx = psiChartRef.current.getContext('2d');
    if (!ctx) return;

    const psiColors = psiTrend.map(d =>
      d.psi >= 0.25 ? '#ef4444' : d.psi >= 0.10 ? '#f59e0b' : '#22c55e'
    );

    psiChartInst.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: psiTrend.map(d => d.vintage),
        datasets: [
          {
            label: 'PSI Over Time',
            data: psiTrend.map(d => d.psi),
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139,92,246,0.15)',
            fill: true,
            tension: 0.3,
            pointBackgroundColor: psiColors,
            pointRadius: 5,
          },
          {
            label: 'Amber Threshold (0.10)',
            data: psiTrend.map(() => 0.10),
            borderColor: '#f59e0b',
            borderDash: [4, 4],
            borderWidth: 1.5,
            pointRadius: 0,
          },
          {
            label: 'Red Threshold (0.25)',
            data: psiTrend.map(() => 0.25),
            borderColor: '#ef4444',
            borderDash: [4, 4],
            borderWidth: 1.5,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: textColor, font: { size: 11 } } },
          tooltip: {
            callbacks: { label: ctx => ` PSI: ${Number(ctx.raw).toFixed(4)}` },
          },
        },
        scales: {
          x: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } },
          y: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor }, min: 0 },
        },
      },
    });

    return () => { psiChartInst.current?.destroy(); };
  }, [psiTrend, textColor, gridColor]);

  const psiStatus = psi >= 0.25 ? 'red' : psi >= 0.10 ? 'amber' : 'green';
  const psiLabel  = psi >= 0.25 ? 'Unstable' : psi >= 0.10 ? 'Warning' : 'Stable';
  const psiBadge  = {
    green: 'bg-green-100 text-green-800',
    amber: 'bg-amber-100 text-amber-800',
    red:   'bg-red-100 text-red-800',
  }[psiStatus];

  return (
    <div className="space-y-4">
      {/* PSI summary badge */}
      <div className="flex items-center gap-3">
        <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {variable}
        </span>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${psiBadge}`}>
          PSI {psi.toFixed(4)} — {psiLabel}
        </span>
      </div>

      {/* Distribution comparison */}
      <div>
        <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Score Distribution — Baseline vs Current (latest vintage: {vintage})
        </p>
        <div style={{ height }}>
          <canvas ref={distChartRef} />
        </div>
      </div>

      {/* PSI trend */}
      <div>
        <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          PSI Trend Over Time
        </p>
        <div style={{ height: 160 }}>
          <canvas ref={psiChartRef} />
        </div>
      </div>
    </div>
  );
};

export default VariableLevelChart;
