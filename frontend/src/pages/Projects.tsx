import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, AlertCircle, ChevronRight, Upload, Plus, X, Eye, Download,
  Shield, BarChart3, TrendingUp, CheckCircle, Database, Zap, Save, Calendar, Clock, FileText
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useGlobal, IngestionJob } from '../contexts/GlobalContext';
import { Breadcrumb } from '../components/UIPatterns';
import { DataIngestionStepComponent, DataIngestionConfig, UploadedDataset } from './DataIngestionStep';
import { generateDataQualityPDF } from '../utils/pdfGenerator';
import { getStepDescription, createWorkflowLogEntry } from '../utils/workflowLogger';
import ReportGeneration from './ReportGeneration';

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
  dataIngestionConfig?: DataIngestionConfig;
  // Data Quality Analysis persistence
  dataQualityAnalysis?: {
    metricsMap: Record<string, any>;
    resolvedDatasetClones: any[];
    resolvedDatasets: any[];
    lastAnalyzedAt?: string;
  };
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
        uploadedFile: uploadedFile ? {
          name: uploadedFile.name,
          path: `/models/${uploadedFile.name}`,
          size: uploadedFile.size,
          type: uploadedFile.type,
        } : undefined,
        modelFileFormat,
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
        uploadedFile: uploadedFile ? {
          name: uploadedFile.name,
          path: `/models/${uploadedFile.name}`,
          size: uploadedFile.size,
          type: uploadedFile.type,
        } : undefined,
        modelFileFormat,
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

// Data Quality Metrics Interface
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

