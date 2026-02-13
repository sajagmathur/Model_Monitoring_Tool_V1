import React, { useState } from 'react';
import {
  Plus,
  ChevronRight,
  Database,
  CheckCircle2,
  AlertCircle,
  Upload,
  ArrowRight,
  BarChart3,
  FileText,
  Bell,
  Edit,
  Trash2,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useNotification } from '../hooks/useNotification';
import { Breadcrumb, SearchBar, EmptyState } from '../components/UIPatterns';

interface Workflow {
  id: string;
  name: string;
  description: string;
  status: 'not-started' | 'in-progress' | 'completed';
  currentStep: number;
  steps: WorkflowStep[];
  createdAt: string;
  owner: string;
}

interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  status: 'not-started' | 'in-progress' | 'completed' | 'error';
  completionPercentage: number;
}

// Step indicator component
const StepIndicator: React.FC<{ steps: WorkflowStep[]; currentStep: number }> = ({ steps, currentStep }) => {
  const { theme } = useTheme();

  return (
    <div className="flex items-center justify-between mb-6">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center flex-1">
          {/* Step Circle */}
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
              index < currentStep
                ? theme === 'dark'
                  ? 'bg-green-600 text-white'
                  : 'bg-green-500 text-white'
                : index === currentStep
                ? theme === 'dark'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-500 text-white'
                : theme === 'dark'
                ? 'bg-slate-700 text-slate-400'
                : 'bg-slate-200 text-slate-600'
            }`}
          >
            {index < currentStep ? <CheckCircle2 size={20} /> : index + 1}
          </div>

          {/* Step Label */}
          <div className="ml-3 flex-1">
            <p
              className={`text-sm font-medium ${
                index <= currentStep
                  ? theme === 'dark'
                    ? 'text-white'
                    : 'text-slate-900'
                  : theme === 'dark'
                  ? 'text-slate-400'
                  : 'text-slate-600'
              }`}
            >
              {step.name}
            </p>
          </div>

          {/* Arrow */}
          {index < steps.length - 1 && (
            <div className={`mx-3 flex-1 h-0.5 ${index < currentStep ? 'bg-green-600' : 'bg-slate-300'}`} />
          )}
        </div>
      ))}
    </div>
  );
};

// Data Ingestion Step Component
const DataIngestionStep: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const { theme } = useTheme();
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>([]);

  const datasets = [
    { id: 'dev', label: 'Development', value: 'dev' },
    { id: 'ref', label: 'Reference', value: 'ref' },
    { id: 'oot', label: 'Out-of-Time (OOT)', value: 'oot' },
    { id: 'prod', label: 'Production', value: 'prod' },
    { id: 'actuals', label: 'Actuals', value: 'actuals' },
  ];

  return (
    <div className="space-y-6">
      <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
        Data Ingestion
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {datasets.map((ds) => (
          <label
            key={ds.id}
            className={`p-4 rounded-lg border-2 cursor-pointer transition ${
              selectedDatasets.includes(ds.value)
                ? theme === 'dark'
                  ? 'bg-blue-600/20 border-blue-500'
                  : 'bg-blue-50 border-blue-500'
                : theme === 'dark'
                ? 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedDatasets.includes(ds.value)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedDatasets([...selectedDatasets, ds.value]);
                  } else {
                    setSelectedDatasets(selectedDatasets.filter((v) => v !== ds.value));
                  }
                }}
                className="w-4 h-4"
              />
              <div>
                <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  {ds.label}
                </p>
                <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                  Upload CSV or Parquet
                </p>
              </div>
            </div>
          </label>
        ))}
      </div>

      <div>
        <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
          Target Variable
        </label>
        <input
          type="text"
          placeholder="e.g., target, outcome, prediction"
          className={`w-full px-4 py-2 rounded-lg border ${
            theme === 'dark'
              ? 'bg-slate-800 border-slate-700 text-white'
              : 'bg-white border-slate-300 text-slate-900'
          }`}
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={onComplete}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            theme === 'dark'
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          Complete Data Ingestion
        </button>
      </div>
    </div>
  );
};

