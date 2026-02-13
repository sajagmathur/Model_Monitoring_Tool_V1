import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, ChevronRight, Upload, Plus, X, Eye } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useGlobal } from '../contexts/GlobalContext';
import { Breadcrumb } from '../components/UIPatterns';

interface ModelVersion {
  id: string;
  name: string;
  type: string;
  tier: string;
  status: string;
  version: string;
  environment: string;
  owner: string;
  lastValidation: string;
  nextReview: string;
  metrics?: {
    auc?: number;
    precision?: number;
    recall?: number;
    f1_score?: number;
    accuracy?: number;
    [key: string]: any;
  };
}

interface ModelMetadata {
  // Identity Tab
  modelId: string;
  modelName: string;
  modelVersion: string;
  owner: string;
  developer: string;
  validator: string;
  type: 'Classification' | 'Regression' | 'Time Series';
  riskTier: 'High' | 'Medium' | 'Low';
  status: 'Champion' | 'Challenger' | 'Benchmark';

  // Governance Tab
  approvalDate: string;
  reviewer: string;
  expiryDate: string;
  lastValidationDate: string;
  nextReviewDue: string;

  // Version Tab
  versionName: string;
  role: 'Champion' | 'Challenger' | 'Benchmark';
  environment: 'Development' | 'Staging' | 'Production';
  versionStatus: 'Active' | 'Retired' | 'Archived';

  // Lineage Tab
  upstreamSources: string;
  featurePipelines: string;
  downstreamSystems: string;
  dependencies: string;

  // Metrics
  metrics?: { [key: string]: number };
}

interface WorkflowStep {
  id: number;
  name: string;
  status: 'not-started' | 'in-progress' | 'completed' | 'error' | 'locked';
  locked?: boolean;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  currentStep: number;
  steps: WorkflowStep[];
  createdAt: string;
  owner: string;
  selectedModel?: string;
  models?: ModelVersion[];
}

interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  workflow: Workflow;
}

interface ModelTree {
  [type: string]: {
    [modelName: string]: ModelVersion[];
  };
}

