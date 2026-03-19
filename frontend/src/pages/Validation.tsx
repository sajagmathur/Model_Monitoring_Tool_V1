import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Plus, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useGlobal } from '../contexts/GlobalContext';
import { Breadcrumb } from '../components/UIPatterns';
import { DataIngestionStepComponent, DataIngestionConfig } from './DataIngestionStep';
import { getStepDescription, createWorkflowLogEntry } from '../utils/workflowLogger';
import {
  DataQualityStep,
  ModelMetricsStep,
  KpiGenerationStep,
  ReportConfigurationStep,
  ScheduleReportsStep,
  type WorkflowStep,
  type Workflow,
  type Project,
} from './Projects';

// ── Validation workflow steps (no Model Import) ──────────────────────────────

const VALIDATION_STEPS: WorkflowStep[] = [
  { id: 0, name: 'Validation Data Ingestion', status: 'not-started' },
  { id: 1, name: 'Data Quality Reporting', status: 'not-started', locked: true },
  { id: 2, name: 'KPI & Metrics Configuration', status: 'not-started', locked: true },
  { id: 3, name: 'KPI Generation', status: 'not-started', locked: true },
  { id: 4, name: 'Report Configuration', status: 'not-started', locked: true },
  { id: 5, name: 'Schedule Reports', status: 'not-started', locked: true },
];

// ── Step indicator (mirrors Projects.tsx) ────────────────────────────────────

