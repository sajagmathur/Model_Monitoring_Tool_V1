import React, { useMemo } from 'react';
import { VariableStability } from '../../utils/bankingMetricsMock';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface VariableStabilityTableProps {
  variables: VariableStability[];
  maxRows?: number;
  /** When provided (compare mode), shows Baseline PSI and delta columns */
  baselineVariables?: VariableStability[];
  /** Shown as a coloured badge next to the Variable column header */
  segmentLabel?: string;
}

export const VariableStabilityTable: React.FC<VariableStabilityTableProps> = ({ 
  variables,
  maxRows = 20,
  baselineVariables,
  segmentLabel,
}) => {
  // Sort by PSI descending (most unstable first)
  const sortedVariables = useMemo(() => {
    return [...variables]
      .sort((a, b) => b.psi - a.psi)
      .slice(0, maxRows);
  }, [variables, maxRows]);

  // Build baseline lookup map
  const baselineMap = useMemo(() => {
    if (!baselineVariables) return {};
    return Object.fromEntries(baselineVariables.map(v => [v.variable, v]));
  }, [baselineVariables]);

  const isCompareMode = !!baselineVariables && baselineVariables.length > 0;

  const getStatusBadge = (status: 'stable' | 'warning' | 'unstable') => {
    const styles = {
      stable: 'bg-green-100 text-green-800 border-green-200',
      warning: 'bg-amber-100 text-amber-800 border-amber-200',
      unstable: 'bg-red-100 text-red-800 border-red-200',
    };

    const icons = {
      stable: <Minus className="w-3 h-3" />,
      warning: <ArrowUp className="w-3 h-3" />,
      unstable: <ArrowUp className="w-3 h-3" />,
    };

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${styles[status]}`}>
        {icons[status]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getPSIBar = (psi: number) => {
    const percentage = Math.min(psi * 400, 100); // Scale PSI to percentage (0.25 = 100%)
    let color = 'bg-green-500';
    if (psi >= 0.25) color = 'bg-red-500';
    else if (psi >= 0.10) color = 'bg-amber-500';

    return (
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div 
          className={`h-full ${color} transition-all duration-300`} 
          style={{ width: `${percentage}%` }}
        />
      </div>
    );
  };

  return (
    <div className="overflow-auto max-h-[600px]">
      <table className="w-full border-collapse">
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b-2 border-gray-200">
              <div className="flex items-center gap-2">
                Variable
                {segmentLabel && (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                    segmentLabel === 'Thin File'
                      ? 'bg-blue-100 text-blue-800'
                      : segmentLabel === 'Thick File'
                        ? 'bg-teal-100 text-teal-800'
                        : 'bg-gray-100 text-gray-700'
                  }`}>
                    {segmentLabel}
                  </span>
                )}
              </div>
            </th>
            {isCompareMode && (
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b-2 border-gray-200">
                Baseline PSI
              </th>
            )}
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b-2 border-gray-200">
              {isCompareMode ? 'Current PSI' : 'PSI'}
            </th>
            {isCompareMode && (
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b-2 border-gray-200">
                Delta
              </th>
            )}
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b-2 border-gray-200">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b-2 border-gray-200">
              Stability
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedVariables.map((variable, idx) => {
            const baseline = baselineMap[variable.variable];
            const delta = baseline ? variable.psi - baseline.psi : undefined;
            return (
              <tr 
                key={variable.variable} 
                className={`hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
              >
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {variable.variable.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </td>
                {isCompareMode && (
                  <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                    {baseline ? baseline.psi.toFixed(4) : '—'}
                  </td>
                )}
                <td className="px-4 py-3 text-sm text-gray-700 font-mono">
                  {variable.psi.toFixed(4)}
                </td>
                {isCompareMode && (
                  <td className="px-4 py-3 text-sm font-mono">
                    {delta !== undefined ? (
                      <span className={`inline-flex items-center gap-1 ${
                        delta > 0.02 ? 'text-red-600' : delta < -0.02 ? 'text-green-600' : 'text-gray-500'
                      }`}>
                        {delta > 0.005 ? <ArrowUp className="w-3 h-3" /> : delta < -0.005 ? <ArrowDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                        {delta > 0 ? '+' : ''}{delta.toFixed(4)}
                      </span>
                    ) : '—'}
                  </td>
                )}
                <td className="px-4 py-3">
                  {getStatusBadge(variable.status)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {getPSIBar(variable.psi)}
                    <span className="text-xs text-gray-500 min-w-fit">
                      {variable.psi < 0.10 ? 'Stable' : variable.psi < 0.25 ? 'Monitor' : 'Alert'}
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {variables.length > maxRows && (
        <div className="text-center py-3 text-sm text-gray-500 bg-gray-50 border-t">
          Showing top {maxRows} of {variables.length} variables
        </div>
      )}
    </div>
  );
};