// Data Quality Step Component
const DataQualityStep: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const { theme } = useTheme();

  const qualityMetrics = [
    { label: 'Volume', value: '1.2M records', status: 'good' as const },
    { label: 'Bad Rate', value: '0.2%', status: 'good' as const },
    { label: 'Missing %', value: '1.5%', status: 'warning' as const },
    { label: 'PSI', value: '0.08', status: 'good' as const },
    { label: 'CSI', value: '0.12', status: 'good' as const },
    { label: 'Schema Drift', value: 'None detected', status: 'good' as const },
  ];

  return (
    <div className="space-y-6">
      <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
        Data Quality Assessment
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {qualityMetrics.map((metric, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-lg border ${
              theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                {metric.label}
              </p>
              <span
                className={`text-2xl ${
                  metric.status === 'good'
                    ? 'text-green-500'
                    : metric.status === 'warning'
                    ? 'text-yellow-500'
                    : 'text-red-500'
                }`}
              >
                {metric.status === 'good' ? '✓' : metric.status === 'warning' ? '⚠' : '✗'}
              </span>
            </div>
            <p className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {metric.value}
            </p>
          </div>
        ))}
      </div>

      <button
        onClick={onComplete}
        className={`px-4 py-2 rounded-lg font-medium transition ${
          theme === 'dark'
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-blue-500 hover:bg-blue-600 text-white'
        }`}
      >
        Approve Data Quality
      </button>
    </div>
  );
};

