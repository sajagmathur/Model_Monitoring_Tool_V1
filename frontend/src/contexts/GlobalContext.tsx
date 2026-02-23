import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  BankingModel, 
  BankingMetrics, 
  SegmentMetrics,
  VariableStability,
  DecileData,
  FeatureImportance,
  generateCompleteBankingDataset 
} from '../utils/bankingMetricsMock';
import { 
  syncRegistryModelsToDashboard,
  mergeRegistryModelsWithExisting 
} from '../utils/modelMetricsMapper';

// Type Definitions
export interface ProjectCode {
  id: string;
  name: string;
  language: 'python' | 'yaml' | 'json' | 'dockerfile' | 'text';
  content: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  environment: 'dev' | 'staging' | 'prod';
  status: 'active' | 'inactive';
  code: ProjectCode[];
  createdAt: string;
  activeModelId?: string; // The currently selected model for this project
}

export interface IngestionJob {
  id: string;
  name: string;
  projectId: string;
  modelId?: string; // Link to the model this dataset is for
  codeId?: string;
  dataSource: 'csv' | 'database' | 'api' | 'cloud' | 'desktop';
  source?: 'csv' | 'database' | 'cloud' | 'treated'; // Simplified source type
  sourceConfig?: Record<string, any>;
  datasetType?: 'baseline' | 'reference' | 'monitoring' | 'development'; // Dataset classification for reporting
  refreshLocation?: string; // Location/path for dataset refresh
  uploadedFile?: {
    name: string;
    path: string;
    size: number;
    type: string;
  };
  status: 'created' | 'running' | 'completed' | 'failed' | 'active' | 'processing';
  outputPath?: string;
  outputShape?: { rows: number; columns: number };
  outputColumns?: string[];
  rows?: number; // Number of rows
  columns?: number; // Number of columns
  schema?: Array<{ name: string; type: string }>; // Column schema
  uploadedAt?: string; // Upload timestamp
  createdAt: string;
  lastRun?: string;
  treatmentMetadata?: {
    originalDatasetId: string;
    treatments: Array<{
      variable: string;
      method: string;
      appliedAt: string;
    }>;
    treatedBy: string;
    treatedAt: string;
  };
  // Dataset lineage for versioning and resolution tracking
  parentDatasetId?: string; // Links to original dataset if this is resolved
  isResolved?: boolean; // Marks this as a resolved dataset
  resolutionTimestamp?: string; // When resolution occurred
  resolutionSummary?: string; // Summary of treatments applied
  resolvedIssuesCount?: number; // Number of issues resolved
}

export interface PreparationJob {
  id: string;
  name: string;
  projectId: string;
  codeId?: string;
  ingestionJobId: string;
  processingConfig?: Record<string, any>;
  status: 'created' | 'running' | 'completed' | 'failed';
  outputPath?: string;
  outputShape?: { rows: number; columns: number };
  outputColumns?: string[];
  createdAt: string;
  lastRun?: string;
}

export interface RegistryModel {
  id: string;
  name: string;
  version: string;
  projectId: string;
  codeId?: string;
  uploadedFile?: {
    name: string;
    path: string;
    size: number;
    type: string;
  };
  modelType: 'classification' | 'regression' | 'clustering' | 'nlp' | 'custom';
  metrics?: Record<string, number>;
  stage: 'dev' | 'staging' | 'production';
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface DeploymentJob {
  id: string;
  name: string;
  projectId: string;
  modelId: string;
  dockerfileCodeId?: string;
  deploymentCodes?: string[]; // Array of code IDs for deployment scripts
  containerName?: string;
  environment: 'dev' | 'staging' | 'prod';
  status: 'created' | 'building' | 'deploying' | 'active' | 'failed';
  deploymentLogs?: string[];
  createdAt: string;
  lastDeployed?: string;
}

export interface InferencingJob {
  id: string;
  name: string;
  projectId: string;
  modelId: string;
  codeId?: string;
  inputDatasetId?: string;
  status: 'created' | 'running' | 'completed' | 'failed';
  outputPath?: string;
  predictions?: any[];
  createdAt: string;
  lastRun?: string;
}

export interface MonitoringJob {
  id: string;
  name: string;
  projectId: string;
  modelId: string;
  codeId?: string;
  inputDatasetId?: string;
  monitoringMetrics?: Record<string, number>;
  metrics?: {
    dataDrift?: number;
    modelDrift?: number;
    performanceDegradation?: number;
    lastChecked?: string;
  };
  status: 'created' | 'running' | 'completed' | 'failed';
  outputPath?: string;
  createdAt: string;
  lastRun?: string;
}

export interface PipelineJob {
  id: string;
  projectId: string;
  name: string;
  stages: {
    ingestion?: string; // Job ID
    preparation?: string;
    training?: string;
    registry?: string;
    deployment?: string;
    inferencing?: string;
    monitoring?: string;
  };
  status: 'created' | 'running' | 'completed' | 'failed';
  createdAt: string;
  lastRun?: string;
}

export interface ReportConfiguration {
  id: string;
  name: string;
  type?: 'data_quality' | 'stability' | 'performance' | 'drift' | 'explainability' | 'general'; // Type-lock configurations
  modelId: string;
  modelName: string;
  modelType: 'classification' | 'regression' | 'timeseries';
  baselineDatasetId: string;
  baselineDatasetName: string;
  referenceDatasetId: string;
  referenceDatasetName: string;
  metricsToMonitor: string[];
  driftMetrics: string[];
  createdAt: string;
  createdBy: string;
}

export interface GeneratedReport {
  id: string;
  name: string;
  type: 'stability' | 'performance' | 'explainability' | 'feature_analytics' | 'segmented_analysis' | 'drift_analysis' | 'data_quality';
  modelId: string;
  modelName: string;
  datasetId?: string;
  datasetName?: string;
  configurationId?: string;
  generatedAt: string;
  generatedBy: string;
  status: 'draft' | 'final' | 'archived';
  healthScore?: number;
  fileSize: string;
  filePath?: string;
  tags: string[];
  // Report artifact storage for immutability
  reportArtifact?: {
    pdfContent: string;
    metadata: any;
  };
  baselineDatasetIds?: string[]; // Original datasets used
  resolvedDatasetIds?: string[]; // Resolved datasets generated
  immutable?: boolean; // Report is frozen, never regenerate
}

export interface DataQualityReport {
  id: string;
  name: string;
  datasetId: string;
  datasetName: string;
  modelId?: string;
  qualityScore: number;
  totalRecords: number;
  recordsAfterExclusion: number;
  issues: Array<{
    variable: string;
    issue: string;
    severity: 'high' | 'medium' | 'low';
    suggestedTreatment?: string;
  }>;
  generatedAt: string;
  filePath?: string;
  // Report artifact storage for immutability
  reportArtifact?: {
    pdfContent: string;
    metadata: any;
  };
  baselineDatasetIds?: string[]; // Original datasets used
  resolvedDatasetIds?: string[]; // Resolved datasets generated
  immutable?: boolean; // Report is frozen, never regenerate
}

export interface SchedulingJob {
  id: string;
  name: string;
  type?: 'report_generation' | 'data_ingestion' | 'data_quality';
  reportType?: 'stability' | 'performance' | 'explainability' | 'feature_analytics' | 'segmented_analysis' | 'drift_analysis' | 'data_quality';
  reportTypes?: string[]; // For combined/multiple report generation in one job
  configurationId?: string;
  configurationName?: string;
  modelId?: string;
  modelName: string;
  scheduleType: 'one-time' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  scheduleTime?: string; // Format: 'HH:MM' (24-hour format)
  
