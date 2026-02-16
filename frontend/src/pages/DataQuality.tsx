import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Beaker,
  Brain,
  CheckCircle,
  CheckCircle2,
  Database,
  Download,
  Filter,
  Shield,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useGlobal } from '../contexts/GlobalContext';
import { generateDataQualityPDF } from '../utils/pdfGenerator';
import { createWorkflowLogEntry } from '../utils/workflowLogger';

interface DataQualityMetrics {
  missingValueStats: Array<{
    variable: string;
    type: string;
    missing: number;
    missingPercent: number;
  }>;
  statisticalSummary: Array<{
    variable: string;
    mean: number;
    std: number;
    min: number;
    p25: number;
    p50: number;
    p75: number;
    max: number;
  }>;
  categoricalDistributions: Array<{
    variable: string;
    categories: number;
    topCategory: string;
    topPercent: number;
  }>;
  outlierDetection: Array<{
    variable: string;
    outlierCount: number;
    outlierPercent: number;
    lowerBound: number;
    upperBound: number;
  }>;
  scoreReplication: {
    rmse: number;
    maxDiff: number;
    meanDiff: number;
    correlation: number;
  };
  volumeMetrics: Array<{
    segment: string;
    count: number;
    eventRate: number;
    baselineEventRate: number;
    delta: number;
  }>;
}

interface TreatmentRecommendation {
  variable: string;
  issue: string;
  severity: 'high' | 'medium' | 'low';
  recommendations: Array<{
    id: string;
    method: string;
    description: string;
    impact: string;
  }>;
  selected?: string;
}

