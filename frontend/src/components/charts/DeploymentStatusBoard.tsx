import React from 'react';
import { Server, ExternalLink } from 'lucide-react';
import { WidgetContainer, EmptyState } from '../DashboardWidgets';

interface DeploymentStatus {
  deploymentId: string;
  modelName: string;
  modelVersion: string;
  modelId: string;
  environment: 'dev' | 'staging' | 'prod';
  status: 'created' | 'building' | 'deploying' | 'active' | 'failed';
  lastDeployed: string;
  containerName: string;
}

interface DeploymentStatusBoardProps {
  theme: string;
  isDark: boolean;
  deployments: DeploymentStatus[];
  onRollback?: (deploymentId: string) => void;
}

const DeploymentStatusBoard: React.FC<DeploymentStatusBoardProps> = ({
  theme,
  isDark,
  deployments,
  onRollback,
}) => {
  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      active: { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200', label: '✓ Active' },
      building: { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-800 dark:text-blue-200', label: '⚙ Building' },
      deploying: { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-800 dark:text-blue-200', label: '🚀 Deploying' },
      failed: { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-800 dark:text-red-200', label: '✗ Failed' },
      created: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-800 dark:text-slate-200', label: '○ Created' },
    };
    const badge = badges[status] || badges.created;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const getEnvironmentBadge = (env: string) => {
    const badges: Record<string, { bg: string; text: string }> = {
      prod: { bg: 'bg-purple-100 dark:bg-purple-900', text: 'text-purple-800 dark:text-purple-200' },
      staging: { bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-800 dark:text-yellow-200' },
      dev: { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-800 dark:text-blue-200' },
    };
    const badge = badges[env] || badges.dev;
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${badge.bg} ${badge.text}`}>
        {env.toUpperCase()}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (!deployments || deployments.length === 0) {
    return (
      <WidgetContainer title="Deployment Status" icon={<Server size={20} />} isDark={isDark}>
        <EmptyState
          title="No Deployments"
          description="Deploy models to see their status here"
          isDark={isDark}
        />
      </WidgetContainer>
    );
  }

  return (
    <WidgetContainer
      title="Deployment Status"
      icon={<Server size={20} className={isDark ? 'text-blue-400' : 'text-blue-600'} />}
      isDark={isDark}
      action={
        <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          {deployments.filter((d) => d.status === 'active').length} active
        </span>
      }
    >
      <div className={`rounded-lg border overflow-hidden ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={`border-b ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <th className={`px-4 py-3 text-left text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Model
                </th>
                <th className={`px-4 py-3 text-left text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Version
                </th>
                <th className={`px-4 py-3 text-left text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Environment
                </th>
                <th className={`px-4 py-3 text-left text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Status
                </th>
                <th className={`px-4 py-3 text-left text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Last Deployed
                </th>
                <th className={`px-4 py-3 text-left text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {deployments.map((deployment, index) => (
                <tr
                  key={deployment.deploymentId}
                  className={`border-b transition-colors ${
                    isDark
                      ? 'border-slate-700 hover:bg-slate-800'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <td className={`px-4 py-3 text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{deployment.modelName}</span>
                    </div>
                  </td>
                  <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    {deployment.modelVersion}
                  </td>
                  <td className="px-4 py-3 text-sm">{getEnvironmentBadge(deployment.environment)}</td>
                  <td className="px-4 py-3 text-sm">{getStatusBadge(deployment.status)}</td>
                  <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {formatDate(deployment.lastDeployed)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors ${
                          isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="View Details"
                      >
                        <ExternalLink size={16} />
                      </button>
                      {deployment.status === 'active' && onRollback && (
                        <button
                          onClick={() => onRollback(deployment.deploymentId)}
                          className={`px-2 py-1 text-xs rounded ${
                            isDark
                              ? 'bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30'
                              : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                          }`}
                        >
                          Rollback
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Stats */}
      <div className={`mt-4 pt-4 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {deployments.filter((d) => d.status === 'active').length}
            </p>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Active</p>
          </div>
          <div>
            <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {deployments.filter((d) => d.status === 'deploying' || d.status === 'building').length}
            </p>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>In Progress</p>
          </div>
          <div>
            <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {deployments.filter((d) => d.status === 'failed').length}
            </p>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Failed</p>
          </div>
          <div>
            <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {deployments.length}
            </p>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Total</p>
          </div>
        </div>
      </div>
    </WidgetContainer>
  );
};

export default DeploymentStatusBoard;
