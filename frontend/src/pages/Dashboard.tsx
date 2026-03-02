import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useGlobal } from '../contexts/GlobalContext';
import { useNotification } from '../hooks/useNotification';
import { ChevronRight, Download, FileText, Presentation, X, CheckCircle, Filter, ChevronDown } from 'lucide-react';
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
import { VolumeVsBadRateChart } from '../components/charts/VolumeVsBadRateChart';
import { ChartCommentary, SectionComment } from '../components/ChartCommentary';
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
  generateQuarterlyVolumeData,
  generateScoreBandData,
  generateBaselineMetrics,
  calculateRAGStatus,
  type BankingMetrics,
} from '../utils/bankingMetricsMock';
import ROBChart from '../components/charts/ROBChart';
import ConfusionMatrixChart from '../components/charts/ConfusionMatrixChart';
import VariableLevelChart from '../components/charts/VariableLevelChart';
import { METRIC_DESCRIPTIONS, DEFAULT_SELECTED_METRICS } from '../utils/metricDescriptions';
import { exportDashboardToExcel } from '../utils/excelExport';

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
  const [exportSections, setExportSections] = useState({
    kpis: true,
    ragStatus: true,
    trends: true,
    segments: true,
    volumeBadRate: true,
    variables: true,
    includeComments: true,
  });
  const [chartComments, setChartComments] = useState<Record<string, SectionComment[]>>({});
  const [exporting, setExporting] = useState(false);

  // Multi-select metric dropdown
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(DEFAULT_SELECTED_METRICS);
  const [metricDropdownOpen, setMetricDropdownOpen] = useState(false);
  const [tooltipMetric, setTooltipMetric] = useState<string | null>(null);

  // Unified export modal
  const [exportTab, setExportTab] = useState<'pdf' | 'ppt' | 'excel'>('pdf');
  const [exportKPIs, setExportKPIs] = useState<string[]>(['KS', 'PSI', 'AUC', 'Gini', 'bad_rate', 'HRL']);

  const AVAILABLE_DASHBOARD_METRICS = [
    'KS', 'PSI', 'AUC', 'Gini', 'bad_rate', 'CA_at_10',
    'accuracy', 'precision', 'recall', 'f1_score', 'HRL', 'ROB', 'ConfusionMatrix',
  ];

  // Vintage range filter for trend charts
  const [selectedVintages, setSelectedVintages] = useState<string[]>([]);

  // Variable level analysis
  const [selectedVariable, setSelectedVariable] = useState<string>('');

  const [viewModes, setViewModes] = useState<{
    ragStatus: 'chart' | 'table';
    trends: 'chart' | 'table';
    segments: 'chart' | 'table';
    volumeBadRate: 'chart' | 'table';
    variables: 'chart' | 'table';
  }>({
    ragStatus: 'chart',
    trends: 'chart',
    segments: 'chart',
    volumeBadRate: 'chart',
    variables: 'table',
  });

  // Segment filter (Thin File / Thick File / All)
  const [selectedSegment, setSelectedSegment] = useState<'all' | 'thin_file' | 'thick_file'>('all');

  // Compare mode: baseline (Training) vs current (Monitoring)
  const [compareMode, setCompareMode] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<'training' | 'monitoring'>('monitoring');
  const [baselineDataset, setBaselineDataset] = useState<'training' | 'monitoring'>('training');
  const [currentDataset, setCurrentDataset] = useState<'training' | 'monitoring'>('monitoring');

  // Volume vs Bad Rate display toggle
  const [volumeDisplayMode, setVolumeDisplayMode] = useState<'quarterly' | 'scorebands'>('quarterly');

  // Restored filter bar state (portfolio, businessLine, modelType, model, timeWindow)
  const [filters, setFilters] = useState({
    portfolio: 'All',
    businessLine: 'All',
    modelType: 'All',
    model: 'All',
    timeWindow: 'Last 30 Days',
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

  // Load comments from localStorage when model changes
  useEffect(() => {
    if (!selectedBankingModel) return;
    const saved = localStorage.getItem(`dashboard_comments_${selectedBankingModel}`);
    if (saved) {
      try { setChartComments(JSON.parse(saved)); } catch { setChartComments({}); }
    } else {
      setChartComments({});
    }
  }, [selectedBankingModel]);

  // Persist comments to localStorage
  useEffect(() => {
    if (!selectedBankingModel) return;
    localStorage.setItem(`dashboard_comments_${selectedBankingModel}`, JSON.stringify(chartComments));
  }, [chartComments, selectedBankingModel]);

  const handleAddComment = (sectionId: string, comment: SectionComment) => {
    setChartComments(prev => ({ ...prev, [sectionId]: [...(prev[sectionId] ?? []), comment] }));
  };
  const handleDeleteComment = (sectionId: string, id: string) => {
    setChartComments(prev => ({ ...prev, [sectionId]: (prev[sectionId] ?? []).filter(c => c.id !== id) }));
  };

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
    filters,
  ]);

  // ─────────────────────────────────────────────────────
  // Segment-filtered metrics for the selected model
  // ─────────────────────────────────────────────────────
  const segmentFilteredMetrics = useMemo((): BankingMetrics[] => {
    if (!selectedBankingModel) return [];
    const allModelMetrics = bankingMetrics.filter(m => m.model_id === selectedBankingModel);
    if (selectedSegment === 'all') {
      const thinM = allModelMetrics.filter(m => m.segment === 'thin_file');
      const thickM = allModelMetrics.filter(m => m.segment === 'thick_file');
      const unseg = allModelMetrics.filter(m => !m.segment);
      if (thinM.length > 0 && thickM.length > 0) {
        const vintages = [...new Set(allModelMetrics.map(m => m.vintage))].sort();
        return vintages.map(vintage => {
          const thin = thinM.find(m => m.vintage === vintage);
          const thick = thickM.find(m => m.vintage === vintage);
          if (!thin && !thick) return null as any;
          if (!thin) return thick!;
          if (!thick) return thin!;
          const totalVol = thin.volume + thick.volume;
          const wt = thin.volume / totalVol;
          const wk = thick.volume / totalVol;
          const wavg = (a?: number, b?: number) =>
            a !== undefined && b !== undefined ? a * wt + b * wk : (a ?? b);
          return {
            ...thin,
            segment: undefined,
            volume: totalVol,
            metrics: {
              KS:        wavg(thin.metrics.KS,        thick.metrics.KS),
              PSI:       wavg(thin.metrics.PSI,       thick.metrics.PSI),
              AUC:       wavg(thin.metrics.AUC,       thick.metrics.AUC),
              Gini:      wavg(thin.metrics.Gini,      thick.metrics.Gini),
              bad_rate:  wavg(thin.metrics.bad_rate,  thick.metrics.bad_rate),
              CA_at_10:  wavg(thin.metrics.CA_at_10,  thick.metrics.CA_at_10),
              accuracy:  wavg(thin.metrics.accuracy,  thick.metrics.accuracy),
              precision: wavg(thin.metrics.precision, thick.metrics.precision),
              recall:    wavg(thin.metrics.recall,    thick.metrics.recall),
              f1_score:  wavg(thin.metrics.f1_score,  thick.metrics.f1_score),
              HRL:       wavg(thin.metrics.HRL,       thick.metrics.HRL),
            },
            rag_status: calculateRAGStatus(
              wavg(thin.metrics.KS, thick.metrics.KS),
              wavg(thin.metrics.PSI, thick.metrics.PSI)
            ),
          } as BankingMetrics;
        }).filter(Boolean);
      }
      return unseg.length > 0 ? unseg : allModelMetrics;
    }
    const filtered = allModelMetrics.filter(m => m.segment === selectedSegment);
    if (filtered.length > 0) return filtered;
    // Fallback: never mix segment types — return only unsegmented records
    const unsegmentedFallback = allModelMetrics.filter(m => !m.segment);
    return unsegmentedFallback.length > 0 ? unsegmentedFallback : [];
  }, [selectedBankingModel, bankingMetrics, selectedSegment, selectedDataset]);

  // Baseline (Training) metrics for compare mode
  const baselineFilteredMetrics = useMemo((): BankingMetrics[] => {
    if (!compareMode || !selectedBankingModel) return [];
    const selectedModel = bankingModels.find(m => m.model_id === selectedBankingModel);
    if (!selectedModel) return [];
    const seg = selectedSegment !== 'all' ? selectedSegment : undefined;
    return generateBaselineMetrics(selectedModel, seg);
  }, [compareMode, selectedBankingModel, selectedSegment, bankingModels]);

  /**
   * In single (non-compare) mode with dataset = 'training', use generated baseline
   * metrics so the trend charts actually reflect the selected dataset.
   * In monitoring mode (single or compare current), use segmentFilteredMetrics.
   */
  const currentModeMetrics = useMemo((): BankingMetrics[] => {
    if (!compareMode && selectedDataset === 'training') {
      const selectedModel = bankingModels.find(m => m.model_id === selectedBankingModel);
      if (!selectedModel) return [];
      const seg = selectedSegment !== 'all' ? selectedSegment : undefined;
      return generateBaselineMetrics(selectedModel, seg);
    }
    return segmentFilteredMetrics;
  }, [compareMode, selectedDataset, selectedBankingModel, selectedSegment, bankingModels, segmentFilteredMetrics]);

  // Per-segment raw metrics for dual-line "All" mode
  const thinFileRawMetrics = useMemo((): BankingMetrics[] => {
    if (!selectedBankingModel) return [];
    const filtered = bankingMetrics.filter(m => m.model_id === selectedBankingModel && m.segment === 'thin_file');
    console.log('🔍 Thin File Raw Metrics:', filtered.length, 'records for model', selectedBankingModel);
    return filtered;
  }, [bankingMetrics, selectedBankingModel]);

  const thickFileRawMetrics = useMemo((): BankingMetrics[] => {
    if (!selectedBankingModel) return [];
    const filtered = bankingMetrics.filter(m => m.model_id === selectedBankingModel && m.segment === 'thick_file');
    console.log('🔍 Thick File Raw Metrics:', filtered.length, 'records for model', selectedBankingModel);
    return filtered;
  }, [bankingMetrics, selectedBankingModel]);

  // Per-segment baseline metrics (for compare mode + dual-segment charts)
  const thinFileBaselineM = useMemo((): BankingMetrics[] => {
    if (!compareMode || !selectedBankingModel) return [];
    const model = bankingModels.find(m => m.model_id === selectedBankingModel);
    if (!model) return [];
    return generateBaselineMetrics(model, 'thin_file');
  }, [compareMode, selectedBankingModel, bankingModels]);

  const thickFileBaselineM = useMemo((): BankingMetrics[] => {
    if (!compareMode || !selectedBankingModel) return [];
    const model = bankingModels.find(m => m.model_id === selectedBankingModel);
    if (!model) return [];
    return generateBaselineMetrics(model, 'thick_file');
  }, [compareMode, selectedBankingModel, bankingModels]);

  // Check if the selected model has segment data
  const hasDualSegmentData = thinFileRawMetrics.length > 0 && thickFileRawMetrics.length > 0;
  const isDualSegmentMode = selectedSegment === 'all' && hasDualSegmentData;

  // Human-readable label for current segment selection (undefined when "All")
  const segmentLabel = selectedSegment === 'thin_file' ? 'Thin File'
    : selectedSegment === 'thick_file' ? 'Thick File'
    : undefined;

  // Log segment state for debugging
  useEffect(() => {
    console.log('📊 Segment State:', {
      selectedSegment,
      hasDualSegmentData,
      isDualSegmentMode,
      thinCount: thinFileRawMetrics.length,
      thickCount: thickFileRawMetrics.length,
    });
  }, [selectedSegment, hasDualSegmentData, isDualSegmentMode, thinFileRawMetrics.length, thickFileRawMetrics.length]);

  // When compare mode is activated, always default to "all segments" so we
  // show a clean Current vs Baseline 2-line comparison across all charts.
  useEffect(() => {
    if (compareMode) setSelectedSegment('all');
  }, [compareMode]);

  // Filter bar options (computed from available data)
  const filterOptions = {
    portfolio: ['All', ...Array.from(new Set(bankingModels.map((m) => m.portfolio)))],
    businessLine: ['All', 'Retail', 'Commercial', 'Digital', 'Cards', 'Mortgages'],
    modelType: ['All', 'Acquisition Scorecard', 'ECM Scorecard', 'Bureau', 'Collections', 'Fraud', 'ML'],
    model: ['All', ...registryModels.map((m) => m.name)],
    timeWindow: ['Last 7 Days', 'Last 30 Days', 'Last 90 Days', 'Year to Date'],
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
                  <label className={`text-sm font-medium whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Select Model:
                  </label>
                  <select
                    value={selectedBankingModel}
                    onChange={(e) => setSelectedBankingModel(e.target.value)}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium max-w-[280px] truncate ${
                      isDark
                        ? 'bg-slate-700 border-slate-600 text-white'
                        : 'bg-white border-slate-300 text-slate-900'
                    }`}
                    title={bankingModels.find(m => m.model_id === selectedBankingModel)?.name ?? ''}
                  >
                    {bankingModels.map((model) => {
                      const latestV = [...new Set(bankingMetrics.map(m => m.vintage))].sort().reverse()[0];
                      const latestMetric = bankingMetrics.find(
                        m => m.model_id === model.model_id && m.vintage === latestV
                      );
                      const ragBadge = latestMetric?.rag_status === 'green' ? '🟢'
                        : latestMetric?.rag_status === 'amber' ? '🟡'
                        : latestMetric?.rag_status === 'red' ? '🔴' : '';
                      const ver = (model as any).version ?? 'v1';
                      return (
                        <option key={model.model_id} value={model.model_id}>
                          {ragBadge} {model.name} – {model.model_id} – {ver} ({model.portfolio})
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
                onClick={() => { setExportTab('pdf'); setShowExportModal(true); }}
                disabled={!selectedBankingModel}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                title={!selectedBankingModel ? "Select a model to export" : "Export model report (PDF / PPT / Excel)"}
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
        {/* Filter Bar: Portfolio / Business Line / Model Type / Model / Time Window */}
        <div className={`p-4 rounded-lg border mb-4 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Filter size={15} className={isDark ? 'text-slate-400' : 'text-slate-500'} />
              <span className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Filters</span>
            </div>
            <div className={`h-5 w-px ${isDark ? 'bg-slate-600' : 'bg-slate-300'}`} />
            {(
              [
                { key: 'portfolio',    label: 'Portfolio',     opts: filterOptions.portfolio    },
                { key: 'businessLine', label: 'Business Line', opts: filterOptions.businessLine },
                { key: 'modelType',    label: 'Model Type',    opts: filterOptions.modelType    },
                { key: 'model',        label: 'Model',         opts: filterOptions.model        },
                { key: 'timeWindow',   label: 'Time Window',   opts: filterOptions.timeWindow   },
              ] as const
            ).map(({ key, label, opts }) => (
              <div key={key} className="flex items-center gap-1.5">
                <label className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{label}:</label>
                <select
                  value={filters[key]}
                  onChange={e => setFilters(prev => ({ ...prev, [key]: e.target.value }))}
                  className={`text-xs px-2 py-1.5 rounded border min-w-[110px] ${
                    isDark
                      ? 'bg-slate-700 border-slate-600 text-white'
                      : 'bg-white border-slate-300 text-slate-800'
                  }`}
                >
                  {opts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
            {/* Active filter chips & clear all */}
            {Object.entries(filters).some(([, v]) => v !== 'All' && v !== 'Last 30 Days') && (
              <button
                onClick={() => setFilters({ portfolio: 'All', businessLine: 'All', modelType: 'All', model: 'All', timeWindow: 'Last 30 Days' })}
                className={`ml-auto text-xs underline ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Controls Bar: Segment + Dataset / Compare Mode */}
        <div className={`p-4 rounded-lg border mb-6 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="flex flex-wrap items-center gap-6">
            {/* Segment Filter */}
            <div className="flex items-center gap-3">
              <span className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Segment:</span>
              <div className="flex gap-1">
                {(['all', 'thin_file', 'thick_file'] as const).map(seg => (
                  <button
                    key={seg}
                    onClick={() => setSelectedSegment(seg)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors relative ${
                      selectedSegment === seg
                        ? 'bg-blue-600 text-white'
                        : isDark
                          ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                    title={seg === 'all' && hasDualSegmentData ? 'Dual-segment mode: Shows Thin File & Thick File lines' : undefined}
                  >
                    {seg === 'all' ? 'All' : seg === 'thin_file' ? 'Thin File' : 'Thick File'}
                    {seg === 'all' && hasDualSegmentData && (
                      <span className={`ml-1.5 inline-block w-1.5 h-1.5 rounded-full ${selectedSegment === seg ? 'bg-white' : 'bg-green-500'}`} />
                    )}
                  </button>
                ))}
              </div>
              {hasDualSegmentData && isDualSegmentMode && (
                <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  (Showing both segments)
                </span>
              )}
            </div>

            {/* Divider */}
            <div className={`h-6 w-px ${isDark ? 'bg-slate-600' : 'bg-slate-300'}`} />

            {/* Compare Mode Toggle + Dataset Selectors */}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => setCompareMode(prev => !prev)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                  compareMode
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : isDark
                      ? 'border-slate-600 text-slate-300 hover:bg-slate-700'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                ⇄ Compare Mode {compareMode ? 'ON' : 'OFF'}
              </button>

              {compareMode ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1">
                    <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Baseline:</span>
                    <select
                      value={baselineDataset}
                      onChange={e => setBaselineDataset(e.target.value as 'training' | 'monitoring')}
                      className={`text-xs px-2 py-1 rounded border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                    >
                      <option value="training">Training</option>
                      <option value="monitoring">Monitoring</option>
                    </select>
                  </div>
                  <span className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>vs</span>
                  <div className="flex items-center gap-1">
                    <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Current:</span>
                    <select
                      value={currentDataset}
                      onChange={e => setCurrentDataset(e.target.value as 'training' | 'monitoring')}
                      className={`text-xs px-2 py-1 rounded border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                    >
                      <option value="training">Training</option>
                      <option value="monitoring">Monitoring</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Dataset:</span>
                  <select
                    value={selectedDataset}
                    onChange={e => setSelectedDataset(e.target.value as 'training' | 'monitoring')}
                    className={`text-xs px-2 py-1 rounded border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                  >
                    <option value="training">Training</option>
                    <option value="monitoring">Monitoring</option>
                  </select>
                </div>
              )}
            </div>

            {/* Active filter chips */}
            {(selectedSegment !== 'all' || compareMode) && (
              <div className="flex items-center gap-2 ml-auto flex-wrap">
                {selectedSegment !== 'all' && (
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${isDark ? 'bg-blue-900/40 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
                    {selectedSegment === 'thin_file' ? 'Thin File' : 'Thick File'}
                    <button onClick={() => setSelectedSegment('all')} className="ml-1 hover:opacity-70">×</button>
                  </span>
                )}
                {compareMode && (
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${isDark ? 'bg-indigo-900/40 text-indigo-300' : 'bg-indigo-50 text-indigo-700'}`}>
                    {baselineDataset.charAt(0).toUpperCase() + baselineDataset.slice(1)} vs {currentDataset.charAt(0).toUpperCase() + currentDataset.slice(1)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <SkeletonLoader count={6} isDark={isDark} variant="card" />
        ) : (
          <div className="space-y-8">
            {/* Model Metrics Section */}
            {bankingModels.length > 0 ? (
              <>
              <div className="space-y-6">
                {/* Model Summary Table */}
                <div className={`p-4 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                  <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    📊 Model Portfolio Overview
                  </h2>
                  {bankingModels.length > 0 ? (() => {
                    // Build one row per model using latest-vintage metrics (deduplicated)
                    const allVintages = [...new Set(bankingMetrics.map(m => m.vintage))].sort().reverse();
                    const portfolioRows = bankingModels.map(model => {
                      const modelMetrics = bankingMetrics.filter(m => m.model_id === model.model_id);
                      const latestVint = allVintages.find(v => modelMetrics.some(m => m.vintage === v));
                      const latestM = modelMetrics.find(m => m.vintage === latestVint);
                      return { model, metric: latestM };
                    }).filter(r => r.metric);

                    const getOtherMetric = (m: BankingMetrics) => {
                      if (m.metrics.CA_at_10 !== undefined) return `CA@10: ${m.metrics.CA_at_10.toFixed(3)}`;
                      if (m.metrics.fraud_detection_rate !== undefined) return `FDR: ${m.metrics.fraud_detection_rate.toFixed(3)}`;
                      if (m.metrics.recovery_rate !== undefined) return `RR: ${m.metrics.recovery_rate.toFixed(3)}`;
                      if (m.metrics.HRL !== undefined) return `HRL: ${m.metrics.HRL.toFixed(3)}`;
                      if (m.metrics.accuracy !== undefined) return `Acc: ${m.metrics.accuracy.toFixed(3)}`;
                      return '–';
                    };

                    return (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className={`${isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-700'}`}>
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Model ID</th>
                              <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Model Name</th>
                              <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Portfolio</th>
                              <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Type</th>
                              <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Latest Vintage</th>
                              <th className="px-3 py-2 text-right font-semibold">KS</th>
                              <th className="px-3 py-2 text-right font-semibold">PSI</th>
                              <th className="px-3 py-2 text-right font-semibold">AUC</th>
                              <th className="px-3 py-2 text-left font-semibold">Other</th>
                              <th className="px-3 py-2 text-center font-semibold">Status</th>
                              <th className="px-3 py-2 text-center font-semibold"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {portfolioRows.map(({ model, metric: m }, idx) => (
                              <tr
                                key={model.model_id}
                                className={`border-b ${isDark ? 'border-slate-700 hover:bg-slate-700/50' : 'border-slate-100 hover:bg-slate-50'} ${selectedBankingModel === model.model_id ? (isDark ? 'bg-blue-900/20' : 'bg-blue-50') : ''}`}
                              >
                                <td className={`px-3 py-2 font-mono text-xs font-semibold ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                                  {model.model_id}
                                </td>
                                <td className={`px-3 py-2 font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                  {model.name}
                                </td>
                                <td className={`px-3 py-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{m!.portfolio}</td>
                                <td className={`px-3 py-2 text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{m!.model_type}</td>
                                <td className={`px-3 py-2 font-mono text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{m!.vintage}</td>
                                <td className={`px-3 py-2 text-right font-mono font-semibold ${m!.metrics.KS !== undefined ? (m!.metrics.KS >= 0.35 ? 'text-green-500' : m!.metrics.KS >= 0.25 ? 'text-amber-500' : 'text-red-500') : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>
                                  {m!.metrics.KS?.toFixed(4) ?? '–'}
                                </td>
                                <td className={`px-3 py-2 text-right font-mono font-semibold ${m!.metrics.PSI !== undefined ? (m!.metrics.PSI < 0.10 ? 'text-green-500' : m!.metrics.PSI < 0.25 ? 'text-amber-500' : 'text-red-500') : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>
                                  {m!.metrics.PSI?.toFixed(4) ?? '–'}
                                </td>
                                <td className={`px-3 py-2 text-right font-mono font-semibold ${m!.metrics.AUC !== undefined ? (m!.metrics.AUC >= 0.75 ? 'text-green-500' : m!.metrics.AUC >= 0.65 ? 'text-amber-500' : 'text-red-500') : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>
                                  {m!.metrics.AUC?.toFixed(4) ?? '–'}
                                </td>
                                <td className={`px-3 py-2 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{getOtherMetric(m!)}</td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${m!.rag_status === 'green' ? 'bg-green-100 text-green-700' : m!.rag_status === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${m!.rag_status === 'green' ? 'bg-green-500' : m!.rag_status === 'amber' ? 'bg-amber-500' : 'bg-red-500'}`} />
                                    {m!.rag_status?.toUpperCase() ?? '—'}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <button
                                    onClick={() => {
                                      setSelectedBankingModel(model.model_id);
                                      setTimeout(() => document.getElementById('export-model-section')?.scrollIntoView({ behavior: 'smooth' }), 100);
                                    }}
                                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded font-medium"
                                  >
                                    Detail
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {portfolioRows.length === 0 && (
                          <div className={`text-center py-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            No model data available.
                          </div>
                        )}
                      </div>
                    );
                  })() : (
                    <div className={`text-center py-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      No models available. Import models via the Projects workflow.
                    </div>
                  )}
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
                  <ChartCommentary
                    sectionId="ragStatus"
                    sectionLabel="Portfolio RAG Status"
                    comments={chartComments['ragStatus'] ?? []}
                    onAdd={c => handleAddComment('ragStatus', c)}
                    onDelete={id => handleDeleteComment('ragStatus', id)}
                    isDark={isDark}
                  />
                </div>

                {/* Model Performance Analysis */}
                {selectedBankingModel && (() => {
                  const selectedModel = bankingModels.find(m => m.model_id === selectedBankingModel);
                  const modelMetrics = currentModeMetrics;
                  // Apply vintage range filter if user has selected specific vintages
                  const filteredByVintage = selectedVintages.length > 0
                    ? modelMetrics.filter(m => selectedVintages.includes(m.vintage))
                    : modelMetrics;
                  // Vintage-filtered per-segment series (for dual segment mode)
                  const thinFiltered = selectedVintages.length > 0
                    ? thinFileRawMetrics.filter(m => selectedVintages.includes(m.vintage))
                    : thinFileRawMetrics;
                  const thickFiltered = selectedVintages.length > 0
                    ? thickFileRawMetrics.filter(m => selectedVintages.includes(m.vintage))
                    : thickFileRawMetrics;
                  // Common props spread onto every BankingMetricsTrendChart in this section.
                  // In compare mode we ALWAYS render exactly 2 lines:
                  //   solid   = Current  (aggregated all-segment weighted average)
                  //   dashed  = Baseline (aggregated all-segment training baseline)
                  // Dual-segment (4-line) mode is only used when NOT in compare mode.
                  const showDual = !compareMode && isDualSegmentMode;
                  const cProps = {
                    metrics: compareMode ? filteredByVintage : (showDual ? [] : filteredByVintage),
                    thinFileMetrics: showDual ? thinFiltered : undefined,
                    thickFileMetrics: showDual ? thickFiltered : undefined,
                    thinFileBaselineMetrics: undefined,   // never in compare mode
                    thickFileBaselineMetrics: undefined,  // never in compare mode
                    baselineMetrics: compareMode && baselineFilteredMetrics.length > 0
                      ? baselineFilteredMetrics
                      : undefined,
                    segmentLabel,
                    currentLabel: compareMode ? 'Current (Monitoring)' : undefined,
                    baselineLabel: compareMode ? 'Baseline (Training)' : undefined,
                  };
                  const latestMetric = [...modelMetrics].sort((a, b) => b.vintage.localeCompare(a.vintage))[0];
                  
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
                        {latestMetric?.metrics.accuracy !== undefined && (
                          <div className={`p-3 rounded border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Accuracy</div>
                            <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{latestMetric.metrics.accuracy.toFixed(3)}</div>
                          </div>
                        )}
                        {latestMetric?.metrics.precision !== undefined && (
                          <div className={`p-3 rounded border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Precision</div>
                            <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{latestMetric.metrics.precision.toFixed(3)}</div>
                          </div>
                        )}
                        {latestMetric?.metrics.recall !== undefined && (
                          <div className={`p-3 rounded border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Recall</div>
                            <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{latestMetric.metrics.recall.toFixed(3)}</div>
                          </div>
                        )}
                        {latestMetric?.metrics.f1_score !== undefined && (
                          <div className={`p-3 rounded border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>F1 Score</div>
                            <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{latestMetric.metrics.f1_score.toFixed(3)}</div>
                          </div>
                        )}
                        {latestMetric?.metrics.HRL !== undefined && (
                          <div className={`p-3 rounded border ${isDark ? 'bg-teal-900/30 border-teal-700' : 'bg-teal-50 border-teal-200'}`}>
                            <div className={`text-xs font-medium ${isDark ? 'text-teal-300' : 'text-teal-700'}`}>HRL</div>
                            <div className={`text-lg font-bold ${latestMetric.metrics.HRL >= 0.70 ? 'text-green-500' : latestMetric.metrics.HRL >= 0.55 ? 'text-amber-500' : 'text-red-500'}`}>
                              {latestMetric.metrics.HRL.toFixed(3)}
                            </div>
                            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Hit Rate at Level</div>
                          </div>
                        )}
                      </div>

                      {/* Metric Selector + Trend Charts */}
                      <div className="mb-4">
                        {/* Vintage Range Selector */}
                        {(() => {
                          const availVintages = [...new Set(modelMetrics.map(m => m.vintage))].sort();
                          if (availVintages.length < 2) return null;
                          return (
                            <div className={`flex flex-wrap items-center gap-3 mb-3 p-2 rounded-lg border text-xs ${isDark ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                              <span className={`font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Vintage filter:</span>
                              <div className="flex gap-1 flex-wrap">
                                <button
                                  onClick={() => setSelectedVintages([])}
                                  className={`px-2 py-0.5 rounded-full font-medium ${selectedVintages.length === 0 ? 'bg-blue-600 text-white' : isDark ? 'bg-slate-600 text-slate-300 hover:bg-slate-500' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'}`}
                                >All</button>
                                {availVintages.map(v => (
                                  <button
                                    key={v}
                                    onClick={() => setSelectedVintages(prev =>
                                      prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]
                                    )}
                                    className={`px-2 py-0.5 rounded-full font-medium ${selectedVintages.includes(v) ? 'bg-blue-600 text-white' : isDark ? 'bg-slate-600 text-slate-300 hover:bg-slate-500' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'}`}
                                  >{v}</button>
                                ))}
                              </div>
                              {selectedVintages.length > 0 && (
                                <span className={`ml-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                  {selectedVintages.length} vintage{selectedVintages.length > 1 ? 's' : ''} selected
                                </span>
                              )}
                            </div>
                          );
                        })()}
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                          <h4 className={`text-md font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            Performance Trends Over Time
                          </h4>
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Multi-Select Metric Dropdown */}
                            <div className="relative">
                              <button
                                onClick={() => { setMetricDropdownOpen(v => !v); setTooltipMetric(null); }}
                                className={`px-3 py-1 rounded text-sm flex items-center gap-1.5 border ${isDark ? 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                              >
                                Select Metrics ({selectedMetrics.length})
                                <ChevronDown size={14} />
                              </button>
                              {metricDropdownOpen && (
                                <div className={`absolute right-0 top-full mt-1 z-30 w-80 rounded-lg border shadow-xl p-3 ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'}`}
                                  onMouseLeave={() => {}}>
                                  <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    Select metrics to display — click ? for details
                                  </p>
                                  <div className="space-y-1 max-h-52 overflow-y-auto mb-2">
                                    {AVAILABLE_DASHBOARD_METRICS.map(key => {
                                      const desc = METRIC_DESCRIPTIONS[key];
                                      return (
                                        <div key={key} className="flex items-center gap-1">
                                          <label className={`flex items-center gap-2 flex-1 cursor-pointer py-1 px-1.5 rounded ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}>
                                            <input
                                              type="checkbox"
                                              checked={selectedMetrics.includes(key)}
                                              onChange={() => setSelectedMetrics(prev =>
                                                prev.includes(key) ? prev.filter(m => m !== key) : [...prev, key]
                                              )}
                                              className="rounded"
                                            />
                                            <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{desc?.label ?? key}</span>
                                          </label>
                                          <button
                                            onClick={() => setTooltipMetric(tooltipMetric === key ? null : key)}
                                            className={`text-xs w-5 h-5 rounded-full border font-bold flex items-center justify-center flex-shrink-0 ${
                                              tooltipMetric === key
                                                ? 'bg-blue-600 text-white border-blue-600'
                                                : isDark ? 'border-slate-500 text-slate-400 hover:border-blue-400 hover:text-blue-400' : 'border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600'
                                            }`}
                                            title="View metric description"
                                          >?</button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  {tooltipMetric && METRIC_DESCRIPTIONS[tooltipMetric] && (
                                    <div className={`p-3 rounded-lg border text-xs ${isDark ? 'bg-slate-700/80 border-slate-600' : 'bg-blue-50 border-blue-200'}`}>
                                      <div className={`font-semibold mb-1 ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>{METRIC_DESCRIPTIONS[tooltipMetric].label}</div>
                                      <code className={`block text-xs mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{METRIC_DESCRIPTIONS[tooltipMetric].formula}</code>
                                      <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>{METRIC_DESCRIPTIONS[tooltipMetric].overview}</p>
                                      {METRIC_DESCRIPTIONS[tooltipMetric].thresholds && (
                                        <div className="mt-2 space-y-0.5">
                                          <div className="text-green-600">🟢 {METRIC_DESCRIPTIONS[tooltipMetric].thresholds!.green}</div>
                                          <div className="text-amber-600">🟡 {METRIC_DESCRIPTIONS[tooltipMetric].thresholds!.amber}</div>
                                          <div className="text-red-600">🔴 {METRIC_DESCRIPTIONS[tooltipMetric].thresholds!.red}</div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  <div className="flex gap-2 mt-2 pt-2 border-t border-slate-200">
                                    <button onClick={() => setSelectedMetrics(AVAILABLE_DASHBOARD_METRICS)} className="text-xs text-blue-600 hover:underline">All</button>
                                    <button onClick={() => setSelectedMetrics([])} className="text-xs text-slate-500 hover:underline">None</button>
                                    <button onClick={() => setSelectedMetrics(DEFAULT_SELECTED_METRICS)} className="text-xs text-slate-500 hover:underline">Default</button>
                                    <button onClick={() => setMetricDropdownOpen(false)} className="ml-auto text-xs text-slate-500 hover:underline">Close</button>
                                  </div>
                                </div>
                              )}
                            </div>
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
                            {([
                              { key: 'KS',        label: 'KS Statistic',           show: latestMetric?.metrics.KS !== undefined || isDualSegmentMode },
                              { key: 'PSI',       label: 'PSI (Stability)',         show: latestMetric?.metrics.PSI !== undefined || isDualSegmentMode },
                              { key: 'AUC',       label: 'AUC (Accuracy)',          show: latestMetric?.metrics.AUC !== undefined || isDualSegmentMode },
                              { key: 'Gini',      label: 'Gini Coefficient',        show: latestMetric?.metrics.Gini !== undefined },
                              { key: 'bad_rate',  label: 'Bad Rate',                show: latestMetric?.metrics.bad_rate !== undefined },
                              { key: 'CA_at_10',  label: 'Capture Rate @ 10%',     show: true },
                              { key: 'accuracy',  label: 'Accuracy',                show: true },
                              { key: 'precision', label: 'Precision',               show: true },
                              { key: 'recall',    label: 'Recall',                  show: true },
                              { key: 'f1_score',  label: 'F1 Score',                show: true },
                              { key: 'HRL',       label: 'Hit Rate at Level (HRL)', show: true, teal: true },
                            ] as const).filter(({ key, show }) => selectedMetrics.includes(key as string) && show)
                              .map(({ key, label, teal }: any) => (
                              <div key={key}>
                                <div className={`text-sm font-medium mb-2 ${
                                  teal
                                    ? (isDark ? 'text-teal-300' : 'text-teal-700')
                                    : (isDark ? 'text-slate-300' : 'text-slate-700')
                                }`}>{label}</div>
                                <BankingMetricsTrendChart {...cProps} metricKey={key} height={200} />
                              </div>
                            ))}
                            {selectedMetrics.length === 0 && (
                              <div className={`col-span-3 text-center py-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                No metrics selected. Use the "Select Metrics" dropdown above to choose which charts to display.
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
                      <ChartCommentary
                        sectionId="trends"
                        sectionLabel="Performance Trends"
                        comments={chartComments['trends'] ?? []}
                        onAdd={c => handleAddComment('trends', c)}
                        onDelete={id => handleDeleteComment('trends', id)}
                        isDark={isDark}
                      />

                      {/* ROB Chart */}
                      {selectedMetrics.includes('ROB') && (
                        <div className={`mt-6 p-4 rounded-lg border ${isDark ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                          <div className="flex items-center gap-2 mb-3">
                            <h4 className={`text-md font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              Risk-Ordered Band (ROB) Chart — Bad Rate vs Score Band
                            </h4>
                            <button
                              onClick={() => setTooltipMetric(tooltipMetric === 'ROB' ? null : 'ROB')}
                              className={`text-xs w-5 h-5 rounded-full border font-bold flex items-center justify-center flex-shrink-0 ${tooltipMetric === 'ROB' ? 'bg-blue-600 text-white border-blue-600' : isDark ? 'border-slate-500 text-slate-400 hover:border-blue-400 hover:text-blue-400' : 'border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600'}`}
                            >?</button>
                          </div>
                          {tooltipMetric === 'ROB' && (
                            <div className={`mb-4 p-3 rounded-lg border text-xs ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-blue-50 border-blue-200'}`}>
                              <p className={`font-semibold mb-1 ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>{METRIC_DESCRIPTIONS.ROB.label}</p>
                              <code className={`block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{METRIC_DESCRIPTIONS.ROB.formula}</code>
                              <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>{METRIC_DESCRIPTIONS.ROB.overview}</p>
                            </div>
                          )}
                          <ROBChart isDark={isDark} />
                        </div>
                      )}

                      {/* Confusion Matrix + Classification Metrics */}
                      {selectedMetrics.includes('ConfusionMatrix') && (
                        <div className={`mt-6 p-4 rounded-lg border ${isDark ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                          <div className="flex items-center gap-2 mb-3">
                            <h4 className={`text-md font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              Confusion Matrix &amp; Classification Metrics
                            </h4>
                            <button
                              onClick={() => setTooltipMetric(tooltipMetric === 'ConfusionMatrix' ? null : 'ConfusionMatrix')}
                              className={`text-xs w-5 h-5 rounded-full border font-bold flex items-center justify-center flex-shrink-0 ${tooltipMetric === 'ConfusionMatrix' ? 'bg-blue-600 text-white border-blue-600' : isDark ? 'border-slate-500 text-slate-400 hover:border-blue-400 hover:text-blue-400' : 'border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600'}`}
                            >?</button>
                          </div>
                          {tooltipMetric === 'ConfusionMatrix' && (
                            <div className={`mb-4 p-3 rounded-lg border text-xs ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-blue-50 border-blue-200'}`}>
                              <p className={`font-semibold mb-1 ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>{METRIC_DESCRIPTIONS.ConfusionMatrix.label}</p>
                              <code className={`block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{METRIC_DESCRIPTIONS.ConfusionMatrix.formula}</code>
                              <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>{METRIC_DESCRIPTIONS.ConfusionMatrix.overview}</p>
                            </div>
                          )}
                          <ConfusionMatrixChart latestMetric={latestMetric} isDark={isDark} />
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Segment & Volume vs Bad Rate Analysis */}
                {selectedBankingModel && (() => {
                  const vintage = dashboardData.latestMetrics[0]?.vintage || '2024-12';
                  const currentDatasetType = compareMode ? currentDataset : selectedDataset;

                  // Segment data
                  const segmentData = generateSegmentMetrics(selectedBankingModel, vintage, currentDatasetType);
                  const baselineSegDataForChart = compareMode
                    ? generateSegmentMetrics(selectedBankingModel, vintage, baselineDataset)
                    : undefined;

                  // Volume vs Bad Rate data
                  const rawVol = volumeDisplayMode === 'quarterly'
                    ? generateQuarterlyVolumeData(selectedBankingModel, selectedSegment, currentDatasetType)
                    : generateScoreBandData(selectedBankingModel, selectedSegment, currentDatasetType);
                  const volumeData = rawVol.map(d => ({
                    label: volumeDisplayMode === 'quarterly' ? (d as any).quarter : (d as any).shortLabel,
                    volume: d.volume,
                    badRate: d.badRate,
                  }));

                  const rawBaseVol = compareMode
                    ? (volumeDisplayMode === 'quarterly'
                        ? generateQuarterlyVolumeData(selectedBankingModel, selectedSegment, baselineDataset)
                        : generateScoreBandData(selectedBankingModel, selectedSegment, baselineDataset))
                    : undefined;
                  const baselineVolumeData = rawBaseVol?.map(d => ({
                    label: volumeDisplayMode === 'quarterly' ? (d as any).quarter : (d as any).shortLabel,
                    volume: d.volume,
                    badRate: d.badRate,
                  }));

                  // Per-segment volume data for "All" dual-segment mode
                  const mapVol = (raw: typeof rawVol) => raw.map(d => ({
                    label: volumeDisplayMode === 'quarterly' ? (d as any).quarter : (d as any).shortLabel,
                    volume: d.volume,
                    badRate: d.badRate,
                  }));
                  const thinFileVolumeData = selectedSegment === 'all'
                    ? mapVol(volumeDisplayMode === 'quarterly'
                        ? generateQuarterlyVolumeData(selectedBankingModel, 'thin_file', currentDatasetType)
                        : generateScoreBandData(selectedBankingModel, 'thin_file', currentDatasetType))
                    : undefined;
                  const thickFileVolumeData = selectedSegment === 'all'
                    ? mapVol(volumeDisplayMode === 'quarterly'
                        ? generateQuarterlyVolumeData(selectedBankingModel, 'thick_file', currentDatasetType)
                        : generateScoreBandData(selectedBankingModel, 'thick_file', currentDatasetType))
                    : undefined;

                  // Baseline per-segment volume data for All+compare mode
                  const thinFileBaselineVolData = (compareMode && selectedSegment === 'all')
                    ? mapVol(volumeDisplayMode === 'quarterly'
                        ? generateQuarterlyVolumeData(selectedBankingModel, 'thin_file', baselineDataset)
                        : generateScoreBandData(selectedBankingModel, 'thin_file', baselineDataset))
                    : undefined;
                  const thickFileBaselineVolData = (compareMode && selectedSegment === 'all')
                    ? mapVol(volumeDisplayMode === 'quarterly'
                        ? generateQuarterlyVolumeData(selectedBankingModel, 'thick_file', baselineDataset)
                        : generateScoreBandData(selectedBankingModel, 'thick_file', baselineDataset))
                    : undefined;

                  return (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Segment Comparison */}
                      <div id="export-segments" className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            Segment Comparison
                            {compareMode && <span className={`ml-2 text-xs font-normal px-2 py-0.5 rounded-full ${isDark ? 'bg-indigo-900/40 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}>Compare Mode</span>}
                          </h3>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setViewModes({...viewModes, segments: 'chart'})}
                              className={`px-3 py-1 rounded text-sm ${
                                viewModes.segments === 'chart'
                                  ? 'bg-blue-600 text-white'
                                  : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
                              }`}
                            >Chart</button>
                            <button
                              onClick={() => setViewModes({...viewModes, segments: 'table'})}
                              className={`px-3 py-1 rounded text-sm ${
                                viewModes.segments === 'table'
                                  ? 'bg-blue-600 text-white'
                                  : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
                              }`}
                            >Table</button>
                          </div>
                        </div>

                        {viewModes.segments === 'chart' ? (
                          <div style={{ height: '300px' }}>
                            <SegmentComparisonChart
                              segmentData={segmentData}
                              activeSegment={selectedSegment}
                              baselineSegmentData={baselineSegDataForChart}
                              segmentLabel={segmentLabel}
                            />
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
                                {(selectedSegment === 'all' ? segmentData.segments : segmentData.segments.filter(s => s.segment === selectedSegment)).map((seg, idx) => (
                                  <tr key={idx} className={isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}>
                                    <td className={`px-3 py-2 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{seg.label}</td>
                                    <td className={`px-3 py-2 text-right ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{seg.volume.toLocaleString()}</td>
                                    <td className={`px-3 py-2 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{seg.metrics.KS?.toFixed(3) || '-'}</td>
                                    <td className={`px-3 py-2 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{seg.metrics.PSI?.toFixed(3) || '-'}</td>
                                    <td className={`px-3 py-2 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{seg.metrics.AUC?.toFixed(3) || '-'}</td>
                                    <td className={`px-3 py-2 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{seg.metrics.bad_rate ? (seg.metrics.bad_rate * 100).toFixed(2) + '%' : '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      <ChartCommentary
                        sectionId="segments"
                        sectionLabel="Segment Comparison"
                        comments={chartComments['segments'] ?? []}
                        onAdd={c => handleAddComment('segments', c)}
                        onDelete={id => handleDeleteComment('segments', id)}
                        isDark={isDark}
                      />
                      </div>

                      {/* Volume vs Bad Rate */}
                      <div id="export-volumeBadRate" className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              Volume vs Bad Rate
                              {compareMode && <span className={`ml-2 text-xs font-normal px-2 py-0.5 rounded-full ${isDark ? 'bg-indigo-900/40 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}>Compare Mode</span>}
                            </h3>
                            {/* Display mode: Quarterly / Score Bands */}
                            <div className="flex gap-1 mt-1">
                              {(['quarterly', 'scorebands'] as const).map(mode => (
                                <button
                                  key={mode}
                                  onClick={() => setVolumeDisplayMode(mode)}
                                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                                    volumeDisplayMode === mode
                                      ? 'bg-blue-600 text-white'
                                      : isDark ? 'bg-slate-700 text-slate-400 hover:bg-slate-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                  }`}
                                >
                                  {mode === 'quarterly' ? 'Quarterly' : 'Score Bands'}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setViewModes({...viewModes, volumeBadRate: 'chart'})}
                              className={`px-3 py-1 rounded text-sm ${
                                viewModes.volumeBadRate === 'chart'
                                  ? 'bg-blue-600 text-white'
                                  : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
                              }`}
                            >Chart</button>
                            <button
                              onClick={() => setViewModes({...viewModes, volumeBadRate: 'table'})}
                              className={`px-3 py-1 rounded text-sm ${
                                viewModes.volumeBadRate === 'table'
                                  ? 'bg-blue-600 text-white'
                                  : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
                              }`}
                            >Table</button>
                          </div>
                        </div>

                        {viewModes.volumeBadRate === 'chart' ? (
                          <VolumeVsBadRateChart
                            data={volumeData}
                            baselineData={compareMode ? baselineVolumeData : undefined}
                            height={300}
                            thinFileData={thinFileVolumeData}
                            thickFileData={thickFileVolumeData}
                            thinFileBaselineData={thinFileBaselineVolData}
                            thickFileBaselineData={thickFileBaselineVolData}
                            segmentLabel={segmentLabel}
                          />
                        ) : (
                          <div className="overflow-auto max-h-[400px]">
                            <table className="w-full text-sm">
                              <thead className={`sticky top-0 ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                                <tr>
                                  <th className={`px-3 py-2 text-left font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                                    {volumeDisplayMode === 'quarterly' ? 'Quarter' : 'Band'}
                                  </th>
                                  {compareMode && <th className={`px-3 py-2 text-right font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Baseline Vol.</th>}
                                  <th className={`px-3 py-2 text-right font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Volume</th>
                                  {compareMode && <th className={`px-3 py-2 text-right font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Baseline Bad Rate</th>}
                                  <th className={`px-3 py-2 text-right font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Bad Rate</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {volumeData.map((row, idx) => {
                                  const blRow = baselineVolumeData?.[idx];
                                  return (
                                    <tr key={idx} className={isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}>
                                      <td className={`px-3 py-2 font-medium ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{row.label}</td>
                                      {compareMode && <td className={`px-3 py-2 text-right ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{blRow?.volume.toLocaleString() ?? '-'}</td>}
                                      <td className={`px-3 py-2 text-right ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{row.volume.toLocaleString()}</td>
                                      {compareMode && <td className={`px-3 py-2 text-right font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{blRow ? (blRow.badRate * 100).toFixed(2) + '%' : '-'}</td>}
                                      <td className={`px-3 py-2 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{(row.badRate * 100).toFixed(2)}%</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      <ChartCommentary
                        sectionId="volumeBadRate"
                        sectionLabel="Volume vs Bad Rate"
                        comments={chartComments['volumeBadRate'] ?? []}
                        onAdd={c => handleAddComment('volumeBadRate', c)}
                        onDelete={id => handleDeleteComment('volumeBadRate', id)}
                        isDark={isDark}
                      />
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
                        variables={generateVariableStability(
                          selectedBankingModel,
                          dashboardData.latestMetrics[0]?.vintage || '2024-12',
                          compareMode ? currentDataset : selectedDataset
                        )}
                        baselineVariables={compareMode
                          ? generateVariableStability(
                              selectedBankingModel,
                              dashboardData.latestMetrics[0]?.vintage || '2024-12',
                              baselineDataset
                            )
                          : undefined
                        }
                        maxRows={15}
                        segmentLabel={segmentLabel}
                      />
                    ) : (
                      <div style={{ height: '400px' }}>
                        {(() => {
                          const latestVintage = dashboardData.latestMetrics[0]?.vintage || '2024-12';
                          const mapVarToMetrics = (vars: ReturnType<typeof generateVariableStability>) =>
                            vars.slice(0, 10).map((v) => ({
                              model_id: selectedBankingModel,
                              portfolio: '',
                              model_type: '',
                              vintage: v.variable,
                              volume: 0,
                              metrics: { PSI: v.psi },
                              computed_at: '',
                            }));
                          return (
                            <BankingMetricsTrendChart
                              metrics={mapVarToMetrics(generateVariableStability(
                                selectedBankingModel, latestVintage,
                                compareMode ? currentDataset : selectedDataset
                              ))}
                              metricKey="PSI"
                              title="Top 10 Variables by PSI"
                              height={400}
                              segmentLabel={segmentLabel}
                              currentLabel={compareMode ? `Current PSI (${currentDataset})` : undefined}
                              baselineLabel={compareMode ? `Baseline PSI (${baselineDataset})` : undefined}
                              baselineMetrics={compareMode
                                ? mapVarToMetrics(generateVariableStability(
                                    selectedBankingModel, latestVintage, baselineDataset
                                  ))
                                : undefined}
                            />
                          );
                        })()}
                      </div>
                    )}
                    <ChartCommentary
                      sectionId="variables"
                      sectionLabel="Variable Stability"
                      comments={chartComments['variables'] ?? []}
                      onAdd={c => handleAddComment('variables', c)}
                      onDelete={id => handleDeleteComment('variables', id)}
                      isDark={isDark}
                    />
                  </div>
                )}
              </div>

              {/* Variable Level Analysis */}
              {selectedBankingModel && (
                <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      🔍 Variable Level Analysis
                    </h3>
                    <span className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                      Distribution shift &amp; PSI trend per variable
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mb-5">
                    <label className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Select Variable:</label>
                    <select
                      value={selectedVariable}
                      onChange={e => setSelectedVariable(e.target.value)}
                      className={`px-3 py-1.5 rounded border text-sm ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                    >
                      <option value="">— choose a variable —</option>
                      {generateVariableStability(
                        selectedBankingModel,
                        dashboardData.latestMetrics[0]?.vintage || '2024-12',
                        selectedDataset
                      ).map(v => (
                        <option key={v.variable} value={v.variable}>{v.variable}</option>
                      ))}
                    </select>
                  </div>
                  {selectedVariable ? (
                    <VariableLevelChart
                      modelId={selectedBankingModel}
                      variable={selectedVariable}
                      vintage={dashboardData.latestMetrics[0]?.vintage || '2024-12'}
                      isDark={isDark}
                    />
                  ) : (
                    <div className={`text-center py-10 rounded-lg border-2 border-dashed ${isDark ? 'border-slate-600 text-slate-400' : 'border-slate-300 text-slate-500'}`}>
                      Select a variable above to view its distribution comparison and PSI trend.
                    </div>
                  )}
                </div>
              )}
              </>
            ) : (
              <div className={`text-center py-12 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                <p className="text-lg">No banking models found. Please load sample data.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== Unified Export Modal (PDF | PowerPoint | Excel) ===== */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-lg p-6 max-w-lg w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto`}>
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Export Report</h3>
              <button onClick={() => setShowExportModal(false)} className={isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'}>
                <X size={24} />
              </button>
            </div>
            {/* 3-Tab selector: PDF | PowerPoint | Excel */}
            <div className={`flex border-b mb-5 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              {([
                { id: 'pdf',   label: '📄 PDF',        icon: <FileText size={15} className="mr-1" /> },
                { id: 'ppt',   label: '📊 PowerPoint', icon: <Presentation size={15} className="mr-1" /> },
                { id: 'excel', label: '📗 Excel',       icon: <Download size={15} className="mr-1" /> },
              ] as const).map(t => (
                <button
                  key={t.id}
                  onClick={() => setExportTab(t.id)}
                  className={`flex items-center px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    exportTab === t.id
                      ? 'border-blue-600 text-blue-600'
                      : `border-transparent ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'}`
                  }`}
                >
                  {t.icon}{t.label.replace(/^[^ ]+ /, '')}
                </button>
              ))}
            </div>

            {/* Model name context */}
            <p className={`text-sm mb-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Exporting report for <strong>{bankingModels.find(m => m.model_id === selectedBankingModel)?.name || '—'}</strong>
              {exportTab === 'excel' ? ' (data tables as workbook sheets)' : ''}.
            </p>

            {/* Section Selection */}
            <div className="mb-5">
              <div className="flex justify-between items-center mb-2">
                <label className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Include Sections</label>
                <button
                  onClick={() => {
                    const keys = ['kpis', 'ragStatus', 'trends', 'segments', 'volumeBadRate', 'variables'] as const;
                    const allOn = keys.every(k => exportSections[k]);
                    setExportSections(prev => ({ ...prev, kpis: !allOn, ragStatus: !allOn, trends: !allOn, segments: !allOn, volumeBadRate: !allOn, variables: !allOn }));
                  }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {(['kpis','ragStatus','trends','segments','volumeBadRate','variables'] as const).every(k => exportSections[k]) ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {([
                  { key: 'kpis',         label: 'Model KPIs' },
                  { key: 'ragStatus',    label: 'RAG Status' },
                  { key: 'trends',       label: 'Performance Trends' },
                  { key: 'segments',     label: 'Segment Analysis' },
                  { key: 'volumeBadRate',label: 'Volume vs Bad Rate' },
                  { key: 'variables',    label: 'Variable Stability' },
                ] as const).map(({ key, label }) => (
                  <label key={key} className={`flex items-center gap-2 cursor-pointer py-1 px-2 rounded ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}>
                    <input type="checkbox" checked={exportSections[key]} onChange={e => setExportSections(prev => ({ ...prev, [key]: e.target.checked }))} className="rounded" />
                    <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{label}</span>
                  </label>
                ))}
              </div>
              <label className={`flex items-center gap-2 cursor-pointer py-1 px-2 rounded mt-1 ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}>
                <input type="checkbox" checked={exportSections.includeComments} onChange={e => setExportSections(prev => ({ ...prev, includeComments: e.target.checked }))} className="rounded" />
                <span className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Include Commentary</span>
              </label>
            </div>

            {/* KPI / Metric Selection */}
            <div className="mb-5">
              <div className="flex justify-between items-center mb-2">
                <label className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Select Metrics</label>
                <div className="flex gap-3">
                  <button onClick={() => setExportKPIs(AVAILABLE_DASHBOARD_METRICS.filter(k => !['ROB','ConfusionMatrix'].includes(k)))} className="text-xs text-blue-600 hover:underline">All</button>
                  <button onClick={() => setExportKPIs([])} className="text-xs text-slate-500 hover:underline">None</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1 max-h-44 overflow-y-auto">
                {AVAILABLE_DASHBOARD_METRICS.map(key => (
                  <label key={key} className={`flex items-center gap-2 cursor-pointer py-1 px-2 rounded ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}>
                    <input
                      type="checkbox"
                      checked={exportKPIs.includes(key)}
                      onChange={() => setExportKPIs(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])}
                      className="rounded"
                    />
                    <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{METRIC_DESCRIPTIONS[key]?.label ?? key}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowExportModal(false)}
                className={`flex-1 px-4 py-2 rounded-lg ${isDark ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' : 'bg-slate-200 text-slate-800 hover:bg-slate-300'}`}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!selectedBankingModel) return;
                  if (exportTab === 'excel') {
                    const model = bankingModels.find(m => m.model_id === selectedBankingModel);
                    if (!model) return;
                    setExporting(true);
                    try {
                      const latestVintage = [...new Set(bankingMetrics.map(m => m.vintage))].sort().reverse()[0];
                      const latestM = segmentFilteredMetrics.find(m => m.vintage === latestVintage) ?? bankingMetrics.find(m => m.model_id === selectedBankingModel && m.vintage === latestVintage);
                      const allModelMetrics = bankingMetrics.filter(m => m.model_id === selectedBankingModel);
                      // Capture chart DOM sections as PNGs for embedding in the workbook
                      const captureChart = async (id: string): Promise<string | undefined> => {
                        try {
                          const el = document.getElementById(id);
                          if (!el) return undefined;
                          const h2c = (await import('html2canvas')).default;
                          const canvas = await h2c(el, { backgroundColor: '#ffffff', scale: 1.5, useCORS: true });
                          return canvas.toDataURL('image/png', 0.9);
                        } catch { return undefined; }
                      };
                      const [trendsImg, segImg, volImg, varImg] = await Promise.all([
                        captureChart('export-trends'),
                        captureChart('export-segments'),
                        captureChart('export-volumeBadRate'),
                        captureChart('export-variables'),
                      ]);
                      await exportDashboardToExcel({
                        model,
                        allMetrics: allModelMetrics,
                        latestMetric: latestM,
                        selectedKPIs: exportKPIs,
                        modelVersion: (model as any).version,
                        baselineMetrics: baselineFilteredMetrics.length > 0 ? baselineFilteredMetrics : undefined,
                        chartImages: { trends: trendsImg, segments: segImg, volumeBadRate: volImg, variables: varImg },
                      });
                      showNotification('Excel report downloaded!', 'success');
                      setShowExportModal(false);
                    } catch (err) {
                      console.error('Excel export failed:', err);
                      showNotification('Excel export failed. Please try again.', 'error');
                    } finally {
                      setExporting(false);
                    }
                  } else {
                    setExporting(true);
                    try {
                      const selectedModel = bankingModels.find(m => m.model_id === selectedBankingModel);
                      const latestVintage = [...new Set(bankingMetrics.map(m => m.vintage))].sort().reverse()[0];
                      const latestMetric = segmentFilteredMetrics.find(m => m.vintage === latestVintage) ?? bankingMetrics.find(m => m.model_id === selectedBankingModel && m.vintage === latestVintage);
                      await exportDashboard({
                        format: exportTab as 'pdf' | 'ppt',
                        selectedModel: selectedModel || undefined,
                        modelMetrics: segmentFilteredMetrics,
                        latestMetric: latestMetric || undefined,
                        includeSections: exportSections,
                        comments: chartComments,
                        includeComments: exportSections.includeComments,
                        selectedKPIs: exportKPIs,
                      });
                      showNotification('Report exported successfully!', 'success');
                      setShowExportModal(false);
                    } catch (err) {
                      console.error('Export failed:', err);
                      showNotification('Export failed. Please try again.', 'error');
                    } finally {
                      setExporting(false);
                    }
                  }
                }}
                disabled={exporting || exportKPIs.length === 0}
                className={`flex-1 px-4 py-2 rounded-lg text-white flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed ${
                  exportTab === 'excel' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {exporting ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />Generating…</>
                ) : (
                  <><Download size={18} />Export {exportTab === 'excel' ? '.xlsx' : exportTab.toUpperCase()}</>
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