const DataQualityStep: React.FC<{ 
  workflow: Workflow;
  projectId: string;
  onComplete: () => void;
  onUpdateWorkflow: (updatedWorkflow: Workflow) => void;
}> = ({ workflow, projectId, onComplete, onUpdateWorkflow }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { addIngestionJob, registryModels, createDataQualityReport, createGeneratedReport, createReportConfiguration, reportConfigurations, cloneDatasetAsResolved, ingestionJobs, projects, createWorkflowLog } = useGlobal();
  
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'distributions' | 'volume'>('overview');
  
  // Initialize state from persisted workflow data or use defaults
  const [metricsMap, setMetricsMap] = useState<Record<string, any>>(
    workflow.dataQualityAnalysis?.metricsMap || {}
  );
  const [currentAnalyzingDataset, setCurrentAnalyzingDataset] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [currentResolvingIndex, setCurrentResolvingIndex] = useState(-1);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  // Store resolved clones as UploadedDataset objects locally
  const [resolvedDatasetClones, setResolvedDatasetClones] = useState<any[]>(
    workflow.dataQualityAnalysis?.resolvedDatasetClones || []
  );
  const [resolvedDatasets, setResolvedDatasets] = useState<any[]>(
    workflow.dataQualityAnalysis?.resolvedDatasets || []
  );

  // Extract all datasets from dataIngestionConfig
  const workflowDatasets = workflow.dataIngestionConfig 
    ? Object.values(workflow.dataIngestionConfig.trackDatasets).flat()
    : [];
  
  // Combine workflow datasets WITH resolved clones from local state
  const allDatasets = [...workflowDatasets, ...resolvedDatasetClones];

  // Persist analysis data to workflow whenever it changes (but avoid infinite loops)
  useEffect(() => {
    // Only save if there's actual analysis data
    const hasAnalysisData = Object.keys(metricsMap).length > 0 || resolvedDatasetClones.length > 0;
    if (hasAnalysisData) {
      // Check if data has actually changed to avoid unnecessary updates
      const existingData = workflow.dataQualityAnalysis;
      const hasChanged = !existingData || 
        JSON.stringify(existingData.metricsMap) !== JSON.stringify(metricsMap) ||
        JSON.stringify(existingData.resolvedDatasetClones) !== JSON.stringify(resolvedDatasetClones) ||
        JSON.stringify(existingData.resolvedDatasets) !== JSON.stringify(resolvedDatasets);
      
      if (hasChanged) {
        const updatedWorkflow = {
          ...workflow,
          dataQualityAnalysis: {
            metricsMap,
            resolvedDatasetClones,
            resolvedDatasets,
            lastAnalyzedAt: new Date().toISOString(),
          },
        };
        onUpdateWorkflow(updatedWorkflow);
      }
    }
  }, [metricsMap, resolvedDatasetClones, resolvedDatasets]);

  // Combine all datasets with resolved datasets to show both
  const selectedDataset = selectedDatasetId 
    ? allDatasets.find(d => d.id === selectedDatasetId)
    : allDatasets[0];

  // Update comprehensive metrics when a dataset is resolved
  useEffect(() => {
    if (resolvedDatasets.length > 0 && selectedDataset) {
      // Check if the selected dataset was just resolved
      const wasResolved = resolvedDatasets.find(rd => rd.id === selectedDataset.id);
      if (wasResolved && !metrics) {
        // Force generation of comprehensive metrics for resolved dataset
        const newMetrics = getComprehensiveMetrics(selectedDataset);
        // Metrics will be generated via the function call below
      }
    }
  }, [resolvedDatasets, selectedDataset]);

  // Generate comprehensive metrics using REAL dataset columns
  const getComprehensiveMetrics = (dataset: any): DataQualityMetrics => {
    // Get real columns from dataset - prioritize columnsList which has actual column names
    let columns: string[] = [];
    
    // Priority 1: Use columnsList from UploadedDataset (real column names from file)
    if (dataset.columnsList && Array.isArray(dataset.columnsList) && dataset.columnsList.length > 0) {
      columns = dataset.columnsList;
    }
    // Priority 2: Try to extract from schema
    else if (dataset.schema && Array.isArray(dataset.schema)) {
      columns = dataset.schema.map((col: any) => 
        typeof col === 'string' ? col : col.name || col.label || `Column_${columns.length + 1}`
      );
    }
    // Priority 3: Use column count to generate names
    else if (dataset.columns && typeof dataset.columns === 'number' && dataset.columns > 0) {
      columns = Array.from({ length: dataset.columns }, (_, i) => `Column_${i + 1}`);
    }
    // Fallback: create default columns
    else {
      columns = ['Variable_1', 'Variable_2', 'Variable_3', 'Variable_4'];
    }

    const numericColumns = columns.slice(0, Math.min(3, columns.length));
    const categoricalColumns = columns.slice(Math.min(3, columns.length), Math.min(6, columns.length));
    
    // Generate statistical summary for numeric columns
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

    // Generate categorical distributions
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

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'distributions', label: 'Distributions', icon: TrendingUp },
    { id: 'volume', label: 'Volume/Event Rate', icon: Database },
  ];

  // Generate comprehensive data quality analysis for all datasets
  const analyzeAllDatasets = async () => {
    if (allDatasets.length === 0) return;

    setLoading(true);
    setMetricsMap({});

    for (const dataset of allDatasets) {
      setCurrentAnalyzingDataset(dataset.id);
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Get REAL columns from uploaded dataset (UploadedDataset.columnsList)
      const columns = (dataset as any).columnsList && Array.isArray((dataset as any).columnsList) && (dataset as any).columnsList.length > 0
        ? (dataset as any).columnsList
        : ['Variable_1', 'Variable_2', 'Variable_3', 'Variable_4']; // Fallback only if no columns
      
      const mockIssues = columns.slice(0, Math.min(4, columns.length)).map((col: string, idx: number) => {
        const issueTypes = ['inconsistency', 'duplication', 'format_error'];
        const severities = ['high', 'medium', 'low'];
        const issueType = issueTypes[idx % 3];
        const severity = severities[idx % 3];
        const percent = 2 + (idx * 1.5);
        const count = Math.floor((dataset.rows || 1000) * (percent / 100));

        return {
          variable: col,
          type: issueType as 'inconsistency' | 'duplication' | 'format_error',
          severity: severity as 'high' | 'medium' | 'low',
          count,
          percent,
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

  // Get selected model for report generation
  const selectedModel = registryModels.find(m => m.id === workflow.selectedModel);

  const handleDownloadReport = async () => {
    if (Object.keys(metricsMap).length === 0 || !selectedModel) return;

    setGeneratingPDF(true);
    
    // Simulate PDF generation
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Separate baseline (original) and resolved datasets
    const baselineDatasetIds: string[] = [];
    const resolvedDatasetIds: string[] = [];
    
    allDatasets.forEach(dataset => {
      // Check if this dataset is resolved by its isResolved property
      if ((dataset as any).isResolved === true) {
        resolvedDatasetIds.push(dataset.id);
      } else {
        baselineDatasetIds.push(dataset.id);
      }
    });

    // Get dataset names for configuration and report
    const datasetNames = allDatasets.map(d => d.name).join('_');
    const timestamp = new Date().toISOString().split('T')[0];
    const configName = `Data_Quality_${selectedModel.name}_${timestamp}`.replace(/\s+/g, '_');
    const reportName = `Data Quality Report - ${selectedModel.name} (${allDatasets.map(d => d.name).join(', ')})`;

    // Prepare PDF data - THIS IS THE SINGLE SOURCE OF TRUTH
    const pdfData = {
      reportName: reportName,
      generatedAt: new Date().toISOString(),
      datasets: allDatasets.map(dataset => {
        const metrics = metricsMap[dataset.id];
        if (!metrics) return null;
        
        return {
          name: dataset.name,
          totalRecords: metrics.totalRecords,
          recordsAfterExclusion: metrics.recordsAfterExclusion,
          exclusionRate: metrics.exclusionRate,
          qualityScore: metrics.qualityScore,
          issues: metrics.issues.map((issue: any) => ({
            variable: issue.variable,
            type: issue.type,
            severity: issue.severity,
            count: issue.count,
            percent: issue.percent,
            selectedMethod: issue.selectedMethod,
          })),
        };
      }).filter(Boolean) as any[],
    };

    // Store as immutable artifact
    const reportArtifact = {
      pdfContent: JSON.stringify(pdfData), // Serialize for storage
      metadata: {
        generatedAt: pdfData.generatedAt,
        datasetCount: allDatasets.length,
        modelId: selectedModel.id,
        modelName: selectedModel.name,
        workflow: 'projects',
      },
    };

    // Actually generate and download the PDF
    generateDataQualityPDF(pdfData);

    // Calculate average quality score
    const avgQualityScore = allDatasets.reduce((sum, dataset) => {
      const metrics = metricsMap[dataset.id];
      return sum + (metrics?.qualityScore || 0);
    }, 0) / allDatasets.length;

    // Create ONE consolidated report with immutable artifact
    const generatedReport = createGeneratedReport({
      name: reportName,
      type: 'data_quality',
      modelId: selectedModel.id,
      modelName: `${selectedModel.name} v${selectedModel.version}`,
      status: 'final',
      healthScore: avgQualityScore,
      fileSize: '2.1 MB',
      tags: ['data-quality', 'automated', 'projects-workflow', resolvedDatasets.length > 0 ? 'resolved' : 'in-progress'],
      // Store the immutable artifact
      reportArtifact,
      baselineDatasetIds,
      resolvedDatasetIds,
      immutable: true,
    });

    setGeneratingPDF(false);
    
    // Log data quality report generation
    const project = projects.find(p => p.id === projectId);
    if (project) {
      createWorkflowLog(createWorkflowLogEntry(
        project.id,
        project.name,
        'Data Quality Report Generated',
        `Generated comprehensive data quality report for ${allDatasets.length} dataset(s): ${allDatasets.map(d => d.name).join(', ')}`
      ));
    }
    
    alert(`✓ Data Quality Report generated and saved to Reports section!`);
  };

  const handleExportReport = () => {
    alert('Downloading comprehensive Data Quality Report...');
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Data Quality Analysis & Reporting
        </h3>
        {Object.keys(metricsMap).length > 0 && (
          <div className="flex items-center gap-3">
            {/* Show Resolve Issues button if there are unresolved issues */}
            {allDatasets.some(dataset => {
              const metrics = metricsMap[dataset.id];
              return metrics && metrics.issues.some((issue: any) => issue.selectedMethod && !issue.resolved);
            }) && (
              <button
                onClick={async () => {
                  // Resolve all issues across all datasets
                  const allResolving = [];
                  for (const dataset of allDatasets) {
                    const metrics = metricsMap[dataset.id];
                    if (metrics) {
                      const issuesToResolve = metrics.issues.filter((issue: any) => issue.selectedMethod && !issue.resolved);
                      if (issuesToResolve.length > 0) {
                        allResolving.push({ datasetId: dataset.id, datasetName: dataset.name, issues: issuesToResolve });
                      }
                    }
                  }
                  
                  if (allResolving.length === 0) {
                    alert('Please select treatment methods for issues first');
                    return;
                  }

                  setResolving(true);
                  
                  // Resolve issues one by one and create cloned UploadedDataset objects
                  const newlyResolvedClones: UploadedDataset[] = [];
                  const newlyResolvedDatasets: any[] = [];
                  
                  for (const { datasetId, datasetName, issues } of allResolving) {
                    // Mark issues as resolved in metricsMap
                    for (const issue of issues) {
                      setCurrentResolvingIndex(metricsMap[datasetId].issues.findIndex((i: any) => i.variable === issue.variable));
                      await new Promise(resolve => setTimeout(resolve, 1500));
                      
                      setMetricsMap(prev => {
                        const updated = { ...prev };
                        const issueIndex = updated[datasetId].issues.findIndex((i: any) => i.variable === issue.variable);
                        if (issueIndex !== -1) {
                          updated[datasetId].issues[issueIndex].resolved = true;
                        }
                        return updated;
                      });
                    }
                    
                    // Create resolved clone as UploadedDataset object
                    const originalDataset = allDatasets.find(d => d.id === datasetId);
                    if (originalDataset) {
                      const resolutionSummary = issues.map((i: any) => `${i.variable} (${i.type}): ${i.selectedMethod}`).join(', ');
                      const resolvedName = originalDataset.name.replace(/\.(csv|json|parquet)$/i, '_Resolved.$1');
                      
                      // Create a cloned UploadedDataset with resolved metadata
                      const clonedId = `${datasetId}_resolved_${Date.now()}`;
                      const clonedDataset = {
                        ...originalDataset,
                        id: clonedId,
                        name: resolvedName.includes('_Resolved') ? resolvedName : `${originalDataset.name}_Resolved`,
                        parentDatasetId: datasetId,
                        isResolved: true,
                        resolutionTimestamp: new Date().toISOString(),
                        resolutionSummary,
                        resolvedIssuesCount: issues.length,
                        uploadedAt: new Date().toISOString(),
                      };
                      
                      // Copy metrics from parent dataset to cloned dataset
                      const parentMetrics = metricsMap[datasetId];
                      if (parentMetrics) {
                        setMetricsMap(prev => ({
                          ...prev,
                          [clonedId]: {
                            ...parentMetrics,
                            // All issues should be marked as resolved in the clone
                            issues: parentMetrics.issues.map((issue: any) => ({
                              ...issue,
                              resolved: true,
                            })),
                          },
                        }));
                      }
                      
                      newlyResolvedClones.push(clonedDataset);
                      newlyResolvedDatasets.push({
                        ...clonedDataset,
                        metrics: parentMetrics,
                        resolvedAt: new Date().toLocaleString(),
                      });
                    }
                  }
                  
                  setCurrentResolvingIndex(-1);
                  setResolving(false);
                  
                  // Store resolved clones in local state to merge with allDatasets
                  setResolvedDatasetClones(prev => [...prev, ...newlyResolvedClones]);
                  setResolvedDatasets(prev => [...prev, ...newlyResolvedDatasets]);
                  
                  // Save resolved datasets to GlobalContext (makes them appear in Datasets page)
                  newlyResolvedClones.forEach((clonedDataset: any) => {
                    addIngestionJob({
                      name: clonedDataset.name,
                      projectId: projectId,
                      modelId: workflow.selectedModel || '',
                      dataSource: 'desktop' as 'csv' | 'database' | 'api' | 'cloud' | 'desktop',
                      source: 'treated' as 'csv' | 'database' | 'cloud' | 'treated',
                      datasetType: 'reference' as 'baseline' | 'reference' | 'monitoring' | 'development',
                      status: 'completed' as 'created' | 'running' | 'completed' | 'failed' | 'active' | 'processing',
                      uploadedAt: clonedDataset.uploadedAt,
                      rows: clonedDataset.rows || 0,
                      columns: clonedDataset.columns || 0,
                      outputShape: { rows: clonedDataset.rows || 0, columns: clonedDataset.columns || 0 },
                      outputColumns: clonedDataset.columnsList || [],
                      uploadedFile: {
                        name: clonedDataset.name,
                        path: `/data/${clonedDataset.name}`,
                        size: 1200000,
                        type: 'text/csv',
                      },
                      // Lineage metadata
                      parentDatasetId: clonedDataset.parentDatasetId,
                      isResolved: true,
                      resolutionTimestamp: clonedDataset.resolutionTimestamp,
                      resolutionSummary: clonedDataset.resolutionSummary,
                      resolvedIssuesCount: clonedDataset.resolvedIssuesCount,
                    });
                  });
                  
                  // Auto-select first resolved dataset
                  if (newlyResolvedClones.length > 0) {
                    setSelectedDatasetId(newlyResolvedClones[0].id);
                  }
                  
                  // Log data quality issue resolution
                  const project = projects.find(p => p.id === projectId);
                  if (project) {
                    createWorkflowLog(createWorkflowLogEntry(
                      project.id,
                      project.name,
                      'Data Quality Issues Resolved',
                      `Resolved all data quality issues, created ${newlyResolvedClones.length} resolved dataset(s)`
                    ));
                  }
                  
                  alert(`✓ All data quality issues have been resolved!\n✓ ${newlyResolvedClones.length} resolved dataset(s) created and available in Datasets page.`);
                }}
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
            
            {/* Show download button only if all issues are resolved */}
            {allDatasets.every(dataset => {
              const metrics = metricsMap[dataset.id];
              return metrics && metrics.issues.every((issue: any) => !issue.selectedMethod || issue.resolved);
            }) && (
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

      {allDatasets.length === 0 ? (
        <div className={`p-6 rounded-lg border text-center ${
          isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'
        }`}>
          <p className={`text-sm ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
            No datasets found. Please complete Data Ingestion step first.
          </p>
        </div>
      ) : (
        <>
          {/* Dataset Selector and Detailed Analysis Section - MOVED TO TOP */}
          <div className={`p-6 rounded-lg border ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Select Dataset for Detailed Analysis
              </h2>
              <div className="flex items-center gap-2">
                {resolvedDatasets.length > 0 && (
                  <span className={`text-xs px-3 py-1 rounded-full ${isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'}`}>
                    {resolvedDatasets.length} Resolved
                  </span>
                )}
                <span className={`text-xs px-3 py-1 rounded-full ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                  {allDatasets.length} Total Dataset{allDatasets.length > 1 ? 's' : ''}
                </span>
              </div>
            </div>
            
            {/* Show imported and resolved datasets list */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              {allDatasets.map((dataset) => {
                // Check if dataset is resolved by looking at its isResolved property
                const isResolved = (dataset as any).isResolved === true;
                const resolvedData = isResolved ? resolvedDatasets.find(rd => rd.id === dataset.id) : null;
                const resolvedMetrics = resolvedData?.metrics || metricsMap[(dataset as any).parentDatasetId || dataset.id];
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
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className={`font-medium text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {dataset.name}
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          {(dataset as any).track} • {dataset.rows?.toLocaleString() || 0} rows × {dataset.columns || 0} cols
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
                    {/* Show metrics for resolved datasets */}
                    {isResolved && resolvedMetrics && (
                      <div className={`text-xs space-y-1 pt-2 border-t ${
                        isDark ? 'border-slate-600' : 'border-slate-200'
                      }`}>
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

          {/* Tab Content - Show detailed analysis for selected dataset */}
          {selectedDataset && metrics && (
            <>
              {/* Overview Tab */}
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

              {/* Distributions Tab */}
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

              {/* Volume/Event Rate Tab */}
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
                            <td className={`py-3 px-4 text-right ${isDark ? 'text-slate-300' : 'text-slate-700'  }`}>
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
            </>
          )}

          {/* Dataset Analysis Section - NOW BELOW DETAILED ANALYSIS */}
          <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Analyze Datasets for Quality Issues
            </h2>
            <div className="space-y-4">
              {allDatasets.length > 0 && (
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Found {allDatasets.length} dataset{allDatasets.length > 1 ? 's' : ''} from Data Ingestion step
                    </p>
                    <div className="mt-2">
                      {allDatasets.map((dataset) => (
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
                        {currentAnalyzingDataset ? `Analyzing...` : 'Analyzing...'}
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

          {/* Analysis Results */}
          {Object.keys(metricsMap).length > 0 && (
            <>
              {/* Quality Issues Summary */}
              <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Data Quality Issues Found
                </h3>
                <div className="space-y-4">
                  {allDatasets.map((dataset) => {
                    const metrics = metricsMap[dataset.id];
                    if (!metrics || metrics.issues.length === 0) return null;

                    return (
                      <div key={dataset.id} className={`p-4 rounded-lg border ${isDark ? 'bg-slate-700/30 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {dataset.name}
                          </h4>
                          <div className={`text-sm px-3 py-1 rounded-full ${
                            metrics.qualityScore >= 80 ? 'bg-green-100 text-green-700' : 
                            metrics.qualityScore >= 60 ? 'bg-yellow-100 text-yellow-700' : 
                            'bg-red-100 text-red-700'
                          }`}>
                            Score: {metrics.qualityScore}%
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          {metrics.issues.map((issue: any, idx: number) => (
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
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Footer Section - Complete Button */}
      <div className="flex justify-end items-center pt-4">
        <button
          onClick={() => {
            // Log approval before completing
            const project = projects.find(p => p.id === projectId);
            if (project) {
              const analysisCount = Object.keys(metricsMap).length;
              const resolvedCount = resolvedDatasetClones.length;
              createWorkflowLog(createWorkflowLogEntry(
                project.id,
                project.name,
                'Data Quality',
                `Approved data quality with ${analysisCount} analyzed dataset(s), ${resolvedCount} resolved dataset(s), and ${allDatasets.length} total dataset(s) ready for monitoring.`
              ));
            }
            onComplete();
          }}
          disabled={allDatasets.length === 0}
          className={`px-6 py-3 rounded-lg transition font-medium ${
            allDatasets.length === 0
              ? isDark ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          Approve Data Quality & Continue
        </button>
      </div>
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

const ReportConfigurationStep: React.FC<{ onComplete: () => void; workflow: Workflow }> = ({ onComplete, workflow }) => {
  const { theme } = useTheme();
  const { reportConfigurations, registryModels, ingestionJobs, createReportConfiguration } = useGlobal();
  const isDark = theme === 'dark';
  
  // Form state
  const [showForm, setShowForm] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    modelId: workflow.selectedModel || '',
    baselineDatasetId: '',
    referenceDatasetId: '',
    metricsToMonitor: [] as string[],
    driftMetrics: [] as string[],
  });

  // Find configurations for the current workflow's model
  const workflowModel = registryModels.find(m => m.id === workflow.selectedModel);
  const relevantConfigs = reportConfigurations.filter(config => 
    config.modelId === workflow.selectedModel
  );
  
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
      { id: 'data_quality', name: 'Data Quality Analysis', category: 'quality' },
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

  const availableMetrics = getAvailableMetrics(workflowModel?.modelType);

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

    const modelName = workflowModel ? `${workflowModel.name} v${workflowModel.version}` : '';
    const baselineDataset = modelDatasets.find(d => d.id === formData.baselineDatasetId);
    const referenceDataset = modelDatasets.find(d => d.id === formData.referenceDatasetId);

    // Create new configuration
    createReportConfiguration({
      ...formData,
      modelName,
      modelType: (workflowModel?.modelType === 'clustering' || 
                   workflowModel?.modelType === 'nlp' || 
                   workflowModel?.modelType === 'custom')
                   ? 'classification' // Default fallback for unsupported types
                   : (workflowModel?.modelType || 'classification'),
      baselineDatasetName: baselineDataset?.name || '',
      referenceDatasetName: referenceDataset?.name || '',
    });
    
    alert('✓ Configuration created successfully');

    // Reset form
    setFormData({
      name: '',
      modelId: workflow.selectedModel || '',
      baselineDatasetId: '',
      referenceDatasetId: '',
      metricsToMonitor: [],
      driftMetrics: [],
    });
    setShowForm(false);
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
      {/* Configuration Form */}
      {showForm && (
        <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
          <h2 className={`text-xl font-semibold mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Create Report Configuration
          </h2>

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
            {workflowModel && (
              <div className={`p-4 rounded-lg ${isDark ? 'bg-slate-700/50' : 'bg-slate-100'}`}>
                <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Model: {workflowModel.name} v{workflowModel.version} ({workflowModel.modelType})
                </p>
              </div>
            )}

            {/* Dataset Selection */}
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

            {/* Metrics to Monitor */}
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

            {/* Drift Metrics */}
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

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
              <button
                onClick={() => {
                  if (relevantConfigs.length > 0) {
                    setShowForm(false);
                  }
                }}
                disabled={relevantConfigs.length === 0}
                className={`px-6 py-2 rounded-lg ${
                  relevantConfigs.length === 0
                    ? isDark ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed' : 'bg-slate-200/50 text-slate-400 cursor-not-allowed'
                    : isDark ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-900'
                }`}
              >
                Skip
              </button>
              <button
                onClick={handleAddConfiguration}
                className={`px-6 py-2 rounded-lg flex items-center gap-2 ${
                  isDark ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                <Save size={18} />
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Existing Configurations List */}
      {!showForm && relevantConfigs.length > 0 && (
        <div className="space-y-4">
          <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Active Configurations ({relevantConfigs.length})
          </h2>
          {relevantConfigs.map((config) => (
            <div
              key={config.id}
              className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {config.name}
                  </h3>
                  <div className={`space-y-1 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    <p><strong>Baseline:</strong> {config.baselineDatasetName}</p>
                    <p><strong>Reference:</strong> {config.referenceDatasetName}</p>
                    <p><strong>Metrics:</strong> {config.metricsToMonitor.length} selected</p>
                  </div>
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
          
          <button
            onClick={() => setShowForm(true)}
            className={`px-4 py-2 rounded-lg transition ${
              isDark ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-900'
            }`}
          >
            Add Another Configuration
          </button>
        </div>
      )}

      {/* Empty State */}
      {!showForm && relevantConfigs.length === 0 && (
        <div className={`p-6 rounded-lg border text-center ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
          <p className={`mb-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            No configurations created yet. Create one to proceed.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className={`px-4 py-2 rounded-lg ${
              isDark ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            Create Configuration
          </button>
        </div>
      )}

      {/* Continue Button */}
      <button
        onClick={onComplete}
        disabled={relevantConfigs.length === 0}
        className={`w-full px-4 py-3 rounded-lg transition font-medium ${
          relevantConfigs.length === 0
            ? isDark ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {relevantConfigs.length === 0 ? 'Create a Configuration to Continue' : 'Continue to Reports'}
      </button>
    </div>
  );
};

// Schedule Reports Step - Workflow summary and automatic scheduling
const ScheduleReportsStep: React.FC<{ onComplete: () => void; workflow: Workflow; project: Project }> = ({ onComplete, workflow, project }) => {
  const { theme } = useTheme();
  const { reportConfigurations, createSchedulingJob, createWorkflowLog, ingestionJobs, schedulingJobs } = useGlobal();
  const isDark = theme === 'dark';

  const [showJobForm, setShowJobForm] = useState(false);
  const [jobForm, setJobForm] = useState({
    name: '',
    configurationId: '', // Add configuration selector
    reportTypes: [] as string[],
    scheduleType: 'daily' as 'one-time' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly',
    scheduleTime: '09:00',
    
    // One-time scheduling
    oneTimeDate: '',
    oneTimeTime: '09:00',
    
    // Weekly scheduling  
    weekdays: [] as number[],
    
    // Monthly scheduling
    dayOfMonth: 1,
    monthlyType: 'day' as 'day' | 'weekday',
    weekOfMonth: 1,
    monthlyWeekday: 1,
    
    // Quarterly scheduling
    quarterMonth: 1 as 1 | 2 | 3,
    
    // Yearly scheduling
    yearMonth: 1,
    yearDay: 1,
    
    enabled: true,
  });

  // Get configurations for the current workflow model
  const workflowConfigs = reportConfigurations.filter(
    config => config.modelId === workflow.selectedModel
  );

  // Get jobs created for this workflow
  const workflowJobs = schedulingJobs.filter(job => 
    job.modelId === workflow.selectedModel
  );

  const availableReportTypes = [
    { value: 'data_quality', label: 'Data Quality' },
    { value: 'stability', label: 'Model Stability' },
    { value: 'performance', label: 'Model Performance' },
    { value: 'drift_analysis', label: 'Drift Analysis' },
    { value: 'explainability', label: 'Explainability' },
    { value: 'feature_analytics', label: 'Feature Analytics' },
  ];

  const handleToggleReportType = (type: string) => {
    setJobForm(prev => ({
      ...prev,
      reportTypes: prev.reportTypes.includes(type)
        ? prev.reportTypes.filter(t => t !== type)
        : [...prev.reportTypes, type]
    }));
  };

  const handleCreateJob = () => {
    if (!jobForm.name.trim()) {
      alert('Please enter a job name');
      return;
    }
    if (!jobForm.configurationId) {
      alert('Please select a configuration');
      return;
    }
    if (jobForm.reportTypes.length === 0) {
      alert('Please select at least one report type');
      return;
    }

    // Validate schedule-specific requirements
    if (jobForm.scheduleType === 'one-time' && !jobForm.oneTimeDate) {
      alert('Please select a date for one-time scheduling');
      return;
    }
    if (jobForm.scheduleType === 'weekly' && jobForm.weekdays.length === 0) {
      alert('Please select at least one day of the week');
      return;
    }

    const config = workflowConfigs.find(c => c.id === jobForm.configurationId);
    if (!config) {
      alert('Selected configuration not found');
      return;
    }

    // Build the scheduling job with appropriate fields based on schedule type
    const jobData: any = {
      name: jobForm.name,
      type: 'report_generation',
      reportTypes: jobForm.reportTypes,
      configurationId: config.id,
      configurationName: config.name,
      modelId: config.modelId,
      modelName: config.modelName,
      scheduleType: jobForm.scheduleType,
      enabled: jobForm.enabled,
      runCount: 0,
    };

    // Add schedule-specific fields
    switch (jobForm.scheduleType) {
      case 'one-time':
        jobData.oneTimeDate = jobForm.oneTimeDate;
        jobData.oneTimeTime = jobForm.oneTimeTime;
        break;
      case 'daily':
        jobData.scheduleTime = jobForm.scheduleTime;
        break;
      case 'weekly':
        jobData.scheduleTime = jobForm.scheduleTime;
        jobData.weekdays = jobForm.weekdays;
        break;
      case 'monthly':
        jobData.scheduleTime = jobForm.scheduleTime;
        jobData.dayOfMonth = jobForm.dayOfMonth;
        jobData.monthlyType = jobForm.monthlyType;
        if (jobForm.monthlyType === 'weekday') {
          jobData.weekOfMonth = jobForm.weekOfMonth;
          jobData.monthlyWeekday = jobForm.monthlyWeekday;
        }
        break;
      case 'quarterly':
        jobData.scheduleTime = jobForm.scheduleTime;
        jobData.quarterMonth = jobForm.quarterMonth;
        jobData.dayOfMonth = jobForm.dayOfMonth;
        break;
      case 'yearly':
        jobData.scheduleTime = jobForm.scheduleTime;
        jobData.yearMonth = jobForm.yearMonth;
        jobData.yearDay = jobForm.yearDay;
        break;
    }

    createSchedulingJob(jobData);

    // Log workflow log entry for job creation
    createWorkflowLog(createWorkflowLogEntry(
      project.id,
      project.name,
      'Schedule Reports',
      `Created scheduling job "${jobForm.name}" with ${jobForm.reportTypes.length} report type(s): ${jobForm.reportTypes.join(', ')}. Schedule: ${jobForm.scheduleType}. Status: ${jobForm.enabled ? 'Enabled' : 'Disabled'}.`
    ));

    alert(`Scheduling job "${jobForm.name}" created successfully!`);
    setShowJobForm(false);
    setJobForm({
      name: '',
      configurationId: '',
      reportTypes: [],
      scheduleType: 'daily',
      scheduleTime: '09:00',
      oneTimeDate: '',
      oneTimeTime: '09:00',
      weekdays: [],
      dayOfMonth: 1,
      monthlyType: 'day',
      weekOfMonth: 1,
      monthlyWeekday: 1,
      quarterMonth: 1,
      yearMonth: 1,
      yearDay: 1,
      enabled: true,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header with Instructions */}
      <div className={`p-4 rounded-lg border ${isDark ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'}`}>
        <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-blue-300' : 'text-blue-900'}`}>
          Schedule Automated Reports
        </h3>
        <p className={`text-sm ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
          Create scheduling jobs to automatically generate reports based on your configurations.
          {workflowConfigs.length > 0 
            ? ` ${workflowConfigs.length} configuration(s) available: ${workflowConfigs.map(c => c.name).join(', ')}`
            : ' No configurations available - please create one in the Report Configuration step.'}
        </p>
      </div>

      {/* Existing Jobs List */}
      {workflowJobs.length > 0 && (
        <div>
          <h4 className={`font-medium mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Scheduled Jobs ({workflowJobs.length})
          </h4>
          <div className="space-y-3">
            {workflowJobs.map(job => (
              <div
                key={job.id}
                className={`p-4 rounded-lg border ${isDark ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h5 className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {job.name}
                    </h5>
                    <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Report Types: {job.reportTypes?.join(', ') || 'N/A'}
                    </p>
                    <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Schedule: {job.scheduleType} at {job.scheduleTime}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    job.enabled
                      ? 'bg-green-500/20 text-green-600 border border-green-500/50'
                      : 'bg-slate-500/20 text-slate-600 border border-slate-500/50'
                  }`}>
                    {job.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create New Job Button */}
      {!showJobForm && (
        <button
          onClick={() => setShowJobForm(true)}
          disabled={workflowConfigs.length === 0}
          className={`w-full px-6 py-3 rounded-lg border-2 border-dashed transition font-medium flex items-center justify-center gap-2 ${
            workflowConfigs.length === 0
              ? isDark
                ? 'border-slate-700 text-slate-600 cursor-not-allowed'
                : 'border-slate-300 text-slate-400 cursor-not-allowed'
              : isDark
              ? 'border-blue-500/50 text-blue-400 hover:bg-blue-500/10'
              : 'border-blue-400 text-blue-600 hover:bg-blue-50'
          }`}
        >
          <Plus size={20} />
          Create New Scheduling Job
        </button>
      )}

      {/* Job Creation Form */}
      {showJobForm && (
        <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
          <h4 className={`font-medium mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            New Scheduling Job
          </h4>

          {/* Job Name */}
          <div className="mb-4">
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Job Name *
            </label>
            <input
              type="text"
              value={jobForm.name}
              onChange={(e) => setJobForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Daily Model Monitoring Reports"
              className={`w-full px-4 py-2 rounded-lg border ${
                isDark
                  ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-500'
                  : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>

          {/* Configuration Selector */}
          <div className="mb-4">
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Configuration *
            </label>
            <select
              value={jobForm.configurationId}
              onChange={(e) => setJobForm(prev => ({ ...prev, configurationId: e.target.value }))}
              className={`w-full px-4 py-2 rounded-lg border ${
                isDark
                  ? 'bg-slate-800 border-slate-600 text-white'
                  : 'bg-white border-slate-300 text-slate-900'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
            >
              <option value="">-- Select Configuration --</option>
              {workflowConfigs.map(config => (
                <option key={config.id} value={config.id}>
                  {config.name}
                </option>
              ))}
            </select>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
              {workflowConfigs.length} configuration(s) available
            </p>
          </div>

          {/* 
          {/* Report Types */}
          <div className="mb-4">
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Report Types * (Select one or more)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {availableReportTypes.map(type => (
                <label
                  key={type.value}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition ${
                    jobForm.reportTypes.includes(type.value)
                      ? isDark
                        ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                        : 'bg-blue-50 border-blue-500 text-blue-700'
                      : isDark
                      ? 'bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-500'
                      : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={jobForm.reportTypes.includes(type.value)}
                    onChange={() => handleToggleReportType(type.value)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">{type.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Advanced Schedule Configuration */}
          <div className="space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Schedule Frequency *
              </label>
              <select
                value={jobForm.scheduleType}
                onChange={(e) => setJobForm(prev => ({ ...prev, scheduleType: e.target.value as any }))}
                className={`w-full px-4 py-2 rounded-lg border ${
                  isDark
                    ? 'bg-slate-800 border-slate-600 text-white'
                    : 'bg-white border-slate-300 text-slate-900'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              >
                <option value="one-time">One Time</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            {/* One-Time Scheduling */}
            {jobForm.scheduleType === 'one-time' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Date *
                  </label>
                  <input
                    type="date"
                    value={jobForm.oneTimeDate}
                    onChange={(e) => setJobForm(prev => ({ ...prev, oneTimeDate: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                    className={`w-full px-4 py-2 rounded-lg border ${
                      isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Time *
                  </label>
                  <input
                    type="time"
                    value={jobForm.oneTimeTime}
                    onChange={(e) => setJobForm(prev => ({ ...prev, oneTimeTime: e.target.value }))}
                    className={`w-full px-4 py-2 rounded-lg border ${
                      isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>
              </div>
            )}

            {/* Daily Scheduling */}
            {jobForm.scheduleType === 'daily' && (
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Time *
                </label>
                <input
                  type="time"
                  value={jobForm.scheduleTime}
                  onChange={(e) => setJobForm(prev => ({ ...prev, scheduleTime: e.target.value }))}
                  className={`w-full px-4 py-2 rounded-lg border ${
                    isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
              </div>
            )}

            {/* Weekly Scheduling */}
            {jobForm.scheduleType === 'weekly' && (
              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Days of the Week *
                  </label>
                  <div className="grid grid-cols-7 gap-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                      <label
                        key={index}
                        className={`flex items-center justify-center p-3 rounded-lg border cursor-pointer text-sm font-medium ${
                          jobForm.weekdays.includes(index)
                            ? isDark ? 'bg-blue-900/30 border-blue-500/50 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-700'
                            : isDark ? 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={jobForm.weekdays.includes(index)}
                          onChange={() => {
                            const updatedWeekdays = jobForm.weekdays.includes(index)
                              ? jobForm.weekdays.filter(d => d !== index)
                              : [...jobForm.weekdays, index];
                            setJobForm(prev => ({ ...prev, weekdays: updatedWeekdays }));
                          }}
                          className="hidden"
                        />
                        {day}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Time *
                  </label>
                  <input
                    type="time"
                    value={jobForm.scheduleTime}
                    onChange={(e) => setJobForm(prev => ({ ...prev, scheduleTime: e.target.value }))}
                    className={`w-full px-4 py-2 rounded-lg border ${
                      isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>
              </div>
            )}

            {/* Monthly Scheduling */}
            {jobForm.scheduleType === 'monthly' && (
              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Monthly Schedule Type
                  </label>
                  <select
                    value={jobForm.monthlyType}
                    onChange={(e) => setJobForm(prev => ({ ...prev, monthlyType: e.target.value as 'day' | 'weekday' }))}
                    className={`w-full px-4 py-2 rounded-lg border ${
                      isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  >
                    <option value="day">Specific Day of Month</option>
                    <option value="weekday">Specific Weekday</option>
                  </select>
                </div>
                
                {jobForm.monthlyType === 'day' ? (
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Day of Month
                    </label>
                    <select
                      value={jobForm.dayOfMonth}
                      onChange={(e) => setJobForm(prev => ({ ...prev, dayOfMonth: parseInt(e.target.value) }))}
                      className={`w-full px-4 py-2 rounded-lg border ${
                        isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                        <option key={day} value={day}>Day {day}</option>
                      ))}
                      <option value={-1}>Last Day of Month</option>
                    </select>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        Week of Month
                      </label>
                      <select
                        value={jobForm.weekOfMonth}
                        onChange={(e) => setJobForm(prev => ({ ...prev, weekOfMonth: parseInt(e.target.value) }))}
                        className={`w-full px-4 py-2 rounded-lg border ${
                          isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      >
                        <option value={1}>First Week</option>
                        <option value={2}>Second Week</option>
                        <option value={3}>Third Week</option>
                        <option value={4}>Fourth Week</option>
                        <option value={-1}>Last Week</option>
                      </select>
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        Day of Week
                      </label>
                      <select
                        value={jobForm.monthlyWeekday}
                        onChange={(e) => setJobForm(prev => ({ ...prev, monthlyWeekday: parseInt(e.target.value) }))}
                        className={`w-full px-4 py-2 rounded-lg border ${
                          isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      >
                        <option value={0}>Sunday</option>
                        <option value={1}>Monday</option>
                        <option value={2}>Tuesday</option>
                        <option value={3}>Wednesday</option>
                        <option value={4}>Thursday</option>
                        <option value={5}>Friday</option>
                        <option value={6}>Saturday</option>
                      </select>
                    </div>
                  </div>
                )}
                
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Time *
                  </label>
                  <input
                    type="time"
                    value={jobForm.scheduleTime}
                    onChange={(e) => setJobForm(prev => ({ ...prev, scheduleTime: e.target.value }))}
                    className={`w-full px-4 py-2 rounded-lg border ${
                      isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>
              </div>
            )}

            {/* Quarterly Scheduling */}
            {jobForm.scheduleType === 'quarterly' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Quarter Month
                    </label>
                    <select
                      value={jobForm.quarterMonth}
                      onChange={(e) => setJobForm(prev => ({ ...prev, quarterMonth: parseInt(e.target.value) as 1 | 2 | 3 }))}
                      className={`w-full px-4 py-2 rounded-lg border ${
                        isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    >
                      <option value={1}>1st Month (Jan/Apr/Jul/Oct)</option>
                      <option value={2}>2nd Month (Feb/May/Aug/Nov)</option>
                      <option value={3}>3rd Month (Mar/Jun/Sep/Dec)</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Day of Month
                    </label>
                    <select
                      value={jobForm.dayOfMonth}
                      onChange={(e) => setJobForm(prev => ({ ...prev, dayOfMonth: parseInt(e.target.value) }))}
                      className={`w-full px-4 py-2 rounded-lg border ${
                        isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    >
                      {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                        <option key={day} value={day}>Day {day}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Time *
                  </label>
                  <input
                    type="time"
                    value={jobForm.scheduleTime}
                    onChange={(e) => setJobForm(prev => ({ ...prev, scheduleTime: e.target.value }))}
                    className={`w-full px-4 py-2 rounded-lg border ${
                      isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>
              </div>
            )}

            {/* Yearly Scheduling */}
            {jobForm.scheduleType === 'yearly' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Month
                    </label>
                    <select
                      value={jobForm.yearMonth}
                      onChange={(e) => setJobForm(prev => ({ ...prev, yearMonth: parseInt(e.target.value) }))}
                      className={`w-full px-4 py-2 rounded-lg border ${
                        isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    >
                      {['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'].map((month, index) => (
                        <option key={index + 1} value={index + 1}>{month}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Day of Month
                    </label>
                    <select
                      value={jobForm.yearDay}
                      onChange={(e) => setJobForm(prev => ({ ...prev, yearDay: parseInt(e.target.value) }))}
                      className={`w-full px-4 py-2 rounded-lg border ${
                        isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                        <option key={day} value={day}>Day {day}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Time *
                  </label>
                  <input
                    type="time"
                    value={jobForm.scheduleTime}
                    onChange={(e) => setJobForm(prev => ({ ...prev, scheduleTime: e.target.value }))}
                    className={`w-full px-4 py-2 rounded-lg border ${
                      isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>
              </div>
            )}

            {/* Enable/Disable Toggle */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={jobForm.enabled}
                  onChange={(e) => setJobForm(prev => ({ ...prev, enabled: e.target.checked }))}
                  className="w-4 h-4"
                />
                <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Enable this job immediately
                </span>
              </label>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleCreateJob}
              className={`flex-1 px-4 py-2 rounded-lg font-medium ${
                isDark
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              Create Job
            </button>
            <button
              onClick={() => {
                setShowJobForm(false);
                setJobForm({
                  name: '',
                  configurationId: '',
                  reportTypes: [],
                  scheduleType: 'daily',
                  scheduleTime: '09:00',
                  oneTimeDate: '',
                  oneTimeTime: '',
                  weekdays: [],
                  dayOfMonth: 1,
                  monthlyType: 'day',
                  weekOfMonth: 1,
                  monthlyWeekday: 0,
                  quarterMonth: 1,
                  yearMonth: 1,
                  yearDay: 1,
                  enabled: true,
                });
              }}
              className={`px-4 py-2 rounded-lg font-medium ${
                isDark
                  ? 'bg-slate-600 hover:bg-slate-500 text-white'
                  : 'bg-slate-300 hover:bg-slate-400 text-slate-900'
              }`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Complete Workflow Button */}
      <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={onComplete}
          disabled={workflowJobs.length === 0}
          className={`flex-1 px-6 py-3 rounded-lg font-medium ${
            workflowJobs.length === 0
              ? isDark
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : isDark
              ? 'bg-green-600 hover:bg-green-500 text-white'
              : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
        >
          {workflowJobs.length === 0 ? 'Create at least one job to continue' : 'Complete Workflow ✓'}
        </button>
      </div>
    </div>
  );
};

// Simple wrapper for ReportsStep now uses ReportGeneration component
const ReportsStep: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  return (
    <div className="space-y-6">
      <ReportGeneration />
      <div className="flex justify-end">
        <button
          onClick={onComplete}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium"
        >
          Continue to Scheduling
        </button>
      </div>
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
  const navigate = useNavigate();
  const { createRegistryModel, createProject: createGlobalProject, projects: globalProjects, createIngestionJob, createWorkflowLog } = useGlobal();
  
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

  // Sync local projects to GlobalContext on mount (for existing projects)
  useEffect(() => {
    if (projects.length > 0) {
      projects.forEach((project) => {
        // Check if project already exists in GlobalContext by name
        const exists = globalProjects.some((gp) => gp.name === project.name);
        if (!exists) {
          createGlobalProject({
            name: project.name,
            description: project.description,
            environment: 'dev',
            status: 'active',
            code: [],
          });
        }
      });
    }
  }, []); // Run only on mount

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
          { id: 1, name: 'Data Ingestion & Dataset Config', status: 'not-started', locked: true },
          { id: 2, name: 'Data Quality Reporting', status: 'not-started', locked: true },
          { id: 3, name: 'Report Configuration', status: 'not-started', locked: true },
          { id: 4, name: 'Report Generation', status: 'not-started', locked: true },
          { id: 5, name: 'Schedule Reports', status: 'not-started', locked: true },
        ],
      },
    };

    setProjects([...projects, newProject]);
    setSelectedProjectId(newProject.id);
    setNewProjectForm({ name: '', description: '' });
    setShowCreateForm(false);

    // Also add project to GlobalContext so it's available in other components (e.g., Import Model dropdown)
    createGlobalProject({
      name: newProjectForm.name,
      description: newProjectForm.description,
      environment: 'dev',
      status: 'active',
      code: [],
    });
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

  /**
   * Helper function to update workflow and log step completion
   * This is called when a workflow step is completed
   */
  const completeWorkflowStep = (
    projectId: string,
    workflow: Workflow,
    stepDescription: string
  ) => {
    const stepIndex = workflow.currentStep;
    const stepName = workflow.steps[stepIndex]?.name || 'Unknown Step';
    
    // Update step status
    const newSteps = workflow.steps.map((s, idx) => {
      if (idx === stepIndex) {
        return { ...s, status: 'completed' as const };
      }
      if (idx === stepIndex + 1) {
        return { ...s, locked: false };
      }
      return s;
    });

    // Move to next step
    const newCurrentStep = Math.min(stepIndex + 1, workflow.steps.length - 1);
    const isLastStep = stepIndex === workflow.steps.length - 1;

    const updatedWorkflow: Workflow = {
      ...workflow,
      steps: newSteps,
      currentStep: newCurrentStep,
      status: isLastStep ? ('completed' as const) : workflow.status,
    };

    // Log this step completion
    console.log(`[WORKFLOW LOG] Project: ${projects.find(p => p.id === projectId)?.name}, Step: ${stepName}, Details: ${stepDescription}`);

    updateProjectWorkflow(projectId, updatedWorkflow);
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
        {/* Left Sidebar - Projects only (Model Repository is in main nav under Model Repository) */}
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
                        // Just move to next step - logging handled in onAddModel
                        const newSteps = selectedProject.workflow.steps.map((s, idx) => {
                          if (idx === 0) {
                            return { ...s, status: 'completed' as const };
                          }
                          if (idx === 1) {
                            return { ...s, locked: false };
                          }
                          return s;
                        });
                        updateProjectWorkflow(selectedProject.id, {
                          ...selectedProject.workflow,
                          steps: newSteps,
                          currentStep: 1,
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
                        
                        // Log model import in workflow
                        const description = getStepDescription.modelImport(
                          metadata.modelName,
                          metadata.modelVersion,
                          metadata.type
                        );
                        createWorkflowLog(createWorkflowLogEntry(
                          selectedProject.id,
                          selectedProject.name,
                          'Model Import',
                          description
                        ));
                        
                        updateProjectWorkflow(selectedProject.id, {
                          ...selectedProject.workflow,
                          models: [...(selectedProject.workflow.models || []), newModel],
                          selectedModel: newModel.id,
                        });
                        
                        // Add to global registry with file information
                        createRegistryModel({
                          name: metadata.modelName,
                          version: metadata.modelVersion,
                          projectId: selectedProject.id,
                          modelType: metadata.type.toLowerCase() as 'classification' | 'regression' | 'clustering' | 'nlp' | 'custom',
                          metrics: metadata.metrics,
                          stage: metadata.environment.toLowerCase() as 'dev' | 'staging' | 'production',
                          status: 'active',
                          uploadedFile: (metadata as any).uploadedFile,
                        });
                      }}
                    />
                  )}
                  {selectedProject.workflow.currentStep === 1 && (
                    <DataIngestionStepComponent
                      workflow={selectedProject.workflow}
                      onComplete={(config: DataIngestionConfig) => {
                        // Collect dataset information for logging
                        const allDatasets = Object.values(config.trackDatasets).flat();
                        const datasetCount = allDatasets.length;
                        const datasetNames = allDatasets.map(d => d.name);
                        const description = getStepDescription.dataIngestion(datasetCount, datasetNames);
                        
                        // Create ingestion jobs for each dataset
                        allDatasets.forEach((dataset) => {
                          const datasetConfig = config.datasetConfigs[dataset.id];
                          if (datasetConfig) {
                            createIngestionJob({
                              name: dataset.name,
                              projectId: selectedProject.id,
                              modelId: config.modelId,
                              dataSource: 'desktop',
                              source: dataset.track.toLowerCase() as 'csv' | 'database' | 'cloud' | 'treated',
                              datasetType: datasetConfig.datasetType || 'monitoring',
                              status: 'completed',
                              outputPath: `/datasets/${dataset.id}`,
                              outputShape: { rows: dataset.rows, columns: dataset.columns },
                              outputColumns: dataset.columnsList,
                              uploadedFile: {
                                name: dataset.name,
                                path: `/datasets/${dataset.id}/${dataset.name}`,
                                size: 0,
                                type: 'csv',
                              },
                            });
                          }
                        });
                        
                        // Complete step with logging
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
                        
                        createWorkflowLog(createWorkflowLogEntry(
                          selectedProject.id,
                          selectedProject.name,
                          'Data Ingestion',
                          description
                        ));
                        
                        updateProjectWorkflow(selectedProject.id, {
                          ...selectedProject.workflow,
                          steps: newSteps,
                          currentStep: newCurrentStep,
                          dataIngestionConfig: config,
                          selectedModel: config.modelId, // Save the selected model ID
                        });
                      }}
                    />
                  )}
                  {selectedProject.workflow.currentStep === 2 && (
                    <DataQualityStep
                      workflow={selectedProject.workflow}
                      projectId={selectedProject.id}
                      onUpdateWorkflow={(updatedWorkflow) => {
                        updateProjectWorkflow(selectedProject.id, updatedWorkflow);
                      }}
                      onComplete={() => {
                        // Get data quality analysis information for logging
                        const analysisCount = (selectedProject.workflow as any).dataQualityConfig?.analyses?.length || 0;
                        const resolvedCount = (selectedProject.workflow as any).dataQualityConfig?.analyses?.filter((a: any) => a.resolved).length || 0;
                        const description = getStepDescription.dataQuality(analysisCount, resolvedCount);
                        
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
                        
                        createWorkflowLog(createWorkflowLogEntry(
                          selectedProject.id,
                          selectedProject.name,
                          'Data Quality',
                          description
                        ));
                        
                        updateProjectWorkflow(selectedProject.id, {
                          ...selectedProject.workflow,
                          steps: newSteps,
                          currentStep: newCurrentStep,
                        });
                      }}
                    />
                  )}
                  {selectedProject.workflow.currentStep === 3 && (
                    <ReportConfigurationStep
                      workflow={selectedProject.workflow}
                      onComplete={() => {
                        // Get report configuration information for logging
                        const configCount = (selectedProject.workflow as any).reportConfigs?.length || 0;
                        const configNames = (selectedProject.workflow as any).reportConfigs?.map((c: any) => c.name) || [];
                        const metricsCount = (selectedProject.workflow as any).reportConfigs?.reduce((acc: number, c: any) => acc + (c.metrics?.length || 0), 0) || 0;
                        const description = getStepDescription.reportConfiguration(configCount, configNames, metricsCount);
                        
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
                        
                        createWorkflowLog(createWorkflowLogEntry(
                          selectedProject.id,
                          selectedProject.name,
                          'Report Configuration',
                          description
                        ));
                        
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
                        // Get report generation information for logging
                        const configCount = (selectedProject.workflow as any).reportConfigs?.length || 0;
                        const reportsReady = (selectedProject.workflow as any).generatedReports?.length || 0;
                        const description = getStepDescription.reportGeneration(configCount, reportsReady);
                        
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
                        
                        createWorkflowLog(createWorkflowLogEntry(
                          selectedProject.id,
                          selectedProject.name,
                          'Report Generation',
                          description
                        ));
                        
                        updateProjectWorkflow(selectedProject.id, {
                          ...selectedProject.workflow,
                          steps: newSteps,
                          currentStep: newCurrentStep,
                        });
                      }}
                    />
                  )}
                  {selectedProject.workflow.currentStep === 5 && (
                    <ScheduleReportsStep
                      workflow={selectedProject.workflow}
                      project={selectedProject}
                      onComplete={() => {
                        // Get scheduling information for logging
                        const jobCount = (selectedProject.workflow as any).scheduledJobs?.length || 0;
                        const reportTypes = (selectedProject.workflow as any).reportConfigs?.map((c: any) => c.name) || [];
                        const scheduleFrequency = (selectedProject.workflow as any).scheduledJobs?.[0]?.frequency || 'Not specified';
                        const description = getStepDescription.scheduleReports(jobCount, reportTypes, scheduleFrequency);
                        
                        const newSteps = selectedProject.workflow.steps.map((s, idx) => {
                          if (idx === selectedProject.workflow.currentStep) {
                            return { ...s, status: 'completed' as const };
                          }
                          return s;
                        });
                        const isLastStep = selectedProject.workflow.currentStep === 5; // Schedule Reports is final step
                        
                        createWorkflowLog(createWorkflowLogEntry(
                          selectedProject.id,
                          selectedProject.name,
                          'Schedule Reports',
                          description
                        ));
                        
                        updateProjectWorkflow(selectedProject.id, {
                          ...selectedProject.workflow,
                          steps: newSteps,
                          currentStep: selectedProject.workflow.currentStep, // Stay on final step
                          status: isLastStep ? ('completed' as const) : selectedProject.workflow.status,
                        });
                        
                        // Navigate to dashboard after completing workflow
                        if (isLastStep) {
                          setTimeout(() => {
                            // Extract model ID to pass to dashboard
                            const completedModelId = selectedProject.workflow.selectedModel 
                              || selectedProject.workflow.models?.[0]?.id;
                            
                            if (completedModelId) {
                              // Navigate with model ID as URL parameter
                              navigate(`/?modelId=${completedModelId}&source=projects`);
                              console.log('✓ Navigating to dashboard with model:', completedModelId);
                            } else {
                              // Navigate without parameters if no model found
                              navigate('/');
                              console.log('⚠️ No model found in workflow, navigating to dashboard');
                            }
                          }, 1000); // Brief delay to show completion message
                        }
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
