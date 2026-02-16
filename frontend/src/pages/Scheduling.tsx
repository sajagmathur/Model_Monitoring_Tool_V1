import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useGlobal } from '../contexts/GlobalContext';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  Play,
  Pause,
  Trash2,
  Plus,
  CheckCircle,
  XCircle,
  Activity,
  RefreshCw,
  Zap,
  FileBarChart,
  AlertCircle,
} from 'lucide-react';

const Scheduling: React.FC = () => {
  const { theme } = useTheme();
  const { schedulingJobs, runSchedulingJob, createGeneratedReport, createDataQualityReport, reportConfigurations, ingestionJobs, cloneDatasetAsResolved } = useGlobal();
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  const [runningJobs, setRunningJobs] = useState<Set<string>>(new Set());

  const getStatusColor = (enabled: boolean) => {
    if (enabled) {
      return isDark
        ? 'bg-green-500/20 text-green-400 border-green-500/50'
        : 'bg-green-100 text-green-700 border-green-300';
    }
    return isDark
      ? 'bg-slate-500/20 text-slate-400 border-slate-500/50'
      : 'bg-slate-100 text-slate-700 border-slate-300';
  };

  const getLastStatusIcon = (status?: 'success' | 'failed' | 'running') => {
    switch (status) {
      case 'success':
        return <CheckCircle className="text-green-500" size={16} />;
      case 'failed':
        return <XCircle className="text-red-500" size={16} />;
      case 'running':
        return <RefreshCw className="text-blue-500 animate-spin" size={16} />;
      default:
        return <Activity className={isDark ? 'text-slate-500' : 'text-slate-400'} size={16} />;
    }
  };

  const handleToggleStatus = (id: string) => {
    runSchedulingJob(id, 'toggle');
  };

  const handleRunNow = async (id: string) => {
    const job = schedulingJobs.find(j => j.id === id);
    if (!job) return;

    setRunningJobs(prev => new Set(prev).add(id));
    
    // Simulate job execution
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get configuration
    const config = reportConfigurations.find(c => c.id === job.configurationId);
    
    // Special handling for Data Quality scheduled jobs
    if (config?.type === 'data_quality' || job.type === 'data_quality') {
      const timestamp = new Date().toISOString().split('T')[0];
      
      // Get baseline dataset
      const baselineDataset = ingestionJobs.find(j => j.id === config?.baselineDatasetId);
      
      if (baselineDataset) {
        // Create timestamped resolved dataset
        const resolvedDataset = cloneDatasetAsResolved(
          baselineDataset.id,
          `Scheduled quality check on ${timestamp}`,
          0, // Will be updated after actual checks
          timestamp
        );
        
        if (resolvedDataset) {
          // Generate mock quality metrics
          const qualityScore = Math.floor(Math.random() * 20) + 75;
          
          const pdfData = {
            reportName: `${job.name} - ${timestamp}`,
            generatedAt: new Date().toISOString(),
            datasets: [{
              name: resolvedDataset.name,
              totalRecords: baselineDataset.outputShape?.rows || 1000,
              recordsAfterExclusion: Math.floor((baselineDataset.outputShape?.rows || 1000) * 0.95),
              exclusionRate: 5,
              qualityScore: qualityScore,
              issues: [],
            }],
          };
          
          const reportArtifact = {
            pdfContent: JSON.stringify(pdfData),
            metadata: {
              generatedAt: pdfData.generatedAt,
              timestamp: timestamp,
            },
          };
          
          // Create Data Quality Report
          createDataQualityReport({
            name: `${job.name} - ${timestamp}`,
            datasetId: resolvedDataset.id,
            datasetName: resolvedDataset.name,
            modelId: config?.modelId,
            qualityScore: qualityScore,
            totalRecords: baselineDataset.outputShape?.rows || 1000,
            recordsAfterExclusion: Math.floor((baselineDataset.outputShape?.rows || 1000) * 0.95),
            issues: [],
            reportArtifact,
            baselineDatasetIds: [baselineDataset.id],
            resolvedDatasetIds: [resolvedDataset.id],
            immutable: true,
          });
          
          // Also add to generated reports
          createGeneratedReport({
            name: `${job.name} - ${timestamp}`,
            type: 'data_quality',
            modelId: config?.modelId || '',
            modelName: job.modelName,
            datasetId: resolvedDataset.id,
            datasetName: resolvedDataset.name,
            configurationId: job.configurationId,
            status: 'final',
            fileSize: '2.1 MB',
            tags: ['automated', 'data_quality', 'scheduled', timestamp],
            healthScore: qualityScore,
            reportArtifact,
            baselineDatasetIds: [baselineDataset.id],
            resolvedDatasetIds: [resolvedDataset.id],
            immutable: true,
          });
        }
      }
      
      runSchedulingJob(id, 'run');
      
      setRunningJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      
      alert(`Data Quality job "${job.name}" executed successfully!\nNew resolved dataset created: ${timestamp}\nReport saved to Reports section.`);
      return;
    }
    
    // Standard report generation for other types
    const reportTypes = [
      'stability',
      'performance',
      'explainability',
      'feature_analytics',
      'segmented_analysis',
      'drift_analysis',
    ];
    
    // Check if this is a combined job with multiple report types
    if (job.reportTypes && job.reportTypes.length > 0) {
      // Generate all reports in the combined job
      const timestamp = new Date().toLocaleDateString();
      let generatedCount = 0;
      
      for (const reportType of job.reportTypes) {
        const report = {
          name: `${job.name} - ${getReportTypeLabel(reportType)} - ${timestamp}`,
          type: reportType as any,
          modelId: job.modelId || 'unknown',
          modelName: job.modelName,
          configurationId: job.configurationId,
          status: 'final' as const,
          fileSize: '2.4 MB',
          tags: ['automated', reportType, 'combined-job'],
          healthScore: Math.floor(Math.random() * 30) + 70,
        };
        
        createGeneratedReport(report);
        generatedCount++;
      }
      
      runSchedulingJob(id, 'run');
      
      setRunningJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      
      alert(`Job "${job.name}" executed successfully!\n${generatedCount} reports generated and saved to Reports section.`);
      return;
    }
    
    // Single report type job
    const reportType = job.reportType || reportTypes[Math.floor(Math.random() * reportTypes.length)];
    
    const report = {
      name: `${job.name} - ${new Date().toLocaleDateString()}`,
      type: reportType as any,
      modelId: job.modelId || 'unknown',
      modelName: job.modelName,
      configurationId: job.configurationId,
      status: 'final' as const,
      fileSize: '2.4 MB',
      tags: ['automated', reportType],
      healthScore: Math.floor(Math.random() * 30) + 70,
    };
    
    createGeneratedReport(report);
    runSchedulingJob(id, 'run');
    
    setRunningJobs(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    
    alert(`Job "${job.name}" executed successfully! Report has been generated and saved to Reports section.`);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete the scheduled job "${name}"?`)) {
      runSchedulingJob(id, 'delete');
    }
  };

  const generateMockMetrics = (reportType: string) => {
    switch (reportType) {
      case 'performance':
        return { auc: 0.78, ks: 0.35, gini: 0.56, accuracy: 0.85, precision: 0.82, recall: 0.79 };
      case 'stability':
        return { psi: 0.18, csi: 0.22, volumeShift: -2.5, eventRate: 5.2 };
      case 'drift_analysis':
        return { psi: 0.18, csi: 0.22, featureDrift: 0.15, distributionShift: 0.12 };
      case 'explainability':
        return {
          topFeatures: ['income', 'bureau_score', 'employment_type', 'age', 'loan_amount'],
          featureContributions: [0.25, 0.22, 0.18, 0.15, 0.12],
        };
      case 'feature_analytics':
        return { featuresAnalyzed: 25, driftingFeatures: 3, missingValuesIssues: 2 };
      case 'segmented_analysis':
        return {
          segments: 4,
          bestPerformingSegment: 'High Income',
          worstPerformingSegment: 'Young Age',
        };
      default:
        return {};
    }
  };

  const getScheduleText = (job: typeof schedulingJobs[0]) => {
    const time = job.scheduleTime || '09:00';
    switch (job.scheduleType) {
      case 'one-time':
        return `Once on ${job.oneTimeDate ? new Date(job.oneTimeDate).toLocaleDateString() : 'TBD'} at ${time}`;
      case 'daily':
        return `Daily at ${time}`;
      case 'weekly':
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return `Weekly on ${days[job.weekdays?.[0] || 0]} at ${time}`;
      case 'monthly':
        return `Monthly on day ${job.dayOfMonth || 1} at ${time}`;
      default:
        return 'Not scheduled';
    }
  };

  const getReportTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      stability: 'Stability Report',
      performance: 'Performance Report',
      explainability: 'Explainability Report',
      feature_analytics: 'Feature Analytics Report',
      segmented_analysis: 'Segmented Analysis Report',
      drift_analysis: 'Drift Analysis Report',
      data_quality: 'Data Quality Report',
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Scheduling
          </h1>
          <p className={`mt-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Manage automated report generation schedules and jobs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/report-generation')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              isDark ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            <Plus size={16} />
            Add New Job
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div
          className={`p-4 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Total Jobs
            </span>
            <Calendar className={isDark ? 'text-blue-400' : 'text-blue-600'} size={20} />
          </div>
          <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {schedulingJobs.length}
          </p>
        </div>

        <div
          className={`p-4 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Active
            </span>
            <Activity className={isDark ? 'text-green-400' : 'text-green-600'} size={20} />
          </div>
          <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {schedulingJobs.filter(j => j.enabled).length}
          </p>
        </div>

        <div
          className={`p-4 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Running
            </span>
            <RefreshCw className={isDark ? 'text-blue-400' : 'text-blue-600'} size={20} />
          </div>
          <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {runningJobs.size}
          </p>
        </div>

        <div
          className={`p-4 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Total Runs
            </span>
            <Zap className={isDark ? 'text-purple-400' : 'text-purple-600'} size={20} />
          </div>
          <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {schedulingJobs.reduce((sum, j) => sum + (j.runCount || 0), 0)}
          </p>
        </div>
      </div>

      {/* Jobs List */}
      {schedulingJobs.length === 0 ? (
        <div
          className={`py-12 text-center rounded-lg border ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
          }`}
        >
          <Calendar className={`mx-auto mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} size={48} />
          <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            No Scheduled Jobs Yet
          </h3>
          <p className={`mb-6 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Create reporting jobs from the Report Generation page to automate your monitoring workflows.
          </p>
          <button
            onClick={() => navigate('/report-generation')}
            className={`px-6 py-3 rounded-lg flex items-center gap-2 mx-auto ${
              isDark ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            <Plus size={16} />
            Create Your First Job
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {schedulingJobs.map((job) => {
            const isRunning = runningJobs.has(job.id);
            return (
              <div
                key={job.id}
                className={`p-6 rounded-lg border ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 hover:border-slate-600'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                } transition-all`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {job.name}
                      </h3>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs border ${getStatusColor(
                          job.enabled
                        )}`}
                      >
                        {job.enabled ? 'Active' : 'Paused'}
                      </span>
                      {isRunning && (
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs border ${
                            isDark
                              ? 'bg-blue-500/20 text-blue-400 border-blue-500/50'
                              : 'bg-blue-100 text-blue-700 border-blue-300'
                          }`}
                        >
                          <RefreshCw className="animate-spin mr-1" size={12} />
                          Running
                        </span>
                      )}
                    </div>
                    <div className={`flex items-center gap-4 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      <span className="flex items-center gap-1">
                        <FileBarChart size={14} />
                        {job.reportTypes && job.reportTypes.length > 0 
                          ? `Combined: ${job.reportTypes.length} reports (${job.reportTypes.map(rt => getReportTypeLabel(rt)).join(', ')})`
                          : job.reportType 
                            ? getReportTypeLabel(job.reportType) 
                            : 'Report'
                        }
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar size={14} />
                        {getScheduleText(job)}
                      </span>
                      <span>•</span>
                      <span>{job.modelName}</span>
                      {job.runCount !== undefined && job.runCount > 0 && (
                        <>
                          <span>•</span>
                          <span>{job.runCount} runs</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRunNow(job.id)}
                      disabled={isRunning}
                      className={`p-2 rounded-lg ${
                        isRunning
                          ? isDark
                            ? 'text-slate-600 cursor-not-allowed'
                            : 'text-slate-400 cursor-not-allowed'
                          : isDark
                          ? 'hover:bg-slate-700 text-green-400'
                          : 'hover:bg-slate-100 text-green-600'
                      }`}
                      title="Run now"
                    >
                      <Play size={18} />
                    </button>
                    <button
                      onClick={() => handleToggleStatus(job.id)}
                      className={`p-2 rounded-lg ${
                        isDark ? 'hover:bg-slate-700 text-yellow-400' : 'hover:bg-slate-100 text-yellow-600'
                      }`}
                      title={job.enabled ? 'Pause' : 'Resume'}
                    >
                      {job.enabled ? <Pause size={18} /> : <Play size={18} />}
                    </button>
                    <button
                      onClick={() => handleDelete(job.id, job.name)}
                      className={`p-2 rounded-lg ${
                        isDark ? 'hover:bg-slate-700 text-red-400' : 'hover:bg-slate-100 text-red-600'
                      }`}
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {/* Configuration Details */}
                <div className={`p-4 rounded-lg mb-4 ${isDark ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        Configuration
                      </div>
                      <span className={`text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {job.configurationName || 'Default Configuration'}
                      </span>
                    </div>
                    <div>
                      <div className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        Schedule Type
                      </div>
                      <span className={`text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {job.scheduleType.charAt(0).toUpperCase() + job.scheduleType.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Last Run & Next Run */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Last Run
                    </div>
                    <div className="flex items-center gap-2">
                      {job.lastStatus && getLastStatusIcon(job.lastStatus)}
                      <span className={`text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {job.lastRun ? new Date(job.lastRun).toLocaleString() : 'Never'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Next Run
                    </div>
                    <span className={`text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {job.nextRun ? new Date(job.nextRun).toLocaleString() : 'Not scheduled'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Actions */}
      {schedulingJobs.length > 0 && (
        <div
          className={`p-6 rounded-lg border ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
          }`}
        >
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => navigate('/reports')}
              className={`p-4 rounded-lg border flex items-center gap-3 ${
                isDark
                  ? 'bg-slate-700 border-slate-600 hover:bg-slate-600 text-white'
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-900'
              }`}
            >
              <FileBarChart size={20} />
              <div className="text-left">
                <div className="font-medium">View All Reports</div>
                <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Access generated reports
                </div>
              </div>
            </button>
            <button
              onClick={() => navigate('/report-generation')}
              className={`p-4 rounded-lg border flex items-center gap-3 ${
                isDark
                  ? 'bg-slate-700 border-slate-600 hover:bg-slate-600 text-white'
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-900'
              }`}
            >
              <Plus size={20} />
              <div className="text-left">
                <div className="font-medium">Add New Job</div>
                <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Schedule report generation
                </div>
              </div>
            </button>
            <button
              onClick={() => navigate('/report-configuration')}
              className={`p-4 rounded-lg border flex items-center gap-3 ${
                isDark
                  ? 'bg-slate-700 border-slate-600 hover:bg-slate-600 text-white'
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-900'
              }`}
            >
              <Activity size={20} />
              <div className="text-left">
                <div className="font-medium">Configurations</div>
                <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Manage report configs
                </div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Scheduling;
