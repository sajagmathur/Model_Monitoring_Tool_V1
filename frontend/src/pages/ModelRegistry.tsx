import React, { useState, useMemo } from 'react';
import {
  Package,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  User,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useGlobal } from '../contexts/GlobalContext';
import { Breadcrumb } from '../components/UIPatterns';

interface DisplayModel {
  id: string;
  name: string;
  description: string;
  modelType: string;
  versions: any[];
  lineage: string[];
}

const ModelVersionCard: React.FC<{ version: any; modelName: string }> = ({ version, modelName }) => {
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
      } hover:shadow-lg transition-all cursor-pointer`}
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
          <CheckCircle2 size={16} className="text-green-500" />
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

      <div className="flex items-center gap-2 text-xs">
        <Clock size={12} className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'} />
        <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
          {new Date(version.createdAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
};

export default function ModelRegistry() {
  const { theme } = useTheme();
  const { registryModels } = useGlobal();
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

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
        metrics: model.metrics,
        createdAt: model.createdAt,
        status: model.status,
      });

      // Build lineage from versions
      groups[model.name].lineage = groups[model.name].versions.map((v) => `v${v.version}`);
    });

    return Object.values(groups);
  }, [registryModels]);

  // Set first model as selected if available
  const selectedModel =
    selectedModelId && groupedModels.find((m) => m.id === selectedModelId)
      ? groupedModels.find((m) => m.id === selectedModelId)
      : groupedModels.length > 0
      ? groupedModels[0]
      : null;

  if (selectedModel && !selectedModelId) {
    setSelectedModelId(selectedModel.id);
  }

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
                  <div>
                    <h2
                      className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}
                    >
                      {selectedModel.name}
                    </h2>
                    <p className={`mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                      {selectedModel.description}
                    </p>
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
                  {selectedModel.versions.map((version) => (
                    <ModelVersionCard
                      key={version.id}
                      version={version}
                      modelName={selectedModel.name}
                    />
                  ))}
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
    </div>
  );
}