const StepIndicator: React.FC<{ steps: WorkflowStep[]; currentStep: number }> = ({ steps, currentStep }) => {
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
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition ${
                isLocked
                  ? theme === 'dark' ? 'bg-slate-700 text-slate-500' : 'bg-slate-300 text-slate-500'
                  : isCompleted ? 'bg-green-500 text-white'
                  : isCurrent ? 'bg-blue-500 text-white'
                  : theme === 'dark' ? 'bg-slate-700 text-slate-400' : 'bg-slate-300 text-slate-600'
              }`}>
                {isCompleted ? <CheckCircle2 size={20} /> : idx + 1}
              </div>
              <p className={`text-xs mt-2 text-center max-w-24 ${
                isLocked
                  ? theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                  : theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
              }`}>{step.name}</p>
            </div>
            {idx < steps.length - 1 && (
              <div className={`flex-1 h-1 mx-2 mb-6 transition ${
                isCompleted ? 'bg-green-500' : theme === 'dark' ? 'bg-slate-700' : 'bg-slate-300'
              }`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ── Validation page ───────────────────────────────────────────────────────────

export default function Validation() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { createIngestionJob, createWorkflowLog } = useGlobal();

  const [validations, setValidations] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem('mlmonitoring_validations');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [selectedId, setSelectedId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('mlmonitoring_validations');
      const list = saved ? JSON.parse(saved) : [];
      return list.length > 0 ? list[0].id : '';
    } catch {
      return '';
    }
  });

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newForm, setNewForm] = useState({ name: '', description: '' });

  useEffect(() => {
    localStorage.setItem('mlmonitoring_validations', JSON.stringify(validations));
    if (validations.length > 0 && !validations.find(v => v.id === selectedId)) {
      setSelectedId(validations[0].id);
    }
  }, [validations]);

  const selected = validations.find(v => v.id === selectedId);

  const createNew = () => {
    if (!newForm.name.trim()) {
      alert('Validation name is required');
      return;
    }
    const id = `val-${Date.now()}`;
    const newVal: Project = {
      id,
      name: newForm.name,
      description: newForm.description,
      createdAt: new Date().toISOString().split('T')[0],
      workflow: {
        id: `wf-${Date.now()}`,
        name: newForm.name,
        description: newForm.description,
        status: 'pending',
        currentStep: 0,
        createdAt: new Date().toISOString().split('T')[0],
        owner: 'Current User',
        models: [],
        steps: VALIDATION_STEPS.map(s => ({ ...s })),
      },
    };
    setValidations([...validations, newVal]);
    setSelectedId(id);
    setNewForm({ name: '', description: '' });
    setShowCreateForm(false);
  };

  const deleteValidation = (id: string) => {
    if (confirm('Are you sure you want to delete this validation?')) {
      const updated = validations.filter(v => v.id !== id);
      setValidations(updated);
      if (selectedId === id && updated.length > 0) setSelectedId(updated[0].id);
    }
  };

  const updateWorkflow = (id: string, updatedWorkflow: Workflow) => {
    setValidations(validations.map(v => v.id === id ? { ...v, workflow: updatedWorkflow } : v));
  };

  const advanceStep = (val: Project, stepIndex: number) => {
    const newSteps = val.workflow.steps.map((s, idx) => {
      if (idx === stepIndex) return { ...s, status: 'completed' as const };
      if (idx === stepIndex + 1) return { ...s, locked: false };
      return s;
    });
    const isLast = stepIndex === val.workflow.steps.length - 1;
    return {
      ...val.workflow,
      steps: newSteps,
      currentStep: isLast ? stepIndex : stepIndex + 1,
      status: isLast ? ('completed' as const) : val.workflow.status,
    };
  };

  const isDark = theme === 'dark';

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Validation' }]} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Model Validation
          </h1>
          <p className={`mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Run validation workflows for models under review
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium"
        >
          <Plus size={18} />
          New Validation
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
          <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Create New Validation
          </h2>
          <div className="space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Validation Name
              </label>
              <input
                type="text"
                value={newForm.name}
                onChange={e => setNewForm({ ...newForm, name: e.target.value })}
                placeholder="e.g., Credit Risk Model – Annual Validation 2025"
                className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Description
              </label>
              <textarea
                value={newForm.description}
                onChange={e => setNewForm({ ...newForm, description: e.target.value })}
                placeholder="Brief description of this validation run..."
                rows={3}
                className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowCreateForm(false)}
                className={`px-4 py-2 rounded-lg transition ${isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300'}`}
              >
                Cancel
              </button>
              <button
                onClick={createNew}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium"
              >
                Create Validation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar */}
        <div className="space-y-3">
          <h3 className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            Your Validations
          </h3>
          {validations.map(val => (
            <div key={val.id} className="flex items-center gap-2">
              <button
                onClick={() => setSelectedId(val.id)}
                className={`flex-1 text-left p-3 rounded-lg border transition ${
                  selectedId === val.id
                    ? isDark ? 'bg-blue-600/20 border-blue-500' : 'bg-blue-50 border-blue-500'
                    : isDark ? 'bg-slate-800/50 border-slate-700 hover:bg-slate-800/70' : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {val.name}
                </p>
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {val.createdAt}
                </p>
              </button>
              <button
                onClick={() => deleteValidation(val.id)}
                className="p-2 rounded hover:bg-red-500/20 text-red-500 transition"
                title="Delete validation"
              >
                <X size={18} />
              </button>
            </div>
          ))}
          {validations.length === 0 && (
            <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              No validations yet.
            </p>
          )}
        </div>

        {/* Right Content */}
        <div className="lg:col-span-3 space-y-6">
          {selected ? (
            <>
              {/* Validation Header */}
              <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
                <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {selected.name}
                </h2>
                <p className={`mt-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {selected.description}
                </p>
                <p className={`text-xs mt-3 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                  Created: {selected.createdAt}
                </p>
              </div>

              {/* Workflow controls */}
              <div className="space-y-4">
                <div className="flex gap-2">
                  {selected.workflow.currentStep > 0 && (
                    <button
                      onClick={() => updateWorkflow(selected.id, {
                        ...selected.workflow,
                        currentStep: Math.max(0, selected.workflow.currentStep - 1),
                      })}
                      className={`px-4 py-2 rounded-lg transition font-medium ${
                        isDark ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-900'
                      }`}
                    >
                      ← Go Back
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to cancel this workflow? Progress will be lost.')) {
                        updateWorkflow(selected.id, {
                          ...selected.workflow,
                          currentStep: 0,
                          selectedModel: undefined,
                          status: 'pending' as const,
                          steps: selected.workflow.steps.map((s, idx) => ({
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

                <StepIndicator steps={selected.workflow.steps} currentStep={selected.workflow.currentStep} />

                <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
                  {/* Step 0: Validation Data Ingestion */}
                  {selected.workflow.currentStep === 0 && (
                    <DataIngestionStepComponent
                      workflow={selected.workflow}
                      onComplete={(config: DataIngestionConfig) => {
                        const datasetNames: string[] = [];
                        if (config.scoreLevelDataset) datasetNames.push(`${config.scoreLevelDataset.name} (score)`);
                        if (config.accountLevelDataset) datasetNames.push(`${config.accountLevelDataset.name} (account)`);
                        if (datasetNames.length === 0 && config.referenceDataset) datasetNames.push(config.referenceDataset.name);

                        type LeveledDataset = { ds: import('./DataIngestionStep').UploadedDataset; level: 'score' | 'account' };
                        const datasetsToRegister: LeveledDataset[] = [];
                        if (config.scoreLevelDataset) datasetsToRegister.push({ ds: config.scoreLevelDataset, level: 'score' });
                        if (config.accountLevelDataset) datasetsToRegister.push({ ds: config.accountLevelDataset, level: 'account' });
                        if (datasetsToRegister.length === 0 && config.referenceDataset) {
                          datasetsToRegister.push({ ds: config.referenceDataset, level: 'score' });
                        }
                        datasetsToRegister.forEach(({ ds, level }) => {
                          createIngestionJob({
                            name: ds.name,
                            projectId: selected.id,
                            modelId: config.modelId,
                            dataSource: 'desktop',
                            source: 'csv',
                            datasetType: 'monitoring',
                            status: 'completed',
                            outputPath: `/datasets/${ds.id}`,
                            outputShape: { rows: ds.rows, columns: ds.columns },
                            outputColumns: ds.columnsList,
                            level,
                            uploadedFile: {
                              name: ds.name,
                              path: `/datasets/${ds.id}/${ds.name}`,
                              size: 0,
                              type: 'csv',
                            },
                          });
                        });

                        const description = getStepDescription.dataIngestion(datasetNames.length, datasetNames);
                        createWorkflowLog(createWorkflowLogEntry(selected.id, selected.name, 'Validation Data Ingestion', description));
                        updateWorkflow(selected.id, {
                          ...advanceStep(selected, 0),
                          dataIngestionConfig: config,
                          selectedModel: config.modelId,
                        });
                      }}
                    />
                  )}

                  {/* Step 1: Data Quality Reporting */}
                  {selected.workflow.currentStep === 1 && (
                    <DataQualityStep
                      workflow={selected.workflow}
                      projectId={selected.id}
                      onUpdateWorkflow={(updatedWorkflow) => updateWorkflow(selected.id, updatedWorkflow)}
                      onComplete={() => {
                        createWorkflowLog(createWorkflowLogEntry(selected.id, selected.name, 'Data Quality', 'Data quality analysis completed'));
                        updateWorkflow(selected.id, advanceStep(selected, 1));
                      }}
                    />
                  )}

                  {/* Step 2: KPI & Metrics Configuration */}
                  {selected.workflow.currentStep === 2 && (
                    <ModelMetricsStep
                      workflow={selected.workflow}
                      onComplete={(config) => {
                        updateWorkflow(selected.id, {
                          ...advanceStep(selected, 2),
                          modelMetricsConfig: config,
                        });
                      }}
                    />
                  )}

                  {/* Step 3: KPI Generation */}
                  {selected.workflow.currentStep === 3 && (
                    <KpiGenerationStep
                      workflow={selected.workflow}
                      project={selected}
                      onComplete={(results) => {
                        createWorkflowLog(createWorkflowLogEntry(selected.id, selected.name, 'KPI Generation', `Generated ${results.length} KPI metric results`));
                        updateWorkflow(selected.id, {
                          ...advanceStep(selected, 3),
                          kpiResults: results,
                        } as any);
                      }}
                      onIngestAnotherModel={(_modelId) => {
                        // Reset back to Validation Data Ingestion (step 0)
                        updateWorkflow(selected.id, {
                          ...selected.workflow,
                          steps: selected.workflow.steps.map((s, idx) => ({
                            ...s,
                            status: 'not-started' as const,
                            locked: idx > 0,
                          })),
                          currentStep: 0,
                          dataIngestionConfig: undefined,
                          dataQualityAnalysis: undefined,
                          modelMetricsConfig: undefined,
                        } as any);
                      }}
                    />
                  )}

                  {/* Step 4: Report Configuration */}
                  {selected.workflow.currentStep === 4 && (
                    <ReportConfigurationStep
                      workflow={selected.workflow}
                      onComplete={() => {
                        createWorkflowLog(createWorkflowLogEntry(selected.id, selected.name, 'Report Configuration', 'Report configuration completed'));
                        updateWorkflow(selected.id, advanceStep(selected, 4));
                      }}
                    />
                  )}

                  {/* Step 5: Schedule Reports */}
                  {selected.workflow.currentStep === 5 && (
                    <ScheduleReportsStep
                      workflow={selected.workflow}
                      project={selected}
                      onComplete={() => {
                        createWorkflowLog(createWorkflowLogEntry(selected.id, selected.name, 'Schedule Reports', 'Reports scheduled'));
                        const completedWorkflow = advanceStep(selected, 5);
                        updateWorkflow(selected.id, completedWorkflow);
                        setTimeout(() => {
                          const completedModelId = selected.workflow.selectedModel || selected.workflow.models?.[0]?.id;
                          if (completedModelId) {
                            navigate(`/?modelId=${completedModelId}&source=validation`);
                          } else {
                            navigate('/');
                          }
                        }, 200);
                      }}
                    />
                  )}
                </div>

                {/* Completion Message */}
                {selected.workflow.status === 'completed' && (
                  <div className="p-6 rounded-lg bg-green-500/10 border border-green-500/30">
                    <p className="flex items-center gap-2 text-green-600 font-semibold">
                      <CheckCircle2 size={20} />
                      Validation workflow completed successfully!
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className={`p-12 text-center rounded-lg border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <AlertCircle size={48} className={`mx-auto mb-4 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
              <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                No validations available. Create a new validation to get started.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
