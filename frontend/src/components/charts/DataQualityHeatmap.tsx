import React from 'react';
import { Database } from 'lucide-react';
import { WidgetContainer, EmptyState } from '../DashboardWidgets';

interface HeatmapData {
  datasetName: string;
  datasetId: string;
  qualityScore: number;
  missingRate: number;
  issueCount: number;
  severity: 'high' | 'medium' | 'low';
}

interface DataQualityHeatmapProps {
  theme: string;
  isDark: boolean;
  data: HeatmapData[];
}

const DataQualityHeatmap: React.FC<DataQualityHeatmapProps> = ({ theme, isDark, data }) => {
  const getColorForScore = (score: number, isDark: boolean): string => {
    if (score >= 80) {
      return isDark ? 'bg-green-500/30 border-green-500/50 text-green-300' : 'bg-green-100 border-green-300 text-green-900';
    } else if (score >= 60) {
      return isDark ? 'bg-yellow-500/30 border-yellow-500/50 text-yellow-300' : 'bg-yellow-100 border-yellow-300 text-yellow-900';
    } else {
      return isDark ? 'bg-red-500/30 border-red-500/50 text-red-300' : 'bg-red-100 border-red-300 text-red-900';
    }
  };

  const getColorForRate = (rate: number, isDark: boolean): string => {
    if (rate <= 2) {
      return isDark ? 'bg-green-500/30 border-green-500/50 text-green-300' : 'bg-green-100 border-green-300 text-green-900';
    } else if (rate <= 5) {
      return isDark ? 'bg-yellow-500/30 border-yellow-500/50 text-yellow-300' : 'bg-yellow-100 border-yellow-300 text-yellow-900';
    } else {
      return isDark ? 'bg-red-500/30 border-red-500/50 text-red-300' : 'bg-red-100 border-red-300 text-red-900';
    }
  };

  const getColorForIssues = (count: number, isDark: boolean): string => {
    if (count <= 5) {
      return isDark ? 'bg-green-500/30 border-green-500/50 text-green-300' : 'bg-green-100 border-green-300 text-green-900';
    } else if (count <= 15) {
      return isDark ? 'bg-yellow-500/30 border-yellow-500/50 text-yellow-300' : 'bg-yellow-100 border-yellow-300 text-yellow-900';
    } else {
      return isDark ? 'bg-red-500/30 border-red-500/50 text-red-300' : 'bg-red-100 border-red-300 text-red-900';
    }
  };

  if (!data || data.length === 0) {
    return (
      <WidgetContainer title="Data Quality Matrix" icon={<Database size={20} />} isDark={isDark}>
        <EmptyState
          title="No Quality Reports"
          description="Run data quality checks to see results"
          isDark={isDark}
        />
      </WidgetContainer>
    );
  }

  return (
    <WidgetContainer
      title="Data Quality Matrix"
      icon={<Database size={20} className={isDark ? 'text-blue-400' : 'text-blue-600'} />}
      isDark={isDark}
      action={
        <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          {data.length} datasets
        </span>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              <th className={`px-3 py-2 text-left text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Dataset
              </th>
              <th className={`px-3 py-2 text-center text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Quality Score
              </th>
              <th className={`px-3 py-2 text-center text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Missing Rate
              </th>
              <th className={`px-3 py-2 text-center text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Issues
              </th>
              <th className={`px-3 py-2 text-center text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Severity
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr
                key={item.datasetId}
                className={`border-b transition-colors ${
                  isDark
                    ? 'border-slate-700 hover:bg-slate-800'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <td className={`px-3 py-3 text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  <div className="font-medium truncate max-w-xs">{item.datasetName}</div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-center">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium border ${getColorForScore(
                        item.qualityScore,
                        isDark
                      )}`}
                    >
                      {item.qualityScore.toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-center">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium border ${getColorForRate(
                        item.missingRate,
                        isDark
                      )}`}
                    >
                      {item.missingRate.toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-center">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium border ${getColorForIssues(
                        item.issueCount,
                        isDark
                      )}`}
                    >
                      {item.issueCount}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3 text-center">
                  <span
                    className={`inline-block w-3 h-3 rounded-full ${
                      item.severity === 'high'
                        ? 'bg-red-500'
                        : item.severity === 'medium'
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className={`mt-4 pt-4 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Legend:</span>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-500"></div>
              <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Good</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-yellow-500"></div>
              <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Warning</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-500"></div>
              <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Critical</span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className={`mt-4 grid grid-cols-3 gap-4 text-center`}>
        <div>
          <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {(
              data.reduce((sum, item) => sum + item.qualityScore, 0) / data.length
            ).toFixed(1)}
            %
          </p>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Avg Quality
          </p>
        </div>
        <div>
          <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {(
              data.reduce((sum, item) => sum + item.missingRate, 0) / data.length
            ).toFixed(1)}
            %
          </p>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Avg Missing
          </p>
        </div>
        <div>
          <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {data.reduce((sum, item) => sum + item.issueCount, 0)}
          </p>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Total Issues
          </p>
        </div>
      </div>
    </WidgetContainer>
  );
};

export default DataQualityHeatmap;
