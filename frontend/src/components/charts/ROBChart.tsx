import React, { useEffect, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface ROBChartProps {
  isDark?: boolean;
  viewMode?: 'chart' | 'table';
  /** When true (during export capture), renders both chart and data table simultaneously */
  forceBoth?: boolean;
}

interface ROBNode {
  node: string;
  treatment: string;
  refAccounts: number;
  refPct: number;
  refBads: number;
  refBadRate: number;
  refRank: number;
  monAccounts: number;
  monPct: number;
  monBads: number;
  monBadRate: number;
  monRank: number;
  rob: number;
}

const ROB_DATA_UC1: ROBNode[] = [
  { node:'A', treatment:'CLD',    refAccounts:31255, refPct:8,  refBads:2500, refBadRate:8.00,  refRank:1, monAccounts:36372, monPct:10, monBads:4000, monBadRate:11.00, monRank:1, rob:0 },
  { node:'B', treatment:'CLD',    refAccounts:4891,  refPct:1,  refBads:318,  refBadRate:6.50,  refRank:2, monAccounts:7130,  monPct:2,  monBads:356,  monBadRate:4.99,  monRank:2, rob:0 },
  { node:'C', treatment:'CLD',    refAccounts:19283, refPct:5,  refBads:965,  refBadRate:5.00,  refRank:3, monAccounts:21353, monPct:6,  monBads:750,  monBadRate:3.51,  monRank:6, rob:3 },
  { node:'D', treatment:'No-CLD', refAccounts:63198, refPct:17, refBads:2520, refBadRate:3.99,  refRank:4, monAccounts:77146, monPct:21, monBads:3367, monBadRate:4.36,  monRank:5, rob:1 },
  { node:'E', treatment:'No-CLD', refAccounts:92208, refPct:25, refBads:3500, refBadRate:3.80,  refRank:5, monAccounts:45364, monPct:12, monBads:2041, monBadRate:4.50,  monRank:3, rob:0 },
  { node:'F', treatment:'No-CLD', refAccounts:5129,  refPct:1,  refBads:190,  refBadRate:3.70,  refRank:6, monAccounts:40972, monPct:11, monBads:1800, monBadRate:4.39,  monRank:4, rob:0 },
  { node:'G', treatment:'No-CLD', refAccounts:86730, refPct:23, refBads:1734, refBadRate:2.00,  refRank:7, monAccounts:72118, monPct:20, monBads:900,  monBadRate:1.25,  monRank:8, rob:1 },
  { node:'H', treatment:'No-CLD', refAccounts:70689, refPct:19, refBads:75,   refBadRate:0.11,  refRank:8, monAccounts:68020, monPct:18, monBads:1020, monBadRate:1.50,  monRank:7, rob:0 },
];

const ROB_DATA_UC2: ROBNode[] = [
  { node:'A', treatment:'CLD',    refAccounts:31255, refPct:8,  refBads:2500, refBadRate:8.00,  refRank:1, monAccounts:33100, monPct:9,  monBads:2640, monBadRate:7.97,  monRank:1, rob:0 },
  { node:'B', treatment:'CLD',    refAccounts:4891,  refPct:1,  refBads:318,  refBadRate:6.50,  refRank:2, monAccounts:5014,  monPct:1,  monBads:326,  monBadRate:6.50,  monRank:2, rob:0 },
  { node:'C', treatment:'CLD',    refAccounts:19283, refPct:5,  refBads:965,  refBadRate:5.00,  refRank:3, monAccounts:20050, monPct:6,  monBads:1002, monBadRate:4.99,  monRank:3, rob:0 },
  { node:'D', treatment:'No-CLD', refAccounts:63198, refPct:17, refBads:2520, refBadRate:3.99,  refRank:4, monAccounts:64800, monPct:18, monBads:2584, monBadRate:3.99,  monRank:4, rob:0 },
  { node:'E', treatment:'No-CLD', refAccounts:92208, refPct:25, refBads:3500, refBadRate:3.80,  refRank:5, monAccounts:90000, monPct:24, monBads:3420, monBadRate:3.80,  monRank:5, rob:0 },
  { node:'F', treatment:'No-CLD', refAccounts:5129,  refPct:1,  refBads:190,  refBadRate:3.70,  refRank:6, monAccounts:5200,  monPct:1,  monBads:192,  monBadRate:3.70,  monRank:6, rob:0 },
  { node:'G', treatment:'No-CLD', refAccounts:86730, refPct:23, refBads:1734, refBadRate:2.00,  refRank:7, monAccounts:85000, monPct:23, monBads:1700, monBadRate:2.00,  monRank:7, rob:0 },
  { node:'H', treatment:'No-CLD', refAccounts:70689, refPct:19, refBads:75,   refBadRate:0.11,  refRank:8, monAccounts:70100, monPct:19, monBads:77,   monBadRate:0.11,  monRank:8, rob:0 },
];

const ROBChart: React.FC<ROBChartProps> = ({ isDark = false, viewMode = 'chart', forceBoth = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [useCase, setUseCase] = useState<'uc1' | 'uc2'>('uc1');

  const data = useCase === 'uc1' ? ROB_DATA_UC1 : ROB_DATA_UC2;
  const totalROB = data.reduce((sum, r) => sum + r.rob, 0);
  const totalRefAccounts = data.reduce((sum, r) => sum + r.refAccounts, 0);
  const totalMonAccounts = data.reduce((sum, r) => sum + r.monAccounts, 0);
  const totalRefBads = data.reduce((sum, r) => sum + r.refBads, 0);
  const totalMonBads = data.reduce((sum, r) => sum + r.monBads, 0);
  const totalRefBadRate = totalRefAccounts > 0 ? (totalRefBads / totalRefAccounts) * 100 : 0;
  const totalMonBadRate = totalMonAccounts > 0 ? (totalMonBads / totalMonAccounts) * 100 : 0;
  const maxPairs = data.length * (data.length - 1) / 2;
  const robPct = maxPairs > 0 ? ((totalROB / maxPairs) * 100).toFixed(1) : '0.0';

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const textColor = isDark ? '#cbd5e1' : '#475569';
    const gridColor = isDark ? 'rgba(148,163,184,0.15)' : 'rgba(100,116,139,0.1)';

    const refColors = data.map(r =>
      r.rob > 0
        ? (isDark ? 'rgba(245,158,11,0.75)' : 'rgba(245,158,11,0.85)')
        : (isDark ? 'rgba(99,102,241,0.65)' : 'rgba(99,102,241,0.75)')
    );
    const monColors = data.map(r =>
      r.rob > 0
        ? (isDark ? 'rgba(239,68,68,0.75)' : 'rgba(239,68,68,0.8)')
        : (isDark ? 'rgba(20,184,166,0.65)' : 'rgba(20,184,166,0.75)')
    );

    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(r => `Node ${r.node}`),
        datasets: [
          {
            label: 'Reference Bad Rate (%)',
            data: data.map(r => r.refBadRate),
            backgroundColor: refColors,
            borderColor: refColors,
            borderWidth: 1.5,
          },
          {
            label: 'Monitoring Bad Rate (%)',
            data: data.map(r => r.monBadRate),
            backgroundColor: monColors,
            borderColor: monColors,
            borderWidth: 1.5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              title: (items) => {
                const idx = items[0]?.dataIndex ?? 0;
                const row = data[idx];
                return `Node ${row.node} (${row.treatment})${row.rob > 0 ? ' ⚠ Rank Break' : ''}`;
              },
              label: (ctx) => {
                const idx = ctx.dataIndex;
                const row = data[idx];
                if (ctx.datasetIndex === 0) return ` Ref Bad Rate: ${row.refBadRate.toFixed(2)}%  (Rank #${row.refRank})`;
                return ` Mon Bad Rate: ${row.monBadRate.toFixed(2)}%  (Rank #${row.monRank})`;
              },
              footer: (items) => {
                const idx = items[0]?.dataIndex ?? 0;
                const row = data[idx];
                return row.rob > 0 ? `ROB: ${row.rob} rank position(s) breached` : '';
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { color: textColor },
            grid: { color: gridColor },
            title: { display: true, text: 'Decision Node', color: textColor, font: { size: 12 } },
          },
          y: {
            ticks: { color: textColor, callback: (v) => `${v}%` },
            grid: { color: gridColor },
            title: { display: true, text: 'Bad Rate (%)', color: textColor, font: { size: 12 } },
          },
        },
      },
    });

    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [data, isDark, viewMode]);

  return (
    <div>
      {/* Use Case Toggle */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Vintage:</span>
        {(['uc1', 'uc2'] as const).map(uc => (
          <button
            key={uc}
            onClick={() => setUseCase(uc)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              useCase === uc
                ? 'bg-blue-600 text-white'
                : isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {uc === 'uc1' ? "Jan'24 — KPI Breach" : "Apr'24 — No Breach"}
          </button>
        ))}
        <div className="flex flex-wrap items-center gap-3 ml-auto text-xs">
          <span className={`flex items-center gap-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <span className="inline-block w-3 h-3 rounded-sm bg-amber-400 opacity-80" /> Ref (ROB node)
          </span>
          <span className={`flex items-center gap-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <span className="inline-block w-3 h-3 rounded-sm bg-indigo-500 opacity-70" /> Ref (stable)
          </span>
          <span className={`flex items-center gap-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <span className="inline-block w-3 h-3 rounded-sm bg-red-500 opacity-75" /> Mon (ROB node)
          </span>
          <span className={`flex items-center gap-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <span className="inline-block w-3 h-3 rounded-sm bg-teal-500 opacity-70" /> Mon (stable)
          </span>
        </div>
      </div>

      {/* KPI Summary Row */}
      <div className={`mb-4 flex flex-wrap gap-4 p-3 rounded-lg text-xs ${isDark ? 'bg-slate-900/50' : 'bg-slate-50'}`}>
        <div>
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Total ROB Count: </span>
          <span className={`font-bold ${totalROB > 0 ? 'text-amber-500' : isDark ? 'text-green-400' : 'text-green-600'}`}>{totalROB}</span>
        </div>
        <div>
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>ROB %: </span>
          <span className={`font-bold ${totalROB > 0 ? 'text-amber-500' : isDark ? 'text-green-400' : 'text-green-600'}`}>{robPct}%</span>
        </div>
        <div>
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Ref Portfolio Bad Rate: </span>
          <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{totalRefBadRate.toFixed(2)}%</span>
        </div>
        <div>
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Mon Portfolio Bad Rate: </span>
          <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{totalMonBadRate.toFixed(2)}%</span>
        </div>
        <div>
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Status: </span>
          <span className={`font-bold ${totalROB > 0 ? 'text-red-500' : isDark ? 'text-green-400' : 'text-green-600'}`}>
            {totalROB > 0 ? '⚠ KPI Breach' : '✓ No Breach'}
          </span>
        </div>
      </div>

      {/* Chart */}
      {(viewMode !== 'table' || forceBoth) && (
        <div style={{ height: '260px' }}>
          <canvas ref={canvasRef} />
        </div>
      )}

      {/* Data Table */}
      {(viewMode !== 'chart' || forceBoth) && (
        <div className="mt-4 overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className={isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-700'}>
              <th className="px-2 py-2 text-left font-semibold">Node</th>
              <th className="px-2 py-2 text-left font-semibold">Treatment</th>
              <th className="px-2 py-2 text-right font-semibold">Ref Accts</th>
              <th className="px-2 py-2 text-right font-semibold">Ref %</th>
              <th className="px-2 py-2 text-right font-semibold">Ref Bads</th>
              <th className="px-2 py-2 text-right font-semibold">Ref Bad Rate</th>
              <th className="px-2 py-2 text-center font-semibold">Ref Rank</th>
              <th className="px-2 py-2 text-right font-semibold">Mon Accts</th>
              <th className="px-2 py-2 text-right font-semibold">Mon %</th>
              <th className="px-2 py-2 text-right font-semibold">Mon Bads</th>
              <th className="px-2 py-2 text-right font-semibold">Mon Bad Rate</th>
              <th className="px-2 py-2 text-center font-semibold">Mon Rank</th>
              <th className="px-2 py-2 text-center font-semibold">ROB</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-slate-200'}`}>
            {data.map((r) => (
              <tr
                key={r.node}
                className={
                  r.rob > 0
                    ? (isDark ? 'bg-amber-900/20 hover:bg-amber-900/30' : 'bg-amber-50 hover:bg-amber-100')
                    : (isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-50')
                }
              >
                <td className={`px-2 py-1.5 font-bold ${r.rob > 0 ? 'text-amber-500' : isDark ? 'text-slate-300' : 'text-slate-700'}`}>{r.node}</td>
                <td className={`px-2 py-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{r.treatment}</td>
                <td className={`px-2 py-1.5 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{r.refAccounts.toLocaleString()}</td>
                <td className={`px-2 py-1.5 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{r.refPct}%</td>
                <td className={`px-2 py-1.5 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{r.refBads.toLocaleString()}</td>
                <td className={`px-2 py-1.5 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{r.refBadRate.toFixed(2)}%</td>
                <td className={`px-2 py-1.5 text-center ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{r.refRank}</td>
                <td className={`px-2 py-1.5 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{r.monAccounts.toLocaleString()}</td>
                <td className={`px-2 py-1.5 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{r.monPct}%</td>
                <td className={`px-2 py-1.5 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{r.monBads.toLocaleString()}</td>
                <td className={`px-2 py-1.5 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{r.monBadRate.toFixed(2)}%</td>
                <td className={`px-2 py-1.5 text-center ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{r.monRank}</td>
                <td className="px-2 py-1.5 text-center">
                  {r.rob > 0
                    ? <span className="font-bold text-amber-500">⚠ {r.rob}</span>
                    : <span className={isDark ? 'text-green-400' : 'text-green-600'}>✓ 0</span>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className={`font-semibold border-t-2 ${isDark ? 'border-slate-500 bg-slate-700 text-slate-200' : 'border-slate-400 bg-slate-100 text-slate-800'}`}>
              <td className="px-2 py-1.5 font-bold" colSpan={2}>Total</td>
              <td className="px-2 py-1.5 text-right font-mono">{totalRefAccounts.toLocaleString()}</td>
              <td className="px-2 py-1.5 text-right font-mono">100%</td>
              <td className="px-2 py-1.5 text-right font-mono">{totalRefBads.toLocaleString()}</td>
              <td className="px-2 py-1.5 text-right font-mono">{totalRefBadRate.toFixed(2)}%</td>
              <td className="px-2 py-1.5 text-center">—</td>
              <td className="px-2 py-1.5 text-right font-mono">{totalMonAccounts.toLocaleString()}</td>
              <td className="px-2 py-1.5 text-right font-mono">100%</td>
              <td className="px-2 py-1.5 text-right font-mono">{totalMonBads.toLocaleString()}</td>
              <td className="px-2 py-1.5 text-right font-mono">{totalMonBadRate.toFixed(2)}%</td>
              <td className="px-2 py-1.5 text-center">—</td>
              <td className={`px-2 py-1.5 text-center font-bold ${totalROB > 0 ? 'text-amber-500' : isDark ? 'text-green-400' : 'text-green-600'}`}>
                {totalROB > 0 ? `⚠ ${totalROB}` : '✓ 0'}
              </td>
            </tr>
          </tfoot>
        </table>
        </div>
      )}
    </div>
  );
};

export default ROBChart;