  // One-time scheduling
  oneTimeDate?: string; // Format: 'YYYY-MM-DD'
  oneTimeTime?: string; // Format: 'HH:MM'
  
  // Daily scheduling (uses scheduleTime)
  
  // Weekly scheduling
  weekdays?: number[]; // Array of weekday numbers (0=Sunday, 1=Monday, etc.)
  
  // Monthly scheduling
  dayOfMonth?: number; // 1-31, or -1 for last day of month
  monthlyType?: 'day' | 'weekday'; // 'day' for specific date, 'weekday' for nth weekday
  weekOfMonth?: number; // 1-4 for first/second/third/fourth week, -1 for last week
  monthlyWeekday?: number; // 0-6 for Sunday-Saturday when using weekday type
  
  // Quarterly scheduling (every 3 months)
  quarterMonth?: 1 | 2 | 3; // Which month of quarter (1=Jan/Apr/Jul/Oct, 2=Feb/May/Aug/Nov, 3=Mar/Jun/Sep/Dec)
  
  // Yearly scheduling
  yearMonth?: number; // 1-12 for January-December
  yearDay?: number; // 1-31 for day of month
  
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  lastStatus?: 'success' | 'failed' | 'running';
  runCount?: number;
  createdAt: string;
  createdBy: string;
}

export interface WorkflowState {
  selectedModelId?: string;
  selectedModelName?: string;
  selectedDatasetId?: string;
  selectedDatasetName?: string;
  dataQualityCompleted?: boolean;
  dataQualityMetrics?: any;
  reportConfigCompleted?: boolean;
  reportConfig?: {
    modelType?: 'classification' | 'regression' | 'timeseries';
    selectedMetrics?: string[];
    segmentationVariable?: string;
  };
  selectedMetrics?: any[];
  thresholds?: any;
  selectedSegments?: string[];
  generatedReportId?: string;
  generatedReports?: any[];
  aiInsights?: any[];
  modelHealth?: number;
  reportGenerationCompleted?: boolean;
}

export interface WorkflowLog {
  id: string;
  projectId: string;
  projectName: string;
  workflowType: 'model_monitoring' | 'data_pipeline' | 'report_generation';
  summary: string;
  steps: Array<{
    stepName: string;
    status: 'completed' | 'skipped' | 'failed';
    details: string;
    timestamp: string;
  }>;
  scheduledJobs: Array<{
    jobName: string;
    reportTypes: string[];
    scheduleType: string;
    scheduleDetails: string;
  }>;
  createdAt: string;
  completedAt: string;
}

interface GlobalContextType {
  // Projects
  projects: Project[];
  createProject: (project: Omit<Project, 'id' | 'createdAt'>) => Project;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  getProject: (id: string) => Project | undefined;

  // Report Configurations
  reportConfigurations: ReportConfiguration[];
  createReportConfiguration: (config: Omit<ReportConfiguration, 'id' | 'createdAt' | 'createdBy'>) => ReportConfiguration;
  updateReportConfiguration: (id: string, updates: Partial<ReportConfiguration>) => void;
  deleteReportConfiguration: (id: string) => void;
  getReportConfiguration: (id: string) => ReportConfiguration | undefined;

  // Generated Reports
  generatedReports: GeneratedReport[];
  createGeneratedReport: (report: Omit<GeneratedReport, 'id' | 'generatedAt' | 'generatedBy'>) => GeneratedReport;
  deleteGeneratedReport: (id: string) => void;
  getGeneratedReport: (id: string) => GeneratedReport | undefined;

  // Data Quality Reports
  dataQualityReports: DataQualityReport[];
  createDataQualityReport: (report: Omit<DataQualityReport, 'id' | 'generatedAt'>) => DataQualityReport;
  deleteDataQualityReport: (id: string) => void;
  getDataQualityReport: (id: string) => DataQualityReport | undefined;

  // Scheduling Jobs
  schedulingJobs: SchedulingJob[];
  createSchedulingJob: (job: Omit<SchedulingJob, 'id' | 'createdAt' | 'createdBy'>) => SchedulingJob;
  updateSchedulingJob: (id: string, updates: Partial<SchedulingJob>) => void;
  deleteSchedulingJob: (id: string) => void;
  getSchedulingJob: (id: string) => SchedulingJob | undefined;
  runSchedulingJob: (id: string, action?: 'run' | 'toggle' | 'delete') => void;

  // Project Code
  addProjectCode: (projectId: string, code: Omit<ProjectCode, 'id' | 'createdAt'>) => ProjectCode;
  updateProjectCode: (projectId: string, codeId: string, updates: Partial<ProjectCode>) => void;
  deleteProjectCode: (projectId: string, codeId: string) => void;
  getProjectCode: (projectId: string, codeId: string) => ProjectCode | undefined;
  getProjectCodes: (projectId: string) => ProjectCode[];

  // Ingestion Jobs
  ingestionJobs: IngestionJob[];
  createIngestionJob: (job: Omit<IngestionJob, 'id' | 'createdAt'>) => IngestionJob;
  addIngestionJob: (job: Omit<IngestionJob, 'id' | 'createdAt'>) => IngestionJob; // Alias for createIngestionJob
  updateIngestionJob: (id: string, updates: Partial<IngestionJob>) => void;
  deleteIngestionJob: (id: string) => void;
  getIngestionJob: (id: string) => IngestionJob | undefined;
  
  // Dataset Cloning and Lineage
  cloneDatasetAsResolved: (originalId: string, resolutionSummary: string, resolvedIssuesCount: number, timestamp?: string) => IngestionJob | null;
  getResolvedDatasetsForParent: (parentId: string) => IngestionJob[];
  getReportsForDataset: (datasetId: string) => (GeneratedReport | DataQualityReport)[];
  getConfigurationsForModel: (modelId: string) => ReportConfiguration[];

  // Preparation Jobs
  preparationJobs: PreparationJob[];
  createPreparationJob: (job: Omit<PreparationJob, 'id' | 'createdAt'>) => PreparationJob;
  updatePreparationJob: (id: string, updates: Partial<PreparationJob>) => void;
  deletePreparationJob: (id: string) => void;
  getPreparationJob: (id: string) => PreparationJob | undefined;

  // Registry Models
  registryModels: RegistryModel[];
  createRegistryModel: (model: Omit<RegistryModel, 'id' | 'createdAt'>) => RegistryModel;
  updateRegistryModel: (id: string, updates: Partial<RegistryModel>) => void;
  deleteRegistryModel: (id: string) => void;
  clearRegistryModels: () => void;
  getRegistryModel: (id: string) => RegistryModel | undefined;

  // Deployment Jobs
  deploymentJobs: DeploymentJob[];
  createDeploymentJob: (job: Omit<DeploymentJob, 'id' | 'createdAt'>) => DeploymentJob;
  updateDeploymentJob: (id: string, updates: Partial<DeploymentJob>) => void;
  deleteDeploymentJob: (id: string) => void;
  getDeploymentJob: (id: string) => DeploymentJob | undefined;

  // Inferencing Jobs
  inferencingJobs: InferencingJob[];
  createInferencingJob: (job: Omit<InferencingJob, 'id' | 'createdAt'>) => InferencingJob;
  updateInferencingJob: (id: string, updates: Partial<InferencingJob>) => void;
  deleteInferencingJob: (id: string) => void;
  getInferencingJob: (id: string) => InferencingJob | undefined;

