import {
  GeneratedReport,
  RegistryModel,
  MonitoringJob,
  DeploymentJob,
  DataQualityReport,
  IngestionJob,
} from '../contexts/GlobalContext';

/**
 * Chart Data Transformers
 * Utilities for transforming GlobalContext data into recharts-compatible format
 */

// Transform generated reports to time series data for performance charts
export function transformReportsToTimeSeries(reports: GeneratedReport[]) {
  const sortedReports = [...reports].sort(
    (a, b) => new Date(a.generatedAt).getTime() - new Date(b.generatedAt).getTime()
  );

  return sortedReports.map((report) => ({
    date: new Date(report.generatedAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    fullDate: report.generatedAt,
    healthScore: report.healthScore || 0,
    modelName: report.modelName,
    reportId: report.id,
    type: report.type,
  }));
}

// Calculate aggregated model health metrics
export function aggregateModelHealth(
  models: RegistryModel[],
  monitoringJobs: MonitoringJob[],
  deploymentJobs: DeploymentJob[]
) {
  const totalModels = models.length;
  const modelsInProduction = models.filter((m) => m.stage === 'production').length;
  const productionPercentage = totalModels > 0 ? (modelsInProduction / totalModels) * 100 : 0;

  // Calculate average drift across all monitoring jobs
  const driftScores = monitoringJobs
    .map((job) => job.metrics?.dataDrift || job.monitoringMetrics?.dataDrift || 0)
    .filter((score) => score > 0);
  const avgDrift = driftScores.length > 0 
    ? driftScores.reduce((sum, score) => sum + score, 0) / driftScores.length 
    : 0;

  // Count active alerts (high drift or failed deployments)
  const highDriftCount = monitoringJobs.filter(
    (job) => (job.metrics?.dataDrift || 0) > 15 || (job.metrics?.modelDrift || 0) > 15
  ).length;
  const failedDeployments = deploymentJobs.filter((job) => job.status === 'failed').length;
  const alertCount = highDriftCount + failedDeployments;

  return {
    totalModels,
    modelsInProduction,
    productionPercentage: Math.round(productionPercentage),
    avgDrift: Math.round(avgDrift * 100) / 100,
    alertCount,
    criticalAlerts: highDriftCount,
    warningAlerts: failedDeployments,
  };
}

// Transform data quality reports into heatmap format
export function transformDataQualityToHeatmap(
  qualityReports: DataQualityReport[],
  ingestionJobs: IngestionJob[]
) {
  const heatmapData: Array<{
    datasetName: string;
    datasetId: string;
    qualityScore: number;
    missingRate: number;
    issueCount: number;
    severity: 'high' | 'medium' | 'low';
  }> = [];

  qualityReports.forEach((report) => {
    const dataset = ingestionJobs.find((job) => job.id === report.datasetId);
    const highSeverityIssues = report.issues.filter((i) => i.severity === 'high').length;
    const mediumSeverityIssues = report.issues.filter((i) => i.severity === 'medium').length;
    
    let severity: 'high' | 'medium' | 'low' = 'low';
    if (highSeverityIssues > 0 || report.qualityScore < 60) {
      severity = 'high';
    } else if (mediumSeverityIssues > 0 || report.qualityScore < 80) {
      severity = 'medium';
    }

    heatmapData.push({
      datasetName: report.datasetName || dataset?.name || 'Unknown',
      datasetId: report.datasetId,
      qualityScore: report.qualityScore,
      missingRate: calculateMissingRate(report),
      issueCount: report.issues.length,
      severity,
    });
  });

  return heatmapData;
}

// Helper to calculate missing rate from quality report
function calculateMissingRate(report: DataQualityReport): number {
  const missingIssues = report.issues.filter((issue) =>
    issue.issue.toLowerCase().includes('missing')
  );
  // Estimate: each missing issue affects ~5% of data on average
  return Math.min(missingIssues.length * 5, 100);
}

// Transform monitoring jobs into drift distribution data
export function transformDriftToBoxPlot(monitoringJobs: MonitoringJob[]) {
  const driftByModel: Record<
    string,
    { modelId: string; modelName: string; driftScores: number[] }
  > = {};

  monitoringJobs.forEach((job) => {
    const dataDrift = job.metrics?.dataDrift || job.monitoringMetrics?.dataDrift || 0;
    const modelDrift = job.metrics?.modelDrift || job.monitoringMetrics?.modelDrift || 0;
    
    if (!driftByModel[job.modelId]) {
      driftByModel[job.modelId] = {
        modelId: job.modelId,
        modelName: job.name,
        driftScores: [],
      };
    }
    
    if (dataDrift > 0) driftByModel[job.modelId].driftScores.push(dataDrift);
    if (modelDrift > 0) driftByModel[job.modelId].driftScores.push(modelDrift);
  });

  return Object.values(driftByModel).map((item) => {
    const scores = item.driftScores.sort((a, b) => a - b);
    const len = scores.length;
    
    if (len === 0) {
      return {
        modelName: item.modelName,
        modelId: item.modelId,
        min: 0,
        q1: 0,
        median: 0,
        q3: 0,
        max: 0,
        avg: 0,
      };
    }

    const min = scores[0];
    const max = scores[len - 1];
    const median = len % 2 === 0 
      ? (scores[len / 2 - 1] + scores[len / 2]) / 2 
      : scores[Math.floor(len / 2)];
    const q1 = scores[Math.floor(len * 0.25)];
    const q3 = scores[Math.floor(len * 0.75)];
    const avg = scores.reduce((sum, s) => sum + s, 0) / len;

    return {
      modelName: item.modelName,
      modelId: item.modelId,
      min: Math.round(min * 100) / 100,
      q1: Math.round(q1 * 100) / 100,
      median: Math.round(median * 100) / 100,
      q3: Math.round(q3 * 100) / 100,
      max: Math.round(max * 100) / 100,
      avg: Math.round(avg * 100) / 100,
    };
  });
}

// Calculate KPI metrics from all data sources
export interface KPIMetric {
  name: string;
  value: string | number;
  unit: string;
  baseline: string | number;
  delta: number;
  status: 'good' | 'warning' | 'critical';
  category: 'performance' | 'stability' | 'features' | 'fairness' | 'business';
}

export function calculateKPIMetrics(
  models: RegistryModel[],
  reports: GeneratedReport[],
  monitoringJobs: MonitoringJob[],
  qualityReports: DataQualityReport[]
): KPIMetric[] {
  const metrics: KPIMetric[] = [];

  // Performance Metrics from Registry Models
  const latestModels = models.filter((m) => m.status === 'active');
  if (latestModels.length > 0) {
    const avgMetrics = calculateAverageModelMetrics(latestModels);
    
    if (avgMetrics.auc > 0) {
      metrics.push({
        name: 'AUC Score',
        value: avgMetrics.auc,
        unit: '',
        baseline: 0.85,
        delta: ((avgMetrics.auc - 0.85) / 0.85) * 100,
        status: avgMetrics.auc >= 0.85 ? 'good' : avgMetrics.auc >= 0.75 ? 'warning' : 'critical',
        category: 'performance',
      });
    }
    
    if (avgMetrics.gini > 0) {
      metrics.push({
        name: 'Gini Coefficient',
        value: avgMetrics.gini,
        unit: '',
        baseline: 0.70,
        delta: ((avgMetrics.gini - 0.70) / 0.70) * 100,
        status: avgMetrics.gini >= 0.70 ? 'good' : avgMetrics.gini >= 0.60 ? 'warning' : 'critical',
        category: 'performance',
      });
    }
    
    if (avgMetrics.accuracy > 0) {
      metrics.push({
        name: 'Accuracy',
        value: avgMetrics.accuracy,
        unit: '',
        baseline: 0.85,
        delta: ((avgMetrics.accuracy - 0.85) / 0.85) * 100,
        status: avgMetrics.accuracy >= 0.85 ? 'good' : avgMetrics.accuracy >= 0.75 ? 'warning' : 'critical',
        category: 'performance',
      });
    }
  }

  // Stability Metrics from Monitoring Jobs
  const driftScores = monitoringJobs.map((job) => ({
    dataDrift: job.metrics?.dataDrift || job.monitoringMetrics?.dataDrift || 0,
    modelDrift: job.metrics?.modelDrift || job.monitoringMetrics?.modelDrift || 0,
  }));

  if (driftScores.length > 0) {
    const avgDataDrift = driftScores.reduce((sum, s) => sum + s.dataDrift, 0) / driftScores.length;
    const avgModelDrift = driftScores.reduce((sum, s) => sum + s.modelDrift, 0) / driftScores.length;

    metrics.push({
      name: 'Population Stability Index',
      value: avgDataDrift.toFixed(3),
      unit: '',
      baseline: 0.025,
      delta: ((avgDataDrift - 0.025) / 0.025) * 100,
      status: avgDataDrift <= 0.05 ? 'good' : avgDataDrift <= 0.15 ? 'warning' : 'critical',
      category: 'stability',
    });

    metrics.push({
      name: 'Model Drift Score',
      value: avgModelDrift.toFixed(3),
      unit: '',
      baseline: 0.020,
      delta: ((avgModelDrift - 0.020) / 0.020) * 100,
      status: avgModelDrift <= 0.05 ? 'good' : avgModelDrift <= 0.15 ? 'warning' : 'critical',
      category: 'stability',
    });
  }

  // Feature Quality from Data Quality Reports
  if (qualityReports.length > 0) {
    const avgQualityScore = qualityReports.reduce((sum, r) => sum + r.qualityScore, 0) / qualityReports.length;
    const avgMissingRate = qualityReports.reduce((sum, r) => sum + calculateMissingRate(r), 0) / qualityReports.length;
    const totalIssues = qualityReports.reduce((sum, r) => sum + r.issues.length, 0);

    metrics.push({
      name: 'Data Quality Score',
      value: avgQualityScore.toFixed(1),
      unit: '%',
      baseline: 85,
      delta: ((avgQualityScore - 85) / 85) * 100,
      status: avgQualityScore >= 85 ? 'good' : avgQualityScore >= 70 ? 'warning' : 'critical',
      category: 'features',
    });

    metrics.push({
      name: 'Missing Data Rate',
      value: avgMissingRate.toFixed(1),
      unit: '%',
      baseline: 2.0,
      delta: ((avgMissingRate - 2.0) / 2.0) * 100,
      status: avgMissingRate <= 2.0 ? 'good' : avgMissingRate <= 5.0 ? 'warning' : 'critical',
      category: 'features',
    });

    metrics.push({
      name: 'Total Data Issues',
      value: totalIssues,
      unit: '',
      baseline: 10,
      delta: ((totalIssues - 10) / 10) * 100,
      status: totalIssues <= 10 ? 'good' : totalIssues <= 25 ? 'warning' : 'critical',
      category: 'features',
    });
  }

  // Business Impact from Reports Health Scores
  if (reports.length > 0) {
    const avgHealthScore = reports
      .filter((r) => r.healthScore !== undefined)
      .reduce((sum, r) => sum + (r.healthScore || 0), 0) / reports.filter((r) => r.healthScore).length || 0;

    metrics.push({
      name: 'Model Health Score',
      value: avgHealthScore.toFixed(1),
      unit: '%',
      baseline: 80,
      delta: ((avgHealthScore - 80) / 80) * 100,
      status: avgHealthScore >= 80 ? 'good' : avgHealthScore >= 60 ? 'warning' : 'critical',
      category: 'business',
    });
  }

  return metrics;
}

// Helper to calculate average metrics across models
function calculateAverageModelMetrics(models: RegistryModel[]) {
  const metricsArray = models.map((m) => m.metrics || {});
  const keys = ['auc', 'gini', 'accuracy', 'precision', 'recall', 'f1'];
  
  const averages: Record<string, number> = {};
  keys.forEach((key) => {
    const values = metricsArray.map((m) => m[key] || 0).filter((v) => v > 0);
    averages[key] = values.length > 0 
      ? values.reduce((sum, v) => sum + v, 0) / values.length 
      : 0;
  });

  return {
    auc: Math.round(averages.auc * 1000) / 1000,
    gini: Math.round(averages.gini * 1000) / 1000,
    accuracy: Math.round(averages.accuracy * 1000) / 1000,
    precision: Math.round(averages.precision * 1000) / 1000,
    recall: Math.round(averages.recall * 1000) / 1000,
    f1: Math.round(averages.f1 * 1000) / 1000,
  };
}

// Transform deployment jobs into status board data
export function transformDeploymentStatus(
  deploymentJobs: DeploymentJob[],
  models: RegistryModel[]
) {
  return deploymentJobs.map((job) => {
    const model = models.find((m) => m.id === job.modelId);
    return {
      deploymentId: job.id,
      modelName: model?.name || 'Unknown Model',
      modelVersion: model?.version || 'N/A',
      modelId: job.modelId,
      environment: job.environment,
      status: job.status,
      lastDeployed: job.lastDeployed || job.createdAt,
      containerName: job.containerName || 'N/A',
    };
  });
}
