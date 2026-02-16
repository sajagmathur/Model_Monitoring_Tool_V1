/**
 * Workflow Logging Utility
 * Provides utilities for logging workflow steps and actions
 */

export const createStepLog = (
  stepName: string,
  status: 'completed' | 'skipped' | 'failed',
  details: string,
  timestamp: string = new Date().toISOString()
) => ({
  stepName,
  status,
  details,
  timestamp,
});

export const createScheduledJobLog = (
  jobName: string,
  reportTypes: string[],
  scheduleType: string,
  scheduleDetails: string
) => ({
  jobName,
  reportTypes,
  scheduleType,
  scheduleDetails,
});

/**
 * Create a complete workflow log entry for GlobalContext
 */
export const createWorkflowLogEntry = (
  projectId: string,
  projectName: string,
  stepName: string,
  details: string,
  workflowType: 'model_monitoring' | 'data_pipeline' | 'report_generation' = 'model_monitoring'
) => ({
  projectId,
  projectName,
  workflowType,
  summary: `${stepName}: ${details}`,
  steps: [{
    stepName,
    status: 'completed' as const,
    details,
    timestamp: new Date().toISOString(),
  }],
  scheduledJobs: [],
  completedAt: new Date().toISOString(),
});

/**
 * Create a creation event log entry for GlobalContext
 */
export const createCreationLogEntry = (
  projectId: string,
  projectName: string,
  actionName: string,
  details: string
) => ({
  projectId,
  projectName,
  workflowType: 'model_monitoring' as const,
  summary: `${actionName}: ${details}`,
  steps: [{
    stepName: actionName,
    status: 'completed' as const,
    details,
    timestamp: new Date().toISOString(),
  }],
  scheduledJobs: [],
  completedAt: new Date().toISOString(),
});

/**
 * Generate detailed step description for each workflow step
 */
export const getStepDescription = {
  modelImport: (modelName: string, modelVersion: string, modelType: string) => 
    `Model imported successfully: ${modelName} (Version: ${modelVersion}, Type: ${modelType})`,
  
  dataIngestion: (datasetCount: number, datasetNames: string[]) =>
    `${datasetCount} dataset(s) ingested and configured: ${datasetNames.join(', ')}`,
  
  dataQuality: (analysisCount: number, resolvedCount: number, datasetCount?: number) =>
    `Analyzed ${analysisCount} dataset(s), Resolved ${resolvedCount} data quality issue(s)${datasetCount ? `, Created ${datasetCount} resolved dataset(s)` : ''}`,
  
  reportConfiguration: (configCount: number, configNames: string[], metricsCount: number) =>
    `Created ${configCount} report configuration(s): ${configNames.join(', ')} with ${metricsCount} total metrics`,
  
  reportGeneration: (configCount: number, reportsReady: boolean) =>
    `Report generation prepared with ${configCount} configuration(s), Reports ready for generation: ${reportsReady ? 'Yes' : 'No'}`,
  
  scheduleReports: (jobCount: number, reportTypes: string[], scheduleFrequency: string) =>
    `Scheduled ${jobCount} report job(s) for ${reportTypes.join(', ')} to run ${scheduleFrequency}`,
};

/**
 * Generate detailed descriptions for creation events
 */
export const getCreationDescription = {
  dataset: (datasetName: string, datasetType: string, rows: number, columns: number, modelName: string) =>
    `Dataset "${datasetName}" created as ${datasetType} with ${rows} rows and ${columns} columns for model "${modelName}"`,
  
  model: (modelName: string, modelVersion: string, modelType: string, modelStage: string) =>
    `Model "${modelName}" (Version: ${modelVersion}, Type: ${modelType}, Stage: ${modelStage}) added to repository`,
  
  reportConfig: (configCount: number, configNames: string, metricsCount: number) =>
    `Created ${configCount} report configuration(s): ${configNames} with ${metricsCount} metrics`,
  
  generatedReport: (reportName: string, reportType: string, modelName: string) =>
    `${reportType} report "${reportName}" generated for model "${modelName}"`,
  
  schedulingJob: (jobName: string, reportTypes: string[], scheduleType: string) =>
    `Scheduling job "${jobName}" created for ${reportTypes.join(', ')} with ${scheduleType} schedule`,
};

/**
 * Activity log entry type
 */
export interface ActivityLog {
  type: 'workflow_step' | 'creation' | 'update' | 'deletion' | 'scheduling';
  action: string;
  description: string;
  timestamp: string;
  itemName?: string;
  itemType?: string;
  status?: 'success' | 'pending' | 'failed';
}

export const createActivityLog = (
  type: ActivityLog['type'],
  action: string,
  description: string,
  itemName?: string,
  itemType?: string,
  status: ActivityLog['status'] = 'success'
): ActivityLog => ({
  type,
  action,
  description,
  itemName,
  itemType,
  status,
  timestamp: new Date().toISOString(),
});
