import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { Breadcrumb } from '../components/UIPatterns';

interface WorkflowStep {
  id: number;
  name: string;
  status: 'not-started' | 'in-progress' | 'completed' | 'error';
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
}

const StepIndicator: React.FC<{ steps: WorkflowStep[]; currentStep: number }> = ({
  steps,
  currentStep,
}) => {
  const { theme } = useTheme();

  return (
    <div className="flex items-center justify-between mb-8">
      {steps.map((step, idx) => {
        const isCompleted = step.status === 'completed';
        const isCurrent = idx === currentStep;

        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition ${
                  isCompleted
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
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
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

export default function Projects() {
  const { theme } = useTheme();
  const [workflows, setWorkflows] = useState<Workflow[]>([
    {
      id: '1',
      name: 'Credit Risk Model v2.1',
      description: 'Model monitoring workflow for credit risk assessment',
      status: 'in-progress',
      currentStep: 1,
      createdAt: '2026-02-10',
      owner: 'Risk Team',
      steps: [
        { id: 0, name: 'Data Ingestion', status: 'completed' },
        { id: 1, name: 'Data Quality', status: 'in-progress' },
        { id: 2, name: 'Model Import', status: 'not-started' },
        { id: 3, name: 'Performance', status: 'not-started' },
        { id: 4, name: 'Reports', status: 'not-started' },
        { id: 5, name: 'Alerts', status: 'not-started' },
      ],
    },
  ]);

  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('1');

  const selectedWorkflow = workflows.find((w) => w.id === selectedWorkflowId);

  const handleCompleteStep = (workflowId: string) => {
    setWorkflows(
      workflows.map((w) => {
        if (w.id === workflowId) {
          const newSteps = w.steps.map((s, idx) => {
            if (idx === w.currentStep) {
              return { ...s, status: 'completed' as const };
            }
            return s;
          });

          const newCurrentStep = Math.min(w.currentStep + 1, w.steps.length - 1);
          const allCompleted = newCurrentStep === w.steps.length - 1 && newSteps[newCurrentStep].status === 'completed';

          return {
            ...w,
            steps: newSteps,
            currentStep: newCurrentStep,
            status: allCompleted ? 'completed' : w.status,
          };
        }
        return w;
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
            Model Monitoring Workflows
          </h1>
          <p className={`mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
            Track and manage model monitoring workflows through monitoring lifecycle
          </p>
        </div>
      </div>

      {/* Workflows Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Workflows List */}
        <div className="space-y-3">
          {workflows.map((workflow) => (
            <button
              key={workflow.id}
              onClick={() => setSelectedWorkflowId(workflow.id)}
              className={`w-full text-left p-4 rounded-lg border transition ${
                selectedWorkflowId === workflow.id
                  ? theme === 'dark'
                    ? 'bg-blue-600/20 border-blue-500'
                    : 'bg-blue-50 border-blue-500'
                  : theme === 'dark'
                  ? 'bg-slate-800/50 border-slate-700 hover:bg-slate-800/70'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <p className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {workflow.name}
              </p>
              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                Step {workflow.currentStep + 1} of {workflow.steps.length}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    workflow.status === 'completed'
                      ? 'bg-green-500/20 text-green-400'
                      : workflow.status === 'in-progress'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-gray-500/20 text-gray-400'
                  }`}
                >
                  {workflow.status}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Workflow Details */}
        <div className="md:col-span-2 space-y-6">
          {selectedWorkflow ? (
            <>
              {/* Step Indicator */}
              <StepIndicator steps={selectedWorkflow.steps} currentStep={selectedWorkflow.currentStep} />

              {/* Step Content */}
              <div
                className={`p-6 rounded-lg border ${
                  theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'
                }`}
              >
                {selectedWorkflow.currentStep === 0 && (
                  <DataIngestionStep onComplete={() => handleCompleteStep(selectedWorkflow.id)} />
                )}
                {selectedWorkflow.currentStep === 1 && (
                  <DataQualityStep onComplete={() => handleCompleteStep(selectedWorkflow.id)} />
                )}
                {selectedWorkflow.currentStep === 2 && (
                  <ModelImportStep onComplete={() => handleCompleteStep(selectedWorkflow.id)} />
                )}
                {selectedWorkflow.currentStep === 3 && (
                  <PerformanceStep onComplete={() => handleCompleteStep(selectedWorkflow.id)} />
                )}
                {selectedWorkflow.currentStep === 4 && (
                  <ReportsStep onComplete={() => handleCompleteStep(selectedWorkflow.id)} />
                )}
                {selectedWorkflow.currentStep === 5 && (
                  <AlertsStep onComplete={() => handleCompleteStep(selectedWorkflow.id)} />
                )}
              </div>

              {/* Completion Message */}
              {selectedWorkflow.status === 'completed' && (
                <div className="p-6 rounded-lg bg-green-500/10 border border-green-500/30">
                  <p className="flex items-center gap-2 text-green-600 font-semibold">
                    <CheckCircle2 size={20} />
                    Workflow completed successfully!
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className={`p-12 text-center rounded-lg border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <AlertCircle size={48} className={`mx-auto mb-4 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`} />
              <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
                Select a workflow to view details
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
