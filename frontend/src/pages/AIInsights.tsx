import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useGlobal } from '../contexts/GlobalContext';
import {
  ChevronRight,
  Download,
  Brain,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Lightbulb,
  BarChart3,
  Database,
  GitBranch,
  Server,
  Zap,
} from 'lucide-react';
import { WidgetContainer, EmptyState, SkeletonLoader } from '../components/DashboardWidgets';
import { generateAllInsights, type Insight } from '../services/insightsEngine';

const AIInsights: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const {
    registryModels = [],
    generatedReports = [],
    monitoringJobs = [],
    deploymentJobs = [],
    dataQualityReports = [],
    schedulingJobs = [],
    loadSampleData,
  } = useGlobal();

  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Auto-load sample data if no data exists
  useEffect(() => {
    console.log('AI Insights data check:', {
      models: registryModels.length,
      reports: generatedReports.length,
      monitoring: monitoringJobs.length
    });
    
    if (registryModels.length === 0 && generatedReports.length === 0 && monitoringJobs.length === 0) {
      console.log('⚠️ No data detected in AI Insights, loading sample data...');
      loadSampleData();
    }
  }, [registryModels.length, generatedReports.length, monitoringJobs.length]);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  // Generate insights
  const insightsData = useMemo(() => {
    return generateAllInsights(
      registryModels,
      generatedReports,
      monitoringJobs,
      deploymentJobs,
      dataQualityReports,
      schedulingJobs
    );
  }, [
    registryModels,
    generatedReports,
    monitoringJobs,
    deploymentJobs,
    dataQualityReports,
    schedulingJobs,
  ]);

  const { insights, healthScore, summary } = insightsData;

  // Filter insights by category
  const filteredInsights =
    selectedCategory === 'all'
      ? insights
      : insights.filter((i) => i.category === selectedCategory);

  // Get severity icon and color
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle size={20} className="text-red-500" />;
      case 'warning':
       return <AlertTriangle size={20} className="text-yellow-500" />;
      case 'success':
        return <CheckCircle size={20} className="text-green-500" />;
      default:
        return <Lightbulb size={20} className="text-blue-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const badges: Record<string, string> = {
      critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-300 dark:border-red-700',
      warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700',
      info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-300 dark:border-blue-700',
      success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300 dark:border-green-700',
    };
    return badges[severity] || badges.info;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'performance':
        return <BarChart3 size={18} />;
      case 'quality':
        return <Database size={18} />;
      case 'drift':
        return <GitBranch size={18} />;
      case 'operations':
        return <Server size={18} />;
      case 'anomaly':
        return <Zap size={18} />;
      default:
        return <Lightbulb size={18} />;
    }
  };

  // Health status determination
  const getHealthStatus = () => {
    if (healthScore >= 85) return { label: 'Excellent', color: 'text-green-500', bgColor: 'bg-green-500' };
    if (healthScore >= 70) return { label: 'Good', color: 'text-blue-500', bgColor: 'bg-blue-500' };
    if (healthScore >= 50) return { label: 'Fair', color: 'text-yellow-500', bgColor: 'bg-yellow-500' };
    return { label: 'Poor', color: 'text-red-500', bgColor: 'bg-red-500' };
  };

  const healthStatus = getHealthStatus();

  if (loading) {
    return (
      <div className={isDark ? 'bg-slate-900' : 'bg-slate-50'}>
        <SkeletonLoader count={6} isDark={isDark} variant="card" />
      </div>
    );
  }

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
              AI Insights
            </span>
          </div>

          {/* Title and Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Brain size={32} className={isDark ? 'text-purple-400' : 'text-purple-600'} />
              <div>
                <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  AI-Powered Insights & Recommendations
                </h1>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Intelligent analysis and actionable recommendations for your ML infrastructure
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  console.log('🔄 Manually loading sample data from AI Insights...');
                  loadSampleData();
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 text-sm"
                title="Load Credit_Card_Model sample data"
              >
                ⟳ Reload Data
              </button>
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                <Download size={18} />
                Export Report
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Executive Summary */} 
        <WidgetContainer
          title="Executive Summary"
          icon={<Brain size={20} className={isDark ? 'text-purple-400' : 'text-purple-600'} />}
          isDark={isDark}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Health Score Gauge */}
            <div className="flex flex-col items-center justify-center">
              <div className="relative w-48 h-48">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="96"
                    cy="96"
                    r="88"
                    stroke={isDark ? '#334155' : '#e2e8f0'}
                    strokeWidth="16"
                    fill="none"
                  />
                  <circle
                    cx="96"
                    cy="96"
                    r="88"
                    stroke={healthStatus.bgColor.replace('bg-', '#')}
                    strokeWidth="16"
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={`${(healthScore / 100) * 552} 552`}
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-4xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {healthScore.toFixed(0)}
                  </span>
                  <span className={`text-sm ${healthStatus.color} font-semibold mt-1`}>
                    {healthStatus.label}
                  </span>
                  <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'} mt-1`}>
                    System Health
                  </span>
                </div>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className={`p-4 rounded-lg border ${isDark ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={20} className="text-red-500" />
                    <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {summary.critical}
                    </span>
                  </div>
                  <p className={`text-sm ${isDark ? 'text-red-300' : 'text-red-700'}`}>Critical Issues</p>
                </div>

                <div className={`p-4 rounded-lg border ${isDark ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-yellow-50 border-yellow-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={20} className="text-yellow-500" />
                    <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {summary.warning}
                    </span>
                  </div>
                  <p className={`text-sm ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>Warnings</p>
                </div>

                <div className={`p-4 rounded-lg border ${isDark ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb size={20} className="text-blue-500" />
                    <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {summary.info}
                    </span>
                  </div>
                  <p className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>Recommendations</p>
                </div>

                <div className={`p-4 rounded-lg border ${isDark ? 'bg-green-500/10 border-green-500/30' : 'bg-green-50 border-green-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle size={20} className="text-green-500" />
                    <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {summary.success}
                    </span>
                  </div>
                  <p className={`text-sm ${isDark ? 'text-green-300' : 'text-green-700'}`}>Improvements</p>
                </div>
              </div>

              <div className={`p-4 rounded-lg ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'} leading-relaxed`}>
                  {summary.critical > 0 ? (
                    <>⚠️ <strong>{summary.critical} critical issue(s)</strong> require immediate attention. </>
                  ) : (
                    <>✓ No critical issues detected. </>
                  )}
                  {summary.warning > 0 && (
                    <>{summary.warning} warning(s) should be addressed soon. </>
                  )}
                  {healthScore >= 85 ? (
                    <>System is operating at optimal levels.</>
                  ) : (
                    <>Review recommendations below to improve system health.</>
                  )}
                </p>
              </div>
            </div>
          </div>
        </WidgetContainer>

        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Filter by:
          </span>
          {['all', 'performance', 'quality', 'drift', 'operations', 'anomaly'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white'
                  : isDark
                  ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        {/* Insights List */}
        <WidgetContainer
          title={`Insights & Recommendations (${filteredInsights.length})`}
          icon={<Lightbulb size={20} className={isDark ? 'text-blue-400' : 'text-blue-600'} />}
          isDark={isDark}
        >
          {filteredInsights.length === 0 ? (
            <EmptyState
              title="No Insights Available"
              description={
                selectedCategory === 'all'
                  ? 'Add models and generate reports to see AI-powered insights'
                  : `No ${selectedCategory} insights found`
              }
              isDark={isDark}
            />
          ) : (
            <div className="space-y-4">
              {filteredInsights.map((insight) => (
                <div
                  key={insight.id}
                  className={`p-5 rounded-lg border transition-all hover:shadow-md ${
                    isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-1">{getSeverityIcon(insight.severity)}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {insight.title}
                          </h3>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getSeverityBadge(insight.severity)}`}>
                            {insight.severity.toUpperCase()}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-700'}`}>
                            {getCategoryIcon(insight.category)}
                            <span className="ml-1">{insight.category}</span>
                          </span>
                        </div>

                        <p className={`text-sm mb-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          {insight.description}
                        </p>

                        {/* Metrics Display */}
                        {insight.metric && (
                          <div className={`flex items-center gap-4 mb-3 text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                            <span>
                              <strong>Metric:</strong> {insight.metric}
                            </span>
                            {insight.currentValue !== undefined && (
                              <span>
                                <strong>Current:</strong> {typeof insight.currentValue === 'number' ? insight.currentValue.toFixed(3) : insight.currentValue}
                              </span>
                            )}
                            {insight.baselineValue !== undefined && (
                              <span>
                                <strong>Baseline:</strong> {typeof insight.baselineValue === 'number' ? insight.baselineValue.toFixed(3) : insight.baselineValue}
                              </span>
                            )}
                            {insight.change !== undefined && (
                              <span className={`flex items-center gap-1 ${insight.change > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                {insight.change > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                <strong>{Math.abs(insight.change).toFixed(1)}%</strong>
                              </span>
                            )}
                          </div>
                        )}

                        {/* Recommendation */}
                        {insight.recommendation && (
                          <div className={`p-3 rounded ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'} border ${isDark ? 'border-blue-500/30' : 'border-blue-200'}`}>
                            <p className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-900'}`}>
                              <strong>💡 Recommendation:</strong> {insight.recommendation}
                            </p>
                          </div>
                        )}

                        {/* Related Models/Datasets */}
                        {(insight.relatedModels || insight.relatedDatasets) && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {insight.relatedModels?.map((model) => (
                              <span
                                key={model}
                                className={`px-2 py-1 rounded text-xs ${isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'}`}
                              >
                                🔷 {model}
                              </span>
                            ))}
                            {insight.relatedDatasets?.map((dataset) => (
                              <span
                                key={dataset}
                                className={`px-2 py-1 rounded text-xs ${isDark ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700'}`}
                              >
                                📊 {dataset}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Priority Badge */}
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${isDark ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-900'}`}>
                      P{insight.priority}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </WidgetContainer>
      </div>
    </div>
  );
};

export default AIInsights;
