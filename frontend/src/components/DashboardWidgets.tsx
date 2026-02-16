import React from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * Dashboard Widget Components
 * Reusable widget components for the dashboard
 */

// Status Badge Component
export const StatusBadge: React.FC<{ status: 'good' | 'warning' | 'critical' }> = ({ status }) => {
  const colors = {
    good: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
    critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
  };

  const labels = {
    good: '🟢 Healthy',
    warning: '🟡 Warning',
    critical: '🔴 Critical',
  };

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${colors[status]}`}>
      {labels[status]}
    </span>
  );
};

// KPI Card Component
interface KPICardProps {
  metric: {
    name: string;
    value: string | number;
    unit: string;
    baseline: string | number;
    delta: number;
    status: 'good' | 'warning' | 'critical';
  };
  theme: string;
  isDark: boolean;
}

export const KPICard: React.FC<KPICardProps> = ({ metric, theme, isDark }) => {
  return (
    <div
      className={`p-4 rounded-lg border ${
        isDark
          ? 'bg-slate-800 border-slate-700 hover:border-slate-600'
          : 'bg-white border-slate-200 hover:border-slate-300'
      } transition-all hover:shadow-md`}
    >
      <div className="flex justify-between items-start mb-3">
        <p className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          {metric.name}
        </p>
        <StatusBadge status={metric.status} />
      </div>
      <div className="space-y-2">
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {metric.value}
          </span>
          <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {metric.unit}
          </span>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-slate-700 dark:border-slate-600">
          <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            Baseline: {metric.baseline}{metric.unit}
          </span>
          <span
            className={`text-sm font-semibold ${
              metric.delta >= 0 ? 'text-green-500' : 'text-red-500'
            }`}
          >
            {metric.delta >= 0 ? '+' : ''}{Math.round(metric.delta * 10) / 10}%
          </span>
        </div>
      </div>
    </div>
  );
};

// Widget Container
interface WidgetContainerProps {
  title?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  isDark: boolean;
  className?: string;
  action?: React.ReactNode;
}

export const WidgetContainer: React.FC<WidgetContainerProps> = ({
  title,
  icon,
  children,
  isDark,
  className = '',
  action,
}) => {
  return (
    <div
      className={`rounded-lg border ${
        isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
      } ${className}`}
    >
      {title && (
        <div
          className={`px-6 py-4 border-b ${
            isDark ? 'border-slate-700' : 'border-slate-200'
          } flex items-center justify-between`}
        >
          <div className="flex items-center gap-2">
            {icon}
            <h3 className={`font-semibold text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {title}
            </h3>
          </div>
          {action}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
};

// Empty State Component
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  isDark: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = <AlertCircle size={48} />,
  title,
  description,
  isDark,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className={`mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{icon}</div>
      <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
        {title}
      </h3>
      {description && (
        <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{description}</p>
      )}
    </div>
  );
};

// Skeleton Loader for Cards
interface SkeletonLoaderProps {
  count?: number;
  isDark: boolean;
  variant?: 'card' | 'text' | 'chart';
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  count = 3,
  isDark,
  variant = 'card',
}) => {
  const baseClass = isDark ? 'bg-slate-700' : 'bg-slate-200';

  if (variant === 'chart') {
    return (
      <div className={`h-64 ${baseClass} animate-pulse rounded-lg`}></div>
    );
  }

  if (variant === 'text') {
    return (
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={`h-4 ${baseClass} animate-pulse rounded`}></div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`p-4 rounded-lg border ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
          }`}
        >
          <div className={`h-4 ${baseClass} animate-pulse rounded mb-3`}></div>
          <div className={`h-8 ${baseClass} animate-pulse rounded mb-2`}></div>
          <div className={`h-3 ${baseClass} animate-pulse rounded`}></div>
        </div>
      ))}
    </div>
  );
};

// Metric Stat Component (for quick stats)
interface MetricStatProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  isDark: boolean;
}

export const MetricStat: React.FC<MetricStatProps> = ({
  label,
  value,
  icon,
  trend,
  trendValue,
  isDark,
}) => {
  const getTrendColor = () => {
    if (trend === 'up') return 'text-green-500';
    if (trend === 'down') return 'text-red-500';
    return isDark ? 'text-slate-400' : 'text-slate-500';
  };

  const getTrendIcon = () => {
    if (trend === 'up') return '↑';
    if (trend === 'down') return '↓';
    return '→';
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon && <div className={isDark ? 'text-blue-400' : 'text-blue-600'}>{icon}</div>}
        <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {value}
        </span>
        {trendValue && (
          <span className={`text-xs ${getTrendColor()}`}>
            {getTrendIcon()} {trendValue}
          </span>
        )}
      </div>
    </div>
  );
};
