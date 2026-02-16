import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useGlobal } from '../contexts/GlobalContext';
import { ChevronRight, Download, Filter } from 'lucide-react';
import { KPICard, SkeletonLoader } from '../components/DashboardWidgets';
import ModelHealthGauge from '../components/charts/ModelHealthGauge';
import PerformanceTrendChart from '../components/charts/PerformanceTrendChart';
import AlertTimeline from '../components/charts/AlertTimeline';
import DeploymentStatusBoard from '../components/charts/DeploymentStatusBoard';
import DataQualityHeatmap from '../components/charts/DataQualityHeatmap';
import ModelDriftDistribution from '../components/charts/ModelDriftDistribution';
import {
  transformReportsToTimeSeries,
  aggregateModelHealth,
  transformDataQualityToHeatmap,
  transformDriftToBoxPlot,
  calculateKPIMetrics,
  transformDeploymentStatus,
  type KPIMetric,
} from '../utils/chartDataTransformers';

interface Alert {
  id: string;
  model: string;
  metric: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  age: string;
  status: 'active' | 'acknowledged' | 'resolved';
  message?: string;
}

const Dashboard: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const {
    registryModels = [],
    generatedReports = [],
    monitoringJobs = [],
    deploymentJobs = [],
    dataQualityReports = [],
    ingestionJobs = [],
    loadSampleData,
  } = useGlobal();

  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    portfolio: 'All',
    businessLine: 'All',
    modelType: 'All',
    model: 'All',
    timeWindow: 'Last 30 Days',
    segment: 'All',
  });

  // Auto-load sample data if no data exists
  useEffect(() => {
    console.log('Dashboard data check:', {
      models: registryModels.length,
      reports: generatedReports.length,
      monitoring: monitoringJobs.length,
      deployments: deploymentJobs.length
    });
    
    if (registryModels.length === 0 && generatedReports.length === 0 && monitoringJobs.length === 0) {
      console.log('⚠️ No data detected, loading sample data...');
      loadSampleData();
    }
  }, [registryModels.length, generatedReports.length, monitoringJobs.length]);

  // Initial loading simulation
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  // Calculate real-time metrics from GlobalContext data
  const dashboardData = useMemo(() => {
    // Model Health Metrics
    const healthMetrics = aggregateModelHealth(
      registryModels,
      monitoringJobs,
      deploymentJobs
    );

    // Performance Trends
    const performanceTrends = transformReportsToTimeSeries(generatedReports);

    // Data Quality Heatmap
    const qualityHeatmap = transformDataQualityToHeatmap(
      dataQualityReports,
      ingestionJobs
    );

    // Drift Distribution
    const driftDistribution = transformDriftToBoxPlot(monitoringJobs);

    // Deployment Status
    const deploymentStatus = transformDeploymentStatus(deploymentJobs, registryModels);

    // KPI Metrics
    const kpiMetrics = calculateKPIMetrics(
      registryModels,
      generatedReports,
      monitoringJobs,
      dataQualityReports
    );

    // Generate mock alerts based on real data
    const alerts: Alert[] = [];
    
    // Alerts from high drift
    monitoringJobs.forEach((job, idx) => {
      const drift = job.metrics?.dataDrift || job.monitoringMetrics?.dataDrift || 0;
      if (drift > 0.15) {
        const model = registryModels.find((m) => m.id === job.modelId);
        alerts.push({
          id: `alert-drift-${idx}`,
          model: model?.name || job.name,
          metric: 'Data Drift',
          severity: drift > 0.25 ? 'critical' : 'high',
          age: '2h',
          status: 'active',
          message: `Drift score: ${(drift * 100).toFixed(1)}%`,
        });
      }
    });

    // Alerts from failed deployments
    deploymentJobs.forEach((job, idx) => {
      if (job.status === 'failed') {
        const model = registryModels.find((m) => m.id === job.modelId);
        alerts.push({
          id: `alert-deploy-${idx}`,
          model: model?.name || 'Unknown Model',
          metric: 'Deployment Failed',
          severity: 'high',
          age: '1h',
          status: 'active',
          message: `Failed in ${job.environment} environment`,
        });
      }
    });

    // Alerts from data quality issues
    dataQualityReports.forEach((report, idx) => {
      const highSeverityIssues = report.issues.filter((i) => i.severity === 'high');
      if (highSeverityIssues.length > 0 && report.qualityScore < 60) {
        alerts.push({
          id: `alert-quality-${idx}`,
          model: report.datasetName,
          metric: 'Data Quality',
          severity: 'medium',
          age: '3h',
          status: 'active',
          message: `${highSeverityIssues.length} high severity issues`,
        });
      }
    });

    // Group KPIs by category
    const performanceMetrics = kpiMetrics.filter((m) => m.category === 'performance');
    const stabilityMetrics = kpiMetrics.filter((m) => m.category === 'stability');
    const featureMetrics = kpiMetrics.filter((m) => m.category === 'features');
    const businessMetrics = kpiMetrics.filter((m) => m.category === 'business');

    return {
      healthMetrics,
      performanceTrends,
      qualityHeatmap,
      driftDistribution,
      deploymentStatus,
      alerts,
      performanceMetrics,
      stabilityMetrics,
      featureMetrics,
      businessMetrics,
    };
  }, [
    registryModels,
    generatedReports,
    monitoringJobs,
    deploymentJobs,
    dataQualityReports,
    ingestionJobs,
  ]);

  const filterOptions = {
    portfolio: ['All', 'Risk Management', 'Marketing', 'Operations'],
    businessLine: ['All', 'Retail', 'Commercial', 'Digital'],
    modelType: ['All', 'Classification', 'Regression', 'Ranking'],
    model: ['All', ...registryModels.map((m) => m.name)],
    timeWindow: ['Last 7 Days', 'Last 30 Days', 'Last 90 Days', 'Year to Date'],
    segment: ['All', 'Prime', 'Non-Prime', 'Subprime'],
  };

  const FilterBar: React.FC = () => {
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
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  console.log('🔄 Manually loading sample data...');
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
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Filters */}
        <FilterBar />

        {loading ? (
          <SkeletonLoader count={6} isDark={isDark} variant="card" />
        ) : (
          <div className="space-y-8">
            {/* System Health Overview */}
            <ModelHealthGauge
              theme={theme}
              isDark={isDark}
              {...dashboardData.healthMetrics}
            />

            {/* Performance Trends */}
            <PerformanceTrendChart
              theme={theme}
              isDark={isDark}
              data={dashboardData.performanceTrends}
            />

            {/* Alerts Section */}
            <AlertTimeline
              theme={theme}
              isDark={isDark}
              alerts={dashboardData.alerts}
            />

            {/* KPI Sections */}
            {dashboardData.performanceMetrics.length > 0 && (
              <div>
                <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  📊 Performance & Accuracy
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {dashboardData.performanceMetrics.map((metric) => (
                    <KPICard key={metric.name} metric={metric} theme={theme} isDark={isDark} />
                  ))}
                </div>
              </div>
            )}

            {dashboardData.stabilityMetrics.length > 0 && (
              <div>
                <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  ⚡ Stability & Drift
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {dashboardData.stabilityMetrics.map((metric) => (
                    <KPICard key={metric.name} metric={metric} theme={theme} isDark={isDark} />
                  ))}
                </div>
              </div>
            )}

            {dashboardData.featureMetrics.length > 0 && (
              <div>
                <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  🔬 Feature Quality
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {dashboardData.featureMetrics.map((metric) => (
                    <KPICard key={metric.name} metric={metric} theme={theme} isDark={isDark} />
                  ))}
                </div>
              </div>
            )}

            {dashboardData.businessMetrics.length > 0 && (
              <div>
                <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  💼 Business Impact
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {dashboardData.businessMetrics.map((metric) => (
                    <KPICard key={metric.name} metric={metric} theme={theme} isDark={isDark} />
                  ))}
                </div>
              </div>
            )}

            {/* Deployment Status */}
            <DeploymentStatusBoard
              theme={theme}
              isDark={isDark}
              deployments={dashboardData.deploymentStatus}
            />

            {/* Data Quality & Drift - Side by Side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DataQualityHeatmap
                theme={theme}
                isDark={isDark}
                data={dashboardData.qualityHeatmap}
              />
              <ModelDriftDistribution
                theme={theme}
                isDark={isDark}
                data={dashboardData.driftDistribution}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;

