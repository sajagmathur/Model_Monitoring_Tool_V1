import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useGlobal } from '../contexts/GlobalContext';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Search,
  Download,
  Eye,
  Trash2,
  Calendar,
  Tag,
  TrendingUp,
  Activity,
  Brain,
  BarChart3,
  Filter,
  Share2,
  FileBarChart,
  AlertCircle,
} from 'lucide-react';
import { generateSimpleReportPDF, generateMonitoringReportPDF, generateDataQualityPDF } from '../utils/pdfGenerator';

const Reports: React.FC = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isDark = theme === 'dark';
  const { generatedReports, dataQualityReports, deleteGeneratedReport, deleteDataQualityReport } = useGlobal();

  // Combine all reports from different sources
  const allReports = [
    ...generatedReports,
    ...dataQualityReports.map(dq => ({
      id: dq.id,
      name: dq.name,
      type: 'data_quality' as const,
      modelId: dq.modelId || '',
      modelName: dq.datasetName,
      generatedAt: dq.generatedAt,
      generatedBy: 'System',
      status: 'final' as const,
      healthScore: dq.qualityScore,
      fileSize: '1.2 MB',
      tags: ['data-quality'],
    })),
  ];

  const [filteredReports, setFilteredReports] = useState(allReports);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'health'>('date');

  useEffect(() => {
    setFilteredReports(allReports);
  }, [generatedReports, dataQualityReports]);

  useEffect(() => {
    let filtered = allReports;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(r =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.modelName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Type filter
    if (selectedType !== 'all') {
      filtered = filtered.filter(r => r.type === selectedType);
    }

    // Status filter
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(r => r.status === selectedStatus);
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime();
      } else if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else {
        return (b.healthScore || 0) - (a.healthScore || 0);
      }
    });

    setFilteredReports(filtered);
  }, [searchQuery, selectedType, selectedStatus, sortBy, allReports]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'performance':
        return <TrendingUp size={16} />;
      case 'stability':
        return <Activity size={16} />;
      case 'drift_analysis':
        return <Filter size={16} />;
      case 'explainability':
        return <Brain size={16} />;
      case 'data_quality':
        return <FileBarChart size={16} />;
      default:
        return <FileText size={16} />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'performance':
        return isDark ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-green-100 text-green-700 border-green-300';
      case 'stability':
        return isDark ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' : 'bg-blue-100 text-blue-700 border-blue-300';
      case 'drift_analysis':
        return isDark ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' : 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'explainability':
        return isDark ? 'bg-purple-500/20 text-purple-400 border-purple-500/50' : 'bg-purple-100 text-purple-700 border-purple-300';
      case 'data_quality':
        return isDark ? 'bg-orange-500/20 text-orange-400 border-orange-500/50' : 'bg-orange-100 text-orange-700 border-orange-300';
      default:
        return isDark ? 'bg-slate-500/20 text-slate-400 border-slate-500/50' : 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'final':
        return isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700';
      case 'draft':
        return isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700';
      case 'archived':
        return isDark ? 'bg-slate-500/20 text-slate-400' : 'bg-slate-100 text-slate-700';
      default:
        return isDark ? 'bg-slate-500/20 text-slate-400' : 'bg-slate-100 text-slate-700';
    }
  };

  const getHealthColor = (health: number) => {
    if (health >= 80) return 'text-green-500';
    if (health >= 60) return 'text-yellow-500';
    if (health > 0) return 'text-red-500';
    return isDark ? 'text-slate-500' : 'text-slate-400';
  };

  const handleDelete = (id: string, type: string) => {
    if (confirm('Are you sure you want to delete this report?')) {
      if (type === 'data_quality') {
        deleteDataQualityReport(id);
      } else {
        deleteGeneratedReport(id);
      }
    }
  };

  const handleClearAll = () => {
    if (allReports.length === 0) {
      alert('There are no reports to clear');
      return;
    }

    if (confirm(`Are you sure you want to delete all ${allReports.length} report(s)? This action cannot be undone.`)) {
      // Delete all generated reports
      generatedReports.forEach(report => {
        deleteGeneratedReport(report.id);
      });

      // Delete all data quality reports
      dataQualityReports.forEach(report => {
        deleteDataQualityReport(report.id);
      });

      alert(`✓ Successfully cleared all ${allReports.length} report(s)`);
    }
  };

  const handleDownload = (report: any) => {
    // Check if report has an immutable artifact stored
    if (report.immutable && report.reportArtifact) {
      // Use the stored artifact - never regenerate
      const pdfData = JSON.parse(report.reportArtifact.pdfContent);
      
      if (report.type === 'data_quality') {
        // Use Data Quality PDF generator with stored artifact
        generateDataQualityPDF(pdfData);
      } else {
        // Use monitoring report generator with stored artifact
        generateMonitoringReportPDF({
          reportName: pdfData.reportName || report.name,
          reportType: report.type,
          modelName: report.modelName,
          generatedAt: report.generatedAt,
          healthScore: report.healthScore,
          metrics: pdfData.metrics,
          summary: pdfData.summary || `This is a ${report.type.replace(/_/g, ' ')} report generated for ${report.modelName}.`,
          sections: pdfData.sections || [
            {
              title: 'Overview',
              content: 'Comprehensive analysis completed successfully.',
            },
          ],
        });
      }
      return;
    }

    // Fallback: Generate new report (for legacy reports without artifacts)
    if (report.type === 'data_quality') {
      // For data quality reports without artifacts, show warning
      alert('⚠ This report does not have a stored artifact. Please regenerate from Data Quality page.');
      return;
    }

    // Legacy report generation for non-DQ reports
    generateMonitoringReportPDF({
      reportName: report.name,
      reportType: report.type,
      modelName: report.modelName,
      generatedAt: report.generatedAt,
      healthScore: report.healthScore,
      summary: `This is a ${report.type.replace(/_/g, ' ')} report generated for ${report.modelName}.`,
      sections: [
        {
          title: 'Overview',
          content: 'Comprehensive analysis completed successfully. All metrics are within expected ranges.',
        },
        {
          title: 'Key Findings',
          content: '• Model performance is stable\n• No significant drift detected\n• All quality checks passed',
        },
      ],
    });
  };

  const handleView = (report: any) => {
    alert(`Viewing report: ${report.name}...`);
  };

  const handleShare = (report: any) => {
    alert(`Sharing ${report.name}...`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Reports
          </h1>
          <p className={`mt-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            View and manage all generated monitoring reports
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/report-generation')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              isDark ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            <FileText size={16} />
            New Report
          </button>
          {allReports.length > 0 && (
            <button
              onClick={handleClearAll}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition ${
                isDark ? 'bg-red-600/20 hover:bg-red-600/30 text-red-400' : 'bg-red-100/50 hover:bg-red-100 text-red-600'
              }`}
              title="Clear all reports"
            >
              <Trash2 size={16} />
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`p-4 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Total Reports</span>
            <FileText className={isDark ? 'text-blue-400' : 'text-blue-600'} size={20} />
          </div>
          <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {allReports.length}
          </p>
        </div>

        <div className={`p-4 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Final</span>
            <TrendingUp className={isDark ? 'text-green-400' : 'text-green-600'} size={20} />
          </div>
          <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {allReports.filter(r => r.status === 'final').length}
          </p>
        </div>

        <div className={`p-4 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Draft</span>
            <Tag className={isDark ? 'text-yellow-400' : 'text-yellow-600'} size={20} />
          </div>
          <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {allReports.filter(r => r.status === 'draft').length}
          </p>
        </div>

        <div className={`p-4 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Avg Health</span>
            <Activity className={isDark ? 'text-purple-400' : 'text-purple-600'} size={20} />
          </div>
          <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {allReports.filter(r => (r.healthScore || 0) > 0).length > 0
              ? Math.round(allReports.filter(r => (r.healthScore || 0) > 0).reduce((sum, r) => sum + (r.healthScore || 0), 0) / allReports.filter(r => (r.healthScore || 0) > 0).length)
              : '-'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className={`p-4 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} size={18} />
              <input
                type="text"
                placeholder="Search reports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
                  isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500'
                }`}
              />
            </div>
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border ${
                isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            >
              <option value="all">All Types</option>
              <option value="stability">Stability</option>
              <option value="performance">Performance</option>
              <option value="explainability">Explainability</option>
              <option value="feature_analytics">Feature Analytics</option>
              <option value="segmented_analysis">Segmented Analysis</option>
              <option value="drift_analysis">Drift Analysis</option>
              <option value="data_quality">Data Quality</option>
            </select>
          </div>

          {/* Sort */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className={`w-full px-3 py-2 rounded-lg border ${
                isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            >
              <option value="date">Sort by Date</option>
              <option value="name">Sort by Name</option>
              <option value="health">Sort by Health</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reports Grid */}
      {allReports.length === 0 ? (
        <div className={`py-16 text-center rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <FileText className={`mx-auto mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} size={64} />
          <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            No Reports Generated Yet
          </h3>
          <p className={`mb-6 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Reports will appear here once they are generated from Data Quality checks or Report Generation workflows.
          </p>
          <button
            onClick={() => navigate('/report-generation')}
            className={`px-6 py-3 rounded-lg font-medium ${isDark ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
          >
            Generate Your First Report
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredReports.map((report) => (
            <div
              key={report.id}
              className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700 hover:border-slate-600' : 'bg-white border-slate-200 hover:border-slate-300'} transition-all`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {report.name}
                    </h3>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${getTypeColor(report.type)}`}>
                      {getTypeIcon(report.type)}
                      {report.type}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(report.status)}`}>
                      {report.status}
                    </span>
                  </div>
                  <div className={`flex items-center gap-4 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    <span>{report.modelName}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar size={14} />
                      {new Date(report.generatedAt).toLocaleDateString()}
                    </span>
                    <span>•</span>
                    <span>by {report.generatedBy}</span>
                    <span>•</span>
                    <span>{report.fileSize}</span>
                  </div>
                </div>
                {report.healthScore !== undefined && report.healthScore > 0 && (
                  <div className="text-center">
                    <div className={`text-3xl font-bold ${getHealthColor(report.healthScore)}`}>
                      {report.healthScore}
                    </div>
                    <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Health Score
                    </div>
                  </div>
                )}
              </div>

              {/* Key Findings */}
              {report.tags && report.tags.length > 0 && (
                <div className={`mb-4 p-3 rounded-lg ${isDark ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                  <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Report generated from {report.type.replace('_', ' ')} workflow
                  </div>
                </div>
              )}

              {/* Tags */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {report.tags.map((tag) => (
                    <span
                      key={tag}
                      className={`text-xs px-2 py-1 rounded-full ${
                        isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleView(report)}
                    className={`p-2 rounded-lg ${
                      isDark ? 'hover:bg-slate-700 text-blue-400' : 'hover:bg-slate-100 text-blue-600'
                    }`}
                    title="View report"
                  >
                    <Eye size={18} />
                  </button>
                  <button
                    onClick={() => handleDownload(report)}
                    className={`p-2 rounded-lg ${
                      isDark ? 'hover:bg-slate-700 text-green-400' : 'hover:bg-slate-100 text-green-600'
                    }`}
                    title="Download"
                  >
                    <Download size={18} />
                  </button>
                  <button
                    onClick={() => handleShare(report)}
                    className={`p-2 rounded-lg ${
                      isDark ? 'hover:bg-slate-700 text-purple-400' : 'hover:bg-slate-100 text-purple-600'
                    }`}
                    title="Share"
                  >
                    <Share2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(report.id, report.type)}
                    className={`p-2 rounded-lg ${
                      isDark ? 'hover:bg-slate-700 text-red-400' : 'hover:bg-slate-100 text-red-600'
                    }`}
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filteredReports.length === 0 && allReports.length > 0 && (
            <div className={`py-12 text-center rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
              <Filter className={`mx-auto mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} size={48} />
              <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                No reports match your search criteria
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Reports;
