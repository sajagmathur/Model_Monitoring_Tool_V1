import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useGlobal } from '../contexts/GlobalContext';
import { useNavigate } from 'react-router-dom';
import {
  FileBarChart,
  Download,
  Brain,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Activity,
  BarChart3,
  Sparkles,
  Plus,
  Calendar,
  Clock,
  X,
  Zap,
  Target,
  PieChart,
  GitBranch,
  Shield,
} from 'lucide-react';

interface ReportType {
  id: 'stability' | 'performance' | 'explainability' | 'feature_analytics' | 'segmented_analysis' | 'drift_analysis' | 'data_quality';
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const ReportGeneration: React.FC = () => {
  const { theme } = useTheme();
  const { reportConfigurations, createGeneratedReport, createSchedulingJob, registryModels } = useGlobal();
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  const [selectedConfigFilter, setSelectedConfigFilter] = useState<string>(''); // For filtering report types
  const [generatingReportId, setGeneratingReportId] = useState<string | null>(null);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    configurationId: '',
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

  const reportTypes: ReportType[] = [
    {
      id: 'stability',
      title: 'Stability Report',
      description: 'Monitor model performance stability over time',
      icon: <Activity className="text-blue-500" size={24} />,
      color: 'blue',
    },
    {
      id: 'performance',
      title: 'Performance Report',
      description: 'Detailed model performance metrics and KPIs',
      icon: <Target className="text-green-500" size={24} />,
      color: 'green',
    },
    {
      id: 'explainability',
      title: 'Explainability Report',
      description: 'Feature importance and SHAP value analysis',
      icon: <Brain className="text-purple-500" size={24} />,
      color: 'purple',
    },
    {
      id: 'feature_analytics',
      title: 'Feature Analytics Report',
      description: 'Deep dive into feature distributions and patterns',
      icon: <BarChart3 className="text-orange-500" size={24} />,
      color: 'orange',
    },
    {
      id: 'segmented_analysis',
      title: 'Segmented Analysis Report',
      description: 'Performance analysis across different segments',
      icon: <PieChart className="text-pink-500" size={24} />,
      color: 'pink',
    },
    {
      id: 'drift_analysis',
      title: 'Drift Analysis Report',
      description: 'PSI, CSI, and distribution drift detection',
      icon: <TrendingUp className="text-yellow-500" size={24} />,
      color: 'yellow',
    },
    {
      id: 'data_quality',
      title: 'Data Quality Report',
      description: 'Comprehensive data quality analysis and validation',
      icon: <Shield className="text-blue-500" size={24} />,
      color: 'blue',
    },
  ];

  // Get filtered report types based on selected configuration
  const getFilteredReportTypes = () => {
    if (!selectedConfigFilter) return reportTypes;
    
    const config = reportConfigurations.find(c => c.id === selectedConfigFilter);
    if (!config) return reportTypes;

    // If this is a data quality configuration, show Data Quality Report + conditionally other reports
    if (config.type === 'data_quality') {
      const dataQualityReports = [
        {
          id: 'data_quality' as const,
          title: 'Data Quality Report',
          description: 'Comprehensive data quality analysis for selected datasets',
          icon: <Shield className="text-blue-500" size={24} />,
          color: 'blue',
        }
      ];
      
      // Add drift analysis if drift metrics are configured
      if (config.driftMetrics && config.driftMetrics.length > 0) {
        const driftReport = reportTypes.find(rt => rt.id === 'drift_analysis');
        if (driftReport) dataQualityReports.push(driftReport);
      }
      
      // Add other standard reports (explainability, feature analytics, segmented analysis)
      const otherReports = reportTypes.filter(rt => 
        ['explainability', 'feature_analytics', 'segmented_analysis'].includes(rt.id)
      );
      
      return [...dataQualityReports, ...otherReports];
    }

    // Filter based on configuration metrics for other types
    const filtered = reportTypes.filter(rt => {
      if (rt.id === 'stability') {
        // Stability report available if any stability metrics are configured
        return config.metricsToMonitor.some(m => ['psi', 'csi', 'jensen_shannon', 'volume_shift'].includes(m));
      } else if (rt.id === 'performance') {
        // Performance report available if any performance metrics are configured
        return config.metricsToMonitor.some(m => ['auc', 'ks', 'gini', 'precision_recall', 'f1', 'rmse', 'mae', 'mape', 'r2'].includes(m));
      } else if (rt.id === 'drift_analysis') {
        // Drift analysis available if any drift metrics are configured
        return config.driftMetrics && config.driftMetrics.length > 0;
      } else {
        // Other reports are always available
        return true;
      }
    });

    return filtered;
  };

  const filteredReportTypes = getFilteredReportTypes();

  const weekdayOptions = [
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
    { value: 0, label: 'Sunday' },
  ];

  const handleGenerateNow = async (reportType: ReportType['id'], configId?: string) => {
    setGeneratingReportId(reportType);
    
    // Simulate report generation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const reportTypeObj = reportTypes.find(rt => rt.id === reportType);
    const config = reportConfigurations.find(rc => rc.id === configId);
    
    // Generate mock report
    const report = {
      name: `${reportTypeObj?.title || 'Report'} - ${new Date().toLocaleDateString()}`,
      type: reportType,
      modelId: config?.modelId || 'unknown',
      modelName: config?.modelName || 'Unknown Model',
      configurationId: configId,
      status: 'final' as const,
      fileSize: '2.4 MB',
      tags: [reportType, 'manual'],
      healthScore: Math.floor(Math.random() * 30) + 70,
    };
    
    createGeneratedReport(report);
    setGeneratingReportId(null);
    
    alert(`${reportTypeObj?.title} generated successfully! Check the Reports section to view it.`);
  };

  const generateMockMetrics = (reportType: ReportType['id']) => {
    switch (reportType) {
      case 'performance':
        return {
          auc: 0.78,
          ks: 0.35,
          gini: 0.56,
          accuracy: 0.85,
          precision: 0.82,
          recall: 0.79,
        };
      case 'stability':
        return {
          psi: 0.18,
          csi: 0.22,
          volumeShift: -2.5,
          eventRate: 5.2,
        };
      case 'drift_analysis':
        return {
          psi: 0.18,
          csi: 0.22,
          featureDrift: 0.15,
          distributionShift: 0.12,
        };
      case 'explainability':
        return {
          topFeatures: ['income', 'bureau_score', 'employment_type', 'age', 'loan_amount'],
          featureContributions: [0.25, 0.22, 0.18, 0.15, 0.12],
        };
      case 'feature_analytics':
        return {
          featuresAnalyzed: 25,
          driftingFeatures: 3,
          missingValuesIssues: 2,
        };
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

  const generateMockSummary = (reportType: ReportType['id']) => {
    switch (reportType) {
      case 'performance':
        return 'Model performance is stable with AUC of 0.78, meeting target thresholds. All key metrics are within acceptable ranges.';
      case 'stability':
        return 'Model shows stable performance with PSI at 0.18, approaching amber threshold. Monitor income and bureau score features closely.';
      case 'drift_analysis':
        return 'Moderate drift detected in 3 key features. Income distribution shows CSI of 0.22, indicating significant population shift.';
      case 'explainability':
        return 'Top 5 features contribute 92% to model predictions. Income and bureau score are the primary drivers with 47% combined contribution.';
      case 'feature_analytics':
        return '25 features analyzed with 3 showing drift and 2 with data quality issues. Employment type has 11% missing values requiring attention.';
      case 'segmented_analysis':
        return 'Performance varies across segments. High Income segment performs best (AUC: 0.82) while Young Age segment needs improvement (AUC: 0.71).';
      default:
        return 'Report generated successfully with comprehensive analysis.';
    }
  };

  const getReportTypeColor = (color: string) => {
    const colors: Record<string, string> = {
      blue: isDark ? 'bg-blue-500/20 border-blue-500/50' : 'bg-blue-50 border-blue-200',
      green: isDark ? 'bg-green-500/20 border-green-500/50' : 'bg-green-50 border-green-200',
      purple: isDark ? 'bg-purple-500/20 border-purple-500/50' : 'bg-purple-50 border-purple-200',
      orange: isDark ? 'bg-orange-500/20 border-orange-500/50' : 'bg-orange-50 border-orange-200',
      pink: isDark ? 'bg-pink-500/20 border-pink-500/50' : 'bg-pink-50 border-pink-200',
      yellow: isDark ? 'bg-yellow-500/20 border-yellow-500/50' : 'bg-yellow-50 border-yellow-200',
    };
    return colors[color] || colors.blue;
  };

  const handleToggleReportType = (type: string) => {
    setScheduleForm(prev => ({
      ...prev,
      reportTypes: prev.reportTypes.includes(type)
        ? prev.reportTypes.filter(t => t !== type)
        : [...prev.reportTypes, type]
    }));
  };

  const handleCreateSchedule = () => {
    if (!scheduleForm.name.trim()) {
      alert('Please enter a job name');
      return;
    }
    if (!scheduleForm.configurationId) {
      alert('Please select a configuration');
      return;
    }
    if (scheduleForm.reportTypes.length === 0) {
      alert('Please select at least one report type');
      return;
    }

    // Validate schedule-specific requirements
    if (scheduleForm.scheduleType === 'one-time' && !scheduleForm.oneTimeDate) {
      alert('Please select a date for one-time scheduling');
      return;
    }
    if (scheduleForm.scheduleType === 'weekly' && scheduleForm.weekdays.length === 0) {
      alert('Please select at least one day of the week');
      return;
    }

    const config = reportConfigurations.find(c => c.id === scheduleForm.configurationId);
    if (!config) {
      alert('Selected configuration not found');
      return;
    }

    // Build the scheduling job with appropriate fields based on schedule type
    const jobData: any = {
      name: scheduleForm.name,
      type: 'report_generation',
      reportTypes: scheduleForm.reportTypes,
      configurationId: config.id,
      configurationName: config.name,
      modelId: config.modelId,
      modelName: config.modelName,
      scheduleType: scheduleForm.scheduleType,
      enabled: scheduleForm.enabled,
      runCount: 0,
    };

    // Add schedule-specific fields
    switch (scheduleForm.scheduleType) {
      case 'one-time':
        jobData.oneTimeDate = scheduleForm.oneTimeDate;
        jobData.oneTimeTime = scheduleForm.oneTimeTime;
        break;
      case 'daily':
        jobData.scheduleTime = scheduleForm.scheduleTime;
        break;
      case 'weekly':
        jobData.scheduleTime = scheduleForm.scheduleTime;
        jobData.weekdays = scheduleForm.weekdays;
        break;
      case 'monthly':
        jobData.scheduleTime = scheduleForm.scheduleTime;
        jobData.dayOfMonth = scheduleForm.dayOfMonth;
        jobData.monthlyType = scheduleForm.monthlyType;
        if (scheduleForm.monthlyType === 'weekday') {
          jobData.weekOfMonth = scheduleForm.weekOfMonth;
          jobData.monthlyWeekday = scheduleForm.monthlyWeekday;
        }
        break;
      case 'quarterly':
        jobData.scheduleTime = scheduleForm.scheduleTime;
        jobData.quarterMonth = scheduleForm.quarterMonth;
        jobData.dayOfMonth = scheduleForm.dayOfMonth;
        break;
      case 'yearly':
        jobData.scheduleTime = scheduleForm.scheduleTime;
        jobData.yearMonth = scheduleForm.yearMonth;
        jobData.yearDay = scheduleForm.yearDay;
        break;
    }

    createSchedulingJob(jobData);

    alert(`Scheduling job "${scheduleForm.name}" created successfully! View it in the Scheduling section.`);
    setShowScheduleForm(false);
    setScheduleForm({
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

  const availableReportTypes = [
    { value: 'data_quality', label: 'Data Quality' },
    { value: 'stability', label: 'Model Stability' },
    { value: 'performance', label: 'Model Performance' },
    { value: 'drift_analysis', label: 'Drift Analysis' },
    { value: 'explainability', label: 'Explainability' },
    { value: 'feature_analytics', label: 'Feature Analytics' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Report Generation
        </h1>
        <p className={`mt-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Generate comprehensive monitoring reports. Use Projects workflow to schedule automated jobs.
        </p>
      </div>

      {/* No Configurations Message */}
      {reportConfigurations.length === 0 && (
        <div className={`p-8 rounded-lg border text-center ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <AlertTriangle className={`mx-auto mb-4 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} size={48} />
          <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            No Report Configurations Found
          </h3>
          <p className={`mb-6 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Create report configurations first to generate reports and schedule jobs.
          </p>
          <button
            onClick={() => navigate('/report-configuration')}
            className={`px-6 py-3 rounded-lg font-medium ${
              isDark ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            Go to Report Configuration
          </button>
        </div>
      )}

      {/* Report Types Grid */}
      {reportConfigurations.length > 0 && (
        <>
          {/* Configuration Filter */}
          <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex-1 mr-4">
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Filter Report Types by Configuration (Optional)
                </label>
                <select
                  value={selectedConfigFilter}
                  onChange={(e) => setSelectedConfigFilter(e.target.value)}
                  className={`w-full px-4 py-2 rounded-lg border ${
                    isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="">All Report Types</option>
                  {reportConfigurations.map((config) => (
                    <option key={config.id} value={config.id}>
                      {config.name} - {config.modelName}
                    </option>
                  ))}
                </select>
              </div>
              {selectedConfigFilter && (
                <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Showing {filteredReportTypes.length} of {reportTypes.length} reports
                </div>
              )}
            </div>
          </div>

          <div>
            <h2 className={`text-xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Available Report Types
              {selectedConfigFilter && ` (${filteredReportTypes.length})`}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredReportTypes.map((reportType) => (
                <div
                  key={reportType.id}
                  className={`p-6 rounded-lg border ${getReportTypeColor(reportType.color)}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {reportType.icon}
                      <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {reportType.title}
                      </h3>
                    </div>
                  </div>
                  <p className={`text-sm mb-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {reportType.description}
                  </p>
                  <button
                    onClick={() => handleGenerateNow(reportType.id)}
                    disabled={generatingReportId !== null}
                    className={`w-full px-4 py-2 rounded-lg flex items-center justify-center gap-2 font-medium ${
                      generatingReportId === reportType.id
                        ? isDark
                          ? 'bg-blue-600 text-white cursor-wait'
                          : 'bg-blue-500 text-white cursor-wait'
                        : generatingReportId !== null
                        ? isDark
                          ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : isDark
                        ? 'bg-slate-700 hover:bg-slate-600 text-white'
                        : 'bg-white hover:bg-slate-50 text-slate-900'
                    }`}
                  >
                    {generatingReportId === reportType.id ? (
                      <>
                        <Activity className="animate-spin" size={16} />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Zap size={16} />
                        Generate Now
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className={`p-6 rounded-lg border ${isDark ? 'bg-gradient-to-br from-purple-900/20 to-blue-900/20 border-purple-500/30' : 'bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200'}`}>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className={isDark ? 'text-purple-400' : 'text-purple-600'} size={24} />
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Quick Actions
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <button
                onClick={() => setShowScheduleForm(!showScheduleForm)}
                className={`p-4 rounded-lg border flex items-center gap-3 ${
                  isDark ? 'bg-blue-900/30 border-blue-500/50 hover:bg-blue-900/50 text-white' : 'bg-blue-50 border-blue-200 hover:bg-blue-100 text-slate-900'
                }`}
              >
                <Clock size={20} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
                <div className="text-left">
                  <div className="font-medium">Schedule Reports</div>
                  <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Automate report generation
                  </div>
                </div>
              </button>
              <button
                onClick={() => navigate('/reports')}
                className={`p-4 rounded-lg border flex items-center gap-3 ${
                  isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-white' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-900'
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
                onClick={() => navigate('/scheduling')}
                className={`p-4 rounded-lg border flex items-center gap-3 ${
                  isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-white' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-900'
                }`}
              >
                <Calendar size={20} />
                <div className="text-left">
                  <div className="font-medium">Manage Schedule</div>
                  <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    View scheduled jobs
                  </div>
                </div>
              </button>
              <button
                onClick={() => navigate('/report-configuration')}
                className={`p-4 rounded-lg border flex items-center gap-3 ${
                  isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-white' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-900'
                }`}
              >
                <GitBranch size={20} />
                <div className="text-left">
                  <div className="font-medium">Configurations</div>
                  <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Manage report configs
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Schedule Automated Reports Form */}
          {showScheduleForm && (
            <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Clock className={isDark ? 'text-blue-400' : 'text-blue-600'} size={24} />
                  <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Schedule Automated Reports
                  </h3>
                </div>
                <button
                  onClick={() => setShowScheduleForm(false)}
                  className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                {/* Job Name */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Job Name
                  </label>
                  <input
                    type="text"
                    value={scheduleForm.name}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, name: e.target.value })}
                    placeholder="Enter job name"
                    className={`w-full px-4 py-2 rounded-lg border ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                {/* Configuration Selector */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Configuration
                  </label>
                  <select
                    value={scheduleForm.configurationId}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, configurationId: e.target.value })}
                    className={`w-full px-4 py-2 rounded-lg border ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="">Select a configuration</option>
                    {reportConfigurations.map(config => (
                      <option key={config.id} value={config.id}>
                        {config.name} ({config.modelName})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Report Types */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Report Types
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {availableReportTypes.map(reportType => (
                      <label
                        key={reportType.value}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${
                          scheduleForm.reportTypes.includes(reportType.value)
                            ? isDark ? 'bg-blue-900/30 border-blue-500/50' : 'bg-blue-50 border-blue-200'
                            : isDark ? 'bg-slate-900 border-slate-700 hover:bg-slate-800' : 'bg-white border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={scheduleForm.reportTypes.includes(reportType.value)}
                          onChange={() => handleToggleReportType(reportType.value)}
                          className="w-4 h-4"
                        />
                        <span className={isDark ? 'text-white' : 'text-slate-900'}>{reportType.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Schedule Configuration */}
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Schedule Frequency
                    </label>
                    <select
                      value={scheduleForm.scheduleType}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, scheduleType: e.target.value as any })}
                      className={`w-full px-4 py-2 rounded-lg border ${
                        isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
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
                  {scheduleForm.scheduleType === 'one-time' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          Date
                        </label>
                        <input
                          type="date"
                          value={scheduleForm.oneTimeDate}
                          onChange={(e) => setScheduleForm({ ...scheduleForm, oneTimeDate: e.target.value })}
                          min={new Date().toISOString().split('T')[0]}
                          className={`w-full px-4 py-2 rounded-lg border ${
                            isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                      </div>
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          Time
                        </label>
                        <input
                          type="time"
                          value={scheduleForm.oneTimeTime}
                          onChange={(e) => setScheduleForm({ ...scheduleForm, oneTimeTime: e.target.value })}
                          className={`w-full px-4 py-2 rounded-lg border ${
                            isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                      </div>
                    </div>
                  )}

                  {/* Daily Scheduling */}
                  {scheduleForm.scheduleType === 'daily' && (
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        Time
                      </label>
                      <input
                        type="time"
                        value={scheduleForm.scheduleTime}
                        onChange={(e) => setScheduleForm({ ...scheduleForm, scheduleTime: e.target.value })}
                        className={`w-full px-4 py-2 rounded-lg border ${
                          isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                        }`}
                      />
                    </div>
                  )}

                  {/* Weekly Scheduling */}
                  {scheduleForm.scheduleType === 'weekly' && (
                    <div className="space-y-4">
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          Days of the Week
                        </label>
                        <div className="grid grid-cols-7 gap-2">
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                            <label
                              key={index}
                              className={`flex items-center justify-center p-3 rounded-lg border cursor-pointer text-sm font-medium ${
                                scheduleForm.weekdays.includes(index)
                                  ? isDark ? 'bg-blue-900/30 border-blue-500/50 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-700'
                                  : isDark ? 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={scheduleForm.weekdays.includes(index)}
                                onChange={() => {
                                  const updatedWeekdays = scheduleForm.weekdays.includes(index)
                                    ? scheduleForm.weekdays.filter(d => d !== index)
                                    : [...scheduleForm.weekdays, index];
                                  setScheduleForm({ ...scheduleForm, weekdays: updatedWeekdays });
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
                          Time
                        </label>
                        <input
                          type="time"
                          value={scheduleForm.scheduleTime}
                          onChange={(e) => setScheduleForm({ ...scheduleForm, scheduleTime: e.target.value })}
                          className={`w-full px-4 py-2 rounded-lg border ${
                            isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                      </div>
                    </div>
                  )}

                  {/* Monthly Scheduling */}
                  {scheduleForm.scheduleType === 'monthly' && (
                    <div className="space-y-4">
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          Monthly Schedule Type
                        </label>
                        <select
                          value={scheduleForm.monthlyType}
                          onChange={(e) => setScheduleForm({ ...scheduleForm, monthlyType: e.target.value as 'day' | 'weekday' })}
                          className={`w-full px-4 py-2 rounded-lg border ${
                            isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        >
                          <option value="day">Specific Day of Month</option>
                          <option value="weekday">Specific Weekday</option>
                        </select>
                      </div>
                      
                      {scheduleForm.monthlyType === 'day' ? (
                        <div>
                          <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            Day of Month
                          </label>
                          <select
                            value={scheduleForm.dayOfMonth}
                            onChange={(e) => setScheduleForm({ ...scheduleForm, dayOfMonth: parseInt(e.target.value) })}
                            className={`w-full px-4 py-2 rounded-lg border ${
                              isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                            }`}
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
                              value={scheduleForm.weekOfMonth}
                              onChange={(e) => setScheduleForm({ ...scheduleForm, weekOfMonth: parseInt(e.target.value) })}
                              className={`w-full px-4 py-2 rounded-lg border ${
                                isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                              }`}
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
                              value={scheduleForm.monthlyWeekday}
                              onChange={(e) => setScheduleForm({ ...scheduleForm, monthlyWeekday: parseInt(e.target.value) })}
                              className={`w-full px-4 py-2 rounded-lg border ${
                                isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                              }`}
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
                          Time
                        </label>
                        <input
                          type="time"
                          value={scheduleForm.scheduleTime}
                          onChange={(e) => setScheduleForm({ ...scheduleForm, scheduleTime: e.target.value })}
                          className={`w-full px-4 py-2 rounded-lg border ${
                            isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                      </div>
                    </div>
                  )}

                  {/* Quarterly Scheduling */}
                  {scheduleForm.scheduleType === 'quarterly' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            Quarter Month
                          </label>
                          <select
                            value={scheduleForm.quarterMonth}
                            onChange={(e) => setScheduleForm({ ...scheduleForm, quarterMonth: parseInt(e.target.value) as 1 | 2 | 3 })}
                            className={`w-full px-4 py-2 rounded-lg border ${
                              isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                            }`}
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
                            value={scheduleForm.dayOfMonth}
                            onChange={(e) => setScheduleForm({ ...scheduleForm, dayOfMonth: parseInt(e.target.value) })}
                            className={`w-full px-4 py-2 rounded-lg border ${
                              isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                            }`}
                          >
                            {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                              <option key={day} value={day}>Day {day}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          Time
                        </label>
                        <input
                          type="time"
                          value={scheduleForm.scheduleTime}
                          onChange={(e) => setScheduleForm({ ...scheduleForm, scheduleTime: e.target.value })}
                          className={`w-full px-4 py-2 rounded-lg border ${
                            isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                      </div>
                    </div>
                  )}

                  {/* Yearly Scheduling */}
                  {scheduleForm.scheduleType === 'yearly' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            Month
                          </label>
                          <select
                            value={scheduleForm.yearMonth}
                            onChange={(e) => setScheduleForm({ ...scheduleForm, yearMonth: parseInt(e.target.value) })}
                            className={`w-full px-4 py-2 rounded-lg border ${
                              isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                            }`}
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
                            value={scheduleForm.yearDay}
                            onChange={(e) => setScheduleForm({ ...scheduleForm, yearDay: parseInt(e.target.value) })}
                            className={`w-full px-4 py-2 rounded-lg border ${
                              isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                            }`}
                          >
                            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                              <option key={day} value={day}>Day {day}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          Time
                        </label>
                        <input
                          type="time"
                          value={scheduleForm.scheduleTime}
                          onChange={(e) => setScheduleForm({ ...scheduleForm, scheduleTime: e.target.value })}
                          className={`w-full px-4 py-2 rounded-lg border ${
                            isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                      </div>
                    </div>
                  )}

                  {/* Enable/Disable Toggle */}
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={scheduleForm.enabled}
                        onChange={(e) => setScheduleForm({ ...scheduleForm, enabled: e.target.checked })}
                        className="w-5 h-5"
                      />
                      <span className={isDark ? 'text-white' : 'text-slate-900'}>
                        Enable this scheduled job immediately
                      </span>
                    </label>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleCreateSchedule}
                    className={`flex-1 px-6 py-3 rounded-lg font-medium ${
                      isDark ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Clock size={20} />
                      Create Scheduled Job
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setShowScheduleForm(false);
                      setScheduleForm({
                        name: '',
                        configurationId: '',
                        reportTypes: [],
                        scheduleType: 'daily',
                        scheduleTime: '09:00',
                        enabled: true,
                      });
                    }}
                    className={`px-6 py-3 rounded-lg font-medium ${
                      isDark ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-900'
                    }`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
};

export default ReportGeneration;
