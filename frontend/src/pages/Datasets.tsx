import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { useGlobal } from '../contexts/GlobalContext';
import { getCreationDescription, createCreationLogEntry } from '../utils/workflowLogger';
import {
  Database,
  Search,
  Filter,
  Download,
  Eye,
  Trash2,
  Calendar,
  BarChart3,
  Tag,
  ChevronDown,
  RefreshCw,
  Upload,
  Server,
  Cloud,
  Plus,
  AlertCircle,
  X,
} from 'lucide-react';

interface Dataset {
  id: string;
  name: string;
  modelId: string;
  modelName: string;
  track: 'Development' | 'OOT' | 'Monitoring' | 'Recent';
  rowCount: number;
  columnCount: number;
  uploadedAt: string;
  uploadedBy: string;
  fileSize: string;
  status: 'active' | 'archived' | 'processing' | 'failed';
  tags: string[];
  source: 'csv' | 'database' | 'api' | 'cloud';
  columns?: string[];
}

const Datasets: React.FC = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isDark = theme === 'dark';
  const { ingestionJobs, registryModels, projects, createIngestionJob, getIngestionJob, createWorkflowLog } = useGlobal();

  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [filteredDatasets, setFilteredDatasets] = useState<Dataset[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrack, setSelectedTrack] = useState<string>('all');
  const [selectedModel, setSelectedModel] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size'>('date');
  const [loading, setLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetModelId, setTargetModelId] = useState<string>('');
  const [dataTrack, setDataTrack] = useState<'Development' | 'OOT' | 'Monitoring' | 'Recent'>('Development');
  const [datasetType, setDatasetType] = useState<'baseline' | 'reference' | 'monitoring' | 'development'>('development');
  const [refreshLocation, setRefreshLocation] = useState<string>('');
  const [showResolvedOnly, setShowResolvedOnly] = useState<boolean>(false);
  
  // Ingest Data modal state
  const [showIngestModal, setShowIngestModal] = useState(false);
  const [ingestFile, setIngestFile] = useState<File | null>(null);
  const [ingestDatasetName, setIngestDatasetName] = useState('');
  const [ingestTargetModelId, setIngestTargetModelId] = useState('');
  const [ingestDatasetType, setIngestDatasetType] = useState<'baseline' | 'reference' | 'monitoring' | 'development'>('development');
  const [ingestRefreshLocation, setIngestRefreshLocation] = useState('');

  // Load datasets from ingestionJobs
  useEffect(() => {
    setLoading(true);
    
    // Convert ingestionJobs to Dataset format
    const datasetsFromJobs: Dataset[] = ingestionJobs
      .filter(job => job.status === 'completed' || job.status === 'created')
      .map(job => {
        // Find the linked model from modelId, or fall back to projectId match
        const model = job.modelId 
          ? registryModels.find(m => m.id === job.modelId)
          : registryModels.find(m => m.projectId === job.projectId) || registryModels[0];
        
        return {
          id: job.id,
          name: job.uploadedFile?.name || job.name,
          modelId: model?.id || 'unknown',
          modelName: model ? `${model.name} v${model.version}` : 'Unknown Model',
          track: 'Development', // Default track, can be enhanced
          rowCount: job.outputShape?.rows || 0,
          columnCount: job.outputShape?.columns || 0,
          uploadedAt: job.createdAt,
          uploadedBy: 'Current User',
          fileSize: job.uploadedFile ? `${(job.uploadedFile.size / (1024 * 1024)).toFixed(1)} MB` : '0 MB',
          status: job.status === 'completed' ? 'active' as const : 
                  job.status === 'failed' ? 'failed' as const :
                  job.status === 'running' ? 'processing' as const : 'active' as const,
          tags: [job.dataSource],
          source: job.dataSource as 'csv' | 'database' | 'api' | 'cloud',
          columns: job.outputColumns,
        };
      });

    setDatasets(datasetsFromJobs);
    setFilteredDatasets(datasetsFromJobs);
    setLoading(false);
  }, [ingestionJobs, registryModels]);

  useEffect(() => {
    let filtered = datasets;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(d =>
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.modelName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Track filter
    if (selectedTrack !== 'all') {
      filtered = filtered.filter(d => d.track === selectedTrack);
    }

    // Model filter
    if (selectedModel !== 'all') {
      filtered = filtered.filter(d => d.modelId === selectedModel);
    }

    // Resolved filter - only show resolved datasets
    if (showResolvedOnly) {
      filtered = filtered.filter(d => {
        const job = ingestionJobs.find(j => j.id === d.id);
        return job?.isResolved === true;
      });
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
      } else if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else {
        return parseFloat(b.fileSize) - parseFloat(a.fileSize);
      }
    });

    setFilteredDatasets(filtered);
  }, [searchQuery, selectedTrack, selectedModel, sortBy, datasets, showResolvedOnly, ingestionJobs]);

  const getTrackColor = (track: string) => {
    switch (track) {
      case 'Development':
        return isDark ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' : 'bg-blue-100 text-blue-700 border-blue-300';
      case 'OOT':
        return isDark ? 'bg-purple-500/20 text-purple-400 border-purple-500/50' : 'bg-purple-100 text-purple-700 border-purple-300';
      case 'Monitoring':
        return isDark ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-green-100 text-green-700 border-green-300';
      case 'Recent':
        return isDark ? 'bg-orange-500/20 text-orange-400 border-orange-500/50' : 'bg-orange-100 text-orange-700 border-orange-300';
      default:
        return isDark ? 'bg-slate-500/20 text-slate-400 border-slate-500/50' : 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return { icon: RefreshCw, label: 'Active', color: isDark ? 'text-green-400' : 'text-green-600' };
      case 'processing':
        return { icon: RefreshCw, label: 'Processing', color: isDark ? 'text-blue-400' : 'text-blue-600' };
      case 'failed':
        return { icon: AlertCircle, label: 'Failed', color: isDark ? 'text-red-400' : 'text-red-600' };
      case 'archived':
        return { icon: Database, label: 'Archived', color: isDark ? 'text-slate-400' : 'text-slate-600' };
      default:
        return { icon: Database, label: 'Unknown', color: isDark ? 'text-slate-400' : 'text-slate-600' };
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'csv':
        return Upload;
      case 'database':
        return Server;
      case 'cloud':
        return Cloud;
      case 'api':
        return Server;
      default:
        return Database;
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this dataset?')) {
      setDatasets(datasets.filter(d => d.id !== id));
    }
  };

  const handleDownload = (dataset: Dataset) => {
    alert(`Downloading ${dataset.name}...`);
  };

  const handleView = (dataset: Dataset) => {
    alert(`Viewing dataset details for ${dataset.name}...`);
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      alert('Please select a file to upload');
      return;
    }
    
    if (!targetModelId) {
      alert('Please select a target model');
      return;
    }

    const model = registryModels.find(m => m.id === targetModelId);
    if (!model) {
      alert('Selected model not found');
      return;
    }

    // Parse CSV to get shape info (simplified - in real app would parse properly)
    const text = await selectedFile.text();
    const lines = text.split('\n').filter(l => l.trim());
    const headers = lines[0]?.split(',') || [];
    
    // Log creation event FIRST before any state changes
    const description = getCreationDescription.dataset(
      selectedFile.name,
      datasetType,
      lines.length - 1,
      headers.length,
      model.name
    );
    const project = projects.find(p => p.id === model.projectId);
    if (project) {
      createWorkflowLog(createCreationLogEntry(
        project.id,
        project.name,
        'Dataset Created',
        description
      ));
    }
    
    const newJob = createIngestionJob({
      name: selectedFile.name,
      projectId: model.projectId,
      modelId: targetModelId, // Link to the selected model
      dataSource: 'csv',
      datasetType: datasetType, // Baseline, Reference, Monitoring, or Development
      refreshLocation: refreshLocation || `/uploads/${selectedFile.name}`, // Location for refresh
      uploadedFile: {
        name: selectedFile.name,
        path: `/uploads/${selectedFile.name}`,
        size: selectedFile.size,
        type: selectedFile.type,
      },
      status: 'completed',
      outputPath: `/data/${selectedFile.name}`,
      outputShape: {
        rows: lines.length - 1,
        columns: headers.length,
      },
      outputColumns: headers.map(h => h.trim()),
    });

    setShowUploadModal(false);
    setSelectedFile(null);
    setTargetModelId('');
    setDatasetType('development');
    setRefreshLocation('');
    alert(`Dataset "${selectedFile.name}" uploaded successfully as ${datasetType} dataset and linked to model "${model.name} v${model.version}"`);
  };

  const uniqueModels = Array.from(new Set(datasets.map(d => d.modelName)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Datasets
          </h1>
          <p className={`mt-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Manage all datasets across all projects and models
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowUploadModal(true)}
            disabled={registryModels.length === 0}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              registryModels.length === 0
                ? isDark ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : isDark ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            <Upload size={16} />
            Ingest Data
          </button>
          <button
            disabled={registryModels.length === 0}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              registryModels.length === 0
                ? isDark ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : isDark ? 'bg-purple-600 hover:bg-purple-500 text-white' : 'bg-purple-500 hover:bg-purple-600 text-white'
            }`}
            onClick={() => alert('Cloud storage connection coming soon')}
          >
            <Cloud size={16} />
            Register Cloud
          </button>
        </div>
      </div>

      {/* Warning if no models */}
      {registryModels.length === 0 && (
        <div className={`p-4 rounded-lg border flex items-center gap-3 ${
          isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'
        }`}>
          <AlertCircle className={isDark ? 'text-amber-400' : 'text-amber-600'} size={20} />
          <div>
            <p className={`text-sm font-medium ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
              No models available
            </p>
            <p className={`text-xs ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
              Please import a model in the Model Registry before ingesting data
            </p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`p-4 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Total Datasets</span>
            <Database className={isDark ? 'text-blue-400' : 'text-blue-600'} size={20} />
          </div>
          <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {datasets.length}
          </p>
        </div>

        <div className={`p-4 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Total Records</span>
            <BarChart3 className={isDark ? 'text-green-400' : 'text-green-600'} size={20} />
          </div>
          <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {datasets.reduce((sum, d) => sum + d.rowCount, 0).toLocaleString()}
          </p>
        </div>

        <div className={`p-4 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Models</span>
            <Tag className={isDark ? 'text-purple-400' : 'text-purple-600'} size={20} />
          </div>
          <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {uniqueModels.length}
          </p>
        </div>

        <div className={`p-4 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Active</span>
            <RefreshCw className={isDark ? 'text-orange-400' : 'text-orange-600'} size={20} />
          </div>
          <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {datasets.filter(d => d.status === 'active').length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className={`p-4 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} size={18} />
              <input
                type="text"
                placeholder="Search datasets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
                  isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500'
                }`}
              />
            </div>
          </div>

          {/* Track Filter */}
          <div>
            <select
              value={selectedTrack}
              onChange={(e) => setSelectedTrack(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border ${
                isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            >
              <option value="all">All Tracks</option>
              <option value="Development">Development</option>
              <option value="OOT">OOT</option>
              <option value="Monitoring">Monitoring</option>
              <option value="Recent">Recent</option>
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
              <option value="size">Sort by Size</option>
            </select>
          </div>

          {/* Resolved Filter Checkbox */}
          <div className="flex items-center">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showResolvedOnly}
                onChange={(e) => setShowResolvedOnly(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Resolved Only
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Datasets Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
        </div>
      ) : (
        <div className={`rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`border-b ${isDark ? 'border-slate-700 bg-slate-700/50' : 'border-slate-200 bg-slate-50'}`}>
                <tr>
                  <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Dataset Name
                  </th>
                  <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Model
                  </th>
                  <th className={`text-center py-3 px-4 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Source
                  </th>
                  <th className={`text-center py-3 px-4 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Track
                  </th>
                  <th className={`text-center py-3 px-4 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Status
                  </th>
                  <th className={`text-right py-3 px-4 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Rows
                  </th>
                  <th className={`text-right py-3 px-4 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Columns
                  </th>
                  <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Uploaded
                  </th>
                  <th className={`text-center py-3 px-4 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredDatasets.map((dataset) => {
                  const SourceIcon = getSourceIcon(dataset.source);
                  const statusBadge = getStatusBadge(dataset.status);
                  const StatusIcon = statusBadge.icon;
                  
                  // Get lineage information
                  const job = ingestionJobs.find(j => j.id === dataset.id);
                  const isResolved = job?.isResolved || false;
                  const parentDataset = job?.parentDatasetId ? getIngestionJob(job.parentDatasetId) : null;
                  
                  return (
                    <tr
                      key={dataset.id}
                      className={`border-b ${isDark ? 'border-slate-700 hover:bg-slate-700/30' : 'border-slate-200 hover:bg-slate-50'}`}
                    >
                      <td className={`py-3 px-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="font-medium">{dataset.name}</div>
                            {isResolved && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                isDark ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-green-100 text-green-700 border border-green-300'
                              }`}>
                                ✓ Resolved
                              </span>
                            )}
                          </div>
                          {isResolved && parentDataset && (
                            <div className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              ← Derived from: {parentDataset.name}
                            </div>
                          )}
                          {job?.resolutionSummary && (
                            <div className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              {job.resolvedIssuesCount} issue(s) resolved
                            </div>
                          )}
                          {dataset.columns && !isResolved && (
                            <div className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              Schema: {dataset.columns.slice(0, 3).join(', ')}
                              {dataset.columns.length > 3 && ` +${dataset.columns.length - 3} more`}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className={`py-3 px-4 text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        {dataset.modelName}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <SourceIcon size={14} className={isDark ? 'text-slate-400' : 'text-slate-600'} />
                          <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                            {dataset.source.toUpperCase()}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs border ${getTrackColor(dataset.track)}`}>
                          {dataset.track}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <StatusIcon size={14} className={statusBadge.color} />
                          <span className={`text-xs ${statusBadge.color}`}>
                            {statusBadge.label}
                          </span>
                        </div>
                      </td>
                      <td className={`py-3 px-4 text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        {dataset.rowCount.toLocaleString()}
                      </td>
                      <td className={`py-3 px-4 text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        {dataset.columnCount}
                      </td>
                      <td className={`py-3 px-4 text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        <div className="flex items-center gap-1">
                          <Calendar size={14} />
                          {new Date(dataset.uploadedAt).toLocaleDateString()}
                        </div>
                        <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {dataset.fileSize}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleView(dataset)}
                            className={`p-2 rounded-lg ${
                              isDark ? 'hover:bg-slate-600 text-blue-400' : 'hover:bg-slate-100 text-blue-600'
                            }`}
                            title="View details"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => handleDownload(dataset)}
                            className={`p-2 rounded-lg ${
                              isDark ? 'hover:bg-slate-600 text-green-400' : 'hover:bg-slate-100 text-green-600'
                            }`}
                            title="Download"
                          >
                            <Download size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(dataset.id)}
                            className={`p-2 rounded-lg ${
                              isDark ? 'hover:bg-slate-600 text-red-400' : 'hover:bg-slate-100 text-red-600'
                            }`}
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredDatasets.length === 0 && (
            <div className="py-12 text-center">
              <Database className={`mx-auto mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} size={48} />
              <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {datasets.length === 0 
                  ? 'No datasets yet. Upload your first dataset above.'
                  : 'No datasets match your filters'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className={`w-full max-w-lg mx-4 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-xl`}>
            <div className="p-6">
              <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Upload Dataset
              </h2>

              <div className="space-y-4">
                {/* Model Selection */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Target Model *
                  </label>
                  <select
                    value={targetModelId}
                    onChange={(e) => setTargetModelId(e.target.value)}
                    className={`w-full px-4 py-2 rounded-lg border ${
                      isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="">-- Select Model --</option>
                    {registryModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name} v{model.version} | {model.modelType} | {model.stage}
                      </option>
                    ))}
                  </select>
                  <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    This dataset will be linked to the selected model
                  </p>
                </div>

                {/* Data Track */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Data Track
                  </label>
                  <select
                    value={dataTrack}
                    onChange={(e) => setDataTrack(e.target.value as any)}
                    className={`w-full px-4 py-2 rounded-lg border ${
                      isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="Development">Development</option>
                    <option value="OOT">OOT (Out of Time)</option>
                    <option value="Monitoring">Monitoring</option>
                    <option value="Recent">Recent</option>
                  </select>
                </div>

                {/* Dataset Type for Reporting */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Dataset Type for Reporting *
                  </label>
                  <select
                    value={datasetType}
                    onChange={(e) => setDatasetType(e.target.value as any)}
                    className={`w-full px-4 py-2 rounded-lg border ${
                      isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="development">Development</option>
                    <option value="baseline">Baseline (Reference for comparison)</option>
                    <option value="reference">Reference (Current production)</option>
                    <option value="monitoring">Monitoring (Ongoing tracking)</option>
                  </select>
                  <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Baseline and Reference datasets can be used in Report Configuration
                  </p>
                </div>

                {/* Refresh Location */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Refresh Location (Optional)
                  </label>
                  <input
                    type="text"
                    value={refreshLocation}
                    onChange={(e) => setRefreshLocation(e.target.value)}
                    placeholder="e.g., s3://bucket/path, /data/refresh/dataset.csv"
                    className={`w-full px-4 py-2 rounded-lg border ${
                      isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                  <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Location from where this dataset should be refreshed for scheduled reports
                  </p>
                </div>

                {/* File Upload */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    CSV File *
                  </label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className={`w-full px-4 py-2 rounded-lg border ${
                      isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                  {selectedFile && (
                    <p className={`text-xs mt-1 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                      Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setSelectedFile(null);
                    setTargetModelId('');
                  }}
                  className={`flex-1 px-4 py-2 rounded-lg border ${
                    isDark ? 'border-slate-600 hover:bg-slate-700' : 'border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleFileUpload}
                  disabled={!selectedFile || !targetModelId}
                  className={`flex-1 px-4 py-2 rounded-lg ${
                    !selectedFile || !targetModelId
                      ? isDark ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  Upload
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ingest Data Modal */}
      {showIngestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-lg ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
            <div className={`sticky top-0 p-6 border-b ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Ingest Dataset
                </h2>
                <button
                  onClick={() => {
                    setShowIngestModal(false);
                    setIngestFile(null);
                    setIngestDatasetName('');
                    setIngestTargetModelId('');
                    setIngestDatasetType('development');
                    setIngestRefreshLocation('');
                  }}
                  className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Model Selection */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Target Model *
                </label>
                <select
                  value={ingestTargetModelId}
                  onChange={(e) => setIngestTargetModelId(e.target.value)}
                  className={`w-full px-4 py-2 rounded-lg border ${
                    isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="">-- Select Model --</option>
                  {registryModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} v{model.version} | {model.modelType}
                    </option>
                  ))}
                </select>
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Dataset will be linked to this model
                </p>
              </div>

              {/* Dataset File Upload */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  CSV File *
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setIngestFile(e.target.files?.[0] || null)}
                  className={`w-full px-4 py-2 rounded-lg border ${
                    isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
                {ingestFile && (
                  <p className={`text-xs mt-1 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                    ✓ Selected: {ingestFile.name} ({(ingestFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              {/* Dataset Name */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Dataset Name (Optional)
                </label>
                <input
                  type="text"
                  value={ingestDatasetName}
                  onChange={(e) => setIngestDatasetName(e.target.value)}
                  placeholder="Leave blank to use filename"
                  className={`w-full px-4 py-2 rounded-lg border ${
                    isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>

              {/* Dataset Type for Reporting */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Dataset Type for Reporting *
                </label>
                <select
                  value={ingestDatasetType}
                  onChange={(e) => setIngestDatasetType(e.target.value as any)}
                  className={`w-full px-4 py-2 rounded-lg border ${
                    isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="development">Development</option>
                  <option value="baseline">Baseline (Reference for comparison)</option>
                  <option value="reference">Reference (Current production)</option>
                  <option value="monitoring">Monitoring (Ongoing tracking)</option>
                </select>
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Baseline and Reference datasets can be used in Report Configuration
                </p>
              </div>

              {/* Refresh Location */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Refresh Location (Optional)
                </label>
                <input
                  type="text"
                  value={ingestRefreshLocation}
                  onChange={(e) => setIngestRefreshLocation(e.target.value)}
                  placeholder="e.g., s3://bucket/path, /data/refresh/dataset.csv"
                  className={`w-full px-4 py-2 rounded-lg border ${
                    isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                />
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Location from where this dataset should be refreshed for scheduled reports
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowIngestModal(false);
                    setIngestFile(null);
                    setIngestDatasetName('');
                    setIngestTargetModelId('');
                    setIngestDatasetType('development');
                    setIngestRefreshLocation('');
                  }}
                  className={`flex-1 px-4 py-3 rounded-lg font-medium ${
                    isDark
                      ? 'bg-slate-700 hover:bg-slate-600 text-white'
                      : 'bg-slate-200 hover:bg-slate-300 text-slate-900'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!ingestTargetModelId || !ingestFile) {
                      alert('Please select a model and file');
                      return;
                    }

                    const model = registryModels.find(m => m.id === ingestTargetModelId);
                    if (!model) {
                      alert('Selected model not found');
                      return;
                    }

                    // Parse CSV to get shape info
                    const text = await ingestFile.text();
                    const lines = text.split('\n').filter(l => l.trim());
                    const headers = lines[0]?.split(',') || [];

                    // Log creation event FIRST before any state changes
                    const description = getCreationDescription.dataset(
                      ingestDatasetName || ingestFile.name,
                      ingestDatasetType,
                      lines.length - 1,
                      headers.length,
                      model.name
                    );
                    const project = projects.find(p => p.id === model.projectId);
                    if (project) {
                      createWorkflowLog(createCreationLogEntry(
                        project.id,
                        project.name,
                        'Dataset Created',
                        description
                      ));
                    }

                    createIngestionJob({
                      name: ingestDatasetName || ingestFile.name,
                      projectId: model.projectId,
                      modelId: ingestTargetModelId,
                      dataSource: 'csv',
                      datasetType: ingestDatasetType,
                      refreshLocation: ingestRefreshLocation || `/uploads/${ingestFile.name}`,
                      uploadedFile: {
                        name: ingestFile.name,
                        path: `/uploads/${ingestFile.name}`,
                        size: ingestFile.size,
                        type: ingestFile.type,
                      },
                      status: 'completed',
                      outputPath: `/data/${ingestFile.name}`,
                      outputShape: {
                        rows: lines.length - 1,
                        columns: headers.length,
                      },
                      outputColumns: headers.map(h => h.trim()),
                    });

                    setShowIngestModal(false);
                    setIngestFile(null);
                    setIngestDatasetName('');
                    setIngestTargetModelId('');
                    setIngestDatasetType('development');
                    setIngestRefreshLocation('');

                    alert(`✓ Dataset "${ingestDatasetName || ingestFile.name}" ingested successfully as ${ingestDatasetType} dataset!`);
                  }}
                  disabled={!ingestTargetModelId || !ingestFile}
                  className={`flex-1 px-4 py-3 rounded-lg font-medium ${
                    !ingestTargetModelId || !ingestFile
                      ? isDark
                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : isDark
                      ? 'bg-green-600 hover:bg-green-500 text-white'
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  Ingest Dataset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Datasets;