const DataQuality: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const {
    projects = [],
    registryModels = [],
    ingestionJobs = [],
    reportConfigurations = [],
    createGeneratedReport,
    createReportConfiguration,
    cloneDatasetAsResolved,
    createWorkflowLog,
  } = useGlobal();

  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedModelId, setSelectedModelId] = useState('');
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'missing' | 'distributions' | 'outliers' | 'replication' | 'volume' | 'ai-treatment'>('overview');
  const [metricsMap, setMetricsMap] = useState<Record<string, any>>({});
  const [currentAnalyzingDataset, setCurrentAnalyzingDataset] = useState('');
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [currentResolvingIndex, setCurrentResolvingIndex] = useState(-1);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [lockWorkflow, setLockWorkflow] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<TreatmentRecommendation[]>([]);
  const [applyingTreatment, setApplyingTreatment] = useState(false);

  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const projectModels = useMemo(() => {
    // Include models that are either:
    // 1. Specifically assigned to this project, OR
    // 2. Have no projectId (unassigned, available to all projects)
    return registryModels.filter(model => 
      model.projectId === selectedProjectId || 
      !model.projectId || 
      model.projectId === ''
    );
  }, [registryModels, selectedProjectId]);

  useEffect(() => {
    if (projectModels.length === 0) {
      setSelectedModelId('');
      return;
    }
    if (!selectedModelId || !projectModels.some(model => model.id === selectedModelId)) {
      setSelectedModelId(projectModels[0].id);
    }
  }, [projectModels, selectedModelId]);

  const allDatasets = useMemo(() => {
    return ingestionJobs.filter(job =>
      job.projectId === selectedProjectId &&
      job.modelId === selectedModelId &&
      job.status === 'completed'
    );
  }, [ingestionJobs, selectedProjectId, selectedModelId]);

  useEffect(() => {
    if (allDatasets.length === 0) {
      setSelectedDatasetId(null);
      return;
    }
    if (!selectedDatasetId || !allDatasets.some(d => d.id === selectedDatasetId)) {
      setSelectedDatasetId(allDatasets[0].id);
    }
  }, [allDatasets, selectedDatasetId]);

  const selectedModel = projectModels.find(model => model.id === selectedModelId);
  const selectedDataset = selectedDatasetId
    ? allDatasets.find(d => d.id === selectedDatasetId)
    : allDatasets[0];

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'missing', label: 'Missing Values', icon: AlertTriangle },
    { id: 'distributions', label: 'Distributions', icon: BarChart3 },
    { id: 'outliers', label: 'Outliers', icon: Filter },
    { id: 'replication', label: 'Replication', icon: TrendingUp },
    { id: 'volume', label: 'Volume', icon: Shield },
    { id: 'ai-treatment', label: 'AI Treatment', icon: Brain },
  ];

  const getColumnsFromDataset = (dataset: any) => {
    if (dataset?.outputColumns && Array.isArray(dataset.outputColumns) && dataset.outputColumns.length > 0) {
      return dataset.outputColumns;
    }
    if (dataset?.schema && Array.isArray(dataset.schema)) {
      return dataset.schema.map((col: any, idx: number) => col.name || col.label || `Column_${idx + 1}`);
    }
    if (dataset?.columns && typeof dataset.columns === 'number' && dataset.columns > 0) {
      return Array.from({ length: dataset.columns }, (_, i) => `Column_${i + 1}`);
    }
    return ['Variable_1', 'Variable_2', 'Variable_3', 'Variable_4'];
  };

  const getComprehensiveMetrics = (dataset: any): DataQualityMetrics => {
    const columns = getColumnsFromDataset(dataset);
    const numericColumns = columns.slice(0, Math.min(3, columns.length));
    const categoricalColumns = columns.slice(Math.min(3, columns.length), Math.min(6, columns.length));

    const missingValueStats = columns.slice(0, Math.min(4, columns.length)).map((col: string, idx: number) => {
      const isNumeric = idx < 3;
      return {
        variable: col,
        type: isNumeric ? 'numeric' : 'categorical',
        missing: Math.floor((dataset.rows || 1000) * (0.01 + idx * 0.005)),
        missingPercent: 1.0 + idx * 0.5,
      };
    });

    const statisticalSummary = numericColumns.map((col: string, idx: number) => {
      const baseValue = 100 + idx * 500;
      return {
        variable: col,
        mean: baseValue,
        std: baseValue * 0.25,
        min: baseValue * 0.1,
        p25: baseValue * 0.7,
        p50: baseValue,
        p75: baseValue * 1.3,
        max: baseValue * 2.5,
      };
    });

    const categoricalDistributions = categoricalColumns.map((col: string, idx: number) => ({
      variable: col,
      categories: 3 + idx * 2,
      topCategory: `Category_${idx + 1}`,
      topPercent: 40 + idx * 10,
    }));

    const outlierDetection = numericColumns.map((col: string, idx: number) => {
      const baseValue = 100 + idx * 500;
      return {
        variable: col,
        outlierCount: Math.floor((dataset.rows || 1000) * (0.006 + idx * 0.004)),
        outlierPercent: 0.6 + idx * 0.4,
        lowerBound: baseValue * 0.1,
        upperBound: baseValue * 2.5,
      };
    });

    return {
      missingValueStats,
      statisticalSummary,
      categoricalDistributions,
      outlierDetection,
      scoreReplication: {
        rmse: 0.0012,
        maxDiff: 0.0045,
        meanDiff: 0.0003,
        correlation: 0.9987,
      },
      volumeMetrics: [
        { segment: 'Q1 2024', count: Math.floor((dataset.rows || 1000) * 0.25), eventRate: 3.2, baselineEventRate: 3.0, delta: 0.2 },
        { segment: 'Q2 2024', count: Math.floor((dataset.rows || 1000) * 0.28), eventRate: 3.5, baselineEventRate: 3.0, delta: 0.5 },
        { segment: 'Q3 2024', count: Math.floor((dataset.rows || 1000) * 0.26), eventRate: 2.8, baselineEventRate: 3.0, delta: -0.2 },
        { segment: 'Q4 2024', count: Math.floor((dataset.rows || 1000) * 0.27), eventRate: 3.1, baselineEventRate: 3.0, delta: 0.1 },
      ],
    };
  };

  const metrics = selectedDataset ? getComprehensiveMetrics(selectedDataset) : null;

  const analyzeAllDatasets = async () => {
    if (allDatasets.length === 0) return;

    setLoading(true);
    setMetricsMap({});

    for (const dataset of allDatasets) {
      setCurrentAnalyzingDataset(dataset.id);
      await new Promise(resolve => setTimeout(resolve, 1200));

      const columns = getColumnsFromDataset(dataset);
      const mockIssues = columns.slice(0, Math.min(4, columns.length)).map((col: string, idx: number) => {
        const issueTypes = ['missing', 'outlier', 'inconsistency'];
        const severities = ['high', 'medium', 'low'];
        const issueType = issueTypes[idx % 3];
        const severity = severities[idx % 3];
        const percent = 2 + (idx * 1.5);
        const count = Math.floor((dataset.rows || 1000) * (percent / 100));

        return {
          variable: col,
          type: issueType as 'missing' | 'outlier' | 'inconsistency',
          severity: severity as 'high' | 'medium' | 'low',
          count,
          percent,
          aiSuggestions: [
            {
              variable: col,
              issue: `${issueType} detected`,
              severity: severity as 'high' | 'medium' | 'low',
              method: issueType === 'missing' ? 'Mean Imputation' : issueType === 'outlier' ? 'Winsorization' : 'Pattern Correction',
              description: `Apply ${issueType === 'missing' ? 'statistical imputation' : issueType === 'outlier' ? 'outlier capping' : 'consistency correction'}`,
              impact: 'Improves data quality and model performance',
            },
          ],
          selectedMethod: undefined,
          resolved: false,
        };
      });

      setMetricsMap(prev => ({
        ...prev,
        [dataset.id]: {
          totalRecords: dataset.rows || 1000,
          recordsAfterExclusion: Math.floor((dataset.rows || 1000) * 0.98),
          exclusionRate: 2.0,
          qualityScore: 85 - (mockIssues.length * 5),
          issues: mockIssues,
        },
      }));
    }

    setLoading(false);
    setCurrentAnalyzingDataset('');
  };

  const handleAIAnalysis = async () => {
    if (!selectedDataset) return;

    setAiAnalyzing(true);
    await new Promise(resolve => setTimeout(resolve, 2000));

    const recommendations: TreatmentRecommendation[] = [
      {
        variable: 'age',
        issue: 'Missing values detected (2.1%)',
        severity: 'medium',
        recommendations: [
          {
            id: 'mean_impute',
            method: 'Mean Imputation',
            description: 'Fill missing values with mean of the column',
            impact: 'Preserves distribution characteristics',
          },
          {
            id: 'median_impute',
            method: 'Median Imputation',
            description: 'Fill missing values with median of the column',
            impact: 'Robust to outliers',
          },
        ],
      },
      {
        variable: 'income',
        issue: 'Outliers detected (1.4%)',
        severity: 'high',
        recommendations: [
          {
            id: 'winsorize',
            method: 'Winsorization',
            description: 'Cap extreme values at 1st and 99th percentiles',
            impact: 'Reduces outlier influence',
          },
          {
            id: 'log_transform',
            method: 'Log Transform',
            description: 'Apply log transformation to reduce skew',
            impact: 'Normalizes distribution',
          },
        ],
      },
    ];

    setAiRecommendations(recommendations);
    setAiAnalyzing(false);
  };

  const handleApplyTreatments = async () => {
    if (!selectedDataset) return;
    const selected = aiRecommendations.filter(r => r.selected);
    if (selected.length === 0) return;

    setApplyingTreatment(true);
    await new Promise(resolve => setTimeout(resolve, 1500));

    const resolutionSummary = selected
      .map(rec => `${rec.variable}: ${rec.recommendations.find(t => t.id === rec.selected)?.method || 'Treatment'}`)
      .join(', ');

    const clonedDataset = cloneDatasetAsResolved(selectedDataset.id, resolutionSummary, selected.length);

    if (clonedDataset) {
      setMetricsMap(prev => ({
        ...prev,
        [clonedDataset.id]: {
          ...(prev[selectedDataset.id] || {}),
          issues: (prev[selectedDataset.id]?.issues || []).map((issue: any) => ({
            ...issue,
            resolved: true,
          })),
        },
      }));

      setSelectedDatasetId(clonedDataset.id);

      const project = projects.find(p => p.id === selectedProjectId);
      if (project) {
        createWorkflowLog(createWorkflowLogEntry(
          project.id,
          project.name,
          'AI Data Quality Treatments Applied',
          `Applied ${selected.length} AI treatments and created a resolved dataset.`
        ));
      }

      alert('✓ Treatments applied. Resolved dataset created in Datasets.');
    }

    setApplyingTreatment(false);
  };

  const handleResolveAllIssues = async () => {
    const toResolve = allDatasets
      .map(dataset => {
        const metricsEntry = metricsMap[dataset.id];
        if (!metricsEntry) return null;
        const issues = metricsEntry.issues.filter((issue: any) => issue.selectedMethod && !issue.resolved);
        if (issues.length === 0) return null;
        return { dataset, issues };
      })
      .filter(Boolean) as Array<{ dataset: any; issues: any[] }>;

    if (toResolve.length === 0) {
      alert('Please select treatment methods for issues first');
      return;
    }

    setResolving(true);
    setCurrentResolvingIndex(-1);

    for (const { dataset, issues } of toResolve) {
      for (const issue of issues) {
        setCurrentResolvingIndex(metricsMap[dataset.id].issues.findIndex((i: any) => i.variable === issue.variable));
        await new Promise(resolve => setTimeout(resolve, 1200));
        setMetricsMap(prev => {
          const updated = { ...prev };
          const issueIndex = updated[dataset.id].issues.findIndex((i: any) => i.variable === issue.variable);
          if (issueIndex !== -1) {
            updated[dataset.id].issues[issueIndex].resolved = true;
          }
          return updated;
        });
      }

      const resolutionSummary = issues.map(i => `${i.variable} (${i.type}): ${i.selectedMethod}`).join(', ');
      const clonedDataset = cloneDatasetAsResolved(dataset.id, resolutionSummary, issues.length);

      if (clonedDataset) {
        setMetricsMap(prev => ({
          ...prev,
          [clonedDataset.id]: {
            ...(prev[dataset.id] || {}),
            issues: (prev[dataset.id]?.issues || []).map((issue: any) => ({
              ...issue,
              resolved: true,
            })),
          },
        }));
        setSelectedDatasetId(clonedDataset.id);
      }
    }

    setResolving(false);
    setCurrentResolvingIndex(-1);

    const project = projects.find(p => p.id === selectedProjectId);
    if (project) {
      createWorkflowLog(createWorkflowLogEntry(
        project.id,
        project.name,
        'Data Quality Issues Resolved',
        `Resolved data quality issues and created resolved dataset(s).`
      ));
    }

    alert('✓ All data quality issues resolved. Resolved datasets created in Datasets.');
  };

  const handleDownloadReport = async () => {
    if (Object.keys(metricsMap).length === 0 || !selectedModel) return;

    setGeneratingPDF(true);
    await new Promise(resolve => setTimeout(resolve, 1500));

    const baselineDatasetIds: string[] = [];
    const resolvedDatasetIds: string[] = [];

    allDatasets.forEach(dataset => {
      if ((dataset as any).isResolved === true) {
        resolvedDatasetIds.push(dataset.id);
      } else {
        baselineDatasetIds.push(dataset.id);
      }
    });

    const datasetNames = allDatasets.map(d => d.name).join('_');
    const timestamp = new Date().toISOString().split('T')[0];
    const configName = `Data_Quality_${selectedModel.name}_${timestamp}`.replace(/\s+/g, '_');
    const reportName = `Data Quality Report - ${selectedModel.name} (${allDatasets.map(d => d.name).join(', ')})`;

    const pdfData = {
      reportName,
      generatedAt: new Date().toISOString(),
      datasets: allDatasets.map(dataset => {
        const metricsEntry = metricsMap[dataset.id];
        if (!metricsEntry) return null;

        return {
          name: dataset.name,
          totalRecords: metricsEntry.totalRecords,
          recordsAfterExclusion: metricsEntry.recordsAfterExclusion,
          exclusionRate: metricsEntry.exclusionRate,
          qualityScore: metricsEntry.qualityScore,
          issues: metricsEntry.issues.map((issue: any) => ({
            variable: issue.variable,
            type: issue.type,
            severity: issue.severity,
            count: issue.count,
            percent: issue.percent,
            selectedMethod: issue.selectedMethod,
          })),
        };
      }).filter(Boolean) as any[],
      lockWorkflow,
    };

    const reportArtifact = {
      pdfContent: JSON.stringify(pdfData),
      metadata: {
        generatedAt: pdfData.generatedAt,
        datasetCount: allDatasets.length,
        modelId: selectedModel.id,
        modelName: selectedModel.name,
        workflow: 'data-quality',
      },
    };

    generateDataQualityPDF(pdfData);

    const avgQualityScore = allDatasets.reduce((sum, dataset) => {
      const metricsEntry = metricsMap[dataset.id];
      return sum + (metricsEntry?.qualityScore || 0);
    }, 0) / allDatasets.length;

    createGeneratedReport({
      name: reportName,
      type: 'data_quality',
      modelId: selectedModel.id,
      modelName: `${selectedModel.name} v${selectedModel.version}`,
      status: 'final',
      healthScore: avgQualityScore,
      fileSize: '2.1 MB',
      tags: ['data-quality', 'automated', 'left-nav', resolvedDatasetIds.length > 0 ? 'resolved' : 'in-progress'],
      reportArtifact,
      baselineDatasetIds,
      resolvedDatasetIds,
      immutable: true,
    });

    if (lockWorkflow) {
      const existingConfig = reportConfigurations?.find(c => c.name === configName);

      if (!existingConfig && baselineDatasetIds.length > 0) {
        const resolvedDatasetId = resolvedDatasetIds.length > 0
          ? resolvedDatasetIds[0]
          : baselineDatasetIds[baselineDatasetIds.length - 1];

        const configModelType = selectedModel.modelType === 'regression' ? 'regression' : 'classification';

        createReportConfiguration({
          name: configName,
          type: 'data_quality',
          modelId: selectedModel.id,
          modelName: `${selectedModel.name} v${selectedModel.version}`,
          modelType: configModelType,
          baselineDatasetId: baselineDatasetIds[0],
          baselineDatasetName: allDatasets.find(d => d.id === baselineDatasetIds[0])?.name || 'Baseline',
          referenceDatasetId: resolvedDatasetId,
          referenceDatasetName: allDatasets.find(d => d.id === resolvedDatasetId)?.name || 'Reference',
          metricsToMonitor: ['quality_score', 'issue_count', 'exclusion_rate'],
          driftMetrics: [],
        });
      }
    }

    setGeneratingPDF(false);

    const project = projects.find(p => p.id === selectedProjectId);
    if (project) {
      createWorkflowLog(createWorkflowLogEntry(
        project.id,
        project.name,
        'Data Quality Report Generated',
        `Generated data quality report for ${allDatasets.length} dataset(s).`
      ));
    }

    alert(`✓ Data Quality Report generated and saved to Reports section!${lockWorkflow ? '\n✓ Configuration created for scheduling.' : ''}`);
  };

  const showResolveButton = allDatasets.some(dataset => {
    const metricsEntry = metricsMap[dataset.id];
    return metricsEntry && metricsEntry.issues.some((issue: any) => issue.selectedMethod && !issue.resolved);
  });

  const showDownloadButton = allDatasets.length > 0 && allDatasets.every(dataset => {
    const metricsEntry = metricsMap[dataset.id];
    return metricsEntry && metricsEntry.issues.every((issue: any) => !issue.selectedMethod || issue.resolved);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Data Quality Analysis & Reporting
          </h3>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Select a project and model, analyze datasets, resolve issues, and generate reports.
          </p>
        </div>
        {Object.keys(metricsMap).length > 0 && (
          <div className="flex items-center gap-3">
            {showResolveButton && (
              <button
                onClick={handleResolveAllIssues}
                disabled={resolving}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                  isDark ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-green-500 hover:bg-green-600 text-white'
                } ${resolving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {resolving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Resolving Issues...
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    Resolve All Issues
                  </>
                )}
              </button>
            )}

            {showDownloadButton && (
              <button
                onClick={handleDownloadReport}
                disabled={generatingPDF}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                  isDark ? 'bg-purple-600 hover:bg-purple-500 text-white' : 'bg-purple-500 hover:bg-purple-600 text-white'
                } ${generatingPDF ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {generatingPDF ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    Download Report (PDF)
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div>
          <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            Project
            {projects.length > 0 && (
              <span className={`ml-2 text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                ({projects.length} available)
              </span>
            )}
          </label>
          <select
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value)}
            className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
          >
            <option value="" disabled>Select a project</option>
            {projects.map(project => {
              const modelCount = registryModels.filter(m => m.projectId === project.id).length;
              return (
                <option key={project.id} value={project.id}>
                  {project.name} ({modelCount} model{modelCount !== 1 ? 's' : ''})
                </option>
              );
            })}
          </select>
        </div>
        <div>
          <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            Model
            {selectedProjectId && (
              <span className={`ml-2 text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                ({projectModels.length} available)
              </span>
            )}
          </label>
          <select
            value={selectedModelId}
            onChange={e => setSelectedModelId(e.target.value)}
            className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'} ${
              projectModels.length === 0 ? 'opacity-50' : ''
            }`}
            disabled={!selectedProjectId}
          >
            {!selectedProjectId ? (
              <option value="" disabled>Select a project first</option>
            ) : projectModels.length === 0 ? (
              <option value="" disabled>No models found for this project</option>
            ) : (
              <option value="" disabled>Select a model</option>
            )}
            {projectModels.map(model => (
              <option key={model.id} value={model.id}>{model.name} v{model.version}</option>
            ))}
          </select>
          {selectedProjectId && projectModels.length === 0 && (
            <p className={`text-xs mt-1 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
              No models found. Please add models to this project in the Model Repository section.
            </p>
          )}
        </div>
      </div>

      {/* Debug/Status Information */}
      {(projects.length === 0 || registryModels.length === 0) && (
        <div className={`p-4 rounded-lg border ${isDark ? 'bg-yellow-900/20 border-yellow-500/30' : 'bg-yellow-50 border-yellow-200'}`}>
          <h4 className={`font-medium mb-2 ${isDark ? 'text-yellow-400' : 'text-yellow-800'}`}>
            System Status
          </h4>
          <div className={`text-sm space-y-1 ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
            <p>• Projects: {projects.length} found</p>
            <p>• Models: {registryModels.length} found</p>
            {projects.length === 0 && (
              <p className="mt-2">→ Please create a project first in the Projects section.</p>
            )}
            {projects.length > 0 && registryModels.length === 0 && (
              <p className="mt-2">→ Please add models to your projects in the Model Repository section.</p>
            )}
          </div>
        </div>
      )}

      {allDatasets.length === 0 ? (
        <div className={`p-6 rounded-lg border text-center ${isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'}`}>
          <p className={`text-sm ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
            No datasets found for this project and model. Please complete Data Ingestion first.
          </p>
        </div>
      ) : (
        <>
          <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Select Dataset for Detailed Analysis
              </h2>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-3 py-1 rounded-full ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                  {allDatasets.length} Total Dataset{allDatasets.length > 1 ? 's' : ''}
                </span>
                {allDatasets.some(d => (d as any).isResolved) && (
                  <span className={`text-xs px-3 py-1 rounded-full ${isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'}`}>
                    {allDatasets.filter(d => (d as any).isResolved).length} Resolved
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {allDatasets.map(dataset => {
                const isResolved = (dataset as any).isResolved === true;
                const resolvedMetrics = metricsMap[dataset.id] || metricsMap[(dataset as any).parentDatasetId || ''];
                return (
                  <div
                    key={dataset.id}
                    className={`p-3 rounded-lg border cursor-pointer transition ${
                      selectedDataset?.id === dataset.id
                        ? isDark ? 'bg-blue-500/20 border-blue-500' : 'bg-blue-50 border-blue-500'
                        : isResolved
                        ? isDark ? 'bg-green-500/10 border-green-500/30 hover:bg-green-500/20' : 'bg-green-50 border-green-200 hover:bg-green-100'
                        : isDark ? 'bg-slate-700/50 border-slate-600 hover:bg-slate-700' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                    onClick={() => {
                      setSelectedDatasetId(dataset.id);
                      setAiRecommendations([]);
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className={`font-medium text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {dataset.name}
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          {dataset.rows?.toLocaleString() || 0} rows × {dataset.columns || 0} cols
                        </p>
                      </div>
                      {isResolved ? (
                        <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'}`}>
                          <CheckCircle size={12} />
                          Resolved
                        </span>
                      ) : (
                        <span className={`text-xs px-2 py-1 rounded-full ${isDark ? 'bg-slate-600 text-slate-300' : 'bg-slate-200 text-slate-700'}`}>
                          Imported
                        </span>
                      )}
                    </div>
                    {isResolved && resolvedMetrics && (
                      <div className={`text-xs space-y-1 pt-2 border-t ${isDark ? 'border-slate-600' : 'border-slate-200'}`}>
                        <div className="flex justify-between">
                          <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Quality Score:</span>
                          <span className={`font-semibold ${
                            (resolvedMetrics?.qualityScore || 0) >= 80 ? 'text-green-500' :
                            (resolvedMetrics?.qualityScore || 0) >= 60 ? 'text-yellow-500' :
                            'text-red-500'
                          }`}>
                            {resolvedMetrics?.qualityScore || 0}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Issues Resolved:</span>
                          <span className={isDark ? 'text-white' : 'text-slate-900'}>
                            {(resolvedMetrics?.issues?.filter((i: any) => i.resolved) || []).length}/{resolvedMetrics?.issues?.length || 0}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Resolved:</span>
                          <span className={isDark ? 'text-green-400' : 'text-green-600'}>
                            {(dataset as any).resolutionTimestamp ? new Date((dataset as any).resolutionTimestamp).toLocaleString() : 'Today'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
            <div className="flex gap-1 overflow-x-auto">
              {tabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-4 py-3 font-medium text-sm whitespace-nowrap flex items-center gap-2 border-b-2 transition ${
                      activeTab === tab.id
                        ? isDark
                          ? 'border-blue-500 text-blue-400'
                          : 'border-blue-600 text-blue-600'
                        : isDark
                        ? 'border-transparent text-slate-400 hover:text-slate-300'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Icon size={16} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedDataset && metrics && (
            <>
              {activeTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <Database className={`${isDark ? 'text-blue-400' : 'text-blue-600'}`} size={24} />
                      <h4 className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        Total Records
                      </h4>
                    </div>
                    <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {selectedDataset.rows?.toLocaleString() || 0}
                    </p>
                    <p className={`text-sm mt-2 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                      {selectedDataset.columns || 0} variables
                    </p>
                  </div>

                  <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <CheckCircle className={`${isDark ? 'text-green-400' : 'text-green-600'}`} size={24} />
                      <h4 className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        After Exclusion
                      </h4>
                    </div>
                    <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {((selectedDataset.rows || 0) * 0.98).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                    <p className={`text-sm mt-2 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                      98% retained
                    </p>
                  </div>

                  <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <Shield className={`${isDark ? 'text-purple-400' : 'text-purple-600'}`} size={24} />
                      <h4 className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        Quality Score
                      </h4>
                    </div>
                    <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      94.2%
                    </p>
                    <p className={`text-sm mt-2 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                      Excellent
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'missing' && (
                <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                  <h4 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Missing Value Analysis
                  </h4>
                  {metrics.missingValueStats && metrics.missingValueStats.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                            <th className={`text-left py-3 px-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Variable</th>
                            <th className={`text-left py-3 px-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Type</th>
                            <th className={`text-right py-3 px-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Missing Count</th>
                            <th className={`text-right py-3 px-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Missing %</th>
                            <th className={`text-center py-3 px-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {metrics.missingValueStats.map((stat, idx) => (
                            <tr key={idx} className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                              <td className={`py-3 px-4 font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                {stat.variable}
                              </td>
                              <td className={`py-3 px-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                {stat.type}
                              </td>
                              <td className={`py-3 px-4 text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                {stat.missing}
                              </td>
                              <td className={`py-3 px-4 text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                {stat.missingPercent.toFixed(2)}%
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs ${
                                  stat.missingPercent < 1
                                    ? isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                                    : stat.missingPercent < 5
                                    ? isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                                    : isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'
                                }`}>
                                  {stat.missingPercent < 1 ? 'Good' : stat.missingPercent < 5 ? 'Warning' : 'Critical'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className={`p-6 rounded-lg text-center ${isDark ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                      <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        No missing value data available
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'distributions' && (
                <div className="space-y-6">
                  <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <h4 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Numerical Variable Summary
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                            <th className={`text-left py-2 px-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Variable</th>
                            <th className={`text-right py-2 px-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Mean</th>
                            <th className={`text-right py-2 px-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Std</th>
                            <th className={`text-right py-2 px-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Min</th>
                            <th className={`text-right py-2 px-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>25%</th>
                            <th className={`text-right py-2 px-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>50%</th>
                            <th className={`text-right py-2 px-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>75%</th>
                            <th className={`text-right py-2 px-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Max</th>
                          </tr>
                        </thead>
                        <tbody>
                          {metrics.statisticalSummary.map((stat, idx) => (
                            <tr key={idx} className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                              <td className={`py-2 px-3 font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                {stat.variable}
                              </td>
                              <td className={`py-2 px-3 text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                {stat.mean.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                              </td>
                              <td className={`py-2 px-3 text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                {stat.std.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                              </td>
                              <td className={`py-2 px-3 text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                {stat.min.toLocaleString()}
                              </td>
                              <td className={`py-2 px-3 text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                {stat.p25.toLocaleString()}
                              </td>
                              <td className={`py-2 px-3 text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                {stat.p50.toLocaleString()}
                              </td>
                              <td className={`py-2 px-3 text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                {stat.p75.toLocaleString()}
                              </td>
                              <td className={`py-2 px-3 text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                {stat.max.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <h4 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Categorical Variable Distribution
                    </h4>
                    <div className="space-y-4">
                      {metrics.categoricalDistributions.map((dist, idx) => (
                        <div key={idx} className={`p-4 rounded-lg ${isDark ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                          <div className="flex justify-between items-start mb-2">
                            <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {dist.variable}
                            </span>
                            <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                              {dist.categories} categories
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                              Top: <strong>{dist.topCategory}</strong>
                            </span>
                            <span className={`text-sm ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                              {dist.topPercent.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'outliers' && (
                <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                  <h4 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Outlier Detection
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                          <th className={`text-left py-3 px-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Variable</th>
                          <th className={`text-right py-3 px-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Outlier Count</th>
                          <th className={`text-right py-3 px-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Outlier %</th>
                          <th className={`text-right py-3 px-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Lower Bound</th>
                          <th className={`text-right py-3 px-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Upper Bound</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.outlierDetection.map((outlier, idx) => (
                          <tr key={idx} className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                            <td className={`py-3 px-4 font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {outlier.variable}
                            </td>
                            <td className={`py-3 px-4 text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                              {outlier.outlierCount}
                            </td>
                            <td className={`py-3 px-4 text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                              {outlier.outlierPercent.toFixed(2)}%
                            </td>
                            <td className={`py-3 px-4 text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                              {outlier.lowerBound.toLocaleString()}
                            </td>
                            <td className={`py-3 px-4 text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                              {outlier.upperBound.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'replication' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <h4 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Score Replication Quality
                    </h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>RMSE</span>
                        <span className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {metrics.scoreReplication.rmse.toFixed(4)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Max Difference</span>
                        <span className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {metrics.scoreReplication.maxDiff.toFixed(4)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Mean Difference</span>
                        <span className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {metrics.scoreReplication.meanDiff.toFixed(4)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Correlation</span>
                        <span className={`text-lg font-semibold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                          {metrics.scoreReplication.correlation.toFixed(4)}
                        </span>
                      </div>
                    </div>
                    <div className={`mt-6 p-4 rounded-lg ${isDark ? 'bg-green-500/10' : 'bg-green-50'}`}>
                      <div className="flex items-center gap-2">
                        <CheckCircle className={`${isDark ? 'text-green-400' : 'text-green-600'}`} size={20} />
                        <span className={`font-medium ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                          Excellent Replication Quality
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <h4 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Interpretation
                    </h4>
                    <ul className={`space-y-2 text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      <li>✓ RMSE &lt; 0.02: Scores replicate accurately</li>
                      <li>✓ Correlation &gt; 0.99: Strong agreement</li>
                      <li>✓ Mean difference near 0: No systematic bias</li>
                      <li>✓ Model execution validated successfully</li>
                    </ul>
                  </div>
                </div>
              )}

              {activeTab === 'volume' && (
                <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                  <h4 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Volume & Event Rate by Segment
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                          <th className={`text-left py-3 px-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Segment</th>
                          <th className={`text-right py-3 px-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Count</th>
                          <th className={`text-right py-3 px-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Event Rate</th>
                          <th className={`text-right py-3 px-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Baseline</th>
                          <th className={`text-right py-3 px-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Delta</th>
                          <th className={`text-center py-3 px-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.volumeMetrics.map((vol, idx) => (
                          <tr key={idx} className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                            <td className={`py-3 px-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>{vol.segment}</td>
                            <td className={`py-3 px-4 text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                              {vol.count.toLocaleString()}
                            </td>
                            <td className={`py-3 px-4 text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                              {vol.eventRate.toFixed(1)}%
                            </td>
                            <td className={`py-3 px-4 text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                              {vol.baselineEventRate.toFixed(1)}%
                            </td>
                            <td className={`py-3 px-4 text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                              {vol.delta > 0 ? '+' : ''}{vol.delta.toFixed(1)}%
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs ${
                                Math.abs(vol.delta) < 0.5
                                  ? isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                                  : Math.abs(vol.delta) < 1.0
                                  ? isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                                  : isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'
                              }`}>
                                {Math.abs(vol.delta) < 0.5 ? '● Green' : Math.abs(vol.delta) < 1.0 ? '● Amber' : '● Red'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'ai-treatment' && (
                <div className="space-y-6">
                  <div className={`p-6 rounded-lg border ${isDark ? 'bg-gradient-to-br from-purple-900/20 to-blue-900/20 border-purple-500/30' : 'bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200'}`}>
                    <div className="flex items-center gap-3 mb-4">
                      <Brain className={`${isDark ? 'text-purple-400' : 'text-purple-600'}`} size={32} />
                      <div>
                        <h4 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          AI-Powered Dataset Treatment
                        </h4>
                        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          Analyze and apply intelligent transformations to improve data quality
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleAIAnalysis}
                      disabled={aiAnalyzing}
                      className={`w-full px-6 py-3 rounded-lg flex items-center justify-center gap-2 font-medium ${
                        isDark ? 'bg-purple-600 hover:bg-purple-500 text-white' : 'bg-purple-500 hover:bg-purple-600 text-white'
                      } ${aiAnalyzing ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {aiAnalyzing ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                          Analyzing Dataset...
                        </>
                      ) : (
                        <>
                          <Zap size={20} />
                          Run AI Analysis
                        </>
                      )}
                    </button>
                  </div>

                  {aiRecommendations.length > 0 && (
                    <>
                      <div className="space-y-4">
                        {aiRecommendations.map(rec => (
                          <div
                            key={rec.variable}
                            className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                          >
                            <div className="flex items-start justify-between mb-4">
                              <div>
                                <h5 className={`font-semibold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                  <Beaker size={18} />
                                  {rec.variable}
                                </h5>
                                <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                  {rec.issue}
                                </p>
                              </div>
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                rec.severity === 'high'
                                  ? isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'
                                  : rec.severity === 'medium'
                                  ? isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                                  : isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                              }`}>
                                {rec.severity.toUpperCase()}
                              </span>
                            </div>

                            <div className="space-y-2">
                              <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                Recommended Treatments:
                              </p>
                              {rec.recommendations.map(treatment => (
                                <label
                                  key={treatment.id}
                                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition ${
                                    rec.selected === treatment.id
                                      ? isDark ? 'bg-blue-500/20 border border-blue-500/50' : 'bg-blue-50 border border-blue-200'
                                      : isDark ? 'bg-slate-700/50 hover:bg-slate-700' : 'bg-slate-50 hover:bg-slate-100'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={`treatment-${rec.variable}`}
                                    checked={rec.selected === treatment.id}
                                    onChange={() => {
                                      const updated = aiRecommendations.map(r =>
                                        r.variable === rec.variable ? { ...r, selected: treatment.id } : r
                                      );
                                      setAiRecommendations(updated);
                                    }}
                                    className="mt-1"
                                  />
                                  <div className="flex-1">
                                    <div className={`font-medium text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                      {treatment.method}
                                    </div>
                                    <div className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                      {treatment.description}
                                    </div>
                                    <div className={`text-xs mt-1 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                                      Impact: {treatment.impact}
                                    </div>
                                  </div>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              Apply Selected Treatments
                            </h5>
                            <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                              This will create a new treated dataset that will appear in the Datasets section
                            </p>
                          </div>
                          <button
                            onClick={handleApplyTreatments}
                            disabled={applyingTreatment || aiRecommendations.filter(r => r.selected).length === 0}
                            className={`px-6 py-3 rounded-lg flex items-center gap-2 font-medium ${
                              isDark ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-green-500 hover:bg-green-600 text-white'
                            } ${(applyingTreatment || aiRecommendations.filter(r => r.selected).length === 0) ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {applyingTreatment ? (
                              <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                                Applying...
                              </>
                            ) : (
                              <>
                                <CheckCircle2 size={20} />
                                Apply Treatments
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {aiRecommendations.length === 0 && !aiAnalyzing && (
                    <div className={`p-8 rounded-lg border text-center ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                      <Brain className={`mx-auto mb-3 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} size={48} />
                      <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        Click "Run AI Analysis" to get intelligent treatment recommendations
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Analyze Datasets for Quality Issues
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Found {allDatasets.length} dataset{allDatasets.length > 1 ? 's' : ''} for this model
                  </p>
                  <div className="mt-2">
                    {allDatasets.map(dataset => (
                      <div key={dataset.id} className={`inline-flex items-center gap-2 mr-4 text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        <span>{dataset.name}</span>
                        <span>({dataset.rows?.toLocaleString() || 0} rows)</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={analyzeAllDatasets}
                  disabled={loading}
                  className={`px-6 py-3 rounded-lg flex items-center gap-2 font-medium ${
                    isDark ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
                  } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                      {currentAnalyzingDataset ? 'Analyzing...' : 'Analyzing...'}
                    </>
                  ) : (
                    <>
                      <Shield size={20} />
                      Run Quality Analysis
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {Object.keys(metricsMap).length > 0 && (
            <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
              <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Data Quality Issues Found
              </h3>
              <div className="space-y-4">
                {allDatasets.map(dataset => {
                  const metricsEntry = metricsMap[dataset.id];
                  if (!metricsEntry || metricsEntry.issues.length === 0) return null;

                  return (
                    <div key={dataset.id} className={`p-4 rounded-lg border ${isDark ? 'bg-slate-700/30 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {dataset.name}
                        </h4>
                        <div className={`text-sm px-3 py-1 rounded-full ${
                          metricsEntry.qualityScore >= 80 ? 'bg-green-100 text-green-700' :
                          metricsEntry.qualityScore >= 60 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          Score: {metricsEntry.qualityScore}%
                        </div>
                      </div>

                      <div className="space-y-3">
                        {metricsEntry.issues.map((issue: any, idx: number) => (
                          <div key={idx} className={`p-3 rounded border ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                  {issue.variable}
                                </span>
                                <span className={`ml-2 text-xs px-2 py-1 rounded-full ${
                                  issue.severity === 'high' ? 'bg-red-100 text-red-700' :
                                  issue.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-blue-100 text-blue-700'
                                }`}>
                                  {issue.severity}
                                </span>
                              </div>
                              {issue.resolved ? (
                                <span className="text-green-500 flex items-center gap-1">
                                  <CheckCircle size={16} />
                                  Resolved
                                </span>
                              ) : (
                                currentResolvingIndex === idx && resolving ? (
                                  <span className="text-blue-500 flex items-center gap-1">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
                                    Resolving...
                                  </span>
                                ) : null
                              )}
                            </div>
                            <div className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                              {issue.type}: {issue.count} records ({issue.percent}%) affected
                            </div>

                            {!issue.resolved && issue.aiSuggestions.length > 0 && (
                              <div className="mt-3">
                                <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                  Select Treatment Method:
                                </label>
                                <select
                                  value={issue.selectedMethod || ''}
                                  onChange={e => {
                                    setMetricsMap(prev => {
                                      const updated = { ...prev };
                                      const issueIndex = updated[dataset.id].issues.findIndex((i: any) => i.variable === issue.variable);
                                      if (issueIndex !== -1) {
                                        updated[dataset.id].issues[issueIndex].selectedMethod = e.target.value || undefined;
                                      }
                                      return updated;
                                    });
                                  }}
                                  className={`w-full px-3 py-1 text-sm rounded border ${
                                    isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                                  }`}
                                >
                                  <option value="">-- Select Treatment --</option>
                                  {issue.aiSuggestions.map((suggestion: any, suggestionIdx: number) => (
                                    <option key={suggestionIdx} value={suggestion.method}>
                                      {suggestion.method} - {suggestion.description}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      <div className="flex justify-between items-center pt-4">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={lockWorkflow}
              onChange={e => setLockWorkflow(e.target.checked)}
              className="w-4 h-4"
            />
            <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Lock Data Quality Workflow (Apply to scheduled reports)
            </span>
          </label>
        </div>
        <button
          onClick={() => {
            const project = projects.find(p => p.id === selectedProjectId);
            if (project) {
              const analysisCount = Object.keys(metricsMap).length;
              const resolvedCount = allDatasets.filter(d => (d as any).isResolved).length;
              createWorkflowLog(createWorkflowLogEntry(
                project.id,
                project.name,
                'Data Quality',
                `Approved data quality with ${analysisCount} analyzed dataset(s), ${resolvedCount} resolved dataset(s), and ${allDatasets.length} total dataset(s) ready for monitoring. Workflow lock: ${lockWorkflow ? 'Enabled' : 'Disabled'}.`
              ));
            }
            alert('✓ Data Quality workflow approved.');
          }}
          disabled={allDatasets.length === 0}
          className={`px-6 py-3 rounded-lg transition font-medium ${
            allDatasets.length === 0
              ? isDark ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          Approve Data Quality
        </button>
      </div>
    </div>
  );
};

export default DataQuality;