  // Monitoring Jobs
  monitoringJobs: MonitoringJob[];
  createMonitoringJob: (job: Omit<MonitoringJob, 'id' | 'createdAt'>) => MonitoringJob;
  updateMonitoringJob: (id: string, updates: Partial<MonitoringJob>) => void;
  deleteMonitoringJob: (id: string) => void;
  getMonitoringJob: (id: string) => MonitoringJob | undefined;

  // Pipeline Jobs
  pipelineJobs: PipelineJob[];
  createPipelineJob: (job: Omit<PipelineJob, 'id' | 'createdAt'>) => PipelineJob;
  updatePipelineJob: (id: string, updates: Partial<PipelineJob>) => void;
  deletePipelineJob: (id: string) => void;
  getPipelineJob: (id: string) => PipelineJob | undefined;
  getPipelinesByProject: (projectId: string) => PipelineJob[];

  // Workflow Logs
  workflowLogs: WorkflowLog[];
  createWorkflowLog: (log: Omit<WorkflowLog, 'id' | 'createdAt'>) => WorkflowLog;
  deleteWorkflowLog: (id: string) => void;
  getWorkflowLog: (id: string) => WorkflowLog | undefined;
  getWorkflowLogsByProject: (projectId: string) => WorkflowLog[];

  // Workflow State
  currentWorkflow: WorkflowState;
  setCurrentWorkflow: (workflow: WorkflowState) => void;

  // Banking Metrics
  bankingModels: BankingModel[];
  bankingMetrics: BankingMetrics[];
  getBankingModelMetrics: (modelId: string, vintage?: string) => BankingMetrics[];
  getBankingModelsByPortfolio: (portfolio: string) => BankingModel[];
  getBankingModelsByType: (modelType: string) => BankingModel[];
  getMetricsByRAGStatus: (ragStatus: 'green' | 'amber' | 'red') => BankingMetrics[];
  refreshBankingData: () => void;
  syncRegistryModelsToDashboard: () => void;

