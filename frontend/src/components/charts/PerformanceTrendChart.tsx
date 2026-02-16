import React from 'react';
import { TrendingUp } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { WidgetContainer, EmptyState } from '../DashboardWidgets';
import { getTooltipStyle, chartColors } from '../../utils/themeClasses';

interface PerformanceTrendChartProps {
  theme: string;
  isDark: boolean;
  data: Array<{
    date: string;
    healthScore: number;
    modelName: string;
  }>;
}

const PerformanceTrendChart: React.FC<PerformanceTrendChartProps> = ({ theme, isDark, data }) => {
  if (!data || data.length === 0) {
    return (
      <WidgetContainer
        title="Performance Trends"
        icon={<TrendingUp size={20} />}
        isDark={isDark}
      >
        <EmptyState
          title="No Performance Data"
          description="Generate reports to see performance trends"
          isDark={isDark}
        />
      </WidgetContainer>
    );
  }

  // Aggregate by date to get average health score per day
  const aggregatedData = data.reduce((acc: any[], curr) => {
    const existing = acc.find((item) => item.date === curr.date);
    if (existing) {
      existing.healthScore = (existing.healthScore + curr.healthScore) / 2;
      existing.count += 1;
    } else {
      acc.push({ date: curr.date, healthScore: curr.healthScore, count: 1 });
    }
    return acc;
  }, []);

  return (
    <WidgetContainer
      title="Performance Trends"
      icon={<TrendingUp size={20} className={isDark ? 'text-blue-400' : 'text-blue-600'} />}
      isDark={isDark}
      action={
        <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Last {data.length} reports
        </span>
      }
    >
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={aggregatedData}>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#475569' : '#e2e8f0'} />
          <XAxis
            dataKey="date"
            stroke={isDark ? '#94a3b8' : '#64748b'}
            style={{ fontSize: '12px' }}
          />
          <YAxis
            stroke={isDark ? '#94a3b8' : '#64748b'}
            style={{ fontSize: '12px' }}
            domain={[0, 100]}
            label={{
              value: 'Health Score (%)',
              angle: -90,
              position: 'insideLeft',
              style: { fill: isDark ? '#94a3b8' : '#64748b', fontSize: '12px' },
            }}
          />
          <Tooltip
            contentStyle={getTooltipStyle(theme)}
            formatter={(value: number) => [`${value.toFixed(1)}%`, 'Health Score']}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="healthScore"
            stroke={chartColors.primary}
            strokeWidth={2}
            dot={{ fill: chartColors.primary, r: 4 }}
            activeDot={{ r: 6 }}
            name="Health Score"
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Trend Summary */}
      <div className={`mt-4 pt-4 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {aggregatedData[aggregatedData.length - 1]?.healthScore.toFixed(1) || 0}%
            </p>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Latest Score
            </p>
          </div>
          <div>
            <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {(
                aggregatedData.reduce((sum, item) => sum + item.healthScore, 0) /
                aggregatedData.length
              ).toFixed(1)}
              %
            </p>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Average</p>
          </div>
          <div>
            <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {Math.max(...aggregatedData.map((item) => item.healthScore)).toFixed(1)}%
            </p>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Peak</p>
          </div>
        </div>
      </div>
    </WidgetContainer>
  );
};

export default PerformanceTrendChart;
