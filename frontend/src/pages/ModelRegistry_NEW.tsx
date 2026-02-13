import React, { useState } from 'react';
import {
  Package,
  ChevronRight,
  FileJson,
  GitBranch,
  Clock,
  User,
  AlertCircle,
  Layers,
  TrendingUp,
  Lock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { Breadcrumb } from '../components/UIPatterns';

interface ModelVersion {
  id: string;
  version: string;
  status: 'champion' | 'challenger' | 'archive' | 'deprecated';
  riskTier: 'Low' | 'Medium' | 'High';
  owner: string;
  lastValidation: string;
  metrics: {
    auc: number;
    precision: number;
    recall: number;
  };
  validationStatus: 'passed' | 'warning' | 'failed';
}

interface Model {
  id: string;
  name: string;
  folder: string;
  description: string;
  modelType: 'Classification' | 'Regression' | 'Clustering';
  versions: ModelVersion[];
  lineage: string[];
}

const ModelVersionCard: React.FC<{ version: ModelVersion; modelName: string }> = ({ version, modelName }) => {
  const { theme } = useTheme();

  const statusColors = {
    champion: {
      bg: theme === 'dark' ? 'bg-gold-500/20' : 'bg-yellow-100',
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

  const validationIcons = {
    passed: <CheckCircle2 size={16} className="text-green-500" />,
    warning: <AlertTriangle size={16} className="text-yellow-500" />,
    failed: <AlertCircle size={16} className="text-red-500" />,
  };

  const colors = statusColors[version.status];

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
              {version.status}
            </span>
          </div>
          <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
            {modelName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {validationIcons[version.validationStatus]}
        </div>
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between text-xs">
          <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Risk Tier:</span>
          <span
            className={`font-medium ${
              version.riskTier === 'High'
                ? 'text-red-500'
                : version.riskTier === 'Medium'
                ? 'text-yellow-500'
                : 'text-green-500'
            }`}
          >
            {version.riskTier}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>AUC:</span>
          <span className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>{version.metrics.auc.toFixed(3)}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t pb-2 text-xs">
        <User size={12} className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'} />
        <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>{version.owner}</span>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <Clock size={12} className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'} />
        <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>{version.lastValidation}</span>
      </div>
    </div>
  );
};

const ModelCard: React.FC<{ model: Model; onSelect: () => void }> = ({ model, onSelect }) => {
  const { theme } = useTheme();
  const currentVersion = model.versions[0];

  return (
    <div
      onClick={onSelect}
      className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-lg ${
        theme === 'dark' ? 'bg-slate-800/50 border-slate-700 hover:bg-slate-800/70' : 'bg-white border-slate-200 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <Package size={20} className={theme === 'dark' ? 'text-blue-400' : 'text-blue-600'} />
          <div>
            <p className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {model.name}
            </p>
            <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              {model.modelType}
            </p>
          </div>
        </div>
        <ChevronRight size={20} className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'} />
      </div>

      <p className={`text-sm mb-3 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{model.description}</p>

      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between text-xs">
          <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Versions:</span>
          <span className={`font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
            {model.versions.length}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Current:</span>
          <span className={theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}>v{currentVersion.version}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {model.versions.slice(0, 3).map((v) => (
          <span
            key={v.id}
            className={`text-xs px-2 py-1 rounded ${
              theme === 'dark' ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-700'
            }`}
          >
            {v.status === 'champion' ? '⭐' : v.status === 'challenger' ? '🔄' : '📦'} v{v.version}
          </span>
        ))}
      </div>
    </div>
  );
};

export default function ModelRegistry() {
  const { theme } = useTheme();
  const [selectedModelId, setSelectedModelId] = useState<string | null>('credit_risk_v2');

  const models: Model[] = [
    {
      id: 'credit_risk_v2',
      name: 'Credit Risk Scoring',
      folder: 'Risk Management / Credit',
      description: 'Production model for credit risk assessment with real-time monitoring',
      modelType: 'Classification',
      lineage: ['version-1.0', 'version-1.5', 'version-2.0', 'version-2.1'],
      versions: [
        {
          id: 'v21',
          version: '2.1',
          status: 'champion',
          riskTier: 'High',
          owner: 'Risk Team',
          lastValidation: '2026-02-10',
          metrics: { auc: 0.857, precision: 0.812, recall: 0.798 },
          validationStatus: 'passed',
        },
        {
          id: 'v20',
          version: '2.0',
          status: 'challenger',
          riskTier: 'High',
          owner: 'Risk Team',
          lastValidation: '2026-02-01',
          metrics: { auc: 0.842, precision: 0.805, recall: 0.791 },
          validationStatus: 'passed',
        },
        {
          id: 'v15',
          version: '1.5',
          status: 'archive',
          riskTier: 'High',
          owner: 'Risk Team',
          lastValidation: '2026-01-15',
          metrics: { auc: 0.825, precision: 0.798, recall: 0.785 },
          validationStatus: 'warning',
        },
      ],
    },
    {
      id: 'fraud_detection',
      name: 'Fraud Detection Engine',
      folder: 'Risk Management / Fraud',
      description: 'Real-time fraud detection for transactions and accounts',
      modelType: 'Classification',
      lineage: ['version-1.0', 'version-2.0', 'version-3.0'],
      versions: [
        {
          id: 'fv30',
          version: '3.0',
          status: 'champion',
          riskTier: 'High',
          owner: 'Fraud Analytics',
          lastValidation: '2026-02-12',
          metrics: { auc: 0.945, precision: 0.928, recall: 0.911 },
          validationStatus: 'passed',
        },
        {
          id: 'fv20',
          version: '2.0',
          status: 'archive',
          riskTier: 'High',
          owner: 'Fraud Analytics',
          lastValidation: '2026-01-30',
          metrics: { auc: 0.912, precision: 0.895, recall: 0.878 },
          validationStatus: 'failed',
        },
      ],
    },
    {
      id: 'marketing_prop',
      name: 'Marketing Propensity',
      folder: 'Marketing / Campaign Targeting',
      description: 'Customer propensity models for campaign optimization',
      modelType: 'Regression',
      lineage: ['version-1.0', 'version-1.5'],
      versions: [
        {
          id: 'mav15',
          version: '1.5',
          status: 'champion',
          riskTier: 'Low',
          owner: 'Marketing Analytics',
          lastValidation: '2026-02-08',
          metrics: { auc: 0.778, precision: 0.721, recall: 0.695 },
          validationStatus: 'passed',
        },
      ],
    },
  ];

  const selectedModel = models.find((m) => m.id === selectedModelId);

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
            Centralized governance and monitoring of production models
          </p>
        </div>
      </div>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Models List */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            Models by Folder
          </h2>

          {/* Folder Tree */}
          <div className="space-y-2">
            {['Risk Management', 'Marketing', 'Operations'].map((folder) => (
              <div key={folder} className={`rounded-lg border overflow-hidden ${
                theme === 'dark' ? 'border-slate-700' : 'border-slate-200'
              }`}>
                <div className={`p-3 font-medium ${theme === 'dark' ? 'bg-slate-800/50 text-slate-300' : 'bg-slate-100 text-slate-700'}`}>
                  📁 {folder}
                </div>
                <div className={`divide-y ${theme === 'dark' ? 'divide-slate-700' : 'divide-slate-200'}`}>
                  {models
                    .filter((m) => m.folder.startsWith(folder))
                    .map((model) => (
                      <button
                        key={model.id}
                        onClick={() => setSelectedModelId(model.id)}
                        className={`w-full text-left p-3 transition ${
                          selectedModelId === model.id
                            ? theme === 'dark'
                              ? 'bg-blue-600/20 text-blue-400'
                              : 'bg-blue-50 text-blue-600'
                            : theme === 'dark'
                            ? 'text-slate-300 hover:bg-slate-700/30'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <p className="text-sm font-medium">{model.name}</p>
                        <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                          {model.versions.length} versions
                        </p>
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Model Details */}
        <div className="lg:col-span-2">
          {selectedModel ? (
            <div className="space-y-6">
              {/* Model Overview */}
              <div
                className={`p-6 rounded-lg border ${
                  theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      {selectedModel.name}
                    </h2>
                    <p className={`mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                      {selectedModel.folder}
                    </p>
                  </div>
                </div>

                <p className={`mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                  {selectedModel.description}
                </p>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                      Model Type
                    </p>
                    <p className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      {selectedModel.modelType}
                    </p>
                  </div>
                  <div>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                      Total Versions
                    </p>
                    <p className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      {selectedModel.versions.length}
                    </p>
                  </div>
                  <div>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                      Lineage Steps
                    </p>
                    <p className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      {selectedModel.lineage.length}
                    </p>
                  </div>
                </div>
              </div>

              {/* Versions */}
              <div>
                <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  Model Versions
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  {selectedModel.versions.map((version) => (
                    <ModelVersionCard key={version.id} version={version} modelName={selectedModel.name} />
                  ))}
                </div>
              </div>

              {/* Governance Info */}
              <div
                className={`p-6 rounded-lg border ${
                  theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'
                }`}
              >
                <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  Governance & Lineage
                </h3>

                <div className="space-y-3">
                  <div>
                    <p className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                      Version Lineage
                    </p>
                    <div className="flex items-center gap-1 flex-wrap">
                      {selectedModel.lineage.map((v, idx) => (
                        <React.Fragment key={v}>
                          <span className={`px-3 py-1 rounded text-xs font-medium ${
                            theme === 'dark'
                              ? 'bg-blue-600/20 text-blue-400'
                              : 'bg-blue-50 text-blue-700'
                          }`}>
                            {v}
                          </span>
                          {idx < selectedModel.lineage.length - 1 && (
                            <ChevronRight size={16} className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'} />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                      Governance Status
                    </p>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-green-500" />
                      <span className={theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}>
                        Approved for Production
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
              <Package size={48} className={`mx-auto mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-400'}`} />
              <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
                Select a model to view details
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
