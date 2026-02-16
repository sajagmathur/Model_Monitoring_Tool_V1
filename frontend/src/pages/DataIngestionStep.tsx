import React, { useState, useEffect } from 'react';
import { Upload, FileText, Database, Settings, X, Link2, Trash2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useGlobal } from '../contexts/GlobalContext';

export type DataTrack = 'Development' | 'OOT' | 'Monitoring' | 'Recent';

export interface UploadedDataset {
  id: string;
  name: string;
  rows: number;
  columns: number;
  uploadedAt: string;
  track: DataTrack;
  columnsList: string[];
  sampleRow?: Record<string, any>;
}

export interface DatasetConfig {
  datasetId: string;
  name: string;
  type: DataTrack;
  datasetType?: 'baseline' | 'reference' | 'monitoring' | 'development';
  refreshLocation?: string;
  performanceMode: 'Early Warning' | 'Full Performance';
  target?: string;
  targets?: string[];
  features: string[];
  segments: string[];
  key?: string;
  exclusions: Record<string, string>;
}

export interface DataIngestionConfig {
  modelId?: string;
  trackDatasets: Record<DataTrack, UploadedDataset[]>;
  datasetConfigs: Record<string, DatasetConfig>;
}

/**
 * Backend contract payload structure (not implemented - for API integration)
 * Payload shape when persisting dataset configs to monitoring pipeline:
 * {
 *   "modelId": "...",
 *   "track": "Monitoring",
 *   "datasets": [
 *     {
 *       "name": "jan_2025_scores.csv",
 *       "type": "Monitoring",
 *       "target": "default_flag",
 *       "features": ["age","income","bureau_score"],
 *       "segments": ["product","channel"],
 *       "key": "loan_id",
 *       "exclusions": { "closed_flag": "1" }
 *     }
 *   ]
 * }
 */

interface Workflow {
  selectedModel?: string;
  models?: { id: string; name: string }[];
}

const TARGET_HEURISTICS = ['default_flag', 'default', 'bad_flag', 'bad', 'outcome', 'target', 'y', 'label', 'flag'];

const detectTargetColumn = (columns: string[]): string | null => {
  const lower = columns.map((c) => c.toLowerCase());
  for (const h of TARGET_HEURISTICS) {
    const idx = lower.findIndex((c) => c.includes(h) || h.includes(c));
    if (idx >= 0) return columns[idx];
  }
  return null;
};