  // Utility
  loadSampleData: () => void;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

const STORAGE_KEY = 'mlops_studio_state';

const initialState: {
  projects: Project[];
  ingestionJobs: IngestionJob[];
  preparationJobs: PreparationJob[];
  registryModels: RegistryModel[];
  deploymentJobs: DeploymentJob[];
  inferencingJobs: InferencingJob[];
  monitoringJobs: MonitoringJob[];
  pipelineJobs: PipelineJob[];
  reportConfigurations: ReportConfiguration[];
  generatedReports: GeneratedReport[];
  dataQualityReports: DataQualityReport[];
  schedulingJobs: SchedulingJob[];
  workflowLogs: WorkflowLog[];
  currentWorkflow: WorkflowState;
  bankingModels: BankingModel[];
  bankingMetrics: BankingMetrics[];
} = {
  projects: [],
  ingestionJobs: [],
  preparationJobs: [],
  registryModels: [],
  deploymentJobs: [],
  inferencingJobs: [],
  monitoringJobs: [],
  pipelineJobs: [],
  reportConfigurations: [],
  generatedReports: [],
  dataQualityReports: [],
  schedulingJobs: [],
  workflowLogs: [],
  currentWorkflow: {},
  bankingModels: [],
  bankingMetrics: [],
};

export const GlobalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Helper function to generate IDs
  const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Initialize with sample data if no stored data exists
  const initializeSampleData = () => {
    const projectId = generateId();
    const modelId1 = generateId();
    const modelId2 = generateId();
    const datasetId1 = generateId();
    const datasetId2 = generateId();

    const sampleProject: Project = {
      id: projectId,
      name: 'Credit_Card_Model',
      description: 'Advanced ML pipeline for credit card fraud detection and risk assessment',
      environment: 'prod',
      status: 'active',
      code: [],
      createdAt: new Date().toISOString(),
    };

    const sampleModels: RegistryModel[] = [
      {
        id: modelId1,
        name: 'Credit_Card_Model',
        version: '1.0.0',
        projectId,
        modelType: 'classification',
        metrics: {
          auc: 0.92,
          precision: 0.88,
          recall: 0.85,
          f1_score: 0.865,
          accuracy: 0.9,
        },
        stage: 'production',
        status: 'active',
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: modelId2,
        name: 'Credit_Card_Model_v2',
        version: '2.0.0',
        projectId,
        modelType: 'classification',
        metrics: {
          auc: 0.945,
          precision: 0.91,
          recall: 0.88,
          f1_score: 0.895,
          accuracy: 0.92,
        },
        stage: 'staging',
        status: 'active',
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    const sampleDatasets: IngestionJob[] = [
      {
        id: datasetId1,
        name: 'Credit Card Training Set',
        projectId,
        modelId: modelId1,
        dataSource: 'database',
        status: 'completed',
        rows: 500000,
        columns: 30,
        outputColumns: [
          'transaction_id', 'customer_id', 'card_type', 'amount', 'merchant_category',
          'merchant_country', 'transaction_date', 'transaction_time', 'time_since_last_transaction',
          'distance_from_home', 'used_chip', 'used_pin', 'online_order', 'fraud_label',
          'customer_age', 'customer_income', 'account_age_months', 'previous_fraud_count',
          'total_transactions_24h', 'total_spend_24h', 'avg_transaction_amount',
          'account_balance', 'credit_limit', 'credit_utilization', 'payment_status',
          'delinquency_status', 'num_accounts', 'device_id', 'ip_country', 'is_fraud'
        ],
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: datasetId2,
        name: 'Credit Card Validation Set',
        projectId,
        modelId: modelId1,
        dataSource: 'database',
        status: 'completed',
        rows: 150000,
        columns: 30,
        outputColumns: [
          'transaction_id', 'customer_id', 'card_type', 'amount', 'merchant_category',
          'merchant_country', 'transaction_date', 'transaction_time', 'time_since_last_transaction',
          'distance_from_home', 'used_chip', 'used_pin', 'online_order', 'fraud_label',
          'customer_age', 'customer_income', 'account_age_months', 'previous_fraud_count',
          'total_transactions_24h', 'total_spend_24h', 'avg_transaction_amount',
          'account_balance', 'credit_limit', 'credit_utilization', 'payment_status',
          'delinquency_status', 'num_accounts', 'device_id', 'ip_country', 'is_fraud'
        ],
        createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    const sampleDeployments: DeploymentJob[] = [
      {
        id: generateId(),
        name: 'Credit_Card_Model-prod-v1',
        projectId,
        modelId: modelId1,
        containerName: 'credit-card-model-prod',
        environment: 'prod',
        status: 'active',
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        lastDeployed: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: generateId(),
        name: 'Credit_Card_Model_v2-staging',
        projectId,
        modelId: modelId2,
        containerName: 'credit-card-model-staging',
        environment: 'staging',
        status: 'active',
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        lastDeployed: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    const sampleMonitoringJobs: MonitoringJob[] = [
      {
        id: generateId(),
        name: 'Cancer Risk Monitoring - Drift',
        projectId,
        modelId: modelId1,
        status: 'running',
        metrics: {
          dataDrift: 8.2,
          modelDrift: 12.5,
          performanceDegradation: 3.1,
          lastChecked: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        },
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: generateId(),
        name: 'Credit_Card_Model_v2 - Drift Detection',
        projectId,
        modelId: modelId2,
        status: 'running',
        metrics: {
          dataDrift: 5.3,
          modelDrift: 4.8,
          performanceDegradation: 0.8,
          lastChecked: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        },
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        lastRun: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      },
    ];

    const sampleDataQualityReports: DataQualityReport[] = [
      {
        id: generateId(),
        name: 'Credit Card Training Data Quality',
        datasetId: datasetId1,
        datasetName: 'Credit Card Training Set',
        modelId: modelId1,
        qualityScore: 94.2,
        totalRecords: 500000,
        recordsAfterExclusion: 485000,
        issues: [
          { variable: 'distance_from_home', issue: 'Outliers detected', severity: 'medium', suggestedTreatment: 'Cap at 95th percentile' },
          { variable: 'amount', issue: '2.1% missing values', severity: 'low', suggestedTreatment: 'Impute with median' },
          { variable: 'merchant_country', issue: 'Imbalanced categories', severity: 'low', suggestedTreatment: 'Group rare categories' },
        ],
        generatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: generateId(),
        name: 'Credit Card Validation Data Quality',
        datasetId: datasetId2,
        datasetName: 'Credit Card Validation Set',
        modelId: modelId1,
        qualityScore: 91.8,
        totalRecords: 150000,
        recordsAfterExclusion: 145500,
        issues: [
          { variable: 'customer_income', issue: '8.3% missing values', severity: 'high', suggestedTreatment: 'Impute with K-NN' },
          { variable: 'device_id', issue: 'New categorical values', severity: 'medium', suggestedTreatment: 'Map to "OTHER"' },
          { variable: 'used_chip', issue: 'Class imbalance 93-7', severity: 'low', suggestedTreatment: 'Monitor in production' },
        ],
        generatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    const sampleGeneratedReports: GeneratedReport[] = [
      {
        id: generateId(),
        name: 'Credit_Card_Model Performance Report - Jan 2026',
        type: 'performance',
        modelId: modelId1,
        modelName: 'Credit_Card_Model',
        datasetId: datasetId1,
        datasetName: 'Credit Card Training Set',
        generatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        generatedBy: 'system',
        status: 'final',
        healthScore: 87,
        fileSize: '2.4 MB',
        tags: ['production', 'monthly', 'performance'],
      },
      {
        id: generateId(),
        name: 'Credit_Card_Model Drift Analysis - Jan 2026',
        type: 'drift_analysis',
        modelId: modelId1,
        modelName: 'Credit_Card_Model',
        datasetId: datasetId2,
        datasetName: 'Credit Card Validation Set',
        generatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        generatedBy: 'system',
        status: 'final',
        healthScore: 78,
        fileSize: '1.8 MB',
        tags: ['production', 'drift', 'monitoring'],
      },
      {
        id: generateId(),
        name: 'Credit_Card_Model_v2 Stability Report - Jan 2026',
        type: 'stability',
        modelId: modelId2,
        modelName: 'Credit_Card_Model_v2',
        datasetId: datasetId1,
        datasetName: 'Credit Card Training Set',
        generatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        generatedBy: 'system',
        status: 'final',
        healthScore: 92,
        fileSize: '2.1 MB',
        tags: ['staging', 'stability', 'comparison'],
      },
      {
        id: generateId(),
        name: 'Data Quality Report - Live Production',
        type: 'data_quality',
        modelId: modelId1,
        modelName: 'Credit_Card_Model',
        generatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        generatedBy: 'system',
        status: 'final',
        healthScore: 85,
        fileSize: '1.2 MB',
        tags: ['realtime', 'production', 'quality'],
      },
    ];

    const sampleSchedulingJobs: SchedulingJob[] = [
      {
        id: generateId(),
        name: 'Daily Performance Report - Credit_Card_Model',
        type: 'report_generation',
        reportType: 'performance',
        modelId: modelId1,
        modelName: 'Credit_Card_Model',
        scheduleType: 'daily',
        scheduleTime: '09:00',
        enabled: true,
        lastRun: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        nextRun: new Date(Date.now() + 21 * 60 * 60 * 1000).toISOString(),
        lastStatus: 'success',
        runCount: 45,
        createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
        createdBy: 'admin@company.com',
      },
      {
        id: generateId(),
        name: 'Weekly Drift Analysis',
        type: 'report_generation',
        reportType: 'drift_analysis',
        modelId: modelId1,
        modelName: 'Credit_Card_Model',
        scheduleType: 'weekly',
        scheduleTime: '18:00',
        weekdays: [1, 3, 5], // Mon, Wed, Fri
        enabled: true,
        lastRun: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        nextRun: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        lastStatus: 'success',
        runCount: 12,
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        createdBy: 'admin@company.com',
      },
      {
        id: generateId(),
        name: 'Monthly Data Quality Audit',
        type: 'report_generation',
        reportType: 'data_quality',
        modelId: modelId1,
        modelName: 'Credit_Card_Model',
        scheduleType: 'monthly',
        scheduleTime: '22:00',
        dayOfMonth: 1,
        enabled: true,
        lastRun: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        nextRun: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        lastStatus: 'success',
        runCount: 3,
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        createdBy: 'admin@company.com',
      },
    ];

    const sampleWorkflowLogs: WorkflowLog[] = [
      {
        id: generateId(),
        projectId,
        projectName: sampleProject.name,
        workflowType: 'model_monitoring',
        summary: 'Model Import: Credit_Card_Model v1.0.0 imported successfully',
        steps: [
          {
            stepName: 'Model Import',
            status: 'completed',
            details: 'Model "Credit_Card_Model" (Version: 1.0.0, Type: classification, Stage: production) added to repository',
            timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
        scheduledJobs: [],
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        completedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: generateId(),
        projectId,
        projectName: sampleProject.name,
        workflowType: 'data_pipeline',
        summary: 'Data Ingestion: 2 datasets ingested and quality checked',
        steps: [
          {
            stepName: 'Data Ingestion',
            status: 'completed',
            details: '2 dataset(s) ingested: Credit Card Training Set (500K rows), Credit Card Validation Set (150K rows)',
            timestamp: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
        scheduledJobs: [],
        createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
        completedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: generateId(),
        projectId,
        projectName: sampleProject.name,
        workflowType: 'model_monitoring',
        summary: 'Model Deployment: Credit_Card_Model deployed to production',
        steps: [
          {
            stepName: 'Build',
            status: 'completed',
            details: 'Docker image built successfully',
            timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            stepName: 'Deploy',
            status: 'completed',
            details: 'Model deployed to prod environment',
            timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
        scheduledJobs: [],
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    // Generate banking metrics dataset
    const { models: bankingModels, metrics: bankingMetrics } = generateCompleteBankingDataset();

    return {
      ...initialState,
      projects: [sampleProject],
      registryModels: sampleModels,
      ingestionJobs: sampleDatasets,
      deploymentJobs: sampleDeployments,
      monitoringJobs: sampleMonitoringJobs,
      dataQualityReports: sampleDataQualityReports,
      generatedReports: sampleGeneratedReports,
      schedulingJobs: sampleSchedulingJobs,
      workflowLogs: sampleWorkflowLogs,
      bankingModels,
      bankingMetrics,
    };
  };

  // Initialize state with sample data immediately for first render
  const [state, setState] = useState<typeof initialState>(() => {
    console.log('🔧 Initializing GlobalContext state...');
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        console.log('📦 Found stored data in localStorage');
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object' && parsed.projects) {
          // Check if the data is actually empty (empty arrays everywhere)
          const isEmpty = (
            (!parsed.projects || parsed.projects.length === 0) &&
            (!parsed.registryModels || parsed.registryModels.length === 0) &&
            (!parsed.generatedReports || parsed.generatedReports.length === 0) &&
            (!parsed.monitoringJobs || parsed.monitoringJobs.length === 0)
          );
          
          if (isEmpty) {
            console.log('⚠️ Stored data is empty, loading sample data instead');
            const sampleData = initializeSampleData();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleData));
            return sampleData;
          }
          
          console.log('✅ Using stored data from localStorage');
          // Merge with initial state to ensure all required properties exist
          const mergedState = {
            ...initialState,
            ...parsed,
            // Ensure arrays are properly initialized
            projects: parsed.projects || [],
            ingestionJobs: parsed.ingestionJobs || [],
            preparationJobs: parsed.preparationJobs || [],
            registryModels: parsed.registryModels || [],
            deploymentJobs: parsed.deploymentJobs || [],
            inferencingJobs: parsed.inferencingJobs || [],
            monitoringJobs: parsed.monitoringJobs || [],
            pipelineJobs: parsed.pipelineJobs || [],
            reportConfigurations: parsed.reportConfigurations || [],
            generatedReports: parsed.generatedReports || [],
            dataQualityReports: parsed.dataQualityReports || [],
            schedulingJobs: parsed.schedulingJobs || [],
            workflowLogs: parsed.workflowLogs || [],
            currentWorkflow: parsed.currentWorkflow || {},
            bankingModels: parsed.bankingModels || [],
            bankingMetrics: parsed.bankingMetrics || [],
          };
          
          // If banking data is missing, generate it
          if (!mergedState.bankingModels.length || !mergedState.bankingMetrics.length) {
            const { models: bankingModels, metrics: bankingMetrics } = generateCompleteBankingDataset();
            mergedState.bankingModels = bankingModels;
            mergedState.bankingMetrics = bankingMetrics;
          }
          
          // Data Migration: Synchronize projects and models on initialization
          if (mergedState.projects && Array.isArray(mergedState.projects) && 
              mergedState.registryModels && Array.isArray(mergedState.registryModels)) {
            const projectIds = new Set(mergedState.projects.map((p: Project) => p.id));
            const firstProjectId = mergedState.projects.length > 0 ? mergedState.projects[0].id : null;
            
            const fixedModels = mergedState.registryModels.map((model: any) => {
              if (!model.projectId || !projectIds.has(model.projectId)) {
                return { ...model, projectId: firstProjectId || model.projectId };
              }
              return model;
            });
            
            return { ...mergedState, registryModels: fixedModels };
          }
          
          return mergedState;
        }
      }
    } catch (err) {
      console.error('❌ Failed to load state from localStorage during initialization:', err);
    }
    // Return sample data if no valid stored data
    console.log('🎲 No valid stored data, loading sample data');
    const sampleData = initializeSampleData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleData));
    return sampleData;
  });

  // Log initial state for debugging
  useEffect(() => {
    console.log('📊 GlobalContext state initialized:', {
      projects: state.projects.length,
      models: state.registryModels.length,
      datasets: state.ingestionJobs.length,
      deployments: state.deploymentJobs.length,
      monitoring: state.monitoringJobs.length,
      reports: state.generatedReports.length,
      dataQuality: state.dataQualityReports.length,
      scheduling: state.schedulingJobs.length,
      bankingModels: state.bankingModels.length,
      bankingMetrics: state.bankingMetrics.length
    });
  }, []);

  // Load from localStorage on mount and update if needed
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        
        // Validate parsed data has required properties
        if (parsed && typeof parsed === 'object' && parsed.projects) {
          // Merge with initial state to ensure all required properties exist
          const mergedState = {
            ...initialState,
            ...parsed,
            // Ensure arrays are properly initialized
            projects: parsed.projects || [],
            ingestionJobs: parsed.ingestionJobs || [],
            preparationJobs: parsed.preparationJobs || [],
            registryModels: parsed.registryModels || [],
            deploymentJobs: parsed.deploymentJobs || [],
            inferencingJobs: parsed.inferencingJobs || [],
            monitoringJobs: parsed.monitoringJobs || [],
            pipelineJobs: parsed.pipelineJobs || [],
            reportConfigurations: parsed.reportConfigurations || [],
            generatedReports: parsed.generatedReports || [],
            dataQualityReports: parsed.dataQualityReports || [],
            schedulingJobs: parsed.schedulingJobs || [],
            workflowLogs: parsed.workflowLogs || [],
            currentWorkflow: parsed.currentWorkflow || {},
            bankingModels: parsed.bankingModels || [],
            bankingMetrics: parsed.bankingMetrics || [],
          };
          
          // If banking data is missing, generate it
          if (!mergedState.bankingModels.length || !mergedState.bankingMetrics.length) {
            const { models: bankingModels, metrics: bankingMetrics } = generateCompleteBankingDataset();
            mergedState.bankingModels = bankingModels;
            mergedState.bankingMetrics = bankingMetrics;
          }
          
          // Data Migration: Synchronize projects and models to ensure all models have valid projectIds
          if (mergedState.projects && Array.isArray(mergedState.projects) && 
              mergedState.registryModels && Array.isArray(mergedState.registryModels)) {
            const projectIds = new Set(mergedState.projects.map((p: Project) => p.id));
            const firstProjectId = mergedState.projects.length > 0 ? mergedState.projects[0].id : null;
            
            // Fix models that have invalid projectIds or no projectId
            const fixedModels = mergedState.registryModels.map((model: any) => {
              const modelProjectId = model.projectId;
              
              // If model has no projectId or projectId is invalid, assign first project
              if (!modelProjectId || !projectIds.has(modelProjectId)) {
                console.log(`[GlobalContext] Fixing model "${model.name}" - invalid projectId: ${modelProjectId}, assigning to first project: ${firstProjectId}`);
                return {
                  ...model,
                  projectId: firstProjectId || modelProjectId, // Fallback to original if no projects exist
                };
              }
              return model;
            });
            
            console.log('[GlobalContext] Data migration complete:', {
              projectCount: mergedState.projects.length,
              modelCount: fixedModels.length,
              modelsFixed: fixedModels.filter((m: any) => {
                const original = mergedState.registryModels.find((om: any) => om.id === m.id);
                return m.projectId !== original?.projectId;
              }).length,
            });
            
            setState({
              ...mergedState,
              registryModels: fixedModels,
            });
          } else {
            // Update state with merged data
            setState(mergedState);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load state from localStorage in useEffect:', err);
      // Use existing state if localStorage fails
    }
  }, []);

  // Save to localStorage on state change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Projects
  const createProject = (project: Omit<Project, 'id' | 'createdAt'>): Project => {
    const newProject: Project = {
      ...project,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    setState(prev => ({
      ...prev,
      projects: [...prev.projects, newProject],
    }));
    return newProject;
  };

  const updateProject = (id: string, updates: Partial<Project>) => {
    setState(prev => ({
      ...prev,
      projects: prev.projects.map(p => p.id === id ? { ...p, ...updates } : p),
    }));
  };

  const deleteProject = (id: string) => {
    setState(prev => ({
      ...prev,
      projects: prev.projects.filter(p => p.id !== id),
    }));
  };

  const getProject = (id: string) => (state.projects || []).find(p => p.id === id);

  // Project Code
  const addProjectCode = (projectId: string, code: Omit<ProjectCode, 'id' | 'createdAt'>): ProjectCode => {
    const newCode: ProjectCode = {
      ...code,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    updateProject(projectId, {
      code: [...(getProject(projectId)?.code || []), newCode],
    });
    return newCode;
  };

  const updateProjectCode = (projectId: string, codeId: string, updates: Partial<ProjectCode>) => {
    const project = getProject(projectId);
    if (project) {
      updateProject(projectId, {
        code: project.code.map(c => c.id === codeId ? { ...c, ...updates } : c),
      });
    }
  };

  const deleteProjectCode = (projectId: string, codeId: string) => {
    const project = getProject(projectId);
    if (project) {
      updateProject(projectId, {
        code: project.code.filter(c => c.id !== codeId),
      });
    }
  };

  const getProjectCode = (projectId: string, codeId: string) => {
    const project = getProject(projectId);
    return project?.code.find(c => c.id === codeId);
  };

  const getProjectCodes = (projectId: string) => {
    const project = getProject(projectId);
    return project?.code || [];
  };

  // Ingestion Jobs
  const createIngestionJob = (job: Omit<IngestionJob, 'id' | 'createdAt'>): IngestionJob => {
    const newJob: IngestionJob = {
      ...job,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    setState(prev => ({
      ...prev,
      ingestionJobs: [...prev.ingestionJobs, newJob],
    }));
    return newJob;
  };

  const updateIngestionJob = (id: string, updates: Partial<IngestionJob>) => {
    setState(prev => ({
      ...prev,
      ingestionJobs: prev.ingestionJobs.map(j => j.id === id ? { ...j, ...updates } : j),
    }));
  };

  const deleteIngestionJob = (id: string) => {
    setState(prev => ({
      ...prev,
      ingestionJobs: prev.ingestionJobs.filter(j => j.id !== id),
    }));
  };

  const getIngestionJob = (id: string) => (state.ingestionJobs || []).find(j => j.id === id);

  // Dataset Cloning and Lineage Functions
  const cloneDatasetAsResolved = (
    originalId: string, 
    resolutionSummary: string,
    resolvedIssuesCount: number,
    timestamp?: string
  ): IngestionJob | null => {
    const original = getIngestionJob(originalId);
    if (!original) return null;

    // Prevent duplicate resolved names by checking existing resolved datasets
    const existingResolved = (state.ingestionJobs || []).filter(j => 
      j.parentDatasetId === originalId && j.isResolved
    );
    
    // Generate resolved name with optional versioning
    let resolvedName = original.name.replace(/\.(csv|json|parquet)$/i, '_Resolved.$1');
    if (!resolvedName.includes('_Resolved')) {
      resolvedName = `${original.name}_Resolved`;
    }
    
    // Add timestamp suffix for scheduled runs to prevent collisions
    if (timestamp) {
      resolvedName = resolvedName.replace('_Resolved', `_Resolved_${timestamp}`);
    } else if (existingResolved.length > 0) {
      resolvedName = resolvedName.replace('_Resolved', `_Resolved_${existingResolved.length + 1}`);
    }

    const clonedDataset: IngestionJob = {
      ...original,
      id: generateId(),
      name: resolvedName,
      createdAt: new Date().toISOString(),
      // Lineage metadata
      parentDatasetId: originalId,
      isResolved: true,
      resolutionTimestamp: new Date().toISOString(),
      resolutionSummary,
      resolvedIssuesCount,
      // Update file metadata if exists
      uploadedFile: original.uploadedFile ? {
        ...original.uploadedFile,
        name: resolvedName,
      } : undefined,
    };

    setState(prev => ({
      ...prev,
      ingestionJobs: [...prev.ingestionJobs, clonedDataset],
    }));

    return clonedDataset;
  };

  const getResolvedDatasetsForParent = (parentId: string): IngestionJob[] => {
    return (state.ingestionJobs || []).filter(j => j.parentDatasetId === parentId && j.isResolved);
  };

  const getReportsForDataset = (datasetId: string): (GeneratedReport | DataQualityReport)[] => {
    const generatedReports = (state.generatedReports || []).filter(r => 
      r.datasetId === datasetId || 
      r.baselineDatasetIds?.includes(datasetId) ||
      r.resolvedDatasetIds?.includes(datasetId)
    );
    const dataQualityReports = (state.dataQualityReports || []).filter(r => 
      r.datasetId === datasetId ||
      r.baselineDatasetIds?.includes(datasetId) ||
      r.resolvedDatasetIds?.includes(datasetId)
    );
    return [...generatedReports, ...dataQualityReports];
  };

  const getConfigurationsForModel = (modelId: string): ReportConfiguration[] => {
    return (state.reportConfigurations || []).filter(c => c.modelId === modelId);
  };

  // Preparation Jobs
  const createPreparationJob = (job: Omit<PreparationJob, 'id' | 'createdAt'>): PreparationJob => {
    const newJob: PreparationJob = {
      ...job,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    setState(prev => ({
      ...prev,
      preparationJobs: [...prev.preparationJobs, newJob],
    }));
    return newJob;
  };

  const updatePreparationJob = (id: string, updates: Partial<PreparationJob>) => {
    setState(prev => ({
      ...prev,
      preparationJobs: prev.preparationJobs.map(j => j.id === id ? { ...j, ...updates } : j),
    }));
  };

  const deletePreparationJob = (id: string) => {
    setState(prev => ({
      ...prev,
      preparationJobs: prev.preparationJobs.filter(j => j.id !== id),
    }));
  };

  const getPreparationJob = (id: string) => (state.preparationJobs || []).find(j => j.id === id);

  // Registry Models
  const createRegistryModel = (model: Omit<RegistryModel, 'id' | 'createdAt'>): RegistryModel => {
    // Validate projectId - critical for data quality page
    if (!model.projectId) {
      console.error('[GlobalContext] ⚠️ Model created without projectId:', model.name);
      console.warn('[GlobalContext] Available projects:', (state.projects || []).map(p => ({ id: p.id, name: p.name })));
    } else {
      const projectExists = (state.projects || []).some(p => p.id === model.projectId);
      if (!projectExists) {
        console.warn(`[GlobalContext] ⚠️ Model projectId "${model.projectId}" does not match any project`, {
          modelName: model.name,
          availableProjectIds: (state.projects || []).map(p => p.id),
        });
      }
    }
    
    const newModel: RegistryModel = {
      ...model,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    
    console.log('[GlobalContext] Creating registry model:', {
      modelName: newModel.name,
      modelId: newModel.id,
      projectId: newModel.projectId,
      modelType: newModel.modelType,
    });
    
    setState(prev => ({
      ...prev,
      registryModels: [...prev.registryModels, newModel],
    }));
    return newModel;
  };

  const updateRegistryModel = (id: string, updates: Partial<RegistryModel>) => {
    setState(prev => ({
      ...prev,
      registryModels: prev.registryModels.map(m => m.id === id ? { ...m, ...updates } : m),
    }));
  };

  const deleteRegistryModel = (id: string) => {
    setState(prev => ({
      ...prev,
      registryModels: prev.registryModels.filter(m => m.id !== id),
    }));
  };

  const clearRegistryModels = () => {
    setState(prev => ({
      ...prev,
      registryModels: [],
    }));
  };

  const getRegistryModel = (id: string) => (state.registryModels || []).find(m => m.id === id);

  // Deployment Jobs
  const createDeploymentJob = (job: Omit<DeploymentJob, 'id' | 'createdAt'>): DeploymentJob => {
    const newJob: DeploymentJob = {
      ...job,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    setState(prev => ({
      ...prev,
      deploymentJobs: [...prev.deploymentJobs, newJob],
    }));
    return newJob;
  };

  const updateDeploymentJob = (id: string, updates: Partial<DeploymentJob>) => {
    setState(prev => ({
      ...prev,
      deploymentJobs: prev.deploymentJobs.map(j => j.id === id ? { ...j, ...updates } : j),
    }));
  };

  const deleteDeploymentJob = (id: string) => {
    setState(prev => ({
      ...prev,
      deploymentJobs: prev.deploymentJobs.filter(j => j.id !== id),
    }));
  };

  const getDeploymentJob = (id: string) => (state.deploymentJobs || []).find(j => j.id === id);

  // Inferencing Jobs
  const createInferencingJob = (job: Omit<InferencingJob, 'id' | 'createdAt'>): InferencingJob => {
    const newJob: InferencingJob = {
      ...job,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    setState(prev => ({
      ...prev,
      inferencingJobs: [...prev.inferencingJobs, newJob],
    }));
    return newJob;
  };

  const updateInferencingJob = (id: string, updates: Partial<InferencingJob>) => {
    setState(prev => ({
      ...prev,
      inferencingJobs: prev.inferencingJobs.map(j => j.id === id ? { ...j, ...updates } : j),
    }));
  };

  const deleteInferencingJob = (id: string) => {
    setState(prev => ({
      ...prev,
      inferencingJobs: prev.inferencingJobs.filter(j => j.id !== id),
    }));
  };

  const getInferencingJob = (id: string) => (state.inferencingJobs || []).find(j => j.id === id);

  // Monitoring Jobs
  const createMonitoringJob = (job: Omit<MonitoringJob, 'id' | 'createdAt'>): MonitoringJob => {
    const newJob: MonitoringJob = {
      ...job,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    setState(prev => ({
      ...prev,
      monitoringJobs: [...prev.monitoringJobs, newJob],
    }));
    return newJob;
  };

  const updateMonitoringJob = (id: string, updates: Partial<MonitoringJob>) => {
    setState(prev => ({
      ...prev,
      monitoringJobs: prev.monitoringJobs.map(j => j.id === id ? { ...j, ...updates } : j),
    }));
  };

  const deleteMonitoringJob = (id: string) => {
    setState(prev => ({
      ...prev,
      monitoringJobs: prev.monitoringJobs.filter(j => j.id !== id),
    }));
  };

  const getMonitoringJob = (id: string) => (state.monitoringJobs || []).find(j => j.id === id);

  // Pipeline Jobs
  const createPipelineJob = (job: Omit<PipelineJob, 'id' | 'createdAt'>): PipelineJob => {
    const newJob: PipelineJob = {
      ...job,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    setState(prev => ({
      ...prev,
      pipelineJobs: [...prev.pipelineJobs, newJob],
    }));
    return newJob;
  };

  const updatePipelineJob = (id: string, updates: Partial<PipelineJob>) => {
    setState(prev => ({
      ...prev,
      pipelineJobs: prev.pipelineJobs.map(j => j.id === id ? { ...j, ...updates } : j),
    }));
  };

  const deletePipelineJob = (id: string) => {
    setState(prev => ({
      ...prev,
      pipelineJobs: prev.pipelineJobs.filter(j => j.id !== id),
    }));
  };

  const getPipelineJob = (id: string) => (state.pipelineJobs || []).find(j => j.id === id);

  const getPipelinesByProject = (projectId: string) => (state.pipelineJobs || []).filter(j => j.projectId === projectId);

  // Report Configurations
  const createReportConfiguration = (config: Omit<ReportConfiguration, 'id' | 'createdAt' | 'createdBy'>): ReportConfiguration => {
    const newConfig: ReportConfiguration = {
      ...config,
      id: generateId(),
      createdAt: new Date().toISOString(),
      createdBy: 'Current User',
    };
    setState(prev => ({
      ...prev,
      reportConfigurations: [...prev.reportConfigurations, newConfig],
    }));
    return newConfig;
  };

  const updateReportConfiguration = (id: string, updates: Partial<ReportConfiguration>) => {
    setState(prev => ({
      ...prev,
      reportConfigurations: prev.reportConfigurations.map(c => c.id === id ? { ...c, ...updates } : c),
    }));
  };

  const deleteReportConfiguration = (id: string) => {
    setState(prev => ({
      ...prev,
      reportConfigurations: prev.reportConfigurations.filter(c => c.id !== id),
    }));
  };

  const getReportConfiguration = (id: string) => (state.reportConfigurations || []).find(c => c.id === id);

  // Generated Reports
  const createGeneratedReport = (report: Omit<GeneratedReport, 'id' | 'generatedAt' | 'generatedBy'>): GeneratedReport => {
    const newReport: GeneratedReport = {
      ...report,
      id: generateId(),
      generatedAt: new Date().toISOString(),
      generatedBy: 'Current User',
    };
    setState(prev => ({
      ...prev,
      generatedReports: [...prev.generatedReports, newReport],
    }));
    return newReport;
  };

  const deleteGeneratedReport = (id: string) => {
    setState(prev => ({
      ...prev,
      generatedReports: prev.generatedReports.filter(r => r.id !== id),
    }));
  };

  const getGeneratedReport = (id: string) => (state.generatedReports || []).find(r => r.id === id);

  // Data Quality Reports
  const createDataQualityReport = (report: Omit<DataQualityReport, 'id' | 'generatedAt'>): DataQualityReport => {
    const newReport: DataQualityReport = {
      ...report,
      id: generateId(),
      generatedAt: new Date().toISOString(),
    };
    setState(prev => ({
      ...prev,
      dataQualityReports: [...prev.dataQualityReports, newReport],
    }));
    return newReport;
  };

  const deleteDataQualityReport = (id: string) => {
    setState(prev => ({
      ...prev,
      dataQualityReports: prev.dataQualityReports.filter(r => r.id !== id),
    }));
  };

  const getDataQualityReport = (id: string) => (state.dataQualityReports || []).find(r => r.id === id);

  // Scheduling Jobs
  const createSchedulingJob = (job: Omit<SchedulingJob, 'id' | 'createdAt' | 'createdBy'>): SchedulingJob => {
    const newJob: SchedulingJob = {
      ...job,
      id: generateId(),
      createdAt: new Date().toISOString(),
      createdBy: 'Current User',
    };
    setState(prev => ({
      ...prev,
      schedulingJobs: [...prev.schedulingJobs, newJob],
    }));
    return newJob;
  };

  const updateSchedulingJob = (id: string, updates: Partial<SchedulingJob>) => {
    setState(prev => ({
      ...prev,
      schedulingJobs: prev.schedulingJobs.map(j => j.id === id ? { ...j, ...updates } : j),
    }));
  };

  const deleteSchedulingJob = (id: string) => {
    setState(prev => ({
      ...prev,
      schedulingJobs: prev.schedulingJobs.filter(j => j.id !== id),
    }));
  };

  const getSchedulingJob = (id: string) => (state.schedulingJobs || []).find(j => j.id === id);

  const runSchedulingJob = (id: string, action: 'run' | 'toggle' | 'delete' = 'run') => {
    const job = getSchedulingJob(id);
    if (!job) return;

    if (action === 'toggle') {
      updateSchedulingJob(id, { enabled: !job.enabled });
      return;
    }

    if (action === 'delete') {
      deleteSchedulingJob(id);
      return;
    }

    // Run action - update lastRun, increment runCount, calculate next run
    updateSchedulingJob(id, {
      lastRun: new Date().toISOString(),
      lastStatus: 'success',
      runCount: (job.runCount || 0) + 1,
      nextRun: calculateNextRun(job),
    });
  };

  const calculateNextRun = (job: SchedulingJob): string | undefined => {
    const now = new Date();
    let next = new Date(now);

    switch (job.scheduleType) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        if (job.scheduleTime) {
          const [hours, minutes] = job.scheduleTime.split(':');
          next.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        }
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        if (job.scheduleTime) {
          const [hours, minutes] = job.scheduleTime.split(':');
          next.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        }
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        if (job.dayOfMonth) {
          next.setDate(job.dayOfMonth);
        }
        if (job.scheduleTime) {
          const [hours, minutes] = job.scheduleTime.split(':');
          next.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        }
        break;
      case 'one-time':
        return undefined; // One-time jobs don't repeat
      default:
        return undefined;
    }

    return next.toISOString();
  };

  // Workflow Logs
  const createWorkflowLog = (log: Omit<WorkflowLog, 'id' | 'createdAt'>): WorkflowLog => {
    try {
      const newLog: WorkflowLog = {
        ...log,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };
      
      console.log('Creating workflow log:', newLog.summary);
      
      setState(prev => {
        const currentLogs = prev.workflowLogs || [];
        return {
          ...prev,
          workflowLogs: [...currentLogs, newLog],
        };
      });
      return newLog;
    } catch (error) {
      console.error('Error creating workflow log:', error);
      // Return a minimal log entry in case of error
      const fallbackLog: WorkflowLog = {
        id: generateId(),
        projectId: log.projectId || 'unknown',
        projectName: log.projectName || 'Unknown Project',
        workflowType: log.workflowType || 'model_monitoring',
        summary: log.summary || 'Workflow step completed',
        steps: [],
        scheduledJobs: [],
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };
      setState(prev => ({
        ...prev,
        workflowLogs: [...(prev.workflowLogs || []), fallbackLog],
      }));
      return fallbackLog;
    }
  };

  const deleteWorkflowLog = (id: string) => {
    setState(prev => ({
      ...prev,
      workflowLogs: (prev.workflowLogs || []).filter(log => log.id !== id),
    }));
  };

  const getWorkflowLog = (id: string) => (state.workflowLogs || []).find(log => log.id === id);

  const getWorkflowLogsByProject = (projectId: string) => 
    (state.workflowLogs || []).filter(log => log.projectId === projectId);

  // Workflow State
  const setCurrentWorkflow = (workflow: WorkflowState) => {
    setState(prev => ({
      ...prev,
      currentWorkflow: { ...prev.currentWorkflow, ...workflow },
    }));
  };

  // Utility Functions
  const loadSampleData = () => {
    console.log('🔄 loadSampleData called');
    const sampleData = initializeSampleData();
    console.log('✅ Sample data generated:', {
      projects: sampleData.projects.length,
      models: sampleData.registryModels.length,
      datasets: sampleData.ingestionJobs.length,
      deployments: sampleData.deploymentJobs.length,
      monitoring: sampleData.monitoringJobs.length,
      reports: sampleData.generatedReports.length,
      dataQuality: sampleData.dataQualityReports.length,
      scheduling: sampleData.schedulingJobs.length
    });
    setState(sampleData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleData));
    console.log('💾 Sample data saved to localStorage and state updated');
  };

  // Banking Metrics Functions
  const getBankingModelMetrics = (modelId: string, vintage?: string): BankingMetrics[] => {
    let filtered = state.bankingMetrics.filter(m => m.model_id === modelId);
    if (vintage) {
      filtered = filtered.filter(m => m.vintage === vintage);
    }
    return filtered;
  };

  const getBankingModelsByPortfolio = (portfolio: string): BankingModel[] => {
    return state.bankingModels.filter(m => m.portfolio === portfolio);
  };

  const getBankingModelsByType = (modelType: string): BankingModel[] => {
    return state.bankingModels.filter(m => m.model_type === modelType);
  };

  const getMetricsByRAGStatus = (ragStatus: 'green' | 'amber' | 'red'): BankingMetrics[] => {
    return state.bankingMetrics.filter(m => m.rag_status === ragStatus);
  };

  const refreshBankingData = () => {
    const { models: bankingModels, metrics: bankingMetrics } = generateCompleteBankingDataset();
    setState(prev => ({ ...prev, bankingModels, bankingMetrics }));
    console.log('🔄 Banking data refreshed:', { models: bankingModels.length, metrics: bankingMetrics.length });
  };

  // Sync RegistryModels to Dashboard Banking Data
  const syncRegistryModelsToDashboard = () => {
    if (state.registryModels.length === 0) {
      console.log('⚠️ No registry models to sync');
      return;
    }

    const synced = mergeRegistryModelsWithExisting(
      state.bankingModels,
      state.bankingMetrics,
      state.registryModels
    );

    setState(prev => ({
      ...prev,
      bankingModels: synced.bankingModels,
      bankingMetrics: synced.bankingMetrics,
    }));

    console.log('✓ Synced registry models to dashboard:', {
      totalModels: synced.bankingModels.length,
      registryModels: state.registryModels.length,
      totalMetrics: synced.bankingMetrics.length,
    });
  };

  const value: GlobalContextType = {
    projects: state.projects || [],
    createProject,
    updateProject,
    deleteProject,
    getProject,
    addProjectCode,
    updateProjectCode,
    deleteProjectCode,
    getProjectCode,
    getProjectCodes,
    ingestionJobs: state.ingestionJobs || [],
    createIngestionJob,
    addIngestionJob: createIngestionJob,
    updateIngestionJob,
    deleteIngestionJob,
    getIngestionJob,
    cloneDatasetAsResolved,
    getResolvedDatasetsForParent,
    getReportsForDataset,
    getConfigurationsForModel,
    preparationJobs: state.preparationJobs || [],
    createPreparationJob,
    updatePreparationJob,
    deletePreparationJob,
    getPreparationJob,
    registryModels: state.registryModels || [],
    createRegistryModel,
    updateRegistryModel,
    deleteRegistryModel,
    clearRegistryModels,
    getRegistryModel,
    deploymentJobs: state.deploymentJobs || [],
    createDeploymentJob,
    updateDeploymentJob,
    deleteDeploymentJob,
    getDeploymentJob,
    inferencingJobs: state.inferencingJobs || [],
    createInferencingJob,
    updateInferencingJob,
    deleteInferencingJob,
    getInferencingJob,
    monitoringJobs: state.monitoringJobs || [],
    createMonitoringJob,
    updateMonitoringJob,
    deleteMonitoringJob,
    getMonitoringJob,
    pipelineJobs: state.pipelineJobs || [],
    createPipelineJob,
    updatePipelineJob,
    deletePipelineJob,
    getPipelineJob,
    getPipelinesByProject,
    reportConfigurations: state.reportConfigurations || [],
    createReportConfiguration,
    updateReportConfiguration,
    deleteReportConfiguration,
    getReportConfiguration,
    generatedReports: state.generatedReports || [],
    createGeneratedReport,
    deleteGeneratedReport,
    getGeneratedReport,
    dataQualityReports: state.dataQualityReports || [],
    createDataQualityReport,
    deleteDataQualityReport,
    getDataQualityReport,
    schedulingJobs: state.schedulingJobs || [],
    createSchedulingJob,
    updateSchedulingJob,
    deleteSchedulingJob,
    getSchedulingJob,
    runSchedulingJob,
    workflowLogs: state.workflowLogs || [],
    createWorkflowLog,
    deleteWorkflowLog,
    getWorkflowLog,
    getWorkflowLogsByProject,
    currentWorkflow: state.currentWorkflow || {},
    setCurrentWorkflow,
    bankingModels: state.bankingModels || [],
    bankingMetrics: state.bankingMetrics || [],
    getBankingModelMetrics,
    getBankingModelsByPortfolio,
    getBankingModelsByType,
    getMetricsByRAGStatus,
    refreshBankingData,
    syncRegistryModelsToDashboard,
    loadSampleData,
  };

  return <GlobalContext.Provider value={value}>{children}</GlobalContext.Provider>;
};

export const useGlobal = () => {
  const context = useContext(GlobalContext);
  if (context === undefined) {
    throw new Error('useGlobal must be used within GlobalProvider');
  }
  return context;
};