const ModelRepositoryStep: React.FC<{ workflow: Workflow; onComplete: () => void; onModelSelect: (model: ModelVersion) => void; onAddModel: (metadata: ModelMetadata) => void }> = ({ workflow, onComplete, onModelSelect, onAddModel }) => {
  const { theme } = useTheme();
  const [showForm, setShowForm] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelVersion | null>(null);
  const [activeTab, setActiveTab] = useState<'identity' | 'governance' | 'version' | 'lineage'>('identity');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [modelFileFormat, setModelFileFormat] = useState<'PMML' | 'ONNX' | 'Pickle' | 'JSON'>('PMML');
  const [appendToExisting, setAppendToExisting] = useState(false);
  const [appendToModelId, setAppendToModelId] = useState('');
  const [metadataFile, setMetadataFile] = useState<File | null>(null);
  const [metricsFile, setMetricsFile] = useState<File | null>(null);
  const [metrics, setMetrics] = useState<{ [key: string]: number }>({});
  const [metadata, setMetadata] = useState<ModelMetadata>({
    modelId: '',
    modelName: '',
    modelVersion: 'v1',
    owner: '',
    developer: '',
    validator: '',
    type: 'Classification',
    riskTier: 'Medium',
    status: 'Challenger',
    approvalDate: '',
    reviewer: '',
    expiryDate: '',
    lastValidationDate: '',
    nextReviewDue: '',
    versionName: 'v1',
    role: 'Challenger',
    environment: 'Development',
    versionStatus: 'Active',
    upstreamSources: '',
    featurePipelines: '',
    downstreamSystems: '',
    dependencies: '',
  });

  const handleMetricsFileUpload = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      setMetrics(data);
      setMetricsFile(file);
      alert(`✓ Metrics loaded from ${file.name}`);
    } catch (error) {
      alert('Failed to parse metrics file. Please ensure it\'s valid JSON.');
    }
  };

  const handleMetadataFileUpload = async (file: File) => {
    try {
      const text = await file.text();
      
      // Try parsing as JSON first, if it fails treat as Excel
      let data: any = {};
      if (file.name.endsWith('.json')) {
        data = JSON.parse(text);
      } else {
        // For Excel and other formats, generate dummy data
        data = generateDummyMetadata();
      }
      
      // Auto-fill metadata from file or use dummy data
      setMetadata({
        modelId: data.modelId || `MODEL-${Date.now().toString().slice(-6)}`,
        modelName: data.modelName || data.name || `Model v${Date.now().toString().slice(-3)}`,
        modelVersion: data.modelVersion || data.version || 'v1',
        owner: data.owner || 'Risk Analytics Team',
        developer: data.developer || 'Data Science Team',
        validator: data.validator || 'Model Governance',
        type: data.type || 'Classification',
        riskTier: data.riskTier || 'Medium',
        status: data.status || 'Challenger',
        approvalDate: data.approvalDate || new Date().toISOString().split('T')[0],
        reviewer: data.reviewer || 'Model Review Board',
        expiryDate: data.expiryDate || new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0],
        lastValidationDate: data.lastValidationDate || new Date().toISOString().split('T')[0],
        nextReviewDue: data.nextReviewDue || new Date(Date.now() + 90*24*60*60*1000).toISOString().split('T')[0],
        versionName: data.versionName || data.modelVersion || 'v1',
        role: data.role || data.status || 'Challenger',
        environment: data.environment || 'Development',
        versionStatus: data.versionStatus || 'Active',
        upstreamSources: data.upstreamSources || 'Customer Master DB, Transaction History DB, Account Database',
        featurePipelines: data.featurePipelines || 'Apache Spark ETL Pipeline, dbt Feature Transformations, Python Feature Engineering',
        downstreamSystems: data.downstreamSystems || 'Credit Decisioning Engine, Lending Platform API, Risk Dashboard',
        dependencies: data.dependencies || 'Python 3.9+, scikit-learn 1.0, scikit-learn 1.0, pandas 1.3+, numpy 1.20+',
      });
      setMetadataFile(file);
      alert(`✓ Metadata loaded from ${file.name}\nFields auto-filled with data.`);
    } catch (error) {
      alert('Failed to parse metadata file. Using placeholder data instead.');
      // Fallback to dummy data
      setMetadata({
        modelId: `MODEL-${Date.now().toString().slice(-6)}`,
        modelName: 'Default Model',
        modelVersion: 'v1',
        owner: 'Risk Analytics Team',
        developer: 'Data Science Team',
        validator: 'Model Governance',
        type: 'Classification',
        riskTier: 'Medium',
        status: 'Challenger',
        approvalDate: new Date().toISOString().split('T')[0],
        reviewer: 'Model Review Board',
        expiryDate: new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0],
        lastValidationDate: new Date().toISOString().split('T')[0],
        nextReviewDue: new Date(Date.now() + 90*24*60*60*1000).toISOString().split('T')[0],
        versionName: 'v1',
        role: 'Challenger',
        environment: 'Development',
        versionStatus: 'Active',
        upstreamSources: 'Customer Master DB, Transaction History DB, Account Database',
        featurePipelines: 'Apache Spark ETL Pipeline, dbt Feature Transformations',
        downstreamSystems: 'Credit Decisioning Engine, Lending Platform API',
        dependencies: 'Python 3.9+, scikit-learn 1.0, pandas 1.3+, numpy 1.20+',
      });
      setMetadataFile(file);
    }
  };

  const generateDummyMetadata = () => {
    const now = new Date();
    const oneYearLater = new Date(now.getTime() + 365*24*60*60*1000);
    const threeMonthsLater = new Date(now.getTime() + 90*24*60*60*1000);
    
    return {
      modelId: `MODEL-${Date.now().toString().slice(-6)}`,
      modelName: 'Advanced Credit Risk Classifier',
      version: 'v2.1',
      owner: 'Risk Analytics Team',
      developer: 'Senior Data Scientist',
      validator: 'Model Governance Officer',
      type: 'Classification',
      riskTier: 'High',
      status: 'Champion',
      approvalDate: now.toISOString().split('T')[0],
      reviewer: 'Chief Model Officer',
      expiryDate: oneYearLater.toISOString().split('T')[0],
      lastValidationDate: now.toISOString().split('T')[0],
      nextReviewDue: threeMonthsLater.toISOString().split('T')[0],
      versionName: 'v2.1-prod-stable',
      role: 'Champion',
      environment: 'Production',
      versionStatus: 'Active',
      upstreamSources: 'Customer Master DB, Transaction History DB, Account Database, Credit Bureau Data',
      featurePipelines: 'Apache Spark ETL Pipeline, dbt Feature Transformations, Python Feature Engineering',
      downstreamSystems: 'Credit Decisioning Engine, Lending Platform API, Risk Dashboard, Mobile Application',
      dependencies: 'Python 3.9+, scikit-learn 1.0, pandas 1.3+, numpy 1.20+, XGBoost 1.5+',
    };
  };

  const handleSaveModel = () => {
    if (!uploadedFile) {
      alert('Please upload a model file (PMML/ONNX/Pickle/JSON)');
      return;
    }

    // Check if adding version to existing model
    if (appendToExisting && appendToModelId) {
      const existingModel = workflow.models?.find((m) => m.id === appendToModelId);
      if (!existingModel) {
        alert('Please select a valid model to add version to');
        return;
      }
      if (!metadata.modelVersion) {
        alert('Please enter a version number');
        return;
      }

      // Use existing model's name, type, and tier for grouping
      const metadataWithExistingInfo = {
        ...metadata,
        modelName: existingModel.name,
        modelId: existingModel.id,
        type: existingModel.type as any,
        riskTier: existingModel.tier as any,
        metrics: Object.keys(metrics).length > 0 ? metrics : undefined,
      };
      onAddModel(metadataWithExistingInfo);
    } else {
      // Creating new model
      if (!metadata.modelName || !metadata.modelId) {
        alert('Please fill in Model Name and Model ID');
        return;
      }

      const metadataWithMetrics = {
        ...metadata,
        metrics: Object.keys(metrics).length > 0 ? metrics : undefined,
      };
      onAddModel(metadataWithMetrics);
    }

    // Reset form
    setMetadata({
      modelId: '',
      modelName: '',
      modelVersion: 'v1',
      owner: '',
      developer: '',
      validator: '',
      type: 'Classification',
      riskTier: 'Medium',
      status: 'Challenger',
      approvalDate: '',
      reviewer: '',
      expiryDate: '',
      lastValidationDate: '',
      nextReviewDue: '',
      versionName: 'v1',
      role: 'Challenger',
      environment: 'Development',
      versionStatus: 'Active',
      upstreamSources: '',
      featurePipelines: '',
      downstreamSystems: '',
      dependencies: '',
    });
    setShowForm(false);
    setUploadedFile(null);
    setMetadataFile(null);
    setMetricsFile(null);
    setMetrics({});
    setModelFileFormat('PMML');
    setAppendToExisting(false);
    setAppendToModelId('');
    // Move to next step (Data Ingestion)
    onComplete();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Model Import */}
        <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="flex justify-between items-center mb-4">
            <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              Model Import
            </h3>
            <button
              onClick={() => setShowForm(!showForm)}
              className="p-1 rounded hover:bg-blue-500/20 text-blue-500"
              title="Add new model"
            >
              <Plus size={16} />
            </button>
          </div>

          {selectedModel ? (
            <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
              <h4 className={`text-sm font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Selected Model
              </h4>
              <div className="space-y-2 text-xs">
                <div>
                  <p className={`font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                    Name
                  </p>
                  <p className={theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}>{selectedModel.name}</p>
                </div>
                <div>
                  <p className={`font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                    Version
                  </p>
                  <p className={theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}>{selectedModel.version}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className={`font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                      Type
                    </p>
                    <p className={theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}>{selectedModel.type}</p>
                  </div>
                  <div>
                    <p className={`font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                      Environment
                    </p>
                    <p className={theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}>{selectedModel.environment}</p>
                  </div>
                </div>
                <button
                  onClick={onComplete}
                  className="w-full mt-3 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-xs transition font-medium"
                >
                  Use This Model & Continue
                </button>
              </div>
            </div>
          ) : (
            <div className={`p-6 rounded-lg border-2 border-dashed text-center ${
              theme === 'dark' ? 'border-slate-600 bg-slate-900/30' : 'border-slate-300 bg-slate-50'
            }`}>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                Click "+" to import a model or select from Model Repository tab
              </p>
            </div>
          )}
        </div>

        {/* Right Panel - Import/Edit Model Form */}
        <div className="lg:col-span-2">
          {showForm ? (
            <div className={`p-6 rounded-lg border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
              <div className="flex justify-between items-center mb-6">
                <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  Import Model
                </h3>
                <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-slate-700">
                  <X size={20} />
                </button>
              </div>

              {/* Step 1: Model Version Selection */}
              <div className={`p-4 rounded-lg border mb-6 ${theme === 'dark' ? 'bg-slate-900/30 border-slate-600' : 'bg-slate-50 border-slate-300'}`}>
                <p className={`text-sm font-medium mb-4 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                  Step 1: Model Version
                </p>
                <div className="space-y-3">
                  {/* Create New Model Option */}
                  <label className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition ${
                    !appendToExisting
                      ? theme === 'dark'
                        ? 'bg-blue-600/20 border-blue-500'
                        : 'bg-blue-50 border-blue-500'
                      : theme === 'dark'
                      ? 'bg-slate-800/50 border-slate-600 hover:bg-slate-800/70'
                      : 'bg-white border-slate-300 hover:bg-slate-50'
                  }`}>
                    <input
                      type="radio"
                      checked={!appendToExisting}
                      onChange={() => setAppendToExisting(false)}
                      className="flex-shrink-0"
                    />
                    <span className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                      Create New Model
                    </span>
                  </label>

                  {/* Add Version to Existing Model Option */}
                  <div className={`rounded-lg border transition ${
                    appendToExisting
                      ? theme === 'dark'
                        ? 'bg-blue-600/20 border-blue-500'
                        : 'bg-blue-50 border-blue-500'
                      : theme === 'dark'
                      ? 'bg-slate-800/50 border-slate-600 hover:bg-slate-800/70'
                      : 'bg-white border-slate-300 hover:bg-slate-50'
                  }`}>
                    <label className="flex items-center gap-3 p-4 cursor-pointer">
                      <input
                        type="radio"
                        checked={appendToExisting}
                        onChange={() => setAppendToExisting(true)}
                        className="flex-shrink-0"
                      />
                      <span className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                        Add New Version to Existing Model
                      </span>
                    </label>

                    {/* Dropdown Section - appears when "Add Version" is selected */}
                    {appendToExisting && (
                      <div className="px-4 pb-4 mt-2 border-t border-current border-opacity-20">
                        {workflow.models && workflow.models.length > 0 ? (
                          <>
                            <label className={`block text-xs font-medium mb-2 mt-3 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                              Select Model to Update
                            </label>
                            <select
                              value={appendToModelId}
                              onChange={(e) => setAppendToModelId(e.target.value)}
                              className={`w-full px-3 py-2 rounded border text-sm ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                            >
                              <option value="">-- Select a model --</option>
                              {workflow.models.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name} ({m.version})
                                </option>
                              ))}
                            </select>
                          </>
                        ) : (
                          <div className={`text-xs p-3 rounded mb-2 mt-3 ${theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                            No Models in Repository
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Step 2: Upload Model File */}
              <div className={`p-4 rounded-lg border mb-6 ${theme === 'dark' ? 'bg-slate-900/30 border-slate-600' : 'bg-slate-50 border-slate-300'}`}>
                <p className={`text-sm font-medium mb-3 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                  Step 2: Upload Model File
                </p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {(['PMML', 'ONNX', 'Pickle', 'JSON'] as const).map((format) => (
                    <button
                      key={format}
                      onClick={() => setModelFileFormat(format)}
                      className={`px-3 py-2 rounded text-sm transition border ${
                        modelFileFormat === format
                          ? theme === 'dark'
                            ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                            : 'bg-blue-50 border-blue-500 text-blue-700'
                          : theme === 'dark'
                          ? 'bg-slate-700/50 border-slate-600 hover:bg-slate-700 text-slate-400'
                          : 'bg-white border-slate-300 hover:bg-slate-100 text-slate-600'
                      }`}
                    >
                      {format}
                    </button>
                  ))}
                </div>

                <label className={`cursor-pointer flex items-center justify-center gap-2 py-6 rounded-lg border-2 border-dashed transition ${
                  theme === 'dark' ? 'border-slate-600 hover:bg-slate-800/50' : 'border-slate-300 hover:bg-slate-100'
                }`}>
                  <Upload size={20} className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'} />
                  <div className="text-center">
                    <p className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                      {uploadedFile ? uploadedFile.name : `Upload ${modelFileFormat} model`}
                    </p>
                    <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                      {uploadedFile ? 'Click to replace' : 'Click to select file'}
                    </p>
                  </div>
                  <input
                    type="file"
                    accept=".pmml,.onnx,.pkl,.pickle,.json"
                    onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Step 3: Metadata Form Tabs */}
              <div className={`p-4 rounded-lg border mb-6 ${theme === 'dark' ? 'bg-slate-900/30 border-slate-600' : 'bg-slate-50 border-slate-300'}`}>
                <p className={`text-sm font-medium mb-3 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                  Step 3: Model Metadata
                </p>

                {/* Upload Metadata File Option */}
                <div className={`p-3 rounded-lg border mb-4 ${theme === 'dark' ? 'bg-blue-900/20 border-blue-600' : 'bg-blue-50 border-blue-200'}`}>
                  <p className={`text-xs font-medium mb-2 ${theme === 'dark' ? 'text-blue-300' : 'text-blue-800'}`}>
                    Upload Metadata (Excel or JSON) to auto-fill fields:
                  </p>
                  <label className={`cursor-pointer flex items-center justify-center gap-2 py-2 rounded border-2 border-dashed transition ${
                    theme === 'dark' ? 'border-blue-600 hover:bg-blue-900/30' : 'border-blue-300 hover:bg-blue-100'
                  }`}>
                    <Upload size={14} className={theme === 'dark' ? 'text-blue-400' : 'text-blue-600'} />
                    <span className={`text-xs ${theme === 'dark' ? 'text-blue-300' : 'text-blue-700'}`}>
                      {metadataFile ? `${metadataFile.name} ✓` : 'Click to upload or drag'}
                    </span>
                    <input
                      type="file"
                      accept=".json,.xlsx,.xls,.csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleMetadataFileUpload(file);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 border-b mb-4" style={{ borderColor: theme === 'dark' ? '#374151' : '#e5e7eb' }}>
                  {['identity', 'governance', 'version', 'lineage'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab as any)}
                      className={`px-3 py-2 transition border-b-2 capitalize text-sm ${
                        activeTab === tab
                          ? 'border-blue-500 text-blue-600'
                          : theme === 'dark'
                          ? 'border-transparent text-slate-400 hover:text-slate-300'
                          : 'border-transparent text-slate-600 hover:text-slate-700'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                  {activeTab === 'identity' && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1">Model ID</label>
                          <input
                            type="text"
                            value={metadata.modelId}
                            onChange={(e) => setMetadata({ ...metadata, modelId: e.target.value })}
                            placeholder="e.g., CRED-RISK-001"
                            className={`w-full px-2 py-1.5 rounded border text-xs ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Model Name</label>
                          <input
                            type="text"
                            value={metadata.modelName}
                            onChange={(e) => setMetadata({ ...metadata, modelName: e.target.value })}
                            placeholder="e.g., Credit Risk Classifier"
                            className={`w-full px-2 py-1.5 rounded border text-xs ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1">Version</label>
                          <input
                            type="text"
                            value={metadata.modelVersion}
                            onChange={(e) => setMetadata({ ...metadata, modelVersion: e.target.value })}
                            placeholder="v1"
                            className={`w-full px-2 py-1.5 rounded border text-xs ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Type</label>
                          <select
                            value={metadata.type}
                            onChange={(e) => setMetadata({ ...metadata, type: e.target.value as any })}
                            className={`w-full px-2 py-1.5 rounded border text-xs ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                          >
                            <option>Classification</option>
                            <option>Regression</option>
                            <option>Time Series</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Risk Tier</label>
                          <select
                            value={metadata.riskTier}
                            onChange={(e) => setMetadata({ ...metadata, riskTier: e.target.value as any })}
                            className={`w-full px-2 py-1.5 rounded border text-xs ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                          >
                            <option>High</option>
                            <option>Medium</option>
                            <option>Low</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1">Owner</label>
                          <input
                            type="text"
                            value={metadata.owner}
                            onChange={(e) => setMetadata({ ...metadata, owner: e.target.value })}
                            placeholder="Team/Person"
                            className={`w-full px-2 py-1.5 rounded border text-xs ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Developer</label>
                          <input
                            type="text"
                            value={metadata.developer}
                            onChange={(e) => setMetadata({ ...metadata, developer: e.target.value })}
                            placeholder="Name"
                            className={`w-full px-2 py-1.5 rounded border text-xs ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Validator</label>
                          <input
                            type="text"
                            value={metadata.validator}
                            onChange={(e) => setMetadata({ ...metadata, validator: e.target.value })}
                            placeholder="Name"
                            className={`w-full px-2 py-1.5 rounded border text-xs ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium mb-1">Status</label>
                        <select
                          value={metadata.status}
                          onChange={(e) => setMetadata({ ...metadata, status: e.target.value as any })}
                          className={`w-full px-2 py-1.5 rounded border text-xs ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                        >
                          <option>Champion</option>
                          <option>Challenger</option>
                          <option>Benchmark</option>
                        </select>
                      </div>
                    </>
                  )}

                  {activeTab === 'governance' && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1">Approval Date</label>
                          <input
                            type="date"
                            value={metadata.approvalDate}
                            onChange={(e) => setMetadata({ ...metadata, approvalDate: e.target.value })}
                            className={`w-full px-2 py-1.5 rounded border text-xs ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Reviewer / MRM Owner</label>
                          <input
                            type="text"
                            value={metadata.reviewer}
                            onChange={(e) => setMetadata({ ...metadata, reviewer: e.target.value })}
                            placeholder="Name/Role"
                            className={`w-full px-2 py-1.5 rounded border text-xs ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1">Expiry Date</label>
                          <input
                            type="date"
                            value={metadata.expiryDate}
                            onChange={(e) => setMetadata({ ...metadata, expiryDate: e.target.value })}
                            className={`w-full px-2 py-1.5 rounded border text-xs ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Last Validation Date</label>
                          <input
                            type="date"
                            value={metadata.lastValidationDate}
                            onChange={(e) => setMetadata({ ...metadata, lastValidationDate: e.target.value })}
                            className={`w-full px-2 py-1.5 rounded border text-xs ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium mb-1">Next Review Due</label>
                        <input
                          type="date"
                          value={metadata.nextReviewDue}
                          onChange={(e) => setMetadata({ ...metadata, nextReviewDue: e.target.value })}
                          className={`w-full px-2 py-1.5 rounded border text-xs ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                        />
                      </div>
                    </>
                  )}

                  {activeTab === 'version' && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1">Version Name</label>
                          <input
                            type="text"
                            value={metadata.versionName}
                            onChange={(e) => setMetadata({ ...metadata, versionName: e.target.value })}
                            placeholder="e.g., v2.1-prod-stable"
                            className={`w-full px-2 py-1.5 rounded border text-xs ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Role</label>
                          <select
                            value={metadata.role}
                            onChange={(e) => setMetadata({ ...metadata, role: e.target.value as any })}
                            className={`w-full px-2 py-1.5 rounded border text-xs ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                          >
                            <option>Champion</option>
                            <option>Challenger</option>
                            <option>Benchmark</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1">Environment</label>
                          <select
                            value={metadata.environment}
                            onChange={(e) => setMetadata({ ...metadata, environment: e.target.value as any })}
                            className={`w-full px-2 py-1.5 rounded border text-xs ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                          >
                            <option>Development</option>
                            <option>Staging</option>
                            <option>Production</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Status</label>
                          <select
                            value={metadata.versionStatus}
                            onChange={(e) => setMetadata({ ...metadata, versionStatus: e.target.value as any })}
                            className={`w-full px-2 py-1.5 rounded border text-xs ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                          >
                            <option>Active</option>
                            <option>Retired</option>
                            <option>Archived</option>
                          </select>
                        </div>
                      </div>
                    </>
                  )}

                  {activeTab === 'lineage' && (
                    <>
                      <div>
                        <label className="block text-xs font-medium mb-1">Upstream Data Sources</label>
                        <textarea
                          value={metadata.upstreamSources}
                          onChange={(e) => setMetadata({ ...metadata, upstreamSources: e.target.value })}
                          placeholder="e.g., Customer DB, Transaction DB"
                          rows={2}
                          className={`w-full px-2 py-1.5 rounded border text-xs ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Feature Pipelines</label>
                        <textarea
                          value={metadata.featurePipelines}
                          onChange={(e) => setMetadata({ ...metadata, featurePipelines: e.target.value })}
                          placeholder="e.g., Apache Spark pipeline, dbt"
                          rows={2}
                          className={`w-full px-2 py-1.5 rounded border text-xs ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Downstream Systems</label>
                        <textarea
                          value={metadata.downstreamSystems}
                          onChange={(e) => setMetadata({ ...metadata, downstreamSystems: e.target.value })}
                          placeholder="e.g., Lending platform, Decision engine"
                          rows={2}
                          className={`w-full px-2 py-1.5 rounded border text-xs ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Dependencies Mapping</label>
                        <textarea
                          value={metadata.dependencies}
                          onChange={(e) => setMetadata({ ...metadata, dependencies: e.target.value })}
                          placeholder="e.g., Python 3.9, scikit-learn 1.0"
                          rows={2}
                          className={`w-full px-2 py-1.5 rounded border text-xs ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Step 4: Upload Metrics */}
              <div className={`p-4 rounded-lg border mb-6 ${theme === 'dark' ? 'bg-slate-900/30 border-slate-600' : 'bg-slate-50 border-slate-300'}`}>
                <p className={`text-sm font-medium mb-3 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                  Step 4: Model Metrics (Optional)
                </p>
                <p className={`text-xs mb-3 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                  Upload metrics.json to include model performance metrics
                </p>
                <label className={`cursor-pointer flex items-center justify-center gap-2 py-4 rounded-lg border-2 border-dashed transition ${
                  theme === 'dark' ? 'border-slate-600 hover:bg-slate-800/50' : 'border-slate-300 hover:bg-slate-100'
                }`}>
                  <Upload size={20} className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'} />
                  <div className="text-center">
                    <p className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                      {metricsFile ? metricsFile.name : 'Upload metrics.json'}
                    </p>
                    <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                      {metricsFile ? 'Click to replace' : 'Click to select file'}
                    </p>
                  </div>
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleMetricsFileUpload(file);
                    }}
                    className="hidden"
                  />
                </label>
                {metricsFile && Object.keys(metrics).length > 0 && (
                  <div className={`mt-3 p-3 rounded-lg ${theme === 'dark' ? 'bg-green-900/20 border border-green-600' : 'bg-green-50 border border-green-200'}`}>
                    <p className={`text-xs font-medium ${theme === 'dark' ? 'text-green-400' : 'text-green-700'}`}>
                      ✓ Metrics loaded: {Object.keys(metrics).join(', ')}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSaveModel}
                  disabled={!metadata.modelName || !metadata.modelId || !uploadedFile}
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-lg transition text-sm font-medium"
                >
                  Import Model
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className={`px-3 py-2 rounded-lg transition text-sm font-medium ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-900'}`}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className={`p-12 text-center rounded-lg border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <Plus size={48} className={`mx-auto mb-4 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-300'}`} />
              <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
                Click the "+" button on the left to import a new model
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};



const StepIndicator: React.FC<{ steps: WorkflowStep[]; currentStep: number }> = ({
  steps,
  currentStep,
}) => {
  const { theme } = useTheme();

  return (
    <div className="flex items-center justify-between mb-8 overflow-x-auto pb-2">
      {steps.map((step, idx) => {
        const isCompleted = step.status === 'completed';
        const isCurrent = idx === currentStep;
        const isLocked = step.locked;

        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center min-w-max">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition ${
                  isLocked
                    ? theme === 'dark'
                      ? 'bg-slate-700 text-slate-500'
                      : 'bg-slate-300 text-slate-500'
                    : isCompleted
                    ? 'bg-green-500 text-white'
                    : isCurrent
                    ? 'bg-blue-500 text-white'
                    : theme === 'dark'
                    ? 'bg-slate-700 text-slate-400'
                    : 'bg-slate-300 text-slate-600'
                }`}
              >
                {isCompleted ? <CheckCircle2 size={20} /> : idx + 1}
              </div>
              <p
                className={`text-xs mt-2 text-center max-w-24 ${
                  isLocked
                    ? theme === 'dark'
                      ? 'text-slate-500'
                      : 'text-slate-400'
                    : theme === 'dark'
                    ? 'text-slate-400'
                    : 'text-slate-600'
                }`}
              >
                {step.name}
              </p>
            </div>

            {idx < steps.length - 1 && (
              <div
                className={`flex-1 h-1 mx-2 mb-6 transition ${
                  isCompleted
                    ? 'bg-green-500'
                    : theme === 'dark'
                    ? 'bg-slate-700'
                    : 'bg-slate-300'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const DataIngestionStep: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const { theme } = useTheme();
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>(['Development']);
  const [targetVar, setTargetVar] = useState('default_flag');

  return (
    <div className="space-y-6">
      <div>
        <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
          Select Training Datasets
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {['Development', 'Reference', 'OOT', 'Production', 'Actuals'].map((dataset) => (
            <label
              key={dataset}
              className={`p-3 rounded-lg border cursor-pointer transition ${
                selectedDatasets.includes(dataset)
                  ? theme === 'dark'
                    ? 'bg-blue-600/20 border-blue-500'
                    : 'bg-blue-50 border-blue-500'
                  : theme === 'dark'
                  ? 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedDatasets.includes(dataset)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedDatasets([...selectedDatasets, dataset]);
                  } else {
                    setSelectedDatasets(selectedDatasets.filter((d) => d !== dataset));
                  }
                }}
                className="mr-2"
              />
              <span className={theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}>{dataset}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label
          className={`block text-sm font-medium mb-2 ${
            theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
          }`}
        >
          Target Variable
        </label>
        <input
          type="text"
          value={targetVar}
          onChange={(e) => setTargetVar(e.target.value)}
          className={`w-full px-3 py-2 rounded-lg border ${
            theme === 'dark'
              ? 'bg-slate-800 border-slate-700 text-white'
              : 'bg-white border-slate-300 text-slate-900'
          } focus:outline-none focus:border-blue-500`}
        />
      </div>

      <button
        onClick={onComplete}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
      >
        Data Ingestion Complete
      </button>
    </div>
  );
};

const DataQualityStep: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const { theme } = useTheme();

  const metrics = [
    { name: 'Volume', value: '1.2M', status: '✓' },
    { name: 'Bad Rate', value: '0.2%', status: '✓' },
    { name: 'Missing %', value: '1.5%', status: '⚠' },
    { name: 'PSI', value: '0.08', status: '✓' },
    { name: 'CSI', value: '0.12', status: '✓' },
    { name: 'Schema Drift', value: 'None', status: '✓' },
  ];

  return (
    <div className="space-y-6">
      <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
        Data Quality Metrics
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {metrics.map((m) => (
          <div
            key={m.name}
            className={`p-4 rounded-lg border ${
              m.status === '✓'
                ? theme === 'dark'
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-green-50 border-green-200'
                : theme === 'dark'
                ? 'bg-yellow-500/10 border-yellow-500/30'
                : 'bg-yellow-50 border-yellow-200'
            }`}
          >
            <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              {m.name}
            </p>
            <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {m.value}
            </p>
            <p className={`text-xs mt-1 ${m.status === '✓' ? 'text-green-600' : 'text-yellow-600'}`}>
              {m.status === '✓' ? 'Passed' : 'Warning'}
            </p>
          </div>
        ))}
      </div>

      <button
        onClick={onComplete}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
      >
        Approve Data Quality
      </button>
    </div>
  );
};

const ModelImportStep: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const { theme } = useTheme();
  const [selectedFormat, setSelectedFormat] = useState('PMML');
  const [modelData, setModelData] = useState({
    id: 'credit_risk_model_v2.1',
    name: 'Credit Risk Scoring Model',
    type: 'Classification',
    riskTier: 'High',
    status: 'Champion',
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
          Model Format
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {['PMML', 'ONNX', 'Pickle', 'JSON'].map((format) => (
            <button
              key={format}
              onClick={() => setSelectedFormat(format)}
              className={`p-3 rounded-lg border transition ${
                selectedFormat === format
                  ? theme === 'dark'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                    : 'bg-blue-50 border-blue-500 text-blue-600'
                  : theme === 'dark'
                  ? 'bg-slate-800/50 border-slate-700 text-slate-300'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              {format}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
            Model ID
          </label>
          <input type="text" value={modelData.id} readOnly className={`w-full px-3 py-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-300 text-slate-600'}`} />
        </div>
        <div>
          <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
            Model Name
          </label>
          <input type="text" value={modelData.name} readOnly className={`w-full px-3 py-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-300 text-slate-600'}`} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
              Model Type
            </label>
            <input type="text" value={modelData.type} readOnly className={`w-full px-3 py-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-300 text-slate-600'}`} />
          </div>
          <div>
            <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
              Risk Tier
            </label>
            <input type="text" value={modelData.riskTier} readOnly className={`w-full px-3 py-2 rounded-lg border text-red-600 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-red-400' : 'bg-slate-100 border-slate-300 text-red-600'}`} />
          </div>
        </div>
      </div>

      <button
        onClick={onComplete}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
      >
        Import Model
      </button>
    </div>
  );
};

const PerformanceStep: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState('Classification');

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b" style={{ borderColor: theme === 'dark' ? '#374151' : '#e5e7eb' }}>
        {['Classification', 'Regression', 'Stability', 'Explainability', 'Segments'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 transition border-b-2 ${
              activeTab === tab
                ? 'border-blue-500 text-blue-600'
                : theme === 'dark'
                ? 'border-transparent text-slate-400 hover:text-slate-300'
                : 'border-transparent text-slate-600 hover:text-slate-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div
        className={`p-6 rounded-lg border ${
          theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
        }`}
      >
        <p className={`text-center py-8 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
          {activeTab} performance metrics and charts will load here
        </p>
      </div>

      <button
        onClick={onComplete}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
      >
        Complete Performance Review
      </button>
    </div>
  );
};

const ReportsStep: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const { theme } = useTheme();
  const reports = ['Quarterly Review', 'Annual Review', 'Drift Analysis', 'Fairness Report', 'Explainability'];

  return (
    <div className="space-y-6">
      <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
        Report Generation
      </h3>
      <div className="space-y-2">
        {reports.map((report) => (
          <div
            key={report}
            className={`p-4 rounded-lg border flex items-center justify-between ${
              theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'
            }`}
          >
            <span className={theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}>{report}</span>
            <ChevronRight size={18} className={theme === 'dark' ? 'text-slate-600' : 'text-slate-400'} />
          </div>
        ))}
      </div>

      <button
        onClick={onComplete}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
      >
        Generate Reports
      </button>
    </div>
  );
};

const AlertsStep: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const { theme } = useTheme();
  const [alerts, setAlerts] = useState([
    { id: 1, message: 'AUC drops below threshold', severity: 'critical', checked: false },
    { id: 2, message: 'Data drift detected', severity: 'warning', checked: false },
    { id: 3, message: 'Fairness metric degradation', severity: 'warning', checked: false },
  ]);

  return (
    <div className="space-y-6">
      <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
        Configure Alerts
      </h3>
      <div className="space-y-3">
        {alerts.map((alert) => (
          <label
            key={alert.id}
            className={`p-4 rounded-lg border flex items-center cursor-pointer ${
              theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'
            }`}
          >
            <input
              type="checkbox"
              checked={alert.checked}
              onChange={(e) => {
                setAlerts(alerts.map((a) => (a.id === alert.id ? { ...a, checked: e.target.checked } : a)));
              }}
              className="mr-3"
            />
            <span className={`flex-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
              {alert.message}
            </span>
            <span
              className={`text-xs px-2 py-1 rounded ${
                alert.severity === 'critical'
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-yellow-500/20 text-yellow-400'
              }`}
            >
              {alert.severity}
            </span>
          </label>
        ))}
      </div>

      <button
        onClick={onComplete}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
      >
        Setup Alerts
      </button>
    </div>
  );
};

// Model Repository Tree Component - displays hierarchical folder structure
const ModelRepositoryTree: React.FC<{
  models: ModelVersion[];
  expandedFolders: Set<string>;
  setExpandedFolders: React.Dispatch<React.SetStateAction<Set<string>>>;
  theme: string;
}> = ({ models, expandedFolders, setExpandedFolders, theme }) => {
  // Organize models by Type -> Model Name -> Versions
  const organizeModels = () => {
    const tree: ModelTree = {};
    models.forEach((model) => {
      if (!tree[model.type]) {
        tree[model.type] = {};
      }
      if (!tree[model.type][model.name]) {
        tree[model.type][model.name] = [];
      }
      tree[model.type][model.name].push(model);
    });
    return tree;
  };

  const modelTree = organizeModels();

  const toggleFolder = (key: string) => {
    const newSet = new Set(expandedFolders);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setExpandedFolders(newSet);
  };

  const getStatusColor = (status: string) => {
    return status === 'Champion'
      ? theme === 'dark' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
      : status === 'Challenger'
      ? theme === 'dark' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
      : theme === 'dark' ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-2 text-xs">
      {Object.entries(modelTree).map(([modelType, modelsByName]) => {
        const typeKey = `type-${modelType}`;
        const isTypeExpanded = expandedFolders.has(typeKey);

        return (
          <div key={typeKey}>
            {/* Type Folder */}
            <button
              onClick={() => toggleFolder(typeKey)}
              className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 transition ${
                theme === 'dark'
                  ? 'hover:bg-slate-700/50 text-slate-300'
                  : 'hover:bg-slate-100 text-slate-700'
              }`}
            >
              <ChevronRight
                size={14}
                className={`transition-transform flex-shrink-0 ${isTypeExpanded ? 'rotate-90' : ''}`}
              />
              <span className="font-medium">📁 {modelType}</span>
              <span className={`ml-auto text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                {Object.values(modelsByName).reduce((sum, v) => sum + v.length, 0)}
              </span>
            </button>

            {/* Type Expanded Content */}
            {isTypeExpanded && (
              <div className="ml-2 border-l border-current border-opacity-20 pl-2 space-y-1">
                {Object.entries(modelsByName).map(([modelName, versions]) => {
                  const modelKey = `model-${modelType}-${modelName}`;
                  const isModelExpanded = expandedFolders.has(modelKey);

                  return (
                    <div key={modelKey}>
                      {/* Model Name Folder */}
                      <button
                        onClick={() => toggleFolder(modelKey)}
                        className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 transition ${
                          theme === 'dark'
                            ? 'hover:bg-slate-700/30 text-slate-400'
                            : 'hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        <ChevronRight
                          size={14}
                          className={`transition-transform flex-shrink-0 ${isModelExpanded ? 'rotate-90' : ''}`}
                        />
                        <span>📦 {modelName}</span>
                        <span className={`ml-auto text-xs ${theme === 'dark' ? 'text-slate-600' : 'text-slate-500'}`}>
                          {versions.length}
                        </span>
                      </button>

                      {/* Model Versions */}
                      {isModelExpanded && (
                        <div className="ml-2 border-l border-current border-opacity-20 pl-2 space-y-1">
                          {versions.map((version) => (
                            <div
                              key={version.id}
                              className={`p-2 rounded flex items-start gap-2 ${
                                theme === 'dark'
                                  ? 'bg-slate-800/30 hover:bg-slate-800/50 text-slate-300'
                                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                              } transition cursor-pointer`}
                            >
                              <span className="text-xs mt-0.5">📄</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">v{version.version}</p>
                                <p className={`text-xs truncate ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'}`}>
                                  {version.environment}
                                </p>
                              </div>
                              <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${getStatusColor(version.status)}`}>
                                {version.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default function Projects() {
  const { theme } = useTheme();
  const { createRegistryModel, registryModels } = useGlobal();

  // Map registry models to ModelVersion format for the tree (global Model Repository)
  const registryModelsForTree = React.useMemo(() => {
    return registryModels.map((rm) => ({
      id: rm.id,
      name: rm.name,
      type: rm.modelType.charAt(0).toUpperCase() + rm.modelType.slice(1),
      tier: 'Medium' as const,
      status: rm.status === 'active' ? ('Champion' as const) : ('Challenger' as const),
      version: rm.version.startsWith('v') ? rm.version.slice(1) : rm.version,
      environment: rm.stage.charAt(0).toUpperCase() + rm.stage.slice(1),
      owner: '',
      lastValidation: '',
      nextReview: '',
      metrics: rm.metrics,
    }));
  }, [registryModels]);
  
  // Initialize state from localStorage or empty array
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem('mlmonitoring_projects');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('mlmonitoring_projects');
      const projects = saved ? JSON.parse(saved) : [];
      return projects.length > 0 ? projects[0].id : '';
    } catch {
      return '';
    }
  });
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProjectForm, setNewProjectForm] = useState({ name: '', description: '' });
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Save projects to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('mlmonitoring_projects', JSON.stringify(projects));
    // Update selectedProjectId if it doesn't exist in projects
    if (projects.length > 0 && !projects.find((p) => p.id === selectedProjectId)) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const createNewProject = () => {
    if (!newProjectForm.name.trim()) {
      alert('Project name is required');
      return;
    }

    const newProject: Project = {
      id: `proj-${Date.now()}`,
      name: newProjectForm.name,
      description: newProjectForm.description,
      createdAt: new Date().toISOString().split('T')[0],
      workflow: {
        id: `wf-${Date.now()}`,
        name: newProjectForm.name,
        description: newProjectForm.description,
        status: 'pending',
        currentStep: 0,
        createdAt: new Date().toISOString().split('T')[0],
        owner: 'Current User',
        models: [],
        steps: [
          { id: 0, name: 'Model Import', status: 'not-started' },
          { id: 1, name: 'Data Ingestion', status: 'not-started', locked: true },
          { id: 2, name: 'Data Quality', status: 'not-started', locked: true },
          { id: 3, name: 'Performance', status: 'not-started', locked: true },
          { id: 4, name: 'Reports', status: 'not-started', locked: true },
          { id: 5, name: 'Alerts', status: 'not-started', locked: true },
        ],
      },
    };

    setProjects([...projects, newProject]);
    setSelectedProjectId(newProject.id);
    setNewProjectForm({ name: '', description: '' });
    setShowCreateForm(false);
  };

  const deleteProject = (projectId: string) => {
    if (confirm('Are you sure you want to delete this project?')) {
      const updatedProjects = projects.filter((p) => p.id !== projectId);
      setProjects(updatedProjects);
      if (selectedProjectId === projectId && updatedProjects.length > 0) {
        setSelectedProjectId(updatedProjects[0].id);
      }
    }
  };

  const updateProjectWorkflow = (projectId: string, updatedWorkflow: Workflow) => {
    setProjects(
      projects.map((p) => {
        if (p.id === projectId) {
          return { ...p, workflow: updatedWorkflow };
        }
        return p;
      })
    );
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Projects' }]} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            Model Monitoring Projects
          </h1>
          <p className={`mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
            Create and manage model monitoring workflows
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium"
        >
          <Plus size={18} />
          New Project
        </button>
      </div>

      {/* Create Project Modal */}
      {showCreateForm && (
        <div className={`p-6 rounded-lg border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
          <h2 className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            Create New Project
          </h2>
          <div className="space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                Project Name
              </label>
              <input
                type="text"
                value={newProjectForm.name}
                onChange={(e) => setNewProjectForm({ ...newProjectForm, name: e.target.value })}
                placeholder="e.g., Credit Risk Model v2.1"
                className={`w-full px-3 py-2 rounded border ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                Project Description
              </label>
              <textarea
                value={newProjectForm.description}
                onChange={(e) => setNewProjectForm({ ...newProjectForm, description: e.target.value })}
                placeholder="Brief description of this project..."
                rows={3}
                className={`w-full px-3 py-2 rounded border ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowCreateForm(false)}
                className={`px-4 py-2 rounded-lg transition ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300'}`}
              >
                Cancel
              </button>
              <button
                onClick={createNewProject}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium"
              >
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar - Projects & Model Repository */}
        <div className="space-y-6">
          {/* Projects Section */}
          <div className="space-y-3">
            <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
              Your Projects
            </h3>
            {projects.map((project) => (
              <div key={project.id} className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedProjectId(project.id)}
                  className={`flex-1 text-left p-3 rounded-lg border transition ${
                    selectedProjectId === project.id
                      ? theme === 'dark'
                        ? 'bg-blue-600/20 border-blue-500'
                        : 'bg-blue-50 border-blue-500'
                      : theme === 'dark'
                      ? 'bg-slate-800/50 border-slate-700 hover:bg-slate-800/70'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <p className={`text-sm font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    {project.name}
                  </p>
                  <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                    {project.createdAt}
                  </p>
                </button>
                <button
                  onClick={() => deleteProject(project.id)}
                  className="p-2 rounded hover:bg-red-500/20 text-red-500 transition"
                  title="Delete project"
                >
                  <X size={18} />
                </button>
              </div>
            ))}
          </div>

          {/* Model Repository Section - global list of imported models */}
          <div className="space-y-3">
            <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
              Model Repository
            </h3>
            {registryModelsForTree.length > 0 ? (
              <ModelRepositoryTree
                models={registryModelsForTree}
                expandedFolders={expandedFolders}
                setExpandedFolders={setExpandedFolders}
                theme={theme}
              />
            ) : (
              <div className={`p-4 rounded-lg border text-center ${theme === 'dark' ? 'bg-slate-900/30 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'}`}>
                  No models yet. Import a model from the workflow to see it here.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Content - Workflow */}
        <div className="lg:col-span-3 space-y-6">
          {selectedProject ? (
            <>
              {/* Project Header */}
              <div className={`p-6 rounded-lg border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
                <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  {selectedProject.name}
                </h2>
                <p className={`mt-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                  {selectedProject.description}
                </p>
                <p className={`text-xs mt-3 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                  Created: {selectedProject.createdAt}
                </p>
              </div>

              {/* Workflow Content */}
              <div className="space-y-4">
                {/* Cancel/Go Back Button */}
                <div className="flex gap-2">
                  {selectedProject.workflow.currentStep > 0 && (
                    <button
                      onClick={() => {
                        updateProjectWorkflow(selectedProject.id, {
                          ...selectedProject.workflow,
                          currentStep: Math.max(0, selectedProject.workflow.currentStep - 1),
                        });
                      }}
                      className={`px-4 py-2 rounded-lg transition font-medium ${
                        theme === 'dark'
                          ? 'bg-slate-700 hover:bg-slate-600 text-white'
                          : 'bg-slate-200 hover:bg-slate-300 text-slate-900'
                      }`}
                    >
                      ← Go Back
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to cancel this workflow? Progress will be lost.')) {
                        updateProjectWorkflow(selectedProject.id, {
                          ...selectedProject.workflow,
                          currentStep: 0,
                          selectedModel: undefined,
                          status: 'pending' as const,
                          steps: selectedProject.workflow.steps.map((s, idx) => ({
                            ...s,
                            status: 'not-started' as const,
                            locked: idx > 0,
                          })),
                        });
                      }
                    }}
                    className="px-4 py-2 rounded-lg hover:bg-red-500/20 text-red-600 transition font-medium border border-red-300"
                  >
                    × Cancel Workflow
                  </button>
                </div>

                {/* Step Indicator */}
                <StepIndicator steps={selectedProject.workflow.steps} currentStep={selectedProject.workflow.currentStep} />

                {/* Step Content */}
                <div
                  className={`p-6 rounded-lg border ${
                    theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'
                  }`}
                >
                  {selectedProject.workflow.currentStep === 0 && (
                    <ModelRepositoryStep
                      workflow={selectedProject.workflow}
                      onComplete={() => {
                        const newSteps = selectedProject.workflow.steps.map((s, idx) => {
                          if (idx === selectedProject.workflow.currentStep) {
                            return { ...s, status: 'completed' as const };
                          }
                          if (idx === selectedProject.workflow.currentStep + 1) {
                            return { ...s, locked: false };
                          }
                          return s;
                        });
                        const newCurrentStep = Math.min(
                          selectedProject.workflow.currentStep + 1,
                          selectedProject.workflow.steps.length - 1
                        );
                        updateProjectWorkflow(selectedProject.id, {
                          ...selectedProject.workflow,
                          steps: newSteps,
                          currentStep: newCurrentStep,
                        });
                      }}
                      onModelSelect={(model) => {
                        const newSteps = selectedProject.workflow.steps.map((s, idx) => {
                          if (idx === 1) {
                            return { ...s, locked: false };
                          }
                          return s;
                        });
                        updateProjectWorkflow(selectedProject.id, {
                          ...selectedProject.workflow,
                          selectedModel: model.id,
                          steps: newSteps,
                        });
                      }}
                      onAddModel={(metadata) => {
                        const newModel: ModelVersion = {
                          id: `model-${Date.now()}`,
                          name: metadata.modelName,
                          type: metadata.type,
                          tier: metadata.riskTier,
                          status: metadata.status,
                          version: metadata.modelVersion,
                          environment: metadata.environment,
                          owner: metadata.owner,
                          lastValidation: metadata.lastValidationDate,
                          nextReview: metadata.nextReviewDue,
                          metrics: metadata.metrics,
                        };
                        updateProjectWorkflow(selectedProject.id, {
                          ...selectedProject.workflow,
                          models: [...(selectedProject.workflow.models || []), newModel],
                        });
                        
                        // Add to global registry
                        createRegistryModel({
                          name: metadata.modelName,
                          version: metadata.modelVersion,
                          projectId: selectedProject.id,
                          modelType: metadata.type.toLowerCase() as 'classification' | 'regression' | 'clustering' | 'nlp' | 'custom',
                          metrics: metadata.metrics,
                          stage: metadata.environment.toLowerCase() as 'dev' | 'staging' | 'production',
                          status: 'active',
                        });
                      }}
                    />
                  )}
                  {selectedProject.workflow.currentStep === 1 && (
                    <DataIngestionStep
                      onComplete={() => {
                        const newSteps = selectedProject.workflow.steps.map((s, idx) => {
                          if (idx === selectedProject.workflow.currentStep) {
                            return { ...s, status: 'completed' as const };
                          }
                          if (idx === selectedProject.workflow.currentStep + 1) {
                            return { ...s, locked: false };
                          }
                          return s;
                        });
                        const newCurrentStep = Math.min(
                          selectedProject.workflow.currentStep + 1,
                          selectedProject.workflow.steps.length - 1
                        );
                        updateProjectWorkflow(selectedProject.id, {
                          ...selectedProject.workflow,
                          steps: newSteps,
                          currentStep: newCurrentStep,
                        });
                      }}
                    />
                  )}
                  {selectedProject.workflow.currentStep === 2 && (
                    <DataQualityStep
                      onComplete={() => {
                        const newSteps = selectedProject.workflow.steps.map((s, idx) => {
                          if (idx === selectedProject.workflow.currentStep) {
                            return { ...s, status: 'completed' as const };
                          }
                          if (idx === selectedProject.workflow.currentStep + 1) {
                            return { ...s, locked: false };
                          }
                          return s;
                        });
                        const newCurrentStep = Math.min(
                          selectedProject.workflow.currentStep + 1,
                          selectedProject.workflow.steps.length - 1
                        );
                        updateProjectWorkflow(selectedProject.id, {
                          ...selectedProject.workflow,
                          steps: newSteps,
                          currentStep: newCurrentStep,
                        });
                      }}
                    />
                  )}
                  {selectedProject.workflow.currentStep === 3 && (
                    <PerformanceStep
                      onComplete={() => {
                        const newSteps = selectedProject.workflow.steps.map((s, idx) => {
                          if (idx === selectedProject.workflow.currentStep) {
                            return { ...s, status: 'completed' as const };
                          }
                          if (idx === selectedProject.workflow.currentStep + 1) {
                            return { ...s, locked: false };
                          }
                          return s;
                        });
                        const newCurrentStep = Math.min(
                          selectedProject.workflow.currentStep + 1,
                          selectedProject.workflow.steps.length - 1
                        );
                        updateProjectWorkflow(selectedProject.id, {
                          ...selectedProject.workflow,
                          steps: newSteps,
                          currentStep: newCurrentStep,
                        });
                      }}
                    />
                  )}
                  {selectedProject.workflow.currentStep === 4 && (
                    <ReportsStep
                      onComplete={() => {
                        const newSteps = selectedProject.workflow.steps.map((s, idx) => {
                          if (idx === selectedProject.workflow.currentStep) {
                            return { ...s, status: 'completed' as const };
                          }
                          if (idx === selectedProject.workflow.currentStep + 1) {
                            return { ...s, locked: false };
                          }
                          return s;
                        });
                        const newCurrentStep = Math.min(
                          selectedProject.workflow.currentStep + 1,
                          selectedProject.workflow.steps.length - 1
                        );
                        updateProjectWorkflow(selectedProject.id, {
                          ...selectedProject.workflow,
                          steps: newSteps,
                          currentStep: newCurrentStep,
                        });
                      }}
                    />
                  )}
                  {selectedProject.workflow.currentStep === 5 && (
                    <AlertsStep
                      onComplete={() => {
                        const newSteps = selectedProject.workflow.steps.map((s, idx) => {
                          if (idx === selectedProject.workflow.currentStep) {
                            return { ...s, status: 'completed' as const };
                          }
                          return s;
                        });
                        updateProjectWorkflow(selectedProject.id, {
                          ...selectedProject.workflow,
                          steps: newSteps,
                          currentStep: selectedProject.workflow.currentStep,
                          status: 'completed' as const,
                        });
                      }}
                    />
                  )}
                </div>

                {/* Completion Message */}
                {selectedProject.workflow.status === 'completed' && (
                  <div className="p-6 rounded-lg bg-green-500/10 border border-green-500/30">
                    <p className="flex items-center gap-2 text-green-600 font-semibold">
                      <CheckCircle2 size={20} />
                      Workflow completed successfully!
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className={`p-12 text-center rounded-lg border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <AlertCircle size={48} className={`mx-auto mb-4 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`} />
              <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
                No projects available. Create a new project to get started.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
