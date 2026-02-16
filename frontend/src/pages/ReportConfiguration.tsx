import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useGlobal } from '../contexts/GlobalContext';
import { useNavigate } from 'react-router-dom';
import { getCreationDescription, createCreationLogEntry } from '../utils/workflowLogger';
import {
  Settings,
  TrendingUp,
  Target,
  Brain,
  BarChart3,
  Sliders,
  CheckSquare,
  Square,
  ChevronRight,
  AlertCircle,
  Zap,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
} from 'lucide-react';

const ReportConfiguration: React.FC = () => {
  const { theme } = useTheme();
  const { 
    registryModels, 
    ingestionJobs, 
    reportConfigurations,
    createReportConfiguration,
    updateReportConfiguration,
    deleteReportConfiguration,
    createWorkflowLog,
    projects,
  } = useGlobal();
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    modelId: '',
    baselineDatasetId: '',
    referenceDatasetId: '',
    metricsToMonitor: [] as string[],
    driftMetrics: [] as string[],
  });

  const selectedModel = registryModels.find(m => m.id === formData.modelId);
  
  // Filter datasets by selected model - only show baseline and reference datasets for reporting
  const modelDatasets = ingestionJobs.filter(job => 
    job.modelId === formData.modelId && 
    job.status === 'completed' &&
    (job.datasetType === 'baseline' || job.datasetType === 'reference')
  );

  // Available metrics based on model type
  const getAvailableMetrics = (modelType?: string) => {
    const commonMetrics = [
      { id: 'psi', name: 'PSI (Population Stability Index)', category: 'stability' },
      { id: 'csi', name: 'CSI (Characteristic Stability Index)', category: 'stability' },
      { id: 'jensen_shannon', name: 'Jensen-Shannon Divergence', category: 'stability' },
      { id: 'volume_shift', name: 'Volume & Event Rate Shifts', category: 'stability' },
    ];

    if (modelType === 'classification') {
      return [
        ...commonMetrics,
        { id: 'auc', name: 'AUC (Area Under Curve)', category: 'performance' },
        { id: 'ks', name: 'KS (Kolmogorov-Smirnov)', category: 'performance' },
        { id: 'gini', name: 'Gini Coefficient', category: 'performance' },
        { id: 'precision_recall', name: 'Precision & Recall', category: 'performance' },
        { id: 'f1', name: 'F1 Score', category: 'performance' },
      ];
    } else if (modelType === 'regression') {
      return [
        ...commonMetrics,
        { id: 'rmse', name: 'RMSE (Root Mean Square Error)', category: 'performance' },
        { id: 'mae', name: 'MAE (Mean Absolute Error)', category: 'performance' },
        { id: 'mape', name: 'MAPE (Mean Absolute % Error)', category: 'performance' },
        { id: 'r2', name: 'R² (R-Squared)', category: 'performance' },
      ];
    }

    return commonMetrics;
  };

  const availableMetrics = getAvailableMetrics(selectedModel?.modelType);

  const driftMetrics = [
    { id: 'data_drift', name: 'Data Drift Detection' },
    { id: 'concept_drift', name: 'Concept Drift Detection' },
    { id: 'prediction_drift', name: 'Prediction Drift Analysis' },
    { id: 'feature_drift', name: 'Feature-level Drift Monitoring' },
  ];

  const handleAddConfiguration = () => {
    if (!formData.name || !formData.modelId || !formData.baselineDatasetId || !formData.referenceDatasetId) {
      alert('Please fill in all required fields');
      return;
    }

    if (formData.metricsToMonitor.length === 0) {
      alert('Please select at least one metric to monitor');
      return;
    }

    const modelName = selectedModel ? `${selectedModel.name} v${selectedModel.version}` : '';
    const baselineDataset = modelDatasets.find(d => d.id === formData.baselineDatasetId);
    const referenceDataset = modelDatasets.find(d => d.id === formData.referenceDatasetId);

    if (editingConfigId) {
      // Update existing configuration
      updateReportConfiguration(editingConfigId, {
        ...formData,
        modelName,
        modelType: (selectedModel?.modelType === 'clustering' || 
                     selectedModel?.modelType === 'nlp' || 
                     selectedModel?.modelType === 'custom') 
                     ? 'classification' // Default fallback for unsupported types
                     : selectedModel?.modelType,
        baselineDatasetName: baselineDataset?.name || '',
        referenceDatasetName: referenceDataset?.name || '',
      });
      alert('✓ Configuration updated successfully');
    } else {
      // Log creation event FIRST before any state changes
      const configCount = 1; // Just created one
      const configNames = formData.name;
      const metricsCount = (formData.metricsToMonitor?.length || 0) + (formData.driftMetrics?.length || 0);
      const description = getCreationDescription.reportConfig(
        configCount,
        configNames,
        metricsCount
      );
      const project = projects.find(p => p.id === selectedModel?.projectId);
      if (project) {
        createWorkflowLog(createCreationLogEntry(
          project.id,
          project.name,
          'Report Configuration Created',
          description
        ));
      }
      
      // Create new configuration
      createReportConfiguration({
        ...formData,
        modelName,
        modelType: (selectedModel?.modelType === 'clustering' || 
                     selectedModel?.modelType === 'nlp' || 
                     selectedModel?.modelType === 'custom')
                     ? 'classification' // Default fallback for unsupported types
                     : (selectedModel?.modelType || 'classification'),
        baselineDatasetName: baselineDataset?.name || '',
        referenceDatasetName: referenceDataset?.name || '',
      });

      alert('✓ Configuration added successfully');
    }

    // Reset form
    setFormData({
      name: '',
      modelId: '',
      baselineDatasetId: '',
      referenceDatasetId: '',
      metricsToMonitor: [],
      driftMetrics: [],
    });
    setShowForm(false);
    setEditingConfigId(null);
  };

  const handleEditConfiguration = (config: any) => {
    setFormData({
      name: config.name,
      modelId: config.modelId,
      baselineDatasetId: config.baselineDatasetId,
      referenceDatasetId: config.referenceDatasetId,
      metricsToMonitor: config.metricsToMonitor,
      driftMetrics: config.driftMetrics,
    });
    setEditingConfigId(config.id);
    setShowForm(true);
  };

  const handleDeleteConfiguration = (id: string) => {
    if (confirm('Are you sure you want to delete this configuration?')) {
      deleteReportConfiguration(id);
      alert('✓ Configuration deleted');
    }
  };

  const toggleMetric = (metricId: string) => {
    setFormData(prev => ({
      ...prev,
      metricsToMonitor: prev.metricsToMonitor.includes(metricId)
        ? prev.metricsToMonitor.filter(m => m !== metricId)
        : [...prev.metricsToMonitor, metricId],
    }));
  };

  const toggleDriftMetric = (metricId: string) => {
    setFormData(prev => ({
      ...prev,
      driftMetrics: prev.driftMetrics.includes(metricId)
        ? prev.driftMetrics.filter(m => m !== metricId)
        : [...prev.driftMetrics, metricId],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Report Configuration
          </h1>
          <p className={`mt-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Configure monitoring metrics and datasets for report generation
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingConfigId(null);
            setFormData({
              name: '',
              modelId: '',
              baselineDatasetId: '',
              referenceDatasetId: '',
              metricsToMonitor: [],
              driftMetrics: [],
            });
          }}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
            isDark ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          <Plus size={20} />
          New Configuration
        </button>
      </div>

      {/* Existing Configurations List */}
      {!showForm && reportConfigurations.length > 0 && (
        <div className="space-y-4">
          <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Saved Configurations
          </h2>
          {reportConfigurations.map((config) => (
            <div
              key={config.id}
              className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {config.name}
                  </h3>
                  <div className={`space-y-1 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    <p><strong>Model:</strong> {config.modelName}</p>
                    <p><strong>Model Type:</strong> {config.modelType}</p>
                    <p><strong>Baseline Dataset:</strong> {config.baselineDatasetName}</p>
                    <p><strong>Reference Dataset:</strong> {config.referenceDatasetName}</p>
                    <p><strong>Metrics:</strong> {config.metricsToMonitor.length} selected</p>
                    <p><strong>Drift Metrics:</strong> {config.driftMetrics.length} selected</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEditConfiguration(config)}
                    className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-700 text-blue-400' : 'hover:bg-slate-100 text-blue-600'}`}
                    title="Edit configuration"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleDeleteConfiguration(config.id)}
                    className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-700 text-red-400' : 'hover:bg-slate-100 text-red-600'}`}
                    title="Delete configuration"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {config.metricsToMonitor.slice(0, 5).map((metricId) => {
                  const metric = availableMetrics.find(m => m.id === metricId);
                  return metric ? (
                    <span
                      key={metricId}
                      className={`text-xs px-3 py-1 rounded-full ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'}`}
                    >
                      {metric.name}
                    </span>
                  ) : null;
                })}
                {config.metricsToMonitor.length > 5 && (
                  <span className={`text-xs px-3 py-1 rounded-full ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'}`}>
                    +{config.metricsToMonitor.length - 5} more
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!showForm && reportConfigurations.length === 0 && (
        <div className={`py-16 text-center rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <Settings className={`mx-auto mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} size={64} />
          <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            No Configurations Yet
          </h3>
          <p className={`mb-6 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Create your first report configuration to start monitoring your models
          </p>
          <button
            onClick={() => setShowForm(true)}
            className={`px-6 py-3 rounded-lg font-medium ${isDark ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
          >
            Create Configuration
          </button>
        </div>
      )}

      {/* Configuration Form */}
      {showForm && (
        <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between mb-6">
            <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {editingConfigId ? 'Edit Configuration' : 'New Configuration'}
            </h2>
            <button
              onClick={() => {
                setShowForm(false);
                setEditingConfigId(null);
              }}
              className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-6">
            {/* Configuration Name */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Configuration Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Monthly Credit Risk Monitoring"
                className={`w-full px-4 py-2 rounded-lg border ${
                  isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                }`}
              />
            </div>

            {/* Model Selection */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Select Model *
              </label>
              <select
                value={formData.modelId}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  modelId: e.target.value,
                  baselineDatasetId: '',
                  referenceDatasetId: '',
                })}
                className={`w-full px-4 py-2 rounded-lg border ${
                  isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                }`}
              >
                <option value="">-- Select a Model --</option>
                {registryModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} v{model.version} ({model.modelType})
                  </option>
                ))}
              </select>
            </div>

            {/* Dataset Selection */}
            {formData.modelId && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Baseline Dataset *
                    </label>
                    <select
                      value={formData.baselineDatasetId}
                      onChange={(e) => setFormData({ ...formData, baselineDatasetId: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg border ${
                        isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">-- Select Baseline --</option>
                      {modelDatasets.map((dataset) => (
                        <option key={dataset.id} value={dataset.id}>
                          {dataset.name} ({dataset.rows?.toLocaleString()} rows)
                        </option>
                      ))}
                    </select>
                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                      Development or training dataset
                    </p>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Reference Dataset *
                    </label>
                    <select
                      value={formData.referenceDatasetId}
                      onChange={(e) => setFormData({ ...formData, referenceDatasetId: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg border ${
                        isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">-- Select Reference --</option>
                      {modelDatasets.map((dataset) => (
                        <option key={dataset.id} value={dataset.id}>
                          {dataset.name} ({dataset.rows?.toLocaleString()} rows)
                        </option>
                      ))}
                    </select>
                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                      Current monitoring or OOT dataset
                    </p>
                  </div>
                </div>

                {modelDatasets.length === 0 && (
                  <div className={`p-4 rounded-lg ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
                    <p className={`text-sm ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
                      No datasets found for this model. Please upload datasets and tag them to this model in the Data Ingestion workflow.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Metrics to Monitor */}
            {formData.modelId && (
              <div>
                <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Metrics to Monitor *
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {availableMetrics.map((metric) => (
                    <label
                      key={metric.id}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition ${
                        formData.metricsToMonitor.includes(metric.id)
                          ? isDark ? 'bg-blue-500/20 border border-blue-500/50' : 'bg-blue-50 border border-blue-200'
                          : isDark ? 'bg-slate-700/50 hover:bg-slate-700' : 'bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.metricsToMonitor.includes(metric.id)}
                        onChange={() => toggleMetric(metric.id)}
                        className="rounded"
                      />
                      <div className="flex-1">
                        <div className={`font-medium text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {metric.name}
                        </div>
                        <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          {metric.category}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Drift Metrics */}
            {formData.modelId && (
              <div>
                <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Drift Detection Metrics
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {driftMetrics.map((metric) => (
                    <label
                      key={metric.id}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition ${
                        formData.driftMetrics.includes(metric.id)
                          ? isDark ? 'bg-purple-500/20 border border-purple-500/50' : 'bg-purple-50 border border-purple-200'
                          : isDark ? 'bg-slate-700/50 hover:bg-slate-700' : 'bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.driftMetrics.includes(metric.id)}
                        onChange={() => toggleDriftMetric(metric.id)}
                        className="rounded"
                      />
                      <div className={`font-medium text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {metric.name}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingConfigId(null);
                }}
                className={`px-6 py-2 rounded-lg ${isDark ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-900'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleAddConfiguration}
                className={`px-6 py-2 rounded-lg flex items-center gap-2 ${
                  isDark ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                <Save size={18} />
                {editingConfigId ? 'Update Configuration' : 'Add Report Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportConfiguration;
