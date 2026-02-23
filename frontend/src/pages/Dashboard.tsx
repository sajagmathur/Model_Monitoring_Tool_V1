import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useGlobal } from '../contexts/GlobalContext';
import { useNotification } from '../hooks/useNotification';
import { ChevronRight, Download, Filter, FileText, Presentation, X, CheckCircle } from 'lucide-react';
import { exportDashboard } from '../utils/dashboardExport';
import { KPICard, SkeletonLoader } from '../components/DashboardWidgets';
import ModelHealthGauge from '../components/charts/ModelHealthGauge';
import PerformanceTrendChart from '../components/charts/PerformanceTrendChart';
import AlertTimeline from '../components/charts/AlertTimeline';
import DeploymentStatusBoard from '../components/charts/DeploymentStatusBoard';
import DataQualityHeatmap from '../components/charts/DataQualityHeatmap';
import ModelDriftDistribution from '../components/charts/ModelDriftDistribution';
import { PortfolioRAGChart } from '../components/charts/PortfolioRAGChart';
import { BankingMetricsTrendChart } from '../components/charts/BankingMetricsTrendChart';
import { SegmentComparisonChart } from '../components/charts/SegmentComparisonChart';
import { VariableStabilityTable } from '../components/charts/VariableStabilityTable';
import { DecileAnalysisChart } from '../components/charts/DecileAnalysisChart';
import {
  transformReportsToTimeSeries,
  aggregateModelHealth,
  transformDataQualityToHeatmap,
  transformDriftToBoxPlot,
  calculateKPIMetrics,
  transformDeploymentStatus,
  type KPIMetric,
} from '../utils/chartDataTransformers';
import {
  generateSegmentMetrics,
  generateVariableStability,
  generateDecileAnalysis,
} from '../utils/bankingMetricsMock';

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
  const { showNotification } = useNotification();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    registryModels = [],
    generatedReports = [],
    monitoringJobs = [],
    deploymentJobs = [],
    dataQualityReports = [],
    ingestionJobs = [],
    bankingModels = [],
    bankingMetrics = [],
    loadSampleData,
    syncRegistryModelsToDashboard,
  } = useGlobal();

  const [loading, setLoading] = useState(true);
  const [selectedBankingModel, setSelectedBankingModel] = useState<string>('');
  const [selectedRAGFilter, setSelectedRAGFilter] = useState<'all' | 'green' | 'amber' | 'red'>('all');
  const [showExportModal, setShowExportModal] = useState(false);
  const [showProjectsBanner, setShowProjectsBanner] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'ppt'>('pdf');
  const [exportSections, setExportSections] = useState({
    kpis: true,
    ragStatus: true,
    trends: true,
    segments: true,
    deciles: true,
    variables: true,
  });
  const [exporting, setExporting] = useState(false);
  const [viewModes, setViewModes] = useState<{
    ragStatus: 'chart' | 'table';
    trends: 'chart' | 'table';
    segments: 'chart' | 'table';
    deciles: 'chart' | 'table';
    variables: 'chart' | 'table';
  }>({
    ragStatus: 'chart',
    trends: 'chart',
    segments: 'chart',
    deciles: 'chart',
    variables: 'table',
  });
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

  // Sync registry models to dashboard whenever they change
  useEffect(() => {
    if (registryModels.length > 0) {
      console.log('✓ Registry models detected, syncing to dashboard...');
      syncRegistryModelsToDashboard();
    }
  }, [registryModels.length]);

  // Initial loading simulation
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  // Auto-select first model on load (if none selected)
  useEffect(() => {
    if (!selectedBankingModel && bankingModels.length > 0) {
      // Check localStorage for last selected model
      const savedModelId = localStorage.getItem('dashboard_selected_model');
      
      if (savedModelId && bankingModels.find(m => m.model_id === savedModelId)) {
        // Restore last selected model if it still exists
        setSelectedBankingModel(savedModelId);
        console.log('✓ Restored previously selected model:', savedModelId);
      } else {
        // Auto-select first model as fallback
        const firstModelId = bankingModels[0].model_id;
        setSelectedBankingModel(firstModelId);
        console.log('✓ Auto-selected first model:', bankingModels[0].name);
      }
    }
  }, [bankingModels, selectedBankingModel]);

  // Persist selected model to localStorage
  useEffect(() => {
    if (selectedBankingModel) {
      localStorage.setItem('dashboard_selected_model', selectedBankingModel);
    }
  }, [selectedBankingModel]);

  // Handle URL parameters for model selection (from Projects page)
  useEffect(() => {
    const modelIdFromUrl = searchParams.get('modelId');
    const sourceFromUrl = searchParams.get('source');
    
    if (modelIdFromUrl && bankingModels.length > 0) {
      const matchedModel = bankingModels.find(m => m.model_id === modelIdFromUrl);
      
      if (matchedModel) {
        setSelectedBankingModel(modelIdFromUrl);
        
        // Show banner if coming from Projects
        if (sourceFromUrl === 'projects') {
          setShowProjectsBanner(true);
          showNotification(
            `Now viewing: ${matchedModel.name} (${matchedModel.portfolio})`,
            'success'
          );
          
          // Auto-hide banner after 5 seconds
          setTimeout(() => setShowProjectsBanner(false), 5000);
        }
        
        // Clean URL after processing (remove query params)
        setSearchParams({});
        
        console.log('✓ Model selected from URL:', matchedModel.name);
      } else {
        console.warn('⚠️ Model ID from URL not found:', modelIdFromUrl);
        showNotification(
          'Selected model not found in dashboard data',
          'warning'
        );
      }
    }
  }, [bankingModels, searchParams, setSearchParams, showNotification]);

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

    // Model Metrics Processing
    let filteredBankingMetrics = bankingMetrics;
    
    // Apply RAG filter
    if (selectedRAGFilter !== 'all') {
      filteredBankingMetrics = filteredBankingMetrics.filter(m => m.rag_status === selectedRAGFilter);
    }
    
    // Apply portfolio filter
    if (filters.portfolio !== 'All') {
      filteredBankingMetrics = filteredBankingMetrics.filter(m => m.portfolio === filters.portfolio);
    }
    
    // Get latest vintage metrics per model
    const latestVintage = [...new Set(bankingMetrics.map(m => m.vintage))].sort().reverse()[0];
    const latestMetrics = bankingMetrics.filter(m => m.vintage === latestVintage);
    
    // Calculate model portfolio KPIs
    const avgKS = latestMetrics.reduce((sum, m) => sum + (m.metrics.KS || 0), 0) / (latestMetrics.length || 1);
    const avgPSI = latestMetrics.reduce((sum, m) => sum + (m.metrics.PSI || 0), 0) / (latestMetrics.length || 1);
    const avgAUC = latestMetrics.reduce((sum, m) => sum + (m.metrics.AUC || 0), 0) / (latestMetrics.length || 1);
    
    const greenModels = latestMetrics.filter(m => m.rag_status === 'green').length;
    const amberModels = latestMetrics.filter(m => m.rag_status === 'amber').length;
    const redModels = latestMetrics.filter(m => m.rag_status === 'red').length;

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
      // Banking metrics
      filteredBankingMetrics,
      latestMetrics,
      bankingKPIs: {
        avgKS,
        avgPSI,
        avgAUC,
        greenModels,
        amberModels,
        redModels,
        totalModels: latestMetrics.length,
      },
    };
  }, [
    registryModels,
    generatedReports,
    monitoringJobs,
    deploymentJobs,
    dataQualityReports,
    ingestionJobs,
    bankingMetrics,
    selectedRAGFilter,
    filters.portfolio,
  ]);

  const filterOptions = {
    portfolio: ['All', ...Array.from(new Set(bankingModels.map(m => m.portfolio)))],
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
            <div className="flex items-center gap-3">
              {/* Model Selector */}
              {bankingModels.length > 0 && (
                <div className="flex items-center gap-2">
                  <label className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Select Model:
                  </label>
                  <select
                    value={selectedBankingModel}
                    onChange={(e) => setSelectedBankingModel(e.target.value)}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium min-w-[280px] ${
                      isDark
                        ? 'bg-slate-700 border-slate-600 text-white'
                        : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    {bankingModels.map((model) => {
                      const latestMetric = bankingMetrics.find(
                        m => m.model_id === model.model_id && 
                        m.vintage === [...new Set(bankingMetrics.map(m => m.vintage))].sort().reverse()[0]
                      );
                      const ragBadge = latestMetric?.rag_status === 'green' ? '🟢' 
                        : latestMetric?.rag_status === 'amber' ? '🟡' 
                        : latestMetric?.rag_status === 'red' ? '🔴' : '';
                      
                      return (
                        <option key={model.model_id} value={model.model_id}>
                          {ragBadge} {model.name} ({model.portfolio})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
              
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
              <button 
                onClick={() => setShowExportModal(true)}
                disabled={!selectedBankingModel}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                title={!selectedBankingModel ? "Select a model to export" : "Export model report"}
              >
                <Download size={18} />
                Export Report
              </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Projects Workflow Success Banner */}
      {showProjectsBanner && selectedBankingModel && (() => {
        const model = bankingModels.find(m => m.model_id === selectedBankingModel);
        return model ? (
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className={`p-4 rounded-lg border flex items-center justify-between ${
              isDark 
                ? 'bg-green-900/20 border-green-500/30' 
                : 'bg-green-50 border-green-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-500/20">
                  <CheckCircle size={24} className="text-green-500" />
                </div>
                <div>
                  <p className={`font-semibold ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                    Successfully loaded from Projects workflow
                  </p>
                  <p className={`text-sm ${isDark ? 'text-green-300/70' : 'text-green-600'}`}>
                    Now viewing: <span className="font-medium">{model.name}</span> ({model.portfolio})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowProjectsBanner(false)}
                className={`p-1 rounded hover:bg-green-500/10 ${
                  isDark ? 'text-green-400' : 'text-green-600'
                }`}
              >
                <X size={20} />
              </button>
            </div>
          </div>
        ) : null;
      })()}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Filters */}
        <FilterBar />

        {loading ? (
          <SkeletonLoader count={6} isDark={isDark} variant="card" />
        ) : (
          <div className="space-y-8">
            {/* Model Metrics Section */}
            {bankingModels.length > 0 ? (
              <div className="space-y-6">
                {/* Model Portfolio KPIs */}
                <div>
                  <h2 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    📊 Model Portfolio
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className={`p-4 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                      <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Avg KS</div>
                      <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {dashboardData.bankingKPIs.avgKS.toFixed(3)}
                      </div>
                      <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                        Target: &gt; 0.35
                      </div>
                    </div>
                    <div className={`p-4 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                      <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Avg PSI</div>
                      <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {dashboardData.bankingKPIs.avgPSI.toFixed(3)}
                      </div>
                      <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                        Target: &lt; 0.10
                      </div>
                    </div>
                    <div className={`p-4 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                      <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Avg AUC</div>
                      <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {dashboardData.bankingKPIs.avgAUC.toFixed(3)}
                      </div>
                      <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                        Target: &gt; 0.75
                      </div>
                    </div>
                    <div className={`p-4 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                      <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Total Models</div>
                      <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {dashboardData.bankingKPIs.totalModels}
                      </div>
                      <div className={`text-xs flex gap-1 mt-1`}>
                        <span className="text-green-500">●{dashboardData.bankingKPIs.greenModels}</span>
                        <span className="text-amber-500">●{dashboardData.bankingKPIs.amberModels}</span>
                        <span className="text-red-500">●{dashboardData.bankingKPIs.redModels}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Portfolio RAG Status */}
                <div id="export-rag-status" className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Portfolio RAG Status Distribution
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setViewModes({...viewModes, ragStatus: 'chart'})}
                        className={`px-3 py-1 rounded text-sm ${
                          viewModes.ragStatus === 'chart'
                            ? 'bg-blue-600 text-white'
                            : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        Chart
                      </button>
                      <button
                        onClick={() => setViewModes({...viewModes, ragStatus: 'table'})}
                        className={`px-3 py-1 rounded text-sm ${
                          viewModes.ragStatus === 'table'
                            ? 'bg-blue-600 text-white'
                            : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        Table
                      </button>
                    </div>
                  </div>
                  
                  {viewModes.ragStatus === 'chart' ? (
                    <div style={{ height: '300px' }}>
                      <PortfolioRAGChart 
                        metrics={dashboardData.latestMetrics}
                        onRAGClick={(ragStatus) => setSelectedRAGFilter(ragStatus)}
                      />
                    </div>
                  ) : (
                    <div className="overflow-auto">
                      <table className="w-full">
                        <thead className={`${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                          <tr>
                            <th className={`px-4 py-2 text-left text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                              RAG Status
                            </th>
                            <th className={`px-4 py-2 text-left text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                              Model Count
                            </th>
                            <th className={`px-4 py-2 text-left text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                              Percentage
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          <tr className={isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}>
                            <td className={`px-4 py-3 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                              <span className="inline-flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                                Green
                              </span>
                            </td>
                            <td className={`px-4 py-3 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                              {dashboardData.bankingKPIs.greenModels}
                            </td>
                            <td className={`px-4 py-3 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                              {((dashboardData.bankingKPIs.greenModels / dashboardData.bankingKPIs.totalModels) * 100).toFixed(1)}%
                            </td>
                          </tr>
                          <tr className={isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}>
                            <td className={`px-4 py-3 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                              <span className="inline-flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                                Amber
                              </span>
                            </td>
                            <td className={`px-4 py-3 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                              {dashboardData.bankingKPIs.amberModels}
                            </td>
                            <td className={`px-4 py-3 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                              {((dashboardData.bankingKPIs.amberModels / dashboardData.bankingKPIs.totalModels) * 100).toFixed(1)}%
                            </td>
                          </tr>
                          <tr className={isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}>
                            <td className={`px-4 py-3 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                              <span className="inline-flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                                Red
                              </span>
                            </td>
                            <td className={`px-4 py-3 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                              {dashboardData.bankingKPIs.redModels}
                            </td>
                            <td className={`px-4 py-3 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                              {((dashboardData.bankingKPIs.redModels / dashboardData.bankingKPIs.totalModels) * 100).toFixed(1)}%
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                  
                  <div className="mt-4 text-center">
                    {selectedRAGFilter !== 'all' && (
                      <button
                        onClick={() => setSelectedRAGFilter('all')}
                        className="text-sm text-blue-600 hover:text-blue-700 underline"
                      >
                        Clear RAG filter
                      </button>
                    )}
                  </div>
                </div>

                {/* Model Performance Analysis */}
                {selectedBankingModel && (() => {
                  const selectedModel = bankingModels.find(m => m.model_id === selectedBankingModel);
                  const modelMetrics = bankingMetrics.filter(m => m.model_id === selectedBankingModel);
                  const latestMetric = modelMetrics.sort((a, b) => b.vintage.localeCompare(a.vintage))[0];
                  
                  return (
                    <div id="export-model-section" className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                      <div className="mb-6">
                        <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {selectedModel?.name}
                        </h3>
                        <div className="flex items-center gap-4 mt-2">
                          <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                            Portfolio: <span className="font-medium">{selectedModel?.portfolio}</span>
                          </span>
                          <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                            Type: <span className="font-medium">{selectedModel?.model_type}</span>
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                            latestMetric?.rag_status === 'green' 
                              ? 'bg-green-100 text-green-800' 
                              : latestMetric?.rag_status === 'amber'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            <span className={`w-2 h-2 rounded-full ${
                              latestMetric?.rag_status === 'green' 
                                ? 'bg-green-500' 
                                : latestMetric?.rag_status === 'amber'
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                            }`}></span>
                            {latestMetric?.rag_status?.toUpperCase()} Status
                          </span>
                        </div>
                      </div>

                      {/* Current Metrics Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
                        {latestMetric?.metrics.KS !== undefined && (
                          <div className={`p-3 rounded border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>KS</div>
                            <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {latestMetric.metrics.KS.toFixed(3)}
                            </div>
                          </div>
                        )}
                        {latestMetric?.metrics.PSI !== undefined && (
                          <div className={`p-3 rounded border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>PSI</div>
                            <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {latestMetric.metrics.PSI.toFixed(3)}
                            </div>
                          </div>
                        )}
                        {latestMetric?.metrics.AUC !== undefined && (
                          <div className={`p-3 rounded border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>AUC</div>
                            <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {latestMetric.metrics.AUC.toFixed(3)}
                            </div>
                          </div>
                        )}
                        {latestMetric?.metrics.Gini !== undefined && (
                          <div className={`p-3 rounded border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Gini</div>
                            <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {latestMetric.metrics.Gini.toFixed(3)}
                            </div>
                          </div>
                        )}
                        {latestMetric?.metrics.bad_rate !== undefined && (
                          <div className={`p-3 rounded border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Bad Rate</div>
                            <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {(latestMetric.metrics.bad_rate * 100).toFixed(2)}%
                            </div>
                          </div>
                        )}
                        {latestMetric?.volume !== undefined && (
                          <div className={`p-3 rounded border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Volume</div>
                            <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {latestMetric.volume.toLocaleString()}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Metric Trends */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className={`text-md font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            Performance Trends Over Time
                          </h4>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setViewModes({...viewModes, trends: 'chart'})}
                              className={`px-3 py-1 rounded text-sm ${
                                viewModes.trends === 'chart'
                                  ? 'bg-blue-600 text-white'
                                  : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              Chart
                            </button>
                            <button
                              onClick={() => setViewModes({...viewModes, trends: 'table'})}
                              className={`px-3 py-1 rounded text-sm ${
                                viewModes.trends === 'table'
                                  ? 'bg-blue-600 text-white'
                                  : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              Table
                            </button>
                          </div>
                        </div>

                        {viewModes.trends === 'chart' ? (
                          <div id="export-trends" className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {latestMetric?.metrics.KS !== undefined && (
                              <div>
                                <div className={`text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                  KS Statistic
                                </div>
                                <BankingMetricsTrendChart
                                  metrics={modelMetrics}
                                  metricKey="KS"
                                  height={200}
                                />
                              </div>
                            )}
                            {latestMetric?.metrics.PSI !== undefined && (
                              <div>
                                <div className={`text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                  PSI (Stability)
                                </div>
                                <BankingMetricsTrendChart
                                  metrics={modelMetrics}
                                  metricKey="PSI"
                                  height={200}
                                />
                              </div>
                            )}
                            {latestMetric?.metrics.AUC !== undefined && (
                              <div>
                                <div className={`text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                  AUC (Accuracy)
                                </div>
                                <BankingMetricsTrendChart
                                  metrics={modelMetrics}
                                  metricKey="AUC"
                                  height={200}
                                />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="overflow-auto">
                            <table className="w-full text-sm">
                              <thead className={`${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                                <tr>
                                  <th className={`px-3 py-2 text-left font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Vintage</th>
                                  <th className={`px-3 py-2 text-right font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>KS</th>
                                  <th className={`px-3 py-2 text-right font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>PSI</th>
                                  <th className={`px-3 py-2 text-right font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>AUC</th>
                                  <th className={`px-3 py-2 text-right font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Gini</th>
                                  <th className={`px-3 py-2 text-right font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Bad Rate</th>
                                  <th className={`px-3 py-2 text-right font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Volume</th>
                                  <th className={`px-3 py-2 text-center font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {modelMetrics.sort((a, b) => b.vintage.localeCompare(a.vintage)).map((m, idx) => (
                                  <tr key={idx} className={isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}>
                                    <td className={`px-3 py-2 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{m.vintage}</td>
                                    <td className={`px-3 py-2 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                                      {m.metrics.KS?.toFixed(3) || '-'}
                                    </td>
                                    <td className={`px-3 py-2 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                                      {m.metrics.PSI?.toFixed(3) || '-'}
                                    </td>
                                    <td className={`px-3 py-2 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                                      {m.metrics.AUC?.toFixed(3) || '-'}
                                    </td>
                                    <td className={`px-3 py-2 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                                      {m.metrics.Gini?.toFixed(3) || '-'}
                                    </td>
                                    <td className={`px-3 py-2 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                                      {m.metrics.bad_rate ? (m.metrics.bad_rate * 100).toFixed(2) + '%' : '-'}
                                    </td>
                                    <td className={`px-3 py-2 text-right ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                                      {m.volume.toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      <span className={`inline-block w-2 h-2 rounded-full ${
                                        m.rag_status === 'green' ? 'bg-green-500' :
                                        m.rag_status === 'amber' ? 'bg-amber-500' : 'bg-red-500'
                                      }`}></span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Segment & Decile Analysis */}
                {selectedBankingModel && (() => {
                  const selectedModel = bankingModels.find(m => m.model_id === selectedBankingModel);
                  const segmentData = generateSegmentMetrics(selectedBankingModel, dashboardData.latestMetrics[0]?.vintage || '2024-12');
                  const decileData = generateDecileAnalysis(selectedBankingModel, dashboardData.latestMetrics[0]?.vintage || '2024-12');
                  
                  return (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Segment Comparison */}
                      <div id="export-segments" className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            Segment Comparison
                          </h3>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setViewModes({...viewModes, segments: 'chart'})}
                              className={`px-3 py-1 rounded text-sm ${
                                viewModes.segments === 'chart'
                                  ? 'bg-blue-600 text-white'
                                  : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              Chart
                            </button>
                            <button
                              onClick={() => setViewModes({...viewModes, segments: 'table'})}
                              className={`px-3 py-1 rounded text-sm ${
                                viewModes.segments === 'table'
                                  ? 'bg-blue-600 text-white'
                                  : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              Table
                            </button>
                          </div>
                        </div>
                        
                        {viewModes.segments === 'chart' ? (
                          <div style={{ height: '300px' }}>
                            <SegmentComparisonChart segmentData={segmentData} />
                          </div>
                        ) : (
                          <div className="overflow-auto">
                            <table className="w-full text-sm">
                              <thead className={`${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                                <tr>
                                  <th className={`px-3 py-2 text-left font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Segment</th>
                                  <th className={`px-3 py-2 text-right font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Volume</th>
                                  <th className={`px-3 py-2 text-right font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>KS</th>
                                  <th className={`px-3 py-2 text-right font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>PSI</th>
                                  <th className={`px-3 py-2 text-right font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>AUC</th>
                                  <th className={`px-3 py-2 text-right font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Bad Rate</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {segmentData.segments.map((seg, idx) => (
                                  <tr key={idx} className={isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}>
                                    <td className={`px-3 py-2 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{seg.label}</td>
                                    <td className={`px-3 py-2 text-right ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                                      {seg.volume.toLocaleString()}
                                    </td>
                                    <td className={`px-3 py-2 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                                      {seg.metrics.KS?.toFixed(3) || '-'}
                                    </td>
                                    <td className={`px-3 py-2 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                                      {seg.metrics.PSI?.toFixed(3) || '-'}
                                    </td>
                                    <td className={`px-3 py-2 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                                      {seg.metrics.AUC?.toFixed(3) || '-'}
                                    </td>
                                    <td className={`px-3 py-2 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                                      {seg.metrics.bad_rate ? (seg.metrics.bad_rate * 100).toFixed(2) + '%' : '-'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Decile Analysis */}
                      <div id="export-deciles" className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            Decile Analysis
                          </h3>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setViewModes({...viewModes, deciles: 'chart'})}
                              className={`px-3 py-1 rounded text-sm ${
                                viewModes.deciles === 'chart'
                                  ? 'bg-blue-600 text-white'
                                  : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              Chart
                            </button>
                            <button
                              onClick={() => setViewModes({...viewModes, deciles: 'table'})}
                              className={`px-3 py-1 rounded text-sm ${
                                viewModes.deciles === 'table'
                                  ? 'bg-blue-600 text-white'
                                  : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              Table
                            </button>
                          </div>
                        </div>
                        
                        {viewModes.deciles === 'chart' ? (
                          <div style={{ height: '300px' }}>
                            <DecileAnalysisChart deciles={decileData} />
                          </div>
                        ) : (
                          <div className="overflow-auto max-h-[400px]">
                            <table className="w-full text-sm">
                              <thead className={`sticky top-0 ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                                <tr>
                                  <th className={`px-3 py-2 text-left font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Decile</th>
                                  <th className={`px-3 py-2 text-right font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Count</th>
                                  <th className={`px-3 py-2 text-right font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Bad Count</th>
                                  <th className={`px-3 py-2 text-right font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Bad Rate</th>
                                  <th className={`px-3 py-2 text-right font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>KS</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {decileData.map((d) => (
                                  <tr key={d.decile} className={isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}>
                                    <td className={`px-3 py-2 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>D{d.decile}</td>
                                    <td className={`px-3 py-2 text-right ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                                      {d.count.toLocaleString()}
                                    </td>
                                    <td className={`px-3 py-2 text-right ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                                      {d.bad_count.toLocaleString()}
                                    </td>
                                    <td className={`px-3 py-2 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                                      {(d.bad_rate * 100).toFixed(2)}%
                                    </td>
                                    <td className={`px-3 py-2 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                                      {d.ks.toFixed(4)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Variable Stability */}
                {selectedBankingModel && (
                  <div id="export-variables" className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        Variable Stability Analysis
                      </h3>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setViewModes({...viewModes, variables: 'table'})}
                          className={`px-3 py-1 rounded text-sm ${
                            viewModes.variables === 'table'
                              ? 'bg-blue-600 text-white'
                              : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          Table
                        </button>
                        <button
                          onClick={() => setViewModes({...viewModes, variables: 'chart'})}
                          className={`px-3 py-1 rounded text-sm ${
                            viewModes.variables === 'chart'
                              ? 'bg-blue-600 text-white'
                              : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          Chart
                        </button>
                      </div>
                    </div>
                    
                    {viewModes.variables === 'table' ? (
                      <VariableStabilityTable 
                        variables={generateVariableStability(selectedBankingModel, dashboardData.latestMetrics[0]?.vintage || '2024-12')}
                        maxRows={15}
                      />
                    ) : (
                      <div style={{ height: '400px' }}>
                        <BankingMetricsTrendChart
                          metrics={generateVariableStability(selectedBankingModel, dashboardData.latestMetrics[0]?.vintage || '2024-12')
                            .slice(0, 10)
                            .map((v, idx) => ({
                              model_id: selectedBankingModel,
                              portfolio: '',
                              model_type: '',
                              vintage: v.variable,
                              volume: 0,
                              metrics: { PSI: v.psi },
                              computed_at: '',
                            }))}
                          metricKey="PSI"
                          title="Top 10 Variables by PSI"
                          height={400}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className={`text-center py-12 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                <p className="text-lg">No banking models found. Please load sample data.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-lg p-6 max-w-md w-full mx-4 shadow-xl`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Export Report
              </h3>
              <button
                onClick={() => setShowExportModal(false)}
                className={`${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'}`}
              >
                <X size={24} />
              </button>
            </div>

            {/* Format Selection */}
            <div className="mb-6">
              <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Export Format
              </label>
              <div className="flex gap-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="format"
                    value="pdf"
                    checked={exportFormat === 'pdf'}
                    onChange={(e) => setExportFormat(e.target.value as 'pdf' | 'ppt')}
                    className="mr-2"
                  />
                  <FileText size={20} className="mr-1" />
                  <span className={isDark ? 'text-slate-200' : 'text-slate-800'}>PDF</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="format"
                    value="ppt"
                    checked={exportFormat === 'ppt'}
                    onChange={(e) => setExportFormat(e.target.value as 'pdf' | 'ppt')}
                    className="mr-2"
                  />
                  <Presentation size={20} className="mr-1" />
                  <span className={isDark ? 'text-slate-200' : 'text-slate-800'}>PowerPoint</span>
                </label>
              </div>
            </div>

            {/* Section Selection */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <label className={`block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Include Sections
                </label>
                <button
                  onClick={() => {
                    const allSelected = Object.values(exportSections).every(v => v);
                    setExportSections({
                      kpis: !allSelected,
                      ragStatus: !allSelected,
                      trends: !allSelected,
                      segments: !allSelected,
                      deciles: !allSelected,
                      variables: !allSelected,
                    });
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  {Object.values(exportSections).every(v => v) ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="space-y-2">
                {[
                  { key: 'kpis', label: 'Model KPIs' },
                  { key: 'ragStatus', label: 'RAG Status' },
                  { key: 'trends', label: 'Performance Trends' },
                  { key: 'segments', label: 'Segment Analysis' },
                  { key: 'deciles', label: 'Decile Analysis' },
                  { key: 'variables', label: 'Variable Stability' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportSections[key as keyof typeof exportSections]}
                      onChange={(e) => setExportSections(prev => ({
                        ...prev,
                        [key]: e.target.checked
                      }))}
                      className="mr-2"
                    />
                    <span className={isDark ? 'text-slate-200' : 'text-slate-800'}>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Export Button */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowExportModal(false)}
                className={`flex-1 px-4 py-2 rounded-lg ${
                  isDark 
                    ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' 
                    : 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!selectedBankingModel) return;
                  
                  setExporting(true);
                  try {
                    const selectedModel = bankingModels.find(m => m.model_id === selectedBankingModel);
                    const modelMetrics = bankingMetrics.filter(m => m.model_id === selectedBankingModel);
                    const latestVintage = [...new Set(bankingMetrics.map(m => m.vintage))].sort().reverse()[0];
                    const latestMetric = bankingMetrics.find(
                      m => m.model_id === selectedBankingModel && m.vintage === latestVintage
                    );

                    await exportDashboard({
                      format: exportFormat,
                      selectedModel: selectedModel || undefined,
                      modelMetrics,
                      latestMetric: latestMetric || undefined,
                      includeSections: exportSections,
                    });

                    // Show success notification
                    if (showNotification) {
                      showNotification('Report exported successfully!', 'success');
                    }
                    setShowExportModal(false);
                  } catch (error) {
                    console.error('Export failed:', error);
                    if (showNotification) {
                      showNotification('Export failed. Please try again.', 'error');
                    }
                  } finally {
                    setExporting(false);
                  }
                }}
                disabled={exporting || !Object.values(exportSections).some(v => v)}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {exporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <Download size={18} />
                    Export {exportFormat.toUpperCase()}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

