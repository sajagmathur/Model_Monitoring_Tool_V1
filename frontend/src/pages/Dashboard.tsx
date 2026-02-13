import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { ChevronRight, Download, Filter } from 'lucide-react';

interface KPIMetric {
  name: string;
  value: string | number;
  unit: string;
  baseline: string | number;
  delta: number;
  status: 'good' | 'warning' | 'critical';
}

interface Alert {
  id: string;
  model: string;
  metric: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  age: string;
  status: 'active' | 'acknowledged' | 'resolved';
}

const StatusBadge: React.FC<{ status: 'good' | 'warning' | 'critical' }> = ({ status }) => {
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

const KPICard: React.FC<{ metric: KPIMetric }> = ({ metric }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

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
              metric.delta >= 0
                ? 'text-green-500'
                : 'text-red-500'
            }`}
          >
            {metric.delta >= 0 ? '+' : ''}{metric.delta}%
          </span>
        </div>
      </div>
    </div>
  );
};

const FilterBar: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [filters, setFilters] = useState({
    portfolio: 'All',
    businessLine: 'All',
    modelType: 'All',
    model: 'All',
    timeWindow: 'Last 30 Days',
    segment: 'All',
  });

  const filterOptions = {
    portfolio: ['All', 'Risk Management', 'Marketing', 'Operations'],
    businessLine: ['All', 'Retail', 'Commercial', 'Digital'],
    modelType: ['All', 'Classification', 'Regression', 'Ranking'],
    model: ['All', 'Credit Risk Scoring', 'Fraud Detection', 'Marketing Propensity'],
    timeWindow: ['Last 7 Days', 'Last 30 Days', 'Last 90 Days', 'Year to Date'],
    segment: ['All', 'Prime', 'Non-Prime', 'Subprime'],
  };

  return (
    <div className={`p-4 rounded-lg border mb-6 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
      <div className="flex items-center gap-2 mb-4">
        <Filter size={18} className={isDark ? 'text-slate-400' : 'text-slate-600'} />
        <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Global Filters</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(filterOptions).map(([key, options]) => (
          <select
            key={key}
            value={filters[key as keyof typeof filters]}
            onChange={(e) =>
              setFilters({ ...filters, [key]: e.target.value })
            }
            className={`px-3 py-2 rounded border text-sm ${
              isDark
                ? 'bg-slate-700 border-slate-600 text-white'
                : 'bg-white border-slate-300 text-slate-900'
            }`}
          >
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ))}
      </div>
    </div>
  );
};

