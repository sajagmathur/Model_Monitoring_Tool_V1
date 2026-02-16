import React from 'react';
import { Activity, TrendingUp, TrendingDown } from 'lucide-react';
import { WidgetContainer, MetricStat, EmptyState } from '../DashboardWidgets';

interface ModelHealthGaugeProps {
  theme: string;
  isDark: boolean;
  totalModels: number;
  modelsInProduction: number;
  productionPercentage: number;
  avgDrift: number;
  alertCount: number;
  criticalAlerts: number;
  warningAlerts: number;
}

const ModelHealthGauge: React.FC<ModelHealthGaugeProps> = ({
  theme,
  isDark,
  totalModels,
  modelsInProduction,
  productionPercentage,
  avgDrift,
  alertCount,
  criticalAlerts,
  warningAlerts,
}) => {
  if (totalModels === 0) {
    return (
      <WidgetContainer title="System Health Overview" icon={<Activity size={20} />} isDark={isDark}>
        <EmptyState
          title="No Models Found"
          description="Start by registering models in the Model Repository"
          isDark={isDark}
        />
      </WidgetContainer>
    );
  }

  const getHealthStatus = (): 'healthy' | 'warning' | 'critical' => {
    if (criticalAlerts > 0 || avgDrift > 20 || productionPercentage < 50) return 'critical';
    if (warningAlerts > 0 || avgDrift > 10 || productionPercentage < 75) return 'warning';
    return 'healthy';
  };

  const healthStatus = getHealthStatus();
  const statusColors = {
    healthy: { bg: 'bg-green-500', text: 'text-green-500', border: 'border-green-500' },
    warning: { bg: 'bg-yellow-500', text: 'text-yellow-500', border: 'border-yellow-500' },
    critical: { bg: 'bg-red-500', text: 'text-red-500', border: 'border-red-500' },
  };

  const statusColor = statusColors[healthStatus];

  return (
    <WidgetContainer
      title="System Health Overview"
      icon={<Activity size={20} className={isDark ? 'text-blue-400' : 'text-blue-600'} />}
      isDark={isDark}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Production Models */}
        <div className="flex flex-col items-center">
          <div className="relative w-32 h-32 mb-4">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke={isDark ? '#334155' : '#e2e8f0'}
                strokeWidth="12"
                fill="none"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke={statusColor.bg.replace('bg-', '#')}
                strokeWidth="12"
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${(productionPercentage / 100) * 352} 352`}
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {productionPercentage}%
              </span>
              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                In Prod
              </span>
            </div>
          </div>
          <MetricStat
            label="Models in Production"
            value={`${modelsInProduction}/${totalModels}`}
            icon={<TrendingUp size={16} />}
            isDark={isDark}
          />
        </div>

        {/* Average Drift */}
        <div className="flex flex-col items-center">
          <div className="relative w-32 h-32 mb-4">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke={isDark ? '#334155' : '#e2e8f0'}
                strokeWidth="12"
                fill="none"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke={avgDrift > 15 ? '#ef4444' : avgDrift > 10 ? '#f59e0b' : '#10b981'}
                strokeWidth="12"
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${Math.min((avgDrift / 25) * 352, 352)} 352`}
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {avgDrift.toFixed(1)}%
              </span>
              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Drift</span>
            </div>
          </div>
          <MetricStat
            label="Avg Data Drift"
            value={`${avgDrift.toFixed(1)}%`}
            icon={avgDrift > 10 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            trend={avgDrift > 10 ? 'up' : 'down'}
            isDark={isDark}
          />
        </div>

        {/* Active Alerts */}
        <div className="flex flex-col items-center">
          <div className="relative w-32 h-32 mb-4 flex items-center justify-center">
            <div
              className={`w-24 h-24 rounded-full ${
                isDark ? 'bg-slate-700' : 'bg-slate-100'
              } flex flex-col items-center justify-center border-4 ${statusColor.border}`}
            >
              <span className={`text-3xl font-bold ${statusColor.text}`}>{alertCount}</span>
              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Alerts
              </span>
            </div>
          </div>
          <div className="space-y-1 w-full">
            <MetricStat
              label="Critical"
              value={criticalAlerts}
              isDark={isDark}
            />
            <MetricStat
              label="Warnings"
              value={warningAlerts}
              isDark={isDark}
            />
          </div>
        </div>
      </div>

      {/* Status Summary */}
      <div
        className={`mt-6 p-4 rounded-lg border ${
          healthStatus === 'healthy'
            ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700'
            : healthStatus === 'warning'
            ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-700'
            : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700'
        }`}
      >
        <p
          className={`text-sm font-medium ${
            healthStatus === 'healthy'
              ? 'text-green-800 dark:text-green-200'
              : healthStatus === 'warning'
              ? 'text-yellow-800 dark:text-yellow-200'
              : 'text-red-800 dark:text-red-200'
          }`}
        >
          System Status:{' '}
          {healthStatus === 'healthy'
            ? '✓ All systems operational'
            : healthStatus === 'warning'
            ? '⚠ Some issues detected'
            : '✗ Critical issues require attention'}
        </p>
      </div>
    </WidgetContainer>
  );
};

export default ModelHealthGauge;
