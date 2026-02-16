import {
  RegistryModel,
  MonitoringJob,
  DeploymentJob,
  DataQualityReport,
  GeneratedReport,
  SchedulingJob,
} from '../contexts/GlobalContext';

/**
 * AI Insights Engine
 * Rule-based pattern analysis for generating intelligent insights and recommendations
 */

export interface Insight {
  id: string;
  category: 'performance' | 'quality' | 'drift' | 'operations' | 'anomaly';
  severity: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
  metric?: string;
  currentValue?: number;
  baselineValue?: number;
  change?: number; // percentage
  recommendation?: string;
  relatedModels?: string[];
  relatedDatasets?: string[];
  detectedAt: string;
  priority: number; // 1-10, 10 being highest
}

// Analyze model performance from reports and models
export function analyzeModelPerformance(
  models: RegistryModel[],
  reports: GeneratedReport[]
): Insight[] {
  const insights: Insight[] = [];
  const now = new Date().toISOString();

  // Group reports by model
  const reportsByModel: Record<string, GeneratedReport[]> = {};
  reports.forEach((report) => {
    if (!reportsByModel[report.modelId]) {
      reportsByModel[report.modelId] = [];
    }
    reportsByModel[report.modelId].push(report);
  });

  models.forEach((model) => {
    const modelReports = (reportsByModel[model.id] || []).sort(
      (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
    );

    if (modelReports.length >= 2) {
      // Compare latest two reports to detect trends
      const latest = modelReports[0];
      const previous = modelReports[1];
      
      if (latest.healthScore !== undefined && previous.healthScore !== undefined) {
        const change = latest.healthScore - previous.healthScore;
        const percentChange = (change / previous.healthScore) * 100;

        if (percentChange < -10) {
          insights.push({
            id: `perf-degrade-${model.id}`,
            category: 'performance',
            severity: percentChange < -20 ? 'critical' : 'warning',
            title: `${model.name}: Performance Degradation Detected`,
            description: `Health score decreased by ${Math.abs(percentChange).toFixed(1)}% from ${previous.healthScore.toFixed(1)}% to ${latest.healthScore.toFixed(1)}%`,
            metric: 'Health Score',
            currentValue: latest.healthScore,
            baselineValue: previous.healthScore,
            change: percentChange,
            recommendation: 'Consider retraining the model with recent data or investigating feature drift.',
            relatedModels: [model.name],
            detectedAt: now,
            priority: percentChange < -20 ? 10 : 7,
          });
        } else if (percentChange > 10) {
          insights.push({
            id: `perf-improve-${model.id}`,
            category: 'performance',
            severity: 'success',
            title: `${model.name}: Performance Improvement`,
            description: `Health score improved by ${percentChange.toFixed(1)}% from ${previous.healthScore.toFixed(1)}% to ${latest.healthScore.toFixed(1)}%`,
            metric: 'Health Score',
            currentValue: latest.healthScore,
            baselineValue: previous.healthScore,
            change: percentChange,
            recommendation: 'Document the changes that led to this improvement for future reference.',
            relatedModels: [model.name],
            detectedAt: now,
            priority: 3,
          });
        }
      }
    }

    // Analyze model metrics
    if (model.metrics) {
      const auc = model.metrics.auc || 0;
      const accuracy = model.metrics.accuracy || 0;

      if (auc > 0 && auc < 0.7) {
        insights.push({
          id: `perf-low-auc-${model.id}`,
          category: 'performance',
          severity: auc < 0.6 ? 'critical' : 'warning',
          title: `${model.name}: Low AUC Score`,
          description: `AUC score of ${auc.toFixed(3)} is below acceptable threshold`,
          metric: 'AUC',
          currentValue: auc,
          baselineValue: 0.85,
          change: ((auc - 0.85) / 0.85) * 100,
          recommendation: 'Review feature engineering and model architecture. Consider ensemble methods.',
          relatedModels: [model.name],
          detectedAt: now,
          priority: auc < 0.6 ? 9 : 6,
        });
      }

      if (accuracy > 0 && accuracy < 0.7) {
        insights.push({
          id: `perf-low-acc-${model.id}`,
          category: 'performance',
          severity: accuracy < 0.6 ? 'critical' : 'warning',
          title: `${model.name}: Low Accuracy`,
          description: `Accuracy of ${(accuracy * 100).toFixed(1)}% needs improvement`,
          metric: 'Accuracy',
          currentValue: accuracy,
          baselineValue: 0.85,
          change: ((accuracy - 0.85) / 0.85) * 100,
          recommendation: 'Investigate data quality issues and consider additional training data.',
          relatedModels: [model.name],
          detectedAt: now,
          priority: accuracy < 0.6 ? 9 : 6,
        });
      }
    }

    // Check model stage and status
    if (model.stage === 'production' && model.status === 'inactive') {
      insights.push({
        id: `perf-inactive-prod-${model.id}`,
        category: 'operations',
        severity: 'critical',
        title: `${model.name}: Inactive Production Model`,
        description: 'Production model is marked as inactive, affecting service availability',
        recommendation: 'Activate the model or deploy a backup model immediately.',
        relatedModels: [model.name],
        detectedAt: now,
        priority: 10,
      });
    }
  });

  return insights;
}

// Analyze data quality issues
export function analyzeDataQuality(
  qualityReports: DataQualityReport[]
): Insight[] {
  const insights: Insight[] = [];
  const now = new Date().toISOString();

  if (qualityReports.length === 0) {
    return insights;
  }

  // Aggregate issues by severity
  let totalHighSeverity = 0;
  let totalMediumSeverity = 0;
  let totalLowSeverity = 0;
  const issuesByVariable: Record<string, number> = {};
  const issuesByType: Record<string, number> = {};

  qualityReports.forEach((report) => {
    report.issues.forEach((issue) => {
      // Count by severity
      if (issue.severity === 'high') totalHighSeverity++;
      else if (issue.severity === 'medium') totalMediumSeverity++;
      else totalLowSeverity++;

      // Count by variable
      issuesByVariable[issue.variable] = (issuesByVariable[issue.variable] || 0) + 1;

      // Count by issue type
      const issueType = issue.issue.toLowerCase();
      if (issueType.includes('missing')) {
        issuesByType['missing'] = (issuesByType['missing'] || 0) + 1;
      } else if (issueType.includes('outlier')) {
        issuesByType['outliers'] = (issuesByType['outliers'] || 0) + 1;
      } else if (issueType.includes('schema')) {
        issuesByType['schema'] = (issuesByType['schema'] || 0) + 1;
      }
    });

    // Low quality score insight
    if (report.qualityScore < 60) {
      insights.push({
        id: `quality-low-${report.id}`,
        category: 'quality',
        severity: report.qualityScore < 50 ? 'critical' : 'warning',
        title: `${report.datasetName}: Poor Data Quality`,
        description: `Quality score of ${report.qualityScore.toFixed(1)}% with ${report.issues.length} issues detected`,
        metric: 'Quality Score',
        currentValue: report.qualityScore,
        baselineValue: 85,
        change: ((report.qualityScore - 85) / 85) * 100,
        recommendation: 'Review and resolve high-severity issues before using this dataset for training.',
        relatedDatasets: [report.datasetName],
        detectedAt: now,
        priority: report.qualityScore < 50 ? 9 : 6,
      });
    }
  });

  // Aggregate insight for high severity issues
  if (totalHighSeverity > 10) {
    insights.push({
      id: 'quality-high-severity-aggregate',
      category: 'quality',
      severity: 'critical',
      title: 'Multiple High-Severity Data Quality Issues',
      description: `${totalHighSeverity} high-severity issues detected across ${qualityReports.length} datasets`,
      recommendation: 'Prioritize resolution of high-severity issues to maintain model reliability.',
      detectedAt: now,
      priority: 10,
    });
  }

  // Find problematic variables
  const problematicVars = Object.entries(issuesByVariable)
    .filter(([_, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1]);

  if (problematicVars.length > 0) {
    const topVar = problematicVars[0];
    insights.push({
      id: 'quality-recurring-variable',
      category: 'quality',
      severity: 'warning',
      title: `Recurring Issues with Variable: ${topVar[0]}`,
      description: `Variable "${topVar[0]}" has ${topVar[1]} issues across multiple datasets`,
      recommendation: 'Investigate data collection or transformation logic for this variable.',
      detectedAt: now,
      priority: 7,
    });
  }

  // Missing data insight
  if (issuesByType['missing'] && issuesByType['missing'] > 5) {
    insights.push({
      id: 'quality-missing-data',
      category: 'quality',
      severity: 'warning',
      title: 'Widespread Missing Data Issues',
      description: `Missing data detected in ${issuesByType['missing']} instances`,
      recommendation: 'Consider imputation strategies or review data pipeline for collection gaps.',
      detectedAt: now,
      priority: 6,
    });
  }

  return insights;
}

// Analyze drift metrics
export function analyzeDrift(
  monitoringJobs: MonitoringJob[],
  reports: GeneratedReport[]
): Insight[] {
  const insights: Insight[] = [];
  const now = new Date().toISOString();

  monitoringJobs.forEach((job) => {
    const dataDrift = job.metrics?.dataDrift || job.monitoringMetrics?.dataDrift || 0;
    const modelDrift = job.metrics?.modelDrift || job.monitoringMetrics?.modelDrift || 0;
    const performanceDegradation = job.metrics?.performanceDegradation || 
                                    job.monitoringMetrics?.performanceDegradation || 0;

    // Critical data drift
    if (dataDrift > 0.15) {
      insights.push({
        id: `drift-data-critical-${job.id}`,
        category: 'drift',
        severity: dataDrift > 0.25 ? 'critical' : 'warning',
        title: `${job.name}: High Data Drift Detected`,
        description: `Data drift of ${(dataDrift * 100).toFixed(1)}% exceeds acceptable threshold`,
        metric: 'Data Drift',
        currentValue: dataDrift,
        baselineValue: 0.05,
        change: ((dataDrift - 0.05) / 0.05) * 100,
        recommendation: 'Retrain model with recent data or recalibrate feature distributions.',
        relatedModels: [job.name],
        detectedAt: now,
        priority: dataDrift > 0.25 ? 10 : 8,
      });
    }

    // Model drift
    if (modelDrift > 0.15) {
      insights.push({
        id: `drift-model-critical-${job.id}`,
        category: 'drift',
        severity: modelDrift > 0.25 ? 'critical' : 'warning',
        title: `${job.name}: Model Drift Detected`,
        description: `Model predictions drifting ${(modelDrift * 100).toFixed(1)}% from baseline`,
        metric: 'Model Drift',
        currentValue: modelDrift,
        baselineValue: 0.05,
        change: ((modelDrift - 0.05) / 0.05) * 100,
        recommendation: 'Review prediction patterns and consider model retraining.',
        relatedModels: [job.name],
        detectedAt: now,
        priority: modelDrift > 0.25 ? 10 : 8,
      });
    }

    // Performance degradation
    if (performanceDegradation > 0.10) {
      insights.push({
        id: `drift-perf-degrade-${job.id}`,
        category: 'drift',
        severity: performanceDegradation > 0.20 ? 'critical' : 'warning',
        title: `${job.name}: Performance Degradation`,
        description: `Model performance degraded by ${(performanceDegradation * 100).toFixed(1)}%`,
        metric: 'Performance Degradation',
        currentValue: performanceDegradation,
        baselineValue: 0,
        change: performanceDegradation * 100,
        recommendation: 'Immediate retraining recommended to restore performance levels.',
        relatedModels: [job.name],
        detectedAt: now,
        priority: performanceDegradation > 0.20 ? 10 : 7,
      });
    }
  });

  return insights;
}

// Analyze operational health
export function analyzeOperational(
  deploymentJobs: DeploymentJob[],
  schedulingJobs: SchedulingJob[]
): Insight[] {
  const insights: Insight[] = [];
  const now = new Date().toISOString();

  // Deployment analysis
  const totalDeployments = deploymentJobs.length;
  const failedDeployments = deploymentJobs.filter((job) => job.status === 'failed');
  const activeDeployments = deploymentJobs.filter((job) => job.status === 'active');
  
  const failureRate = totalDeployments > 0 
    ? (failedDeployments.length / totalDeployments) * 100 
    : 0;

  if (failureRate > 20) {
    insights.push({
      id: 'ops-high-failure-rate',
      category: 'operations',
      severity: failureRate > 40 ? 'critical' : 'warning',
      title: 'High Deployment Failure Rate',
      description: `${failureRate.toFixed(1)}% of deployments are failing (${failedDeployments.length}/${totalDeployments})`,
      metric: 'Deployment Failure Rate',
      currentValue: failureRate,
      baselineValue: 5,
      change: ((failureRate - 5) / 5) * 100,
      recommendation: 'Review deployment configurations, container images, and infrastructure logs.',
      detectedAt: now,
      priority: failureRate > 40 ? 10 : 7,
    });
  }

  // Individual failed deployments
  failedDeployments.forEach((job) => {
    insights.push({
      id: `ops-deploy-fail-${job.id}`,
      category: 'operations',
      severity: job.environment === 'prod' ? 'critical' : 'warning',
      title: `Deployment Failed: ${job.name}`,
      description: `Failed deployment in ${job.environment} environment`,
      recommendation: 'Check deployment logs for errors and verify container image availability.',
      detectedAt: now,
      priority: job.environment === 'prod' ? 9 : 5,
    });
  });

  // Scheduling analysis
  const failedSchedules = schedulingJobs.filter((job) => job.lastStatus === 'failed');
  if (failedSchedules.length > 0) {
    insights.push({
      id: 'ops-schedule-failures',
      category: 'operations',
      severity: failedSchedules.length > 3 ? 'warning' : 'info',
      title: 'Scheduled Job Failures',
      description: `${failedSchedules.length} scheduled job(s) failed in recent executions`,
      recommendation: 'Review job configurations and ensure required resources are available.',
      detectedAt: now,
      priority: failedSchedules.length > 3 ? 6 : 4,
    });
  }

  return insights;
}

// Detect anomalies using statistical rules
export function detectAnomalies(
  models: RegistryModel[],
  reports: GeneratedReport[],
  monitoringJobs: MonitoringJob[]
): Insight[] {
  const insights: Insight[] = [];
  const now = new Date().toISOString();

  // Calculate baseline statistics for drift
  const driftValues = monitoringJobs
    .map((job) => job.metrics?.dataDrift || job.monitoringMetrics?.dataDrift || 0)
    .filter((v) => v > 0);

  if (driftValues.length >= 3) {
    const mean = driftValues.reduce((sum, v) => sum + v, 0) / driftValues.length;
    const variance = driftValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / driftValues.length;
    const stdDev = Math.sqrt(variance);

    // Find outliers (> 2 standard deviations)
    monitoringJobs.forEach((job) => {
      const drift = job.metrics?.dataDrift || job.monitoringMetrics?.dataDrift || 0;
      if (drift > mean + 2 * stdDev) {
        insights.push({
          id: `anomaly-drift-${job.id}`,
          category: 'anomaly',
          severity: 'warning',
          title: `Anomalous Drift Pattern: ${job.name}`,
          description: `Drift value ${(drift * 100).toFixed(1)}% is significantly higher than normal (avg: ${(mean * 100).toFixed(1)}%)`,
          metric: 'Data Drift',
          currentValue: drift,
          baselineValue: mean,
          change: ((drift - mean) / mean) * 100,
          recommendation: 'Investigate sudden data distribution changes or data pipeline issues.',
          relatedModels: [job.name],
          detectedAt: now,
          priority: 7,
        });
      }
    });
  }

  return insights;
}

// Calculate overall system health score
export function calculateHealthScore(
  models: RegistryModel[],
  reports: GeneratedReport[],
  monitoringJobs: MonitoringJob[],
  qualityReports: DataQualityReport[]
): number {
  let score = 100;

  // Performance score (30%)
  const avgModelMetrics = models
    .filter((m) => m.metrics && m.status === 'active')
    .reduce((sum, m) => {
      const auc = m.metrics?.auc || 0;
      const accuracy = m.metrics?.accuracy || 0;
      return sum + (auc > 0 ? auc : accuracy);
    }, 0) / (models.filter((m) => m.status === 'active').length || 1);
  
  const perfScore = avgModelMetrics * 100;
  score -= (85 - perfScore) * 0.3;

  // Quality score (25%)
  const avgQualityScore = qualityReports.length > 0
    ? qualityReports.reduce((sum, r) => sum + r.qualityScore, 0) / qualityReports.length
    : 85;
  score -= (85 - avgQualityScore) * 0.25;

  // Drift score (20%)
  const avgDrift = monitoringJobs.length > 0
    ? monitoringJobs.reduce((sum, job) => {
        const drift = job.metrics?.dataDrift || job.monitoringMetrics?.dataDrift || 0;
        return sum + drift;
      }, 0) / monitoringJobs.length
    : 0;
  score -= avgDrift * 100 * 0.2;

  // Operational score (15%)
  // Health score based on report health scores
  const avgReportHealth = reports.filter((r) => r.healthScore).length > 0
    ? reports.filter((r) => r.healthScore).reduce((sum, r) => sum + (r.healthScore || 0), 0) / 
      reports.filter((r) => r.healthScore).length
    : 85;
  score -= (85 - avgReportHealth) * 0.15;

  // Ensure score is between 0 and 100
  return Math.max(0, Math.min(100, score));
}

// Prioritize and sort insights
export function prioritizeRecommendations(insights: Insight[]): Insight[] {
  return insights
    .sort((a, b) => {
      // Sort by priority (descending), then by severity
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      const severityOrder = { critical: 0, warning: 1, info: 2, success: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    })
    .slice(0, 20); // Limit to top 20 insights
}

// Generate all insights
export function generateAllInsights(
  models: RegistryModel[],
  reports: GeneratedReport[],
  monitoringJobs: MonitoringJob[],
  deploymentJobs: DeploymentJob[],
  qualityReports: DataQualityReport[],
  schedulingJobs: SchedulingJob[]
): {
  insights: Insight[];
  healthScore: number;
  summary: {
    critical: number;
    warning: number;
    info: number;
    success: number;
  };
} {
  const allInsights: Insight[] = [
    ...analyzeModelPerformance(models, reports),
    ...analyzeDataQuality(qualityReports),
    ...analyzeDrift(monitoringJobs, reports),
    ...analyzeOperational(deploymentJobs, schedulingJobs),
    ...detectAnomalies(models, reports, monitoringJobs),
  ];

  const prioritizedInsights = prioritizeRecommendations(allInsights);
  const healthScore = calculateHealthScore(models, reports, monitoringJobs, qualityReports);

  const summary = {
    critical: prioritizedInsights.filter((i) => i.severity === 'critical').length,
    warning: prioritizedInsights.filter((i) => i.severity === 'warning').length,
    info: prioritizedInsights.filter((i) => i.severity === 'info').length,
    success: prioritizedInsights.filter((i) => i.severity === 'success').length,
  };

  return {
    insights: prioritizedInsights,
    healthScore,
    summary,
  };
}
