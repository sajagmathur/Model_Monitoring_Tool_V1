import React, { useState, useMemo, useEffect } from 'react';
import {
  Package,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  User,
  Trash2,
  Upload,
  X,
  Edit,
  Save,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useGlobal } from '../contexts/GlobalContext';
import { Breadcrumb } from '../components/UIPatterns';
import { getCreationDescription, createCreationLogEntry } from '../utils/workflowLogger';

interface DisplayModel {
  id: string;
  name: string;
  description: string;
  modelType: string;
  versions: any[];
  lineage: string[];
}

const ModelVersionCard: React.FC<{ version: any; modelName: string; onEdit?: () => void; onDelete?: () => void }> = ({ version, modelName, onEdit, onDelete }) => {
  const { theme } = useTheme();

  // Derive status from stage
  const statusMap: Record<string, 'champion' | 'challenger' | 'archive' | 'deprecated'> = {
    production: 'champion',
    staging: 'challenger',
    dev: 'archive',
  };
  const status = statusMap[version.stage || 'dev'] || 'archive';

  const statusColors = {
    champion: {
      bg: theme === 'dark' ? 'bg-yellow-500/20' : 'bg-yellow-100',
      text: theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700',
      border: 'border-yellow-500/30',
    },
    challenger: {
      bg: theme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-100',
      text: theme === 'dark' ? 'text-blue-400' : 'text-blue-700',
      border: 'border-blue-500/30',
    },
    archive: {
      bg: theme === 'dark' ? 'bg-slate-500/20' : 'bg-slate-100',
      text: theme === 'dark' ? 'text-slate-400' : 'text-slate-700',
      border: 'border-slate-500/30',
    },
    deprecated: {
      bg: theme === 'dark' ? 'bg-red-500/20' : 'bg-red-100',
      text: theme === 'dark' ? 'text-red-400' : 'text-red-700',
      border: 'border-red-500/30',
    },
  };

  const colors = statusColors[status];
  const auc = version.metrics?.auc || 0;

  return (
    <div
      className={`p-4 rounded-lg border ${
        theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'
      } hover:shadow-lg transition-all`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <p className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              v{version.version}
            </p>
            <span className={`text-xs font-medium px-2 py-1 rounded border ${colors.bg} ${colors.text} ${colors.border}`}>
              {status}
            </span>
          </div>
          <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
            {modelName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 size={18} className="text-green-500" />
        </div>
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between text-xs">
          <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Stage:</span>
          <span
            className={`font-medium ${
              version.stage === 'production'
                ? 'text-red-500'
                : version.stage === 'staging'
                ? 'text-yellow-500'
                : 'text-blue-500'
            }`}
          >
            {version.stage?.charAt(0).toUpperCase() + version.stage?.slice(1)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>AUC:</span>
          <span className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>{auc.toFixed(3)}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t pb-2 text-xs">
        <User size={12} className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'} />
        <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Added from Projects</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          <Clock size={12} className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'} />
          <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
            {new Date(version.createdAt).toLocaleDateString()}
          </span>
        </div>
        {(onEdit || onDelete) && (
          <div className="flex items-center gap-1">
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className={`p-1.5 rounded ${theme === 'dark' ? 'hover:bg-slate-700 text-blue-400' : 'hover:bg-slate-100 text-blue-600'}`}
                title="Edit version"
              >
                <Edit size={14} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className={`p-1.5 rounded ${theme === 'dark' ? 'hover:bg-slate-700 text-red-400' : 'hover:bg-slate-100 text-red-600'}`}
                title="Delete version"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default function ModelRegistry() {
  const { theme } = useTheme();
  const { registryModels, clearRegistryModels, projects, createRegistryModel, deleteRegistryModel, updateRegistryModel, createWorkflowLog } = useGlobal();
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [modelName, setModelName] = useState('');
  const [modelVersion, setModelVersion] = useState('v1.0');
  const [modelType, setModelType] = useState<'classification' | 'regression' | 'clustering' | 'nlp' | 'custom'>('classification');
  const [modelStage, setModelStage] = useState<'dev' | 'staging' | 'production'>('dev');
  const [selectedProjectId, setSelectedProjectId] = useState('');

  // Auto-select first project when modal opens
  useEffect(() => {
    if (showImportModal && projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [showImportModal, projects, selectedProjectId]);
  const [editingModel, setEditingModel] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    version: '',
    modelType: 'classification' as 'classification' | 'regression' | 'clustering' | 'nlp' | 'custom',
    stage: 'dev' as 'dev' | 'staging' | 'production',
  });

  const handleClearAll = () => {
    if (registryModels.length === 0) return;
    if (confirm(`Are you sure you want to remove all ${registryModels.length} model(s) from the repository? This cannot be undone.`)) {
      clearRegistryModels();
      setSelectedModelId(null);
    }
  };
  const handleEditModel = (model: any) => {
    setEditingModel(model.id);
    setEditFormData({
      name: model.name,
      version: model.version,
      modelType: model.modelType,
      stage: model.stage,
    });
  };

  const handleUpdateModel = (modelId: string) => {
    updateRegistryModel(modelId, {
      name: editFormData.name,
      version: editFormData.version,
      modelType: editFormData.modelType,
      stage: editFormData.stage,
    });
    setEditingModel(null);
    alert('✓ Model updated successfully!');
  };

  const handleDeleteModel = (modelId: string, modelName: string) => {
    if (confirm(`Are you sure you want to delete "${modelName}"? This cannot be undone.`)) {
      deleteRegistryModel(modelId);
      if (selectedModelId === modelId) {
        setSelectedModelId(null);
      }
      alert('✓ Model deleted successfully!');
    }
  };

  const handleCancelEdit = () => {
    setEditingModel(null);
    setEditFormData({
      name: '',
      version: '',
      modelType: 'classification',
      stage: 'dev',
    });
  };
  // Group models by name and organize versions
  const groupedModels = useMemo(() => {
    const groups: Record<string, DisplayModel> = {};

    registryModels.forEach((model) => {
      if (!groups[model.name]) {
        groups[model.name] = {
          id: model.id,
          name: model.name,
          description: `${model.modelType} model from project`,
          modelType: model.modelType.charAt(0).toUpperCase() + model.modelType.slice(1),
          versions: [],
          lineage: [],
        };
      }

      groups[model.name].versions.push({
        id: model.id,
        version: model.version,
        stage: model.stage,
        name: model.name,
        modelType: model.modelType,
        metrics: model.metrics,
        createdAt: model.createdAt,
        status: model.status,
      });

      // Build lineage from versions
      groups[model.name].lineage = groups[model.name].versions.map((v) => `v${v.version}`);
    });

    return Object.values(groups);
  }, [registryModels]);

  // Find selected model using stable ID lookup
  const selectedModel = useMemo(() => {
    if (!selectedModelId || groupedModels.length === 0) {
      return groupedModels.length > 0 ? groupedModels[0] : null;
    }
    
    const found = groupedModels.find((m) => m.id === selectedModelId);
    return found || (groupedModels.length > 0 ? groupedModels[0] : null);
  }, [selectedModelId, groupedModels]);

  // Auto-select first model only when it becomes available
  useEffect(() => {
    if (groupedModels.length > 0 && !selectedModelId) {
      setSelectedModelId(groupedModels[0].id);
    }
  }, [groupedModels.length, selectedModelId]);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Model Repository' }]} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            Model Repository
          </h1>
          <p className={`mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
            Models imported from project workflows
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition font-medium ${
              theme === 'dark'
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            <Upload size={18} />
            Import Model
          </button>
          {registryModels.length > 0 && (
            <button
              onClick={handleClearAll}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition font-medium ${
                theme === 'dark'
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/50'
                  : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
              }`}
              title="Remove all models from repository"
            >
              <Trash2 size={18} />
              Clear All Models
            </button>
          )}
        </div>
      </div>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Models List */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            All Models ({groupedModels.length})
          </h2>

          {groupedModels.length === 0 ? (
            <div
              className={`p-6 rounded-lg border-2 border-dashed text-center ${
                theme === 'dark'
                  ? 'border-slate-600 bg-slate-900/30'
                  : 'border-slate-300 bg-slate-50'
              }`}
            >
              <Package
                size={32}
                className={`mx-auto mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-400'}`}
              />
              <p className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                No models yet
              </p>
              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                Import models from Projects to see them here
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {groupedModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => setSelectedModelId(model.id)}
                  className={`w-full text-left p-3 rounded-lg transition ${
                    selectedModelId === model.id
                      ? theme === 'dark'
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50'
                        : 'bg-blue-50 text-blue-600 border border-blue-300'
                      : theme === 'dark'
                      ? 'text-slate-300 hover:bg-slate-700/30 border border-slate-700'
                      : 'text-slate-700 hover:bg-slate-50 border border-slate-200'
                  } border`}
                >
                  <p className="text-sm font-medium">{model.name}</p>
                  <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                    {model.versions.length} version{model.versions.length !== 1 ? 's' : ''}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Model Details */}
        <div className="lg:col-span-2">
          {selectedModel && groupedModels.length > 0 ? (
            <div className="space-y-6">
              {/* Model Overview */}
              <div
                className={`p-6 rounded-lg border ${
                  theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h2
                      className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}
                    >
                      {selectedModel.name}
                    </h2>
                    <p className={`mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                      {selectedModel.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {selectedModel.versions && selectedModel.versions.length > 0 && (
                      <>
                        <button
                          onClick={() => handleEditModel(selectedModel.versions[0])}
                          className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-slate-700 text-blue-400' : 'hover:bg-slate-100 text-blue-600'}`}
                          title="Edit model"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteModel(selectedModel.versions[0].id, selectedModel.name)}
                          className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-slate-700 text-red-400' : 'hover:bg-slate-100 text-red-600'}`}
                          title="Delete model"
                        >
                          <Trash2 size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                      Model Type
                    </p>
                    <p
                      className={`text-lg font-semibold ${
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      {selectedModel.modelType}
                    </p>
                  </div>
                  <div>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                      Total Versions
                    </p>
                    <p
                      className={`text-lg font-semibold ${
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      {selectedModel.versions.length}
                    </p>
                  </div>
                  <div>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                      Lineage Steps
                    </p>
                    <p
                      className={`text-lg font-semibold ${
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      {selectedModel.lineage.length}
                    </p>
                  </div>
                </div>
              </div>

              {/* Versions */}
              <div>
                <h3
                  className={`text-lg font-semibold mb-4 ${
                    theme === 'dark' ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  Model Versions
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  {selectedModel.versions && selectedModel.versions.length > 0 ? (
                    selectedModel.versions.map((version) => (
                      <React.Fragment key={version.id}>
                        {editingModel === version.id ? (
                          <div
                            className={`p-6 rounded-lg border ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                          >
                            <h4 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                              Edit Version {version.version}
                            </h4>
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                                    Model Name
                                  </label>
                                  <input
                                    type="text"
                                    value={editFormData.name}
                                    onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                                    className={`w-full px-3 py-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                                  />
                                </div>
                                <div>
                                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                                    Version
                                  </label>
                                  <input
                                    type="text"
                                    value={editFormData.version}
                                    onChange={(e) => setEditFormData({...editFormData, version: e.target.value})}
                                    className={`w-full px-3 py-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                                    Model Type
                                  </label>
                                  <select
                                    value={editFormData.modelType}
                                    onChange={(e) => setEditFormData({...editFormData, modelType: e.target.value as any})}
                                    className={`w-full px-3 py-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                                  >
                                    <option value="classification">Classification</option>
                                    <option value="regression">Regression</option>
                                    <option value="clustering">Clustering</option>
                                    <option value="nlp">NLP</option>
                                    <option value="custom">Custom</option>
                                  </select>
                                </div>
                                <div>
                                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                                    Stage
                                  </label>
                                  <select
                                    value={editFormData.stage}
                                    onChange={(e) => setEditFormData({...editFormData, stage: e.target.value as any})}
                                    className={`w-full px-3 py-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                                  >
                                    <option value="dev">Development</option>
                                    <option value="staging">Staging</option>
                                    <option value="production">Production</option>
                                  </select>
                                </div>
                              </div>
                              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                                <button
                                  onClick={handleCancelEdit}
                                  className={`px-4 py-2 rounded-lg font-medium ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-900'}`}
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleUpdateModel(version.id)}
                                  className={`px-4 py-2 rounded-lg flex items-center gap-2 font-medium ${theme === 'dark' ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
                                >
                                  <Save size={16} />
                                  Save Changes
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <ModelVersionCard
                            version={version}
                            modelName={selectedModel.name}
                            onEdit={() => handleEditModel(version)}
                            onDelete={() => handleDeleteModel(version.id, `${selectedModel.name} v${version.version}`)}
                          />
                        )}
                      </React.Fragment>
                    ))
                  ) : (
                    <div className={`p-4 rounded-lg border text-center ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                      <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                        No versions available
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Governance Info */}
              <div
                className={`p-6 rounded-lg border ${
                  theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'
                }`}
              >
                <h3
                  className={`text-lg font-semibold mb-4 ${
                    theme === 'dark' ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  Governance & Lineage
                </h3>

                <div className="space-y-3">
                  <div>
                    <p
                      className={`text-sm font-medium mb-2 ${
                        theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                      }`}
                    >
                      Version Lineage
                    </p>
                    <div className="flex items-center gap-1 flex-wrap">
                      {selectedModel.lineage.map((v, idx) => (
                        <React.Fragment key={v}>
                          <span
                            className={`px-3 py-1 rounded text-xs font-medium ${
                              theme === 'dark'
                                ? 'bg-blue-600/20 text-blue-400'
                                : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            {v}
                          </span>
                          {idx < selectedModel.lineage.length - 1 && (
                            <ChevronRight
                              size={16}
                              className={
                                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                              }
                            />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p
                      className={`text-sm font-medium mb-2 ${
                        theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                      }`}
                    >
                      Governance Status
                    </p>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-green-500" />
                      <span className={theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}>
                        Active in Repository
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div
              className={`p-12 rounded-lg border text-center ${
                theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'
              }`}
            >
              <Package
                size={48}
                className={`mx-auto mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-400'}`}
              />
              <p className={`text-lg font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                Model Repository is Empty
              </p>
              <p className={`mt-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                Import models from Projects workflow to populate the repository
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Import Model Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-lg ${theme === 'dark' ? 'bg-slate-800' : 'bg-white'}`}>
            <div className={`sticky top-0 p-6 border-b ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  Import Model
                </h2>
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setModelFile(null);
                    setModelName('');
                    setModelVersion('v1.0');
                    setSelectedProjectId('');
                  }}
                  className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Project Selection */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                  Target Project * 
                  {selectedProjectId && (
                    <span className={`text-xs ml-2 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
                      ✓ Selected
                    </span>
                  )}
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className={`w-full px-4 py-2 rounded-lg border ${
                    theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="">-- Select Project --</option>
                  {projects && projects.length > 0 ? (
                    projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>
                      No projects available
                    </option>
                  )}
                </select>
                {projects && projects.length === 0 && (
                  <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}`}>
                    ℹ️ Create a project in the Projects section first
                  </p>
                )}
                {projects && projects.length > 0 && (
                  <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                    Model will be added to this project
                  </p>
                )}
              </div>

              {/* Model File Upload */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                  Model File *
                </label>
                <input
                  type="file"
                  accept=".pkl,.pmml,.onnx,.json,.h5"
                  onChange={(e) => setModelFile(e.target.files?.[0] || null)}
                  className={`w-full px-4 py-2 rounded-lg border ${
                    theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
                {modelFile && (
                  <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
                    ✓ Selected: {modelFile.name} ({(modelFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
                <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                  Supported formats: .pkl, .pmml, .onnx, .json, .h5
                </p>
              </div>

              {/* Model Name */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                  Model Name *
                </label>
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="e.g., Credit Risk Model"
                  className={`w-full px-4 py-2 rounded-lg border ${
                    theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>

              {/* Model Version */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                  Version *
                </label>
                <input
                  type="text"
                  value={modelVersion}
                  onChange={(e) => setModelVersion(e.target.value)}
                  placeholder="e.g., v1.0, v2.1"
                  className={`w-full px-4 py-2 rounded-lg border ${
                    theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>

              {/* Model Type */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                  Model Type *
                </label>
                <select
                  value={modelType}
                  onChange={(e) => setModelType(e.target.value as any)}
                  className={`w-full px-4 py-2 rounded-lg border ${
                    theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="classification">Classification</option>
                  <option value="regression">Regression</option>
                  <option value="clustering">Clustering</option>
                  <option value="nlp">NLP</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              {/* Stage */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                  Stage *
                </label>
                <select
                  value={modelStage}
                  onChange={(e) => setModelStage(e.target.value as any)}
                  className={`w-full px-4 py-2 rounded-lg border ${
                    theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="dev">Development</option>
                  <option value="staging">Staging</option>
                  <option value="production">Production</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setModelFile(null);
                    setModelName('');
                    setModelVersion('v1.0');
                    setSelectedProjectId('');
                  }}
                  className={`flex-1 px-4 py-3 rounded-lg font-medium ${
                    theme === 'dark'
                      ? 'bg-slate-700 hover:bg-slate-600 text-white'
                      : 'bg-slate-200 hover:bg-slate-300 text-slate-900'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!selectedProjectId || !modelFile || !modelName) {
                      alert('Please fill in all required fields');
                      return;
                    }

                    // Log creation event FIRST before any state changes
                    const description = getCreationDescription.model(
                      modelName,
                      modelVersion,
                      modelType,
                      modelStage
                    );
                    const project = projects.find(p => p.id === selectedProjectId);
                    if (project) {
                      createWorkflowLog(createCreationLogEntry(
                        project.id,
                        project.name,
                        'Model Created',
                        description
                      ));
                    }

                    createRegistryModel({
                      name: modelName,
                      version: modelVersion,
                      projectId: selectedProjectId,
                      modelType: modelType,
                      stage: modelStage,
                      status: 'active',
                      uploadedFile: {
                        name: modelFile.name,
                        path: `/models/${modelFile.name}`,
                        size: modelFile.size,
                        type: modelFile.type,
                      },
                    });

                    setShowImportModal(false);
                    setModelFile(null);
                    setModelName('');
                    setModelVersion('v1.0');
                    setSelectedProjectId('');
                    
                    alert(`✓ Model "${modelName} ${modelVersion}" imported successfully!`);
                  }}
                  disabled={!selectedProjectId || !modelFile || !modelName}
                  className={`flex-1 px-4 py-3 rounded-lg font-medium ${
                    !selectedProjectId || !modelFile || !modelName
                      ? theme === 'dark'
                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : theme === 'dark'
                      ? 'bg-blue-600 hover:bg-blue-500 text-white'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  Import Model
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