const DatasetConfigDrawer: React.FC<{
  dataset: UploadedDataset;
  config: DatasetConfig;
  onSave: (c: DatasetConfig) => void;
  onClose: () => void;
}> = ({ dataset, config, onSave, onClose }) => {
  const { theme } = useTheme();
  const [cfg, setCfg] = useState<DatasetConfig>(config);
  const isDark = theme === 'dark';

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className={`w-full max-w-lg ${isDark ? 'bg-slate-900' : 'bg-white'} shadow-xl overflow-y-auto`}>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold">Dataset Configuration: {dataset.name}</h3>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            {/* Dataset Type for Reporting */}
            <div>
              <label className="block text-sm font-medium mb-1">Dataset Type (for Reporting)</label>
              <select
                value={cfg.datasetType || 'development'}
                onChange={(e) =>
                  setCfg({ ...cfg, datasetType: e.target.value as 'baseline' | 'reference' | 'monitoring' | 'development' })
                }
                className={`w-full px-3 py-2 rounded border ${theme === 'dark' ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-300'}`}
              >
                <option value="development">Development</option>
                <option value="baseline">Baseline (Reference for comparison)</option>
                <option value="reference">Reference (Current production)</option>
                <option value="monitoring">Monitoring (Ongoing tracking)</option>
              </select>
              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                Baseline and Reference datasets will be available in Report Configuration
              </p>
            </div>

            {/* Refresh Location */}
            <div>
              <label className="block text-sm font-medium mb-1">Refresh Location (Optional)</label>
              <input
                type="text"
                value={cfg.refreshLocation || ''}
                onChange={(e) => setCfg({ ...cfg, refreshLocation: e.target.value })}
                placeholder="e.g., s3://bucket/path, /data/refresh/dataset.csv"
                className={`w-full px-3 py-2 rounded border ${theme === 'dark' ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-300'}`}
              />
              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                Location from where this dataset should be refreshed for scheduled reports
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">4.1 Performance Mode</label>
              <select
                value={cfg.performanceMode}
                onChange={(e) =>
                  setCfg({ ...cfg, performanceMode: e.target.value as 'Early Warning' | 'Full Performance' })
                }
                className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-300'}`}
              >
                <option>Early Warning</option>
                <option>Full Performance</option>
              </select>
            </div>

            {cfg.performanceMode === 'Full Performance' && (
              <div>
                <label className="block text-sm font-medium mb-1">4.2 Target Variable</label>
                <select
                  value={cfg.target || ''}
                  onChange={(e) => setCfg({ ...cfg, target: e.target.value || undefined })}
                  className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-300'}`}
                >
                  <option value="">-- Select target --</option>
                  {dataset.columnsList.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}

            {cfg.performanceMode === 'Early Warning' && (
              <div>
                <label className="block text-sm font-medium mb-1">Target Variables (multiple)</label>
                <select
                  multiple
                  value={cfg.targets || []}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, (o) => o.value);
                    setCfg({ ...cfg, targets: selected });
                  }}
                  className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-300'}`}
                >
                  {dataset.columnsList.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">4.3 Feature Selection (explanatory variables)</label>
              <select
                multiple
                value={cfg.features}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, (o) => o.value);
                  setCfg({ ...cfg, features: selected });
                }}
                className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-300'}`}
              >
                {dataset.columnsList.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">4.4 Segmentation Variables</label>
              <select
                multiple
                value={cfg.segments}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, (o) => o.value);
                  setCfg({ ...cfg, segments: selected });
                }}
                className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-300'}`}
              >
                {dataset.columnsList.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">4.5 Unique Key (Optional)</label>
              <select
                value={cfg.key || ''}
                onChange={(e) => setCfg({ ...cfg, key: e.target.value || undefined })}
                className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-300'}`}
              >
                <option value="">-- None --</option>
                {dataset.columnsList.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">4.6 Exclusion Configuration</label>
              <p className="text-xs text-slate-500 mb-2">
                Add exclusion rules (e.g., closed_flag = 1, fraud = Y)
              </p>
              <div className="space-y-2">
                {Object.entries(cfg.exclusions || {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center text-sm py-1 px-2 bg-slate-100 dark:bg-slate-800 rounded">
                    <span>{k} = {v}</span>
                    <button
                      onClick={() => {
                        const { [k]: _, ...rest } = cfg.exclusions || {};
                        setCfg({ ...cfg, exclusions: rest });
                      }}
                      className="text-red-500 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <ExclusionAdder columns={dataset.columnsList} cfg={cfg} setCfg={setCfg} isDark={isDark} />
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <button
              onClick={onClose}
              className={`flex-1 px-4 py-2 rounded border ${isDark ? 'border-slate-600' : 'border-slate-300'}`}
            >
              Cancel
            </button>
            <button onClick={() => onSave(cfg)} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded">
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ExclusionAdder: React.FC<{
  columns: string[];
  cfg: DatasetConfig;
  setCfg: (c: DatasetConfig) => void;
  isDark: boolean;
}> = ({ columns, cfg, setCfg, isDark }) => {
  const [var_, setVar] = useState('');
  const [val, setVal] = useState('');
  return (
    <div className="flex gap-2">
      <select
        value={var_}
        onChange={(e) => setVar(e.target.value)}
        className={`flex-1 px-3 py-2 rounded border ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-300'}`}
      >
        <option value="">-- Select variable --</option>
        {columns.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <input
        type="text"
        placeholder="Value (e.g. 1, Y)"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className={`flex-1 px-3 py-2 rounded border ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-300'}`}
      />
      <button
        type="button"
        onClick={() => {
          if (var_ && val) {
            setCfg({ ...cfg, exclusions: { ...cfg.exclusions, [var_]: val } });
            setVar('');
            setVal('');
          }
        }}
        className="px-3 py-2 rounded bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600"
      >
        Add
      </button>
    </div>
  );
};

export const DataIngestionStepComponent: React.FC<{
  workflow: Workflow;
  onComplete: (config: DataIngestionConfig) => void;
}> = ({ workflow, onComplete }) => {
  const { theme } = useTheme();
  const { registryModels } = useGlobal();
  const tracks: DataTrack[] = ['Development', 'OOT', 'Monitoring', 'Recent'];
  const [activeTrack, setActiveTrack] = useState<DataTrack>('Development');
  const [trackDatasets, setTrackDatasets] = useState<Record<DataTrack, UploadedDataset[]>>({
    Development: [],
    OOT: [],
    Monitoring: [],
    Recent: [],
  });
  const [datasetConfigs, setDatasetConfigs] = useState<Record<string, DatasetConfig>>({});
  const [configDrawerOpen, setConfigDrawerOpen] = useState(false);
  const [configDatasetId, setConfigDatasetId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>(workflow.selectedModel);

  // Sync selectedModelId with workflow.selectedModel when it changes
  useEffect(() => {
    if (workflow.selectedModel && workflow.selectedModel !== selectedModelId) {
      setSelectedModelId(workflow.selectedModel);
    }
  }, [workflow.selectedModel]);

  // Pull models from GlobalContext instead of workflow
  const availableModels = registryModels.map(model => ({
    id: model.id,
    name: `${model.name} v${model.version}`,
    type: model.modelType,
    version: model.version,
    stage: model.stage,
  }));

  const selectedModel = selectedModelId
    ? availableModels.find((m) => m.id === selectedModelId)
    : null;

  const getInitialConfig = (ds: UploadedDataset): DatasetConfig => {
    const existing = datasetConfigs[ds.id];
    if (existing) return existing;
    const detectedTarget = detectTargetColumn(ds.columnsList);
    const numericOrCat = ds.columnsList;
    return {
      datasetId: ds.id,
      name: ds.name,
      type: ds.track,
      performanceMode: 'Full Performance',
      target: detectedTarget || undefined,
      features: numericOrCat.filter((c) => c !== detectedTarget).slice(0, 10),
      segments: [],
      exclusions: {},
    };
  };

  const handleFileUpload = (file: File, track: DataTrack) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || '';
      const lines = text.split('\n').filter((l) => l.trim());
      const headers = lines[0]?.split(',').map((h) => h.trim().replace(/^"|"$/g, '')) || [];
      const rows = lines.slice(1).filter((l) => l.trim()).length;
      const id = `ds-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const ds: UploadedDataset = {
        id,
        name: file.name,
        rows,
        columns: headers.length,
        uploadedAt: new Date().toISOString(),
        track,
        columnsList: headers,
        sampleRow: {},
      };
      setTrackDatasets((prev) => ({
        ...prev,
        [track]: [...(prev[track] || []), ds],
      }));
    };
    reader.readAsText(file);
  };

  const openConfigDrawer = (datasetId: string) => {
    setConfigDatasetId(datasetId);
    setConfigDrawerOpen(true);
  };

  const saveConfig = (config: DatasetConfig) => {
    setDatasetConfigs((prev) => ({ ...prev, [config.datasetId]: config }));
    setConfigDrawerOpen(false);
  };

  const removeDataset = (datasetId: string, track: DataTrack) => {
    setTrackDatasets((prev) => ({
      ...prev,
      [track]: (prev[track] || []).filter((d) => d.id !== datasetId),
    }));
    setDatasetConfigs((prev) => {
      const next = { ...prev };
      delete next[datasetId];
      return next;
    });
    if (configDatasetId === datasetId) {
      setConfigDrawerOpen(false);
      setConfigDatasetId(null);
    }
  };

  const allDatasets = Object.values(trackDatasets).flat();
  const totalRows = allDatasets.reduce((s, d) => s + d.rows, 0);
  const configs = Object.values(datasetConfigs);
  const targets = [...new Set(configs.flatMap((c) => (c.performanceMode === 'Early Warning' ? c.targets || [] : c.target ? [c.target] : [])))];
  const featureCount = configs.length > 0 ? configs.reduce((s, c) => s + c.features.length, 0) / configs.length : 0;
  const segmentFields = [...new Set(configs.flatMap((c) => c.segments))];
  const exclusionsApplied = configs.reduce((s, c) => s + Object.keys(c.exclusions || {}).length, 0);

  const validateAndSave = () => {
    const errs: string[] = [];
    allDatasets.forEach((ds) => {
      const cfg = datasetConfigs[ds.id];
      if (!cfg) {
        errs.push(`Configure dataset: ${ds.name}`);
        return;
      }
      if (cfg.performanceMode === 'Full Performance' && !cfg.target) errs.push(`Target not selected for ${ds.name}`);
      if (cfg.performanceMode === 'Early Warning' && (!cfg.targets || cfg.targets.length === 0))
        errs.push(`Select at least one target for ${ds.name}`);
      if (!cfg.features || cfg.features.length === 0) errs.push(`No features selected for ${ds.name}`);
    });
    if (allDatasets.length === 0) errs.push('Upload at least one dataset');
    if (!selectedModel) errs.push('Select a model in Model Import step first');
    setValidationErrors(errs);
    if (errs.length > 0) return;

    onComplete({
      modelId: selectedModel?.id,
      trackDatasets,
      datasetConfigs,
    });
  };

  const configDataset = configDatasetId ? allDatasets.find((d) => d.id === configDatasetId) : null;

  return (
    <div className="space-y-6">
      <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
        Data Ingestion & Dataset Configuration
      </h3>

      {/* Model Selector */}
      <div className={`p-6 rounded-lg border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-3 mb-3">
          <Link2 size={20} className={theme === 'dark' ? 'text-blue-400' : 'text-blue-600'} />
          <h4 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            Select Target Model
          </h4>
        </div>
        <p className={`text-xs mb-3 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
          All datasets will be tagged to this model. The model type determines available metrics later.
        </p>
        {availableModels.length > 0 ? (
          <div className="space-y-3">
            <select
              value={selectedModelId || ''}
              onChange={(e) => setSelectedModelId(e.target.value)}
              className={`w-full px-4 py-3 rounded-lg border ${
                theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            >
              <option value="">-- Select a Model --</option>
              {availableModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} | {model.type} | {model.stage}
                </option>
              ))}
            </select>
            {availableModels.length > 0 && (
              <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'}`}>
                {availableModels.length} model{availableModels.length !== 1 ? 's' : ''} available from Model Registry
              </p>
            )}
          </div>
        ) : (
          <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'}`}>
            <p className={`text-sm ${theme === 'dark' ? 'text-amber-300' : 'text-amber-800'}`}>
              No models available. Please import a model in the Model Registry first.
            </p>
          </div>
        )}
        {selectedModel && (
          <div className={`mt-3 p-3 rounded-lg ${theme === 'dark' ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
            <p className={`text-sm font-medium ${theme === 'dark' ? 'text-blue-400' : 'text-blue-700'}`}>
              ✓ Selected: {selectedModel.name}
            </p>
            <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-blue-300' : 'text-blue-600'}`}>
              Type: {selectedModel.type} | Stage: {selectedModel.stage}
            </p>
          </div>
        )}
      </div>

      {!selectedModel && (
        <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'}`}>
          <p className={`text-sm ${theme === 'dark' ? 'text-amber-300' : 'text-amber-800'}`}>
            Please select a model above to continue with data ingestion.
          </p>
        </div>
      )}

      {/* Track Tabs */}
      <div className="flex gap-2 border-b" style={{ borderColor: theme === 'dark' ? '#334155' : '#e2e8f0' }}>
        {tracks.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTrack(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTrack === t ? 'border-blue-500 text-blue-600' : theme === 'dark' ? 'border-transparent text-slate-400 hover:text-slate-300' : 'border-transparent text-slate-600 hover:text-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Upload Panel */}
      <div className={`p-6 rounded-lg border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
        <h4 className={`text-sm font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
          Input Methods
        </h4>
        <div className="flex flex-wrap gap-4">
          <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition ${theme === 'dark' ? 'border-slate-600 hover:bg-slate-700/50' : 'border-slate-300 hover:bg-slate-50'}`}>
            <Upload size={18} />
            <span className="text-sm">CSV Upload</span>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileUpload(f, activeTrack);
                e.target.value = '';
              }}
            />
          </label>
          <button className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${theme === 'dark' ? 'border-slate-600 hover:bg-slate-700/50' : 'border-slate-300 hover:bg-slate-50'}`}>
            <FileText size={18} />
            File Browser
          </button>
          <button className={`flex items-center gap-2 px-4 py-2 rounded-lg border opacity-60 ${theme === 'dark' ? 'border-slate-600' : 'border-slate-300'}`} title="Placeholder for MIDAS or external API">
            <Database size={18} />
            API Connector (placeholder)
          </button>
        </div>
      </div>

      {/* Dataset Cards */}
      <div className="space-y-2">
        <h4 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
          Datasets in {activeTrack}
        </h4>
        {(trackDatasets[activeTrack] || []).length === 0 ? (
          <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
            No datasets uploaded. Use the input methods above.
          </p>
        ) : (
          <div className="grid gap-3">
            {(trackDatasets[activeTrack] || []).map((ds) => {
              const cfg = datasetConfigs[ds.id];
              return (
                <div key={ds.id} className={`p-4 rounded-lg border flex items-center justify-between ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <div>
                    <p className="font-medium">{ds.name}</p>
                    <p className="text-xs text-slate-500">
                      {ds.rows} rows · {ds.columns} columns · {ds.track} · {new Date(ds.uploadedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openConfigDrawer(ds.id)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm ${cfg ? 'bg-green-500/20 text-green-600' : 'bg-blue-500/20 text-blue-600'}`}
                    >
                      <Settings size={14} />
                      {cfg ? 'Edit Config' : 'Configure'}
                    </button>
                    <button
                      onClick={() => removeDataset(ds.id, ds.track)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded text-sm bg-red-500/20 text-red-600 hover:bg-red-500/30 transition"
                      title="Remove dataset"
                    >
                      <Trash2 size={14} />
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dataset Linking */}
      {(trackDatasets[activeTrack] || []).length > 1 && (
        <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
          <h4 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            <Link2 size={16} />
            Dataset Linking
          </h4>
          <p className="text-xs text-slate-500 mb-2">
            Link datasets using Unique Key, Date, or Account ID. Matched % and Missing % will appear after configuration.
          </p>
          <div className="flex gap-2">
            <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400">Matched: --</span>
            <span className="text-xs px-2 py-1 rounded bg-amber-500/20 text-amber-400">Missing: --</span>
          </div>
        </div>
      )}

      {/* Data Summary Card */}
      <div className={`p-6 rounded-lg border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
        <h4 className={`text-sm font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
          Data Summary Checkpoint
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Number of datasets</p>
            <p className="font-semibold">{allDatasets.length}</p>
          </div>
          <div>
            <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Dataset names</p>
            <p className="font-semibold truncate">{allDatasets.map((d) => d.name).join(', ') || '—'}</p>
          </div>
          <div>
            <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Total rows</p>
            <p className="font-semibold">{totalRows}</p>
          </div>
          <div>
            <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Target variable(s)</p>
            <p className="font-semibold">{targets.join(', ') || '—'}</p>
          </div>
          <div>
            <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Feature count</p>
            <p className="font-semibold">{Math.round(featureCount)}</p>
          </div>
          <div>
            <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Segmentation fields</p>
            <p className="font-semibold">{segmentFields.join(', ') || '—'}</p>
          </div>
          <div>
            <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Exclusions applied</p>
            <p className="font-semibold">{exclusionsApplied}</p>
          </div>
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
          <p className="text-sm font-medium text-red-400 mb-2">Validation errors:</p>
          <ul className="text-sm text-red-300 list-disc list-inside">
            {validationErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <button onClick={validateAndSave} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium">
        Save & Continue
      </button>

      {configDrawerOpen && configDataset && (
        <DatasetConfigDrawer
          dataset={configDataset}
          config={getInitialConfig(configDataset)}
          onSave={saveConfig}
          onClose={() => setConfigDrawerOpen(false)}
        />
      )}
    </div>
  );
};
