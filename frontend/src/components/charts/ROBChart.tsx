import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Chart, registerables } from 'chart.js';
import { generateROBTrendData, ROBVintageResult } from '../../utils/bankingMetricsMock';

Chart.register(...registerables);

interface ROBChartProps {
  isDark?: boolean;
  modelId: string;
  referenceVintage: string;
  monVintages: string[];
  viewMode?: 'chart' | 'table';
  /** When true (during export capture), renders both chart and data table simultaneously */
  forceBoth?: boolean;
}

const ROB_AMBER_THRESHOLD = 25;

const ROBChart: React.FC<ROBChartProps> = ({
  isDark = false,
  modelId,
  referenceVintage,
  monVintages,
  viewMode = 'chart',
  forceBoth = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);
  const [selectedVintage, setSelectedVintage] = useState<string>('');

  const robData: ROBVintageResult[] = useMemo(() => {
    if (!modelId || !referenceVintage || monVintages.length === 0) return [];
    return generateROBTrendData(modelId, referenceVintage, monVintages);
  }, [modelId, referenceVintage, monVintages]);

  // Keep selectedVintage in sync
  useEffect(() => {
    if (robData.length > 0 && !robData.find(r => r.vintage === selectedVintage)) {
      setSelectedVintage(robData[robData.length - 1].vintage);
    }
  }, [robData, selectedVintage]);

  const lastRob = robData.length > 0 ? robData[robData.length - 1] : null;
  const isKPIBreach = lastRob ? lastRob.robPct >= ROB_AMBER_THRESHOLD : false;

  const textColor = isDark ? '#94a3b8' : '#475569';
  const gridColor = isDark ? 'rgba(148,163,184,0.12)' : 'rgba(100,116,139,0.1)';

  useEffect(() => {
    if (!canvasRef.current || robData.length === 0) return;
    if (chartInstanceRef.current) { chartInstanceRef.current.destroy(); chartInstanceRef.current = null; }

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const labels = robData.map(r => r.vintage);
    const values = robData.map(r => parseFloat(r.robPct.toFixed(1)));

    const pointColors = values.map(v => v >= ROB_AMBER_THRESHOLD ? '#ef4444' : v > 10 ? '#f59e0b' : '#10b981');
    const lineColor = values.some(v => v >= ROB_AMBER_THRESHOLD) ? '#ef4444' : values.some(v => v > 10) ? '#f59e0b' : '#10b981';

    chartInstanceRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'ROB%',
            data: values,
            borderColor: lineColor,
            backgroundColor: `${lineColor}22`,
            borderWidth: 2.5,
            tension: 0.4,
            fill: true,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: pointColors,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
          },
          {
            label: `Amber Threshold (${ROB_AMBER_THRESHOLD}%)`,
            data: labels.map(() => ROB_AMBER_THRESHOLD),
            borderColor: '#f59e0b',
            borderDash: [6, 4],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
            tension: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              font: { size: 11, family: 'Inter, system-ui, sans-serif' },
              padding: 10,
              usePointStyle: true,
              color: textColor,
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                if (ctx.datasetIndex === 0) {
                  const v = ctx.parsed.y;
                  if (v == null) return ' ROB%: N/A';
                  const status = v >= ROB_AMBER_THRESHOLD ? ' ⚠ KPI Breach' : v > 10 ? ' ⚡ Watch' : ' ✓ OK';
                  return ` ROB%: ${v.toFixed(1)}%${status}`;
                }
                return ` Threshold: ${ROB_AMBER_THRESHOLD}%`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: textColor, font: { size: 11 }, maxRotation: 45, minRotation: 45 },
          },
          y: {
            beginAtZero: true,
            min: 0,
            max: Math.max(50, ...values) + 5,
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              font: { size: 11 },
              callback: (v) => `${(v as number).toFixed(0)}%`,
            },
            title: { display: true, text: 'ROB%', color: textColor, font: { size: 11 } },
          },
        },
      },
    });

    return () => { chartInstanceRef.current?.destroy(); chartInstanceRef.current = null; };
  }, [robData, isDark, textColor, gridColor]);

  if (!modelId || !referenceVintage || monVintages.length === 0 || robData.length === 0) {
    return (
      <div className={`flex items-center justify-center h-32 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        No vintages available for ROB analysis
      </div>
    );
  }

  const selectedVintageData = robData.find(r => r.vintage === selectedVintage);

  return (
    <div>
      {/* KPI Summary */}
      <div className={`mb-4 flex flex-wrap gap-4 p-3 rounded-lg text-xs ${isDark ? 'bg-slate-900/50' : 'bg-slate-50'}`}>
        <div>
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Reference Vintage: </span>
          <span className={`font-mono font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{referenceVintage}</span>
        </div>
        {lastRob && (
          <>
            <div>
              <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Latest OOT Vintage: </span>
              <span className={`font-mono font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{lastRob.vintage}</span>
            </div>
            <div>
              <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>ROB Count: </span>
              <span className={`font-bold ${lastRob.totalROB > 0 ? 'text-amber-500' : isDark ? 'text-green-400' : 'text-green-600'}`}>
                {lastRob.totalROB}
              </span>
            </div>
            <div>
              <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>ROB%: </span>
              <span className={`font-bold ${lastRob.robPct >= ROB_AMBER_THRESHOLD ? 'text-red-500' : lastRob.robPct > 10 ? 'text-amber-500' : isDark ? 'text-green-400' : 'text-green-600'}`}>
                {lastRob.robPct.toFixed(1)}%
              </span>
            </div>
            <div>
              <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Status: </span>
              <span className={`font-bold ${isKPIBreach ? 'text-red-500' : isDark ? 'text-green-400' : 'text-green-600'}`}>
                {isKPIBreach ? '⚠ KPI Breach' : '✓ No Breach'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Trend Chart */}
      {(viewMode !== 'table' || forceBoth) && (
        <div style={{ height: '260px' }}>
          <canvas ref={canvasRef} />
        </div>
      )}

      {/* Data Table */}
      {(viewMode !== 'chart' || forceBoth) && (
        <div className="mt-4">
          {/* Vintage selector for table */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>OOT Vintage:</span>
            {robData.map(r => (
              <button
                key={r.vintage}
                onClick={() => setSelectedVintage(r.vintage)}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                  selectedVintage === r.vintage
                    ? 'bg-blue-600 text-white'
                    : isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {r.vintage}
                {r.robPct >= ROB_AMBER_THRESHOLD && <span className="ml-1 text-amber-400">⚠</span>}
              </button>
            ))}
          </div>

          {selectedVintageData && (
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className={isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-700'}>
                    <th className="px-2 py-2 text-left font-semibold">Score Band</th>
                    <th className="px-2 py-2 text-right font-semibold">Ref Bad Rate</th>
                    <th className="px-2 py-2 text-center font-semibold">Ref Rank</th>
                    <th className="px-2 py-2 text-right font-semibold">Mon Bad Rate</th>
                    <th className="px-2 py-2 text-center font-semibold">Mon Rank</th>
                    <th className="px-2 py-2 text-center font-semibold">ROB</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-slate-200'}`}>
                  {selectedVintageData.bandDetails.map((b) => (
                    <tr
                      key={b.band}
                      className={b.rob > 0
                        ? isDark ? 'bg-amber-900/20 hover:bg-amber-900/30' : 'bg-amber-50 hover:bg-amber-100'
                        : isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-50'
                      }
                    >
                      <td className={`px-2 py-1.5 font-mono font-medium ${b.rob > 0 ? 'text-amber-500' : isDark ? 'text-slate-300' : 'text-slate-700'}`}>{b.band}</td>
                      <td className={`px-2 py-1.5 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{(b.refBadRate * 100).toFixed(2)}%</td>
                      <td className={`px-2 py-1.5 text-center ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{b.refRank}</td>
                      <td className={`px-2 py-1.5 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{(b.monBadRate * 100).toFixed(2)}%</td>
                      <td className={`px-2 py-1.5 text-center ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{b.monRank}</td>
                      <td className="px-2 py-1.5 text-center">
                        {b.rob > 0
                          ? <span className="font-bold text-amber-500">⚠ {b.rob}</span>
                          : <span className={isDark ? 'text-green-400' : 'text-green-600'}>✓ 0</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className={`font-semibold border-t-2 ${isDark ? 'border-slate-500 bg-slate-700 text-slate-200' : 'border-slate-400 bg-slate-100 text-slate-800'}`}>
                    <td className="px-2 py-1.5 font-bold" colSpan={5}>
                      ROB% = {selectedVintageData.totalROB} / {selectedVintageData.maxPossible} &times; 100
                    </td>
                    <td className={`px-2 py-1.5 text-center font-bold ${selectedVintageData.robPct >= ROB_AMBER_THRESHOLD ? 'text-red-500' : selectedVintageData.robPct > 10 ? 'text-amber-500' : isDark ? 'text-green-400' : 'text-green-600'}`}>
                      {selectedVintageData.robPct.toFixed(1)}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ROBChart;