const AlertGrid: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const alerts: Alert[] = [
    {
      id: '1',
      model: 'Credit Risk Scoring v2.1',
      metric: 'AUC Score',
      severity: 'high',
      age: '2 hours ago',
      status: 'active',
    },
    {
      id: '2',
      model: 'Fraud Detection v3.0',
      metric: 'PSI Drift',
      severity: 'critical',
      age: '1 hour ago',
      status: 'active',
    },
    {
      id: '3',
      model: 'Marketing Propensity v1.5',
      metric: 'Feature Drift',
      severity: 'medium',
      age: '30 minutes ago',
      status: 'acknowledged',
    },
    {
      id: '4',
      model: 'Credit Risk Scoring v2.1',
      metric: 'Demographic Parity',
      severity: 'high',
      age: '15 minutes ago',
      status: 'active',
    },
    {
      id: '5',
      model: 'Fraud Detection v3.0',
      metric: 'Missing Rate',
      severity: 'low',
      age: '5 minutes ago',
      status: 'resolved',
    },
  ];

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      low: isDark ? 'bg-blue-900 text-blue-100' : 'bg-blue-100 text-blue-800',
      medium: isDark ? 'bg-yellow-900 text-yellow-100' : 'bg-yellow-100 text-yellow-800',
      high: isDark ? 'bg-orange-900 text-orange-100' : 'bg-orange-100 text-orange-800',
      critical: isDark ? 'bg-red-900 text-red-100' : 'bg-red-100 text-red-800',
    };
    return colors[severity] || colors.low;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: isDark ? 'text-red-400' : 'text-red-600',
      acknowledged: isDark ? 'text-yellow-400' : 'text-yellow-600',
      resolved: isDark ? 'text-green-400' : 'text-green-600',
    };
    return colors[status] || colors.active;
  };

  return (
    <div className={`rounded-lg border overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className={`border-b ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <th className={`px-6 py-3 text-left text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Model
              </th>
              <th className={`px-6 py-3 text-left text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Metric
              </th>
              <th className={`px-6 py-3 text-left text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Severity
              </th>
              <th className={`px-6 py-3 text-left text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Age
              </th>
              <th className={`px-6 py-3 text-left text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert) => (
              <tr
                key={alert.id}
                className={`border-b transition-colors ${
                  isDark
                    ? 'border-slate-700 hover:bg-slate-700'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <td className={`px-6 py-3 text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {alert.model}
                </td>
                <td className={`px-6 py-3 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {alert.metric}
                </td>
                <td className="px-6 py-3 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(alert.severity)}`}>
                    {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
                  </span>
                </td>
                <td className={`px-6 py-3 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {alert.age}
                </td>
                <td className={`px-6 py-3 text-sm font-medium ${getStatusColor(alert.status)}`}>
                  {alert.status.charAt(0).toUpperCase() + alert.status.slice(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // KPI Data - organized by category
  const performanceMetrics: KPIMetric[] = [
    { name: 'AUC Score', value: 0.857, unit: '', baseline: 0.85, delta: 0.8, status: 'good' },
    { name: 'Gini Coefficient', value: 0.714, unit: '', baseline: 0.70, delta: 1.2, status: 'good' },
    { name: 'KS Statistic', value: 0.625, unit: '', baseline: 0.62, delta: 0.5, status: 'good' },
  ];

  const stabilityMetrics: KPIMetric[] = [
    { name: 'Population Stability Index', value: 0.042, unit: '', baseline: 0.025, delta: -68.0, status: 'warning' },
    { name: 'Characteristic Stability', value: 0.031, unit: '', baseline: 0.020, delta: -55.0, status: 'warning' },
    { name: 'JS Divergence', value: 0.018, unit: '', baseline: 0.015, delta: -20.0, status: 'good' },
  ];

  const featureMetrics: KPIMetric[] = [
    { name: 'Information Value', value: 0.385, unit: '', baseline: 0.40, delta: 3.8, status: 'good' },
    { name: 'Feature Drift Rate', value: '12.5%', unit: '', baseline: '8%', delta: -56.3, status: 'warning' },
    { name: 'Missing Rate', value: '2.3%', unit: '', baseline: '1.5%', delta: -53.3, status: 'warning' },
  ];

  const fairnessMetrics: KPIMetric[] = [
    { name: 'Demographic Parity', value: 0.92, unit: '', baseline: 0.95, delta: 3.2, status: 'warning' },
    { name: 'Equal Opportunity', value: 0.88, unit: '', baseline: 0.90, delta: 2.2, status: 'good' },
    { name: 'Adverse Impact Ratio', value: 0.81, unit: '', baseline: 0.80, delta: -1.2, status: 'good' },
  ];

  const businessMetrics: KPIMetric[] = [
    { name: 'Approval Rate', value: '68.5%', unit: '', baseline: '65%', delta: 5.4, status: 'good' },
    { name: 'Loss Rate', value: '2.1%', unit: '', baseline: '2.5%', delta: 16.0, status: 'good' },
    { name: 'ROI', value: '24.3%', unit: '', baseline: '20%', delta: 21.5, status: 'good' },
  ];

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
      {/* Header */}
      <div className={`border-b ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-4">
            <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Home</span>
            <ChevronRight size={16} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
            <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Dashboard
            </span>
          </div>

          {/* Title and Actions */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Model Monitoring Dashboard
              </h1>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Real-time health metrics and risk indicators across your model portfolio
              </p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
              <Download size={18} />
              Export Report
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Filters */}
        <FilterBar />

        {/* KPI Sections */}
        <div className="space-y-8">
          {/* Performance & Accuracy */}
          <div>
            <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              📊 Performance & Accuracy
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {performanceMetrics.map((metric) => (
                <KPICard key={metric.name} metric={metric} />
              ))}
            </div>
          </div>

          {/* Stability */}
          <div>
            <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              ⚡ Stability & Drift
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {stabilityMetrics.map((metric) => (
                <KPICard key={metric.name} metric={metric} />
              ))}
            </div>
          </div>

          {/* Feature Quality */}
          <div>
            <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              🔬 Feature Quality
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {featureMetrics.map((metric) => (
                <KPICard key={metric.name} metric={metric} />
              ))}
            </div>
          </div>

          {/* Fairness */}
          <div>
            <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              ⚖️ Fairness & Compliance
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {fairnessMetrics.map((metric) => (
                <KPICard key={metric.name} metric={metric} />
              ))}
            </div>
          </div>

          {/* Business Impact */}
          <div>
            <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              💼 Business Impact
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {businessMetrics.map((metric) => (
                <KPICard key={metric.name} metric={metric} />
              ))}
            </div>
          </div>

          {/* Alerts Section */}
          <div>
            <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              🚨 Active Alerts
            </h2>
            <AlertGrid />
          </div>

          {/* Trends & Anomalies Placeholder */}
          <div className={`p-8 rounded-lg border text-center ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
              📈 Trends & Anomalies visualization coming soon
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

