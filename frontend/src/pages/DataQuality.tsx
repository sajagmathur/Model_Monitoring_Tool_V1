import React, { useState, useEffect } from 'react';
import {
  Shield, ChevronRight, CheckCircle, BarChart3, TrendingUp,
  Database, Zap, Download, Folder, Package, ArrowLeft
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useGlobal, IngestionJob } from '../contexts/GlobalContext';
import { generateDataQualityPDF } from '../utils/pdfGenerator';

// ─── Interfaces (mirror the workflow DataQualityStep) ─────────────────────
interface DataQualityMetrics {
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
  volumeMetrics: Array<{
    segment: string;
    count: number;
    eventRate: number;
    baselineEventRate: number;
    delta: number;
  }>;
}

// ─── Component ────────────────────────────────────────────────────────────
const DataQuality: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const {
    projects,
    registryModels,
    ingestionJobs,
    createGeneratedReport,
  } = useGlobal();

  // ── wizard state ───────────────────────────────────────────────
  const [step, setStep] = useState<'project' | 'model' | 'dataset' | 'analysis'>('project');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

  // ── analysis state (mirrors DataQualityStep) ───────────────────
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'distributions' | 'volume'>('overview');
  const [metricsMap, setMetricsMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [currentAnalyzingDataset, setCurrentAnalyzingDataset] = useState('');
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // ── Refresh trigger for manual data refresh ───────────────────
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // ── derived data ──────────────────────────────────────────────
  
  // Get all unique projectIds from registry models
  const projectIdsWithModels = new Set(registryModels.map(m => m.projectId));
  
  // Build list of projects that have models
  // First, find actual projects with models
  const projectsWithModels = projects.filter(p => projectIdsWithModels.has(p.id));

  const selectedProject = selectedProjectId ? projectsWithModels.find(p => p.id === selectedProjectId) : null;

  // Models for selected project: from registryModels linked to this project
  const modelsForProject = selectedProjectId
    ? registryModels.filter(m => m.projectId === selectedProjectId)
    : [];

  const selectedModel = selectedModelId ? registryModels.find(m => m.id === selectedModelId) : null;

  // Datasets for the selected model
  const datasetsForModel = selectedModelId
    ? ingestionJobs.filter(j =>
        j.modelId === selectedModelId &&
        (j.status === 'completed' || j.status === 'active')
      )
    : [];

  // Also include datasets that belong to the project but have no modelId
  const datasetsForProject = selectedProjectId
    ? ingestionJobs.filter(j =>
        j.projectId === selectedProjectId &&
        !j.modelId &&
        (j.status === 'completed' || j.status === 'active')
      )
    : [];

  const allAvailableDatasets = [...datasetsForModel, ...datasetsForProject];

  const selectedDataset = selectedDatasetId
    ? allAvailableDatasets.find(d => d.id === selectedDatasetId)
    : allAvailableDatasets[0];

  // Reset downstream state when project changes
  useEffect(() => {
    setSelectedModelId(null);
    setSelectedDatasetId(null);
    setMetricsMap({});
  }, [selectedProjectId]);

  // Reset downstream state when model changes
  useEffect(() => {
    setSelectedDatasetId(null);
    setMetricsMap({});
  }, [selectedModelId]);

  // Debug orphaned models and warn about sync issues
  useEffect(() => {
    const orphanedProjectIds = Array.from(new Set(registryModels.map(m => m.projectId))).filter(
      pid => !projects.some(p => p.id === pid)
    );
    if (orphanedProjectIds.length > 0) {
      console.warn('[DataQuality] ⚠️ Found models with invalid projectIds (project may be missing):', orphanedProjectIds);
      const orphanedModels = registryModels.filter(m => orphanedProjectIds.includes(m.projectId));
      console.log('[DataQuality] Orphaned models:', orphanedModels.map(m => ({ name: m.name, projectId: m.projectId })));
    }
  }, [registryModels, projects]);

  // Log state for debugging and ensure component re-renders when models/projects are imported
  useEffect(() => {
    console.log('[DataQuality] Component state update:', {
      projectsCount: projects.length,
      registryModelsCount: registryModels.length,
      projectsWithModelsCount: projectsWithModels.length,
      ingestionJobsCount: ingestionJobs.length,
      refreshTrigger,
      registryModels: registryModels.map(m => ({ id: m.id, name: m.name, projectId: m.projectId })),
    });
  }, [projects, registryModels, ingestionJobs, refreshTrigger]);

  // ── helper: generate comprehensive metrics (exact copy from workflow) ──
  const getComprehensiveMetrics = (dataset: any): DataQualityMetrics => {
    let columns: string[] = [];

    if (dataset.outputColumns && Array.isArray(dataset.outputColumns) && dataset.outputColumns.length > 0) {
      columns = dataset.outputColumns;
    } else if (dataset.columnsList && Array.isArray(dataset.columnsList) && dataset.columnsList.length > 0) {
      columns = dataset.columnsList;
    } else if (dataset.schema && Array.isArray(dataset.schema)) {
      columns = dataset.schema.map((col: any) =>
        typeof col === 'string' ? col : col.name || col.label || `Column_${columns.length + 1}`
      );
    } else if (dataset.columns && typeof dataset.columns === 'number' && dataset.columns > 0) {
      columns = Array.from({ length: dataset.columns }, (_, i) => `Column_${i + 1}`);
    } else {
      columns = ['Variable_1', 'Variable_2', 'Variable_3', 'Variable_4'];
    }

    const numericColumns = columns.slice(0, Math.min(3, columns.length));
    const categoricalColumns = columns.slice(Math.min(3, columns.length), Math.min(6, columns.length));

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

    return {
      statisticalSummary,
      categoricalDistributions,
      volumeMetrics: [
        { segment: 'Q1 2024', count: Math.floor((dataset.rows || 1000) * 0.25), eventRate: 3.2, baselineEventRate: 3.0, delta: 0.2 },
        { segment: 'Q2 2024', count: Math.floor((dataset.rows || 1000) * 0.28), eventRate: 3.5, baselineEventRate: 3.0, delta: 0.5 },
        { segment: 'Q3 2024', count: Math.floor((dataset.rows || 1000) * 0.26), eventRate: 2.8, baselineEventRate: 3.0, delta: -0.2 },
        { segment: 'Q4 2024', count: Math.floor((dataset.rows || 1000) * 0.27), eventRate: 3.1, baselineEventRate: 3.0, delta: 0.1 },
      ],
    };
  };

  const metrics = selectedDataset ? getComprehensiveMetrics(selectedDataset) : null;

  // ── Analyze all datasets ──
  const analyzeAllDatasets = async () => {
    if (allAvailableDatasets.length === 0) return;
    setLoading(true);
    setMetricsMap({});

    for (const dataset of allAvailableDatasets) {
      setCurrentAnalyzingDataset(dataset.id);
      await new Promise(resolve => setTimeout(resolve, 1500));

      const columns =
        (dataset as any).outputColumns?.length > 0 ? (dataset as any).outputColumns :
        (dataset as any).columnsList?.length > 0 ? (dataset as any).columnsList :
        ['Variable_1', 'Variable_2', 'Variable_3', 'Variable_4'];

      const mockIssues = columns.slice(0, Math.min(4, columns.length)).map((col: string, idx: number) => {
        const issueTypes = ['inconsistency', 'duplication', 'format_error'];
        const severities = ['high', 'medium', 'low'];
        return {
          variable: col,
          type: issueTypes[idx % 3] as 'inconsistency' | 'duplication' | 'format_error',
          severity: severities[idx % 3] as 'high' | 'medium' | 'low',
          count: Math.floor((dataset.rows || 1000) * ((2 + idx * 1.5) / 100)),
          percent: 2 + idx * 1.5,
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

  // ── Download / Generate report ──
  const handleDownloadReport = async () => {
    if (Object.keys(metricsMap).length === 0 || !selectedModel) return;
    setGeneratingPDF(true);
    await new Promise(resolve => setTimeout(resolve, 1500));

    const datasetIds = allAvailableDatasets.map(d => d.id);
    const reportName = `Data Quality Report - ${selectedModel.name} (${allAvailableDatasets.map(d => d.name).join(', ')})`;

    const pdfData = {
      reportName,
      generatedAt: new Date().toISOString(),
      datasets: allAvailableDatasets.map(dataset => {
        const m = metricsMap[dataset.id];
        if (!m) return null;
        return {
          name: dataset.name,
          totalRecords: m.totalRecords,
          recordsAfterExclusion: m.recordsAfterExclusion,
          exclusionRate: m.exclusionRate,
          qualityScore: m.qualityScore,
          issues: m.issues.map((issue: any) => ({
            variable: issue.variable,
            type: issue.type,
            severity: issue.severity,
            count: issue.count,
            percent: issue.percent,
          })),
        };
      }).filter(Boolean) as any[],
    };

    generateDataQualityPDF(pdfData);

    const avgQualityScore = allAvailableDatasets.reduce((sum, dataset) => {
      const m = metricsMap[dataset.id];
      return sum + (m?.qualityScore || 0);
    }, 0) / allAvailableDatasets.length;

    const reportArtifact = {
      pdfContent: JSON.stringify(pdfData),
      metadata: {
        generatedAt: pdfData.generatedAt,
        datasetCount: allAvailableDatasets.length,
        modelId: selectedModel.id,
        modelName: selectedModel.name,
        workflow: 'data-quality-nav',
      },
    };

    createGeneratedReport({
      name: reportName,
      type: 'data_quality',
      modelId: selectedModel.id,
      modelName: `${selectedModel.name} v${selectedModel.version}`,
      status: 'final',
      healthScore: avgQualityScore,
      fileSize: '2.1 MB',
      tags: ['data-quality', 'automated', 'standalone'],
      reportArtifact,
      baselineDatasetIds: datasetIds,
      immutable: true,
    });

    setGeneratingPDF(false);
    alert('✓ Data Quality Report generated and saved to Reports section!');
  };

  // ── Tab definitions ──
  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'distributions', label: 'Distributions', icon: TrendingUp },
    { id: 'volume', label: 'Volume/Event Rate', icon: Database },
  ];

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  // ── Breadcrumb ──
  const breadcrumbParts: { label: string; onClick?: () => void }[] = [
    { label: 'Data Quality', onClick: () => setStep('project') },
  ];
  if (selectedProject) {
    breadcrumbParts.push({ label: selectedProject.name, onClick: () => setStep('model') });
  }
  if (selectedModel) {
    breadcrumbParts.push({ label: `${selectedModel.name} v${selectedModel.version}`, onClick: () => setStep('dataset') });
  }
  if (step === 'analysis') {
    breadcrumbParts.push({ label: 'Analysis' });
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Data Quality
          </h1>
          <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Analyze and improve data quality for your models
          </p>
        </div>
        <button
          onClick={() => setRefreshTrigger(prev => prev + 1)}
          className={`p-2 rounded-lg transition-all hover:scale-105 ${
            isDark
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
          title="Refresh data from workflow imports"
        >
          <Zap size={20} className={refreshTrigger > 0 ? 'animate-pulse' : ''} />
        </button>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm flex-wrap">
        {breadcrumbParts.map((part, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <ChevronRight size={14} className={isDark ? 'text-slate-500' : 'text-slate-400'} />}
            {part.onClick ? (
              <button
                onClick={part.onClick}
                className={`hover:underline ${isDark ? 'text-blue-400' : 'text-blue-600'}`}
              >
                {part.label}
              </button>
            ) : (
              <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{part.label}</span>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* ═══ STEP 1: Select Project ═══ */}
      {step === 'project' && (
        <div className="space-y-4">
          <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Select a Project
          </h2>
          {projectsWithModels.length === 0 ? (
            <div className={`p-8 rounded-lg border text-center ${isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'}`}>
              <Folder className={`mx-auto mb-3 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} size={40} />
              <p className={`text-sm font-medium ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
                No projects with models found
              </p>
              <p className={`text-xs mt-2 ${isDark ? 'text-amber-200/70' : 'text-amber-700/70'}`}>
                To get started:
              </p>
              <ul className={`text-xs mt-3 space-y-2 text-left max-w-md mx-auto ${isDark ? 'text-amber-200/80' : 'text-amber-700/80'}`}>
                <li>✓ Go to <strong>Projects</strong> page</li>
                <li>✓ Create a new project or select existing one</li>
                <li>✓ In the workflow, go to Model Repository step</li>
                <li>✓ Upload or register a model</li>
                <li>✓ Return to Data Quality - your project will appear here automatically</li>
              </ul>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projectsWithModels.map(project => (
                <button
                  key={project.id}
                  onClick={() => {
                    setSelectedProjectId(project.id);
                    setStep('model');
                  }}
                  className={`p-5 rounded-lg border text-left transition-all hover:shadow-lg ${
                    isDark
                      ? 'bg-slate-800 border-slate-700 hover:border-blue-500/50 hover:bg-slate-800/80'
                      : 'bg-white border-slate-200 hover:border-blue-400 hover:bg-blue-50/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                      <Folder size={20} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {project.name}
                      </h3>
                      <p className={`text-xs mt-1 truncate ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        {project.description || 'No description'}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          project.status === 'active'
                            ? isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                            : isDark ? 'bg-slate-600 text-slate-300' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {project.status || 'active'}
                        </span>
                        <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                          {project.environment || 'dev'}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={18} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ STEP 2: Select Model ═══ */}
      {step === 'model' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setStep('project')}
              className={`p-2 rounded-lg transition ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}
            >
              <ArrowLeft size={20} />
            </button>
            <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Select a Model for "{selectedProject?.name}"
            </h2>
          </div>
          {modelsForProject.length === 0 ? (
            <div className="space-y-4">
              <div className={`p-8 rounded-lg border text-center ${isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'}`}>
                <Package className={`mx-auto mb-3 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} size={40} />
                <p className={`text-sm font-medium ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
                  No models found for "{selectedProject?.name}"
                </p>
                <p className={`text-xs mt-2 ${isDark ? 'text-amber-200/70' : 'text-amber-700/70'}`}>
                  You can register a model in two ways:
                </p>
                <ul className={`text-xs mt-3 space-y-2 text-left max-w-md mx-auto ${isDark ? 'text-amber-200/80' : 'text-amber-700/80'}`}>
                  <li>✓ Through <strong>Projects</strong> → Start a workflow → Model Repository step</li>
                  <li>✓ Through <strong>Model Repository</strong> page → Import/Create model for this project</li>
                </ul>
              </div>

              {/* Show other projects with models for reference */}
              {registryModels.length > 0 && registryModels.some(m => m.projectId !== selectedProjectId) && (
                <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <p className={`text-sm font-medium mb-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Models available in other projects:
                  </p>
                  <div className="space-y-2">
                    {(() => {
                      const modelsByProject: Record<string, typeof registryModels> = {};
                      registryModels
                        .filter(m => m.projectId !== selectedProjectId)
                        .forEach(model => {
                          const projectName = projects.find(p => p.id === model.projectId)?.name || 'Unknown Project';
                          if (!modelsByProject[projectName]) modelsByProject[projectName] = [];
                          modelsByProject[projectName].push(model);
                        });
                      return Object.entries(modelsByProject).map(([projectName, models]) => (
                        <div key={projectName} className={`p-3 rounded ${isDark ? 'bg-slate-700/50' : 'bg-white'}`}>
                          <p className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            📁 {projectName}
                          </p>
                          <div className={`text-xs mt-1 space-y-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                            {models.map(m => (
                              <div key={m.id}>→ {m.name} (v{m.version})</div>
                            ))}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {modelsForProject.map(model => (
                <button
                  key={model.id}
                  onClick={() => {
                    setSelectedModelId(model.id);
                    setStep('dataset');
                  }}
                  className={`p-5 rounded-lg border text-left transition-all hover:shadow-lg ${
                    isDark
                      ? 'bg-slate-800 border-slate-700 hover:border-purple-500/50 hover:bg-slate-800/80'
                      : 'bg-white border-slate-200 hover:border-purple-400 hover:bg-purple-50/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${isDark ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
                      <Package size={20} className={isDark ? 'text-purple-400' : 'text-purple-600'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {model.name}
                      </h3>
                      <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        v{model.version} • {model.modelType}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          model.stage === 'production'
                            ? isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                            : model.stage === 'staging'
                            ? isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                            : isDark ? 'bg-slate-600 text-slate-300' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {model.stage}
                        </span>
                        <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                          {model.status}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={18} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ STEP 3: Select / View Datasets ═══ */}
      {step === 'dataset' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setStep('model')}
              className={`p-2 rounded-lg transition ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}
            >
              <ArrowLeft size={20} />
            </button>
            <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Datasets for "{selectedModel?.name} v{selectedModel?.version}"
            </h2>
          </div>

          {allAvailableDatasets.length === 0 ? (
            <div className={`p-8 rounded-lg border text-center ${isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'}`}>
              <Database className={`mx-auto mb-3 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} size={40} />
              <p className={`text-sm ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
                No datasets found for this model. Please ingest datasets first via the Projects workflow or Datasets page.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allAvailableDatasets.map(dataset => (
                  <div
                    key={dataset.id}
                    className={`p-4 rounded-lg border transition-all ${
                      isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium text-sm truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {dataset.name}
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          {(dataset.rows || 0).toLocaleString()} rows × {dataset.columns || 0} cols
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${isDark ? 'bg-slate-600 text-slate-300' : 'bg-slate-200 text-slate-700'}`}>
                        {dataset.status}
                      </span>
                    </div>
                    {dataset.datasetType && (
                      <span className={`text-xs px-2 py-0.5 rounded ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                        {dataset.datasetType}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setStep('analysis')}
                  className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center gap-2 transition"
                >
                  <Shield size={20} />
                  Proceed to Data Quality Analysis
                  <ChevronRight size={18} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ STEP 4: Full Data Quality Analysis (mirrors DataQualityStep) ═══ */}
      {step === 'analysis' && (
        <div className="space-y-6">
          {/* Back button & header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep('dataset')}
                className={`p-2 rounded-lg transition ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}
              >
                <ArrowLeft size={20} />
              </button>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Data Quality Analysis & Reporting
              </h3>
            </div>

            {Object.keys(metricsMap).length > 0 && (
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
                    Generating Report...
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    Generate &amp; Download Report
                  </>
                )}
              </button>
            )}
          </div>

          {allAvailableDatasets.length === 0 ? (
            <div className={`p-6 rounded-lg border text-center ${isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'}`}>
              <p className={`text-sm ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
                No datasets found. Please add datasets to the model first.
              </p>
            </div>
          ) : (
            <>
              {/* Dataset Selector */}
              <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Select Dataset for Detailed Analysis
                  </h2>
                  <span className={`text-xs px-3 py-1 rounded-full ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                    {allAvailableDatasets.length} Total Dataset{allAvailableDatasets.length > 1 ? 's' : ''}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  {allAvailableDatasets.map((dataset) => (
                    <div
                      key={dataset.id}
                      className={`p-3 rounded-lg border cursor-pointer transition ${
                        selectedDataset?.id === dataset.id
                          ? isDark ? 'bg-blue-500/20 border-blue-500' : 'bg-blue-50 border-blue-500'
                          : isDark ? 'bg-slate-700/50 border-slate-600 hover:bg-slate-700' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                      onClick={() => setSelectedDatasetId(dataset.id)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className={`font-medium text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {dataset.name}
                          </p>
                          <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                            {(dataset.rows || 0).toLocaleString()} rows × {dataset.columns || 0} cols
                          </p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${isDark ? 'bg-slate-600 text-slate-300' : 'bg-slate-200 text-slate-700'}`}>
                          {dataset.status || 'Imported'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tab Navigation */}
              <div className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                <div className="flex gap-1 overflow-x-auto">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`px-4 py-3 font-medium text-sm whitespace-nowrap flex items-center gap-2 border-b-2 transition ${
                          activeTab === tab.id
                            ? isDark ? 'border-blue-500 text-blue-400' : 'border-blue-600 text-blue-600'
                            : isDark ? 'border-transparent text-slate-400 hover:text-slate-300' : 'border-transparent text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Icon size={16} />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tab Content */}
              {selectedDataset && metrics && (
                <>
                  {/* Overview Tab */}
                  {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <div className="flex items-center gap-3 mb-2">
                          <Database className={isDark ? 'text-blue-400' : 'text-blue-600'} size={24} />
                          <h4 className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Total Records</h4>
                        </div>
                        <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {(selectedDataset.rows || 0).toLocaleString()}
                        </p>
                        <p className={`text-sm mt-2 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                          {selectedDataset.columns || 0} variables
                        </p>
                      </div>

                      <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <div className="flex items-center gap-3 mb-2">
                          <CheckCircle className={isDark ? 'text-green-400' : 'text-green-600'} size={24} />
                          <h4 className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>After Exclusion</h4>
                        </div>
                        <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {((selectedDataset.rows || 0) * 0.98).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                        <p className={`text-sm mt-2 ${isDark ? 'text-green-400' : 'text-green-600'}`}>98% retained</p>
                      </div>

                      <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <div className="flex items-center gap-3 mb-2">
                          <Shield className={isDark ? 'text-purple-400' : 'text-purple-600'} size={24} />
                          <h4 className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Quality Score</h4>
                        </div>
                        <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>94.2%</p>
                        <p className={`text-sm mt-2 ${isDark ? 'text-green-400' : 'text-green-600'}`}>Excellent</p>
                      </div>
                    </div>
                  )}

                  {/* Distributions Tab */}
                  {activeTab === 'distributions' && (
                    <div className="space-y-6">
                      <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <h4 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Numerical Variable Summary</h4>
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
                                  <td className={`py-2 px-3 font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{stat.variable}</td>
                                  <td className={`py-2 px-3 text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{stat.mean.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                                  <td className={`py-2 px-3 text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{stat.std.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                                  <td className={`py-2 px-3 text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{stat.min.toLocaleString()}</td>
                                  <td className={`py-2 px-3 text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{stat.p25.toLocaleString()}</td>
                                  <td className={`py-2 px-3 text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{stat.p50.toLocaleString()}</td>
                                  <td className={`py-2 px-3 text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{stat.p75.toLocaleString()}</td>
                                  <td className={`py-2 px-3 text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{stat.max.toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <h4 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Categorical Variable Distribution</h4>
                        <div className="space-y-4">
                          {metrics.categoricalDistributions.map((dist, idx) => (
                            <div key={idx} className={`p-4 rounded-lg ${isDark ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                              <div className="flex justify-between items-start mb-2">
                                <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{dist.variable}</span>
                                <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{dist.categories} categories</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                  Top: <strong>{dist.topCategory}</strong>
                                </span>
                                <span className={`text-sm ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{dist.topPercent.toFixed(1)}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Volume/Event Rate Tab */}
                  {activeTab === 'volume' && (
                    <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                      <h4 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Volume & Event Rate by Segment</h4>
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
                                <td className={`py-3 px-4 text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{vol.count.toLocaleString()}</td>
                                <td className={`py-3 px-4 text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{vol.eventRate.toFixed(1)}%</td>
                                <td className={`py-3 px-4 text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{vol.baselineEventRate.toFixed(1)}%</td>
                                <td className={`py-3 px-4 text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{vol.delta > 0 ? '+' : ''}{vol.delta.toFixed(1)}%</td>
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
                </>
              )}

              {/* Analyze Datasets Button */}
              <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Analyze Datasets for Quality Issues
                </h2>
                <div className="space-y-4">
                  {allAvailableDatasets.length > 0 && (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          Found {allAvailableDatasets.length} dataset{allAvailableDatasets.length > 1 ? 's' : ''}
                        </p>
                        <div className="mt-2">
                          {allAvailableDatasets.map((dataset) => (
                            <div key={dataset.id} className={`inline-flex items-center gap-2 mr-4 text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                              <span>{dataset.name}</span>
                              <span>({(dataset.rows || 0).toLocaleString()} rows)</span>
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
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <Shield size={20} />
                            Run Quality Analysis
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Analysis Results - Quality Issues */}
              {Object.keys(metricsMap).length > 0 && (
                <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                  <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Data Quality Issues Found
                  </h3>
                  <div className="space-y-4">
                    {allAvailableDatasets.map((dataset) => {
                      const m = metricsMap[dataset.id];
                      if (!m || m.issues.length === 0) return null;

                      return (
                        <div key={dataset.id} className={`p-4 rounded-lg border ${isDark ? 'bg-slate-700/30 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{dataset.name}</h4>
                            <div className={`text-sm px-3 py-1 rounded-full ${
                              m.qualityScore >= 80 ? 'bg-green-100 text-green-700' :
                              m.qualityScore >= 60 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              Score: {m.qualityScore}%
                            </div>
                          </div>

                          <div className="space-y-3">
                            {m.issues.map((issue: any, idx: number) => (
                              <div key={idx} className={`p-3 rounded border ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <div>
                                    <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{issue.variable}</span>
                                    <span className={`ml-2 text-xs px-2 py-1 rounded-full ${
                                      issue.severity === 'high' ? 'bg-red-100 text-red-700' :
                                      issue.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-blue-100 text-blue-700'
                                    }`}>
                                      {issue.severity}
                                    </span>
                                  </div>
                                </div>
                                <div className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                                  {issue.type}: {issue.count} records ({issue.percent}%) affected
                                </div>
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
        </div>
      )}
    </div>
  );
};

export default DataQuality;
