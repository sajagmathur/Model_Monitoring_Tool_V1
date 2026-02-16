import React from 'react';
import { GitBranch } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { WidgetContainer, EmptyState } from '../DashboardWidgets';
import { getTooltipStyle, chartColors } from '../../utils/themeClasses';

interface DriftData {
  modelName: string;
  modelId: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  avg: number;
}

interface ModelDriftDistributionProps {
  theme: string;
  isDark: boolean;
  data: DriftData[];
}

const ModelDriftDistribution: React.FC<ModelDriftDistributionProps> = ({
  theme,
  isDark,
  data,
}) => {
  if (!data || data.length === 0) {
    return (
      <WidgetContainer title="Model Drift Distribution" icon={<GitBranch size={20} />} isDark={isDark}>
        <EmptyState
          title="No Drift Data"
          description="Monitor models to see drift metrics"
          isDark={isDark}
        />
      </WidgetContainer>
    );
  }

  // Transform data for bar chart (using average drift)
  const chartData = data.map((item) => ({
    name: item.modelName.length > 15 ? item.modelName.substring(0, 15) + '...' : item.modelName,
    fullName: item.modelName,
    avg: item.avg,
    max: item.max,
    median: item.median,
  }));

  const getBarColor = (value: number): string => {
    if (value > 15) return '#ef4444'; // red-500
    if (value > 10) return '#f59e0b'; // amber-500
    if (value > 5) return '#eab308'; // yellow-500
    return '#10b981'; // green-500
  };

  return (
    <WidgetContainer
      title="Model Drift Distribution"
      icon={<GitBranch size={20} className={isDark ? 'text-blue-400' : 'text-blue-600'} />}
      isDark={isDark}
      action={
        <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          {data.length} models
        </span>
      }
    >
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#475569' : '#e2e8f0'} />
          <XAxis
            dataKey="name"
            stroke={isDark ? '#94a3b8' : '#64748b'}
            style={{ fontSize: '11px' }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            stroke={isDark ? '#94a3b8' : '#64748b'}
            style={{ fontSize: '12px' }}
            label={{
              value: 'Drift Score (%)',
              angle: -90,
              position: 'insideLeft',
              style: { fill: isDark ? '#94a3b8' : '#64748b', fontSize: '12px' },
            }}
          />
          <Tooltip
            contentStyle={getTooltipStyle(theme)}
            formatter={(value: number, name: string) => [
              `${value.toFixed(2)}%`,
              name === 'avg' ? 'Average Drift' : name === 'max' ? 'Max Drift' : 'Median Drift',
            ]}
            labelFormatter={(label, payload: any) => {
              if (payload && payload[0]) {
                return payload[0].payload.fullName;
              }
              return label;
            }}
          />
          <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.avg)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Drift Threshold Legend */}
      <div className={`mt-4 pt-4 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
        <div className="flex items-center justify-between text-xs mb-4">
          <div className="flex items-center gap-4">
            <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Thresholds:</span>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-500"></div>
              <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>{'<'}5% (Good)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-yellow-500"></div>
              <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>5-10% (Monitor)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-amber-500"></div>
              <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>10-15% (Warning)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-500"></div>
              <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>{'>'}15% (Critical)</span>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {(data.reduce((sum, item) => sum + item.avg, 0) / data.length).toFixed(2)}%
            </p>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Avg Drift</p>
          </div>
          <div>
            <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {Math.max(...data.map((item) => item.max)).toFixed(2)}%
            </p>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Max Drift</p>
          </div>
          <div>
            <p
              className={`text-lg font-bold ${
                data.filter((item) => item.avg > 15).length > 0 ? 'text-red-500' : 'text-green-500'
              }`}
            >
              {data.filter((item) => item.avg > 15).length}
            </p>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>High Risk</p>
          </div>
          <div>
            <p
              className={`text-lg font-bold ${
                data.filter((item) => item.avg <= 5).length > 0 ? 'text-green-500' : isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              {data.filter((item) => item.avg <= 5).length}
            </p>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Healthy</p>
          </div>
        </div>
      </div>

      {/* Models at Risk */}
      {data.filter((item) => item.avg > 15).length > 0 && (
        <div
          className={`mt-4 p-3 rounded-lg ${
            isDark
              ? 'bg-red-500/10 border border-red-500/30 text-red-300'
              : 'bg-red-50 border border-red-300 text-red-900'
          }`}
        >
          <p className="text-sm font-medium">
            ⚠ {data.filter((item) => item.avg > 15).length} model(s) with critical drift detected. Consider retraining.
          </p>
        </div>
      )}
    </WidgetContainer>
  );
};

export default ModelDriftDistribution;
