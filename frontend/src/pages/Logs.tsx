import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useGlobal } from '../contexts/GlobalContext';
import {
  FileText,
  Search,
  Download,
  Eye,
  Trash2,
  Calendar,
  CheckCircle,
  AlertCircle,
  XCircle,
  ChevronDown,
  ClipboardList,
} from 'lucide-react';

const Logs: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { workflowLogs = [], deleteWorkflowLog } = useGlobal();

  const [filteredLogs, setFilteredLogs] = useState(workflowLogs || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorkflowType, setSelectedWorkflowType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date');
  const [selectedLog, setSelectedLog] = useState<string | null>(null);

  useEffect(() => {
    setFilteredLogs(workflowLogs || []);
  }, [workflowLogs]);

  useEffect(() => {
    let filtered = workflowLogs || [];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(log =>
        log.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.summary.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Workflow type filter
    if (selectedWorkflowType !== 'all') {
      filtered = filtered.filter(log => log.workflowType === selectedWorkflowType);
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else {
        return a.projectName.localeCompare(b.projectName);
      }
    });

    setFilteredLogs(filtered);
  }, [searchQuery, selectedWorkflowType, sortBy, workflowLogs]);

  const handleDownload = (log: typeof workflowLogs[0]) => {
    const blob = new Blob([log.summary], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `workflow-log-${log.projectName.replace(/\s+/g, '-')}-${log.id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this workflow log?')) {
      deleteWorkflowLog(id);
      if (selectedLog === id) {
        setSelectedLog(null);
      }
    }
  };

  const getStepStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={16} className="text-green-500" />;
      case 'skipped':
        return <AlertCircle size={16} className="text-amber-500" />;
      case 'failed':
        return <XCircle size={16} className="text-red-500" />;
      default:
        return <AlertCircle size={16} className="text-slate-500" />;
    }
  };

  const selectedLogData = filteredLogs.find(log => log.id === selectedLog);

  return (
    <div className={`min-h-screen p-6 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Workflow Logs
          </h1>
          <p className={`mt-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            View and manage workflow execution logs and summaries
          </p>
        </div>

        {/* Filters */}
        <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search size={20} className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                <input
                  type="text"
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
                    isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>
            </div>

            {/* Workflow Type Filter */}
            <div>
              <select
                value={selectedWorkflowType}
                onChange={(e) => setSelectedWorkflowType(e.target.value)}
                className={`w-full px-4 py-2 rounded-lg border ${
                  isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                }`}
              >
                <option value="all">All Types</option>
                <option value="model_monitoring">Model Monitoring</option>
                <option value="data_pipeline">Data Pipeline</option>
                <option value="report_generation">Report Generation</option>
              </select>
            </div>

            {/* Sort */}
            <div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'name')}
                className={`w-full px-4 py-2 rounded-lg border ${
                  isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                }`}
              >
                <option value="date">Sort by Date</option>
                <option value="name">Sort by Project Name</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-blue-500/20">
                <ClipboardList size={24} className="text-blue-500" />
              </div>
              <div>
                <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {(workflowLogs || []).length}
                </p>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Total Logs
                </p>
              </div>
            </div>
          </div>

          <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-green-500/20">
                <CheckCircle size={24} className="text-green-500" />
              </div>
              <div>
                <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {(workflowLogs || []).filter(log => log.steps.every(s => s.status === 'completed' || s.status === 'skipped')).length}
                </p>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Successful Workflows
                </p>
              </div>
            </div>
          </div>

          <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-amber-500/20">
                <Calendar size={24} className="text-amber-500" />
              </div>
              <div>
                <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {(workflowLogs || []).filter(log => {
                    const logDate = new Date(log.createdAt);
                    const today = new Date();
                    return logDate.toDateString() === today.toDateString();
                  }).length}
                </p>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Today's Workflows
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Logs List */}
        <div className={`rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="p-6 border-b border-slate-700">
            <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Workflow Logs ({filteredLogs.length})
            </h2>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center">
              <FileText size={48} className={`mx-auto mb-4 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
              <p className={`text-lg font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                No workflow logs found
              </p>
              <p className={`mt-2 text-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                Complete a workflow in Projects to generate logs
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {filteredLogs.map((log) => (
                <div key={log.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <FileText size={20} className="text-blue-500" />
                        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {log.projectName}
                        </h3>
                        <span className={`text-xs px-2 py-1 rounded ${
                          log.workflowType === 'model_monitoring' ? 'bg-blue-500/20 text-blue-500' :
                          log.workflowType === 'data_pipeline' ? 'bg-green-500/20 text-green-500' :
                          'bg-purple-500/20 text-purple-500'
                        }`}>
                          {log.workflowType.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-slate-400 mb-3">
                        <span className="flex items-center gap-1">
                          <Calendar size={14} />
                          {new Date(log.createdAt).toLocaleDateString()} {new Date(log.createdAt).toLocaleTimeString()}
                        </span>
                        <span>
                          {log.steps.length} Step{log.steps.length !== 1 ? 's' : ''}
                        </span>
                        <span>
                          {log.scheduledJobs.length} Job{log.scheduledJobs.length !== 1 ? 's' : ''} Scheduled
                        </span>
                      </div>

                      {/* Steps Summary */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {log.steps.map((step, idx) => (
                          <div
                            key={idx}
                            className={`flex items-center gap-2 px-3 py-1 rounded text-xs ${
                              isDark ? 'bg-slate-700/50' : 'bg-slate-100'
                            }`}
                          >
                            {getStepStatusIcon(step.status)}
                            <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                              {step.stepName}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Expandable Details */}
                      {selectedLog === log.id && (
                        <div className={`mt-4 p-4 rounded-lg border ${
                          isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'
                        }`}>
                          <h4 className={`font-medium mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            Step Details
                          </h4>
                          <div className="space-y-3 mb-4">
                            {log.steps.map((step, idx) => (
                              <div key={idx} className="text-sm">
                                <div className="flex items-center gap-2 mb-1">
                                  {getStepStatusIcon(step.status)}
                                  <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                    {step.stepName}
                                  </span>
                                </div>
                                <p className={`ml-6 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                  {step.details}
                                </p>
                              </div>
                            ))}
                          </div>

                          {log.scheduledJobs.length > 0 && (
                            <>
                              <h4 className={`font-medium mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                Scheduled Jobs
                              </h4>
                              <div className="space-y-2">
                                {log.scheduledJobs.map((job, idx) => (
                                  <div key={idx} className={`text-sm p-3 rounded ${
                                    isDark ? 'bg-slate-800' : 'bg-white'
                                  }`}>
                                    <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                      {job.jobName}
                                    </p>
                                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                      Reports: {job.reportTypes.join(', ')}
                                    </p>
                                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                      Schedule: {job.scheduleDetails}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}

                          <div className="mt-4">
                            <h4 className={`font-medium mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              Full Summary
                            </h4>
                            <div className={`p-3 rounded font-mono text-xs overflow-auto max-h-64 ${
                              isDark ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-700'
                            }`}>
                              <pre className="whitespace-pre-wrap">{log.summary}</pre>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => setSelectedLog(selectedLog === log.id ? null : log.id)}
                        className={`p-2 rounded-lg hover:bg-slate-700 ${
                          isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="View Details"
                      >
                        <ChevronDown
                          size={20}
                          className={`transform transition-transform ${selectedLog === log.id ? 'rotate-180' : ''}`}
                        />
                      </button>
                      <button
                        onClick={() => handleDownload(log)}
                        className={`p-2 rounded-lg hover:bg-slate-700 ${
                          isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Download"
                      >
                        <Download size={20} />
                      </button>
                      <button
                        onClick={() => handleDelete(log.id)}
                        className="p-2 rounded-lg hover:bg-red-500/20 text-red-500"
                        title="Delete"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Logs;
