import React from 'react';
import { Bell, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import { WidgetContainer, EmptyState } from '../DashboardWidgets';

interface Alert {
  id: string;
  model: string;
  metric: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  age: string;
  status: 'active' | 'acknowledged' | 'resolved';
  message?: string;
}

interface AlertTimelineProps {
  theme: string;
  isDark: boolean;
  alerts: Alert[];
  onAcknowledge?: (id: string) => void;
  onDismiss?: (id: string) => void;
}

const AlertTimeline: React.FC<AlertTimelineProps> = ({
  theme,
  isDark,
  alerts,
  onAcknowledge,
  onDismiss,
}) => {
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle size={18} className="text-red-500" />;
      case 'high':
        return <AlertTriangle size={18} className="text-orange-500" />;
      case 'medium':
        return <AlertTriangle size={18} className="text-yellow-500" />;
      default:
        return <AlertCircle size={18} className="text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      critical: isDark ? 'bg-red-500/10 border-red-500/30 text-red-300' : 'bg-red-50 border-red-300 text-red-900',
      high: isDark ? 'bg-orange-500/10 border-orange-500/30 text-orange-300' : 'bg-orange-50 border-orange-300 text-orange-900',
      medium: isDark ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300' : 'bg-yellow-50 border-yellow-300 text-yellow-900',
      low: isDark ? 'bg-blue-500/10 border-blue-500/30 text-blue-300' : 'bg-blue-50 border-blue-300 text-blue-900',
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

  if (!alerts || alerts.length === 0) {
    return (
      <WidgetContainer title="Active Alerts" icon={<Bell size={20} />} isDark={isDark}>
        <EmptyState
          icon={<CheckCircle size={48} className="text-green-500" />}
          title="No Active Alerts"
          description="All systems are operating normally"
          isDark={isDark}
        />
      </WidgetContainer>
    );
  }

  // Sort alerts by severity and age
  const sortedAlerts = [...alerts].sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  return (
    <WidgetContainer
      title="Active Alerts"
      icon={<Bell size={20} className={isDark ? 'text-blue-400' : 'text-blue-600'} />}
      isDark={isDark}
      action={
        <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          {alerts.filter((a) => a.status === 'active').length} active
        </span>
      }
    >
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {sortedAlerts.map((alert, index) => (
          <div
            key={alert.id}
            className={`p-4 rounded-lg border transition-all ${getSeverityColor(
              alert.severity
            )} hover:shadow-md`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1">
                <div className="mt-1">{getSeverityIcon(alert.severity)}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {alert.model}
                    </h4>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(
                        alert.severity
                      )}`}
                    >
                      {alert.severity.toUpperCase()}
                    </span>
                  </div>
                  <p className={`text-sm mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    <span className="font-medium">{alert.metric}</span>
                    {alert.message && ` - ${alert.message}`}
                  </p>
                  <div className="flex items-center gap-4 text-xs">
                    <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                      Age: {alert.age}
                    </span>
                    <span className={`font-medium ${getStatusColor(alert.status)}`}>
                      {alert.status.charAt(0).toUpperCase() + alert.status.slice(1)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {alert.status === 'active' && onAcknowledge && (
                  <button
                    onClick={() => onAcknowledge(alert.id)}
                    className={`px-3 py-1 text-xs rounded ${
                      isDark
                        ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30'
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                  >
                    Acknowledge
                  </button>
                )}
                {onDismiss && (
                  <button
                    onClick={() => onDismiss(alert.id)}
                    className={`px-3 py-1 text-xs rounded ${
                      isDark
                        ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    Dismiss
                  </button>
                )}
              </div>
            </div>

            {/* Timeline connector (except for last item) */}
            {index < sortedAlerts.length - 1 && (
              <div className={`ml-2 mt-2 h-4 w-px ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`}></div>
            )}
          </div>
        ))}
      </div>
    </WidgetContainer>
  );
};

export default AlertTimeline;