// Model Import Step Component
const ModelImportStep: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const { theme } = useTheme();
  const [modelType, setModelType] = useState('pmml');

  return (
    <div className="space-y-6">
      <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
        Model Import
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {['PMML', 'ONNX', 'Pickle', 'JSON'].map((type) => (
          <button
            key={type}
            onClick={() => setModelType(type.toLowerCase())}
            className={`p-3 rounded-lg border-2 transition font-medium ${
              modelType === type.toLowerCase()
                ? theme === 'dark'
                  ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                  : 'bg-blue-50 border-blue-500 text-blue-600'
                : theme === 'dark'
                ? 'bg-slate-800/50 border-slate-700 text-slate-300'
                : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <div>
          <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
            Model ID
          </label>
          <input
            type="text"
            placeholder="e.g., CREDIT_RISK_2024_Q1"
            className={`w-full px-4 py-2 rounded-lg border ${
              theme === 'dark'
                ? 'bg-slate-800 border-slate-700 text-white'
                : 'bg-white border-slate-300 text-slate-900'
            }`}
          />
        </div>

        <div>
          <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
            Model Name
          </label>
          <input
            type="text"
            placeholder="e.g., Credit Risk Scoring v2.1"
            className={`w-full px-4 py-2 rounded-lg border ${
              theme === 'dark'
                ? 'bg-slate-800 border-slate-700 text-white'
                : 'bg-white border-slate-300 text-slate-900'
            }`}
          />
        </div>

        <div>
          <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
            Model Type
          </label>
          <select
            className={`w-full px-4 py-2 rounded-lg border ${
              theme === 'dark'
                ? 'bg-slate-800 border-slate-700 text-white'
                : 'bg-white border-slate-300 text-slate-900'
            }`}
          >
            <option>Classification</option>
            <option>Regression</option>
            <option>Clustering</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
              Risk Tier
            </label>
            <select
              className={`w-full px-4 py-2 rounded-lg border ${
                theme === 'dark'
                  ? 'bg-slate-800 border-slate-700 text-white'
                  : 'bg-white border-slate-300 text-slate-900'
              }`}
            >
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
              Status
            </label>
            <select
              className={`w-full px-4 py-2 rounded-lg border ${
                theme === 'dark'
                  ? 'bg-slate-800 border-slate-700 text-white'
                  : 'bg-white border-slate-300 text-slate-900'
              }`}
            >
              <option>Champion</option>
              <option>Challenger</option>
              <option>Archive</option>
            </select>
          </div>
        </div>
      </div>

      <button
        onClick={onComplete}
        className={`px-4 py-2 rounded-lg font-medium transition ${
          theme === 'dark'
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-blue-500 hover:bg-blue-600 text-white'
        }`}
      >
        Import Model
      </button>
    </div>
  );
};

// Performance Evaluation Step
const PerformanceStep: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const { theme } = useTheme();

  const tabs = ['Classification', 'Regression', 'Stability', 'Explainability', 'Segments'];

  return (
    <div className="space-y-6">
      <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
        Performance Evaluation
      </h3>

      <div className="flex gap-2 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition ${
              theme === 'dark'
                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className={`p-6 rounded-lg border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
        <p className={`${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
          Performance charts, ROC curves, KS plots, SHAP analysis, and more will be displayed here based on your model type and evaluation data.
        </p>
      </div>

      <button
        onClick={onComplete}
        className={`px-4 py-2 rounded-lg font-medium transition ${
          theme === 'dark'
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-blue-500 hover:bg-blue-600 text-white'
        }`}
      >
        Complete Performance Review
      </button>
    </div>
  );
};

// Reports Step
const ReportsStep: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const { theme } = useTheme();

  const reports = [
    { name: 'Quarterly Review', type: 'quarterly' },
    { name: 'Annual Review', type: 'annual' },
    { name: 'Drift Analysis', type: 'drift' },
    { name: 'Fairness Report', type: 'fairness' },
    { name: 'Explainability', type: 'explainability' },
  ];

  return (
    <div className="space-y-6">
      <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
        Reports
      </h3>

      <div className="space-y-3">
        {reports.map((report) => (
          <div
            key={report.type}
            className={`p-4 rounded-lg border cursor-pointer transition ${
              theme === 'dark'
                ? 'bg-slate-800/50 border-slate-700 hover:bg-slate-800/80'
                : 'bg-white border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText size={20} className={theme === 'dark' ? 'text-blue-400' : 'text-blue-600'} />
                <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  {report.name}
                </p>
              </div>
              <ChevronRight size={20} className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'} />
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onComplete}
        className={`px-4 py-2 rounded-lg font-medium transition ${
          theme === 'dark'
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-blue-500 hover:bg-blue-600 text-white'
        }`}
      >
        Generate Reports
      </button>
    </div>
  );
};

// Alerts Step
const AlertsStep: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const { theme } = useTheme();

  const [alerts] = useState([
    { id: 1, msg: 'AUC dropped below threshold', severity: 'critical' },
    { id: 2, msg: 'Data drift detected', severity: 'warning' },
    { id: 3, msg: 'Fairness metric degraded', severity: 'warning' },
  ]);

  return (
    <div className="space-y-6">
      <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
        Alert Configuration
      </h3>

      <div className="space-y-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`p-4 rounded-lg border flex items-center gap-3 ${
              alert.severity === 'critical'
                ? theme === 'dark'
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-red-50 border-red-500/30'
                : theme === 'dark'
                ? 'bg-yellow-500/10 border-yellow-500/30'
                : 'bg-yellow-50 border-yellow-500/30'
            }`}
          >
            <AlertCircle
              size={20}
              className={alert.severity === 'critical' ? 'text-red-500' : 'text-yellow-500'}
            />
            <p className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>{alert.msg}</p>
            <input type="checkbox" className="ml-auto w-4 h-4" defaultChecked />
          </div>
        ))}
      </div>

      <button
        onClick={onComplete}
        className={`px-4 py-2 rounded-lg font-medium transition ${
          theme === 'dark'
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-blue-500 hover:bg-blue-600 text-white'
        }`}
      >
        Setup Alerts
      </button>
    </div>
  );
};

export default function ProjectsMonitoring() {
  const { theme } = useTheme();
  const { showNotification } = useNotification();
  const [workflows, setWorkflows] = useState<Workflow[]>([
    {
      id: '1',
      name: 'Credit Risk Model v2.1',
      description: 'Quarterly monitoring and validation',
      status: 'in-progress',
      currentStep: 2,
      createdAt: '2026-02-13',
      owner: 'John Smith',
      steps: [
        { id: 's1', name: 'Data Ingestion', description: 'Upload datasets', status: 'completed', completionPercentage: 100 },
        { id: 's2', name: 'Data Quality', description: 'Validate data', status: 'in-progress', completionPercentage: 50 },
        { id: 's3', name: 'Model Import', description: 'Import model', status: 'not-started', completionPercentage: 0 },
        { id: 's4', name: 'Performance', description: 'Evaluate metrics', status: 'not-started', completionPercentage: 0 },
        { id: 's5', name: 'Reports', description: 'Generate reports', status: 'not-started', completionPercentage: 0 },
        { id: 's6', name: 'Alerts', description: 'Configure alerts', status: 'not-started', completionPercentage: 0 },
      ],
    },
  ]);

  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>('1');
  const [showNewWorkflowModal, setShowNewWorkflowModal] = useState(false);

  const selectedWorkflow = selectedWorkflowId ? workflows.find((w) => w.id === selectedWorkflowId) : null;

  const handleCompleteStep = () => {
    if (!selectedWorkflow) return;

    setWorkflows(
      workflows.map((w) => {
        if (w.id === selectedWorkflow.id) {
          const newSteps = [...w.steps];
          newSteps[w.currentStep].status = 'completed';
          newSteps[w.currentStep].completionPercentage = 100;

          return {
            ...w,
            currentStep: Math.min(w.currentStep + 1, newSteps.length - 1),
            status: w.currentStep === newSteps.length - 1 ? 'completed' : 'in-progress',
            steps: newSteps,
          };
        }
        return w;
      })
    );

    showNotification('Step completed!', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Projects' }]} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            Model Monitoring Workflows
          </h1>
          <p className={`mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
            Manage model monitoring and governance processes
          </p>
        </div>
        <button
          onClick={() => setShowNewWorkflowModal(true)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
            theme === 'dark'
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          <Plus size={18} />
          New Workflow
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Workflows List */}
        <div className="lg:col-span-1">
          <div
            className={`rounded-lg border ${
              theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'
            }`}
          >
            <div className={`p-4 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-slate-200'}`}>
              <h2 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Workflows
              </h2>
            </div>

            <div className="divide-y">
              {workflows.map((workflow) => (
                <button
                  key={workflow.id}
                  onClick={() => setSelectedWorkflowId(workflow.id)}
                  className={`w-full text-left p-4 transition ${
                    selectedWorkflowId === workflow.id
                      ? theme === 'dark'
                        ? 'bg-blue-600/20 border-l-2 border-l-blue-500'
                        : 'bg-blue-50 border-l-2 border-l-blue-500'
                      : theme === 'dark'
                      ? 'hover:bg-slate-700/30'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    {workflow.name}
                  </p>
                  <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                    Step {workflow.currentStep + 1} of {workflow.steps.length}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Workflow Details */}
        <div className="lg:col-span-3">
          {selectedWorkflow ? (
            <div
              className={`rounded-lg border p-6 ${
                theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'
              }`}
            >
              {/* Step Indicator */}
              <StepIndicator steps={selectedWorkflow.steps} currentStep={selectedWorkflow.currentStep} />

              {/* Current Step Content */}
              <div className="mt-8">
                {selectedWorkflow.currentStep === 0 && <DataIngestionStep onComplete={handleCompleteStep} />}
                {selectedWorkflow.currentStep === 1 && <DataQualityStep onComplete={handleCompleteStep} />}
                {selectedWorkflow.currentStep === 2 && <ModelImportStep onComplete={handleCompleteStep} />}
                {selectedWorkflow.currentStep === 3 && <PerformanceStep onComplete={handleCompleteStep} />}
                {selectedWorkflow.currentStep === 4 && <ReportsStep onComplete={handleCompleteStep} />}
                {selectedWorkflow.currentStep === 5 && <AlertsStep onComplete={handleCompleteStep} />}

                {selectedWorkflow.status === 'completed' && (
                  <div
                    className={`p-6 rounded-lg text-center ${
                      theme === 'dark' ? 'bg-green-600/20 border border-green-500/30' : 'bg-green-50 border border-green-500/30'
                    }`}
                  >
                    <CheckCircle2 size={48} className="mx-auto mb-3 text-green-500" />
                    <p className={`font-bold ${theme === 'dark' ? 'text-green-400' : 'text-green-700'}`}>
                      Workflow Completed!
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<Database size={48} />}
              title="No Workflow Selected"
              description="Select a workflow from the list to view details"
            />
          )}
        </div>
      </div>
    </div>
  );
}
