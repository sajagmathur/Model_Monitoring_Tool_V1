import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useGlobal } from '../contexts/GlobalContext';
import { useNotification } from '../hooks/useNotification';
import { ChevronRight, X, CheckCircle, Filter, Download, FileText, Presentation } from 'lucide-react';
import { SkeletonLoader } from '../components/DashboardWidgets';
import { PortfolioRAGChart } from '../components/charts/PortfolioRAGChart';
import { PortfolioAnalyzer, type ReportItem } from '../components/charts/PortfolioAnalyzer';
import { ChartCommentary, SectionComment } from '../components/ChartCommentary';
import { calculateRAGStatus, type BankingMetrics } from '../utils/bankingMetricsMock';
import { exportDashboard } from '../utils/dashboardExport';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);



const Dashboard: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { showNotification } = useNotification();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    registryModels = [],
    generatedReports = [],
    monitoringJobs = [],
    deploymentJobs = [],
    dataQualityReports = [],
    ingestionJobs = [],
    bankingModels = [],
    bankingMetrics = [],
    loadSampleData,
    syncRegistryModelsToDashboard,
  } = useGlobal();

  const [loading, setLoading] = useState(true);
  const [selectedRAGFilter, setSelectedRAGFilter] = useState<'all' | 'green' | 'amber' | 'red'>('all');
  const [showProjectsBanner, setShowProjectsBanner] = useState(false);
  const [bannerModelId, setBannerModelId] = useState<string>('');
  const [ragComments, setRagComments] = useState<SectionComment[]>([]);
  const [dashboardComments, setDashboardComments] = useState<SectionComment[]>([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportTab, setExportTab] = useState<'pdf' | 'ppt'>('pdf');
  const [exporting, setExporting] = useState(false);
  const [reportItems, setReportItems] = useState<ReportItem[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [tablePage, setTablePage] = useState(1);
  const [tableSearch, setTableSearch] = useState('');

  const [filters, setFilters] = useState({
    businessLine: 'All',
    mlCategory: 'All',
    domain: 'All',
    populationType: 'All',
    model: 'All',
    observationVintage: 'All',
  });

  useEffect(() => {
    if (registryModels.length === 0 && generatedReports.length === 0 && monitoringJobs.length === 0) {
      loadSampleData();
    }
  }, [registryModels.length, generatedReports.length, monitoringJobs.length]);

  useEffect(() => {
    if (registryModels.length > 0) syncRegistryModelsToDashboard();
  }, [registryModels.length]);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const modelIdFromUrl = searchParams.get('modelId');
    const sourceFromUrl = searchParams.get('source');
    if (modelIdFromUrl && bankingModels.length > 0) {
      const matchedModel = bankingModels.find(m => m.model_id === modelIdFromUrl);
      if (matchedModel) {
        if (sourceFromUrl === 'projects') {
          setBannerModelId(modelIdFromUrl);
          setShowProjectsBanner(true);
          showNotification(`Now viewing: ${matchedModel.name} (${matchedModel.portfolio})`, 'success');
          setTimeout(() => setShowProjectsBanner(false), 5000);
        }
        setSearchParams({});
        navigate(`/dashboard/model/${modelIdFromUrl}`);
      }
    }
  }, [bankingModels, searchParams, setSearchParams, showNotification, navigate]);

  useEffect(() => {
    const saved = localStorage.getItem('dashboard_rag_comments');
    if (saved) { try { setRagComments(JSON.parse(saved)); } catch {} }
    const savedDash = localStorage.getItem('dashboard_overall_comments');
    if (savedDash) { try { setDashboardComments(JSON.parse(savedDash)); } catch {} }
  }, []);
  useEffect(() => {
    localStorage.setItem('dashboard_rag_comments', JSON.stringify(ragComments));
  }, [ragComments]);
  useEffect(() => {
    localStorage.setItem('dashboard_overall_comments', JSON.stringify(dashboardComments));
  }, [dashboardComments]);

  const allVintages = useMemo(
    () => [...new Set(bankingMetrics.map(m => m.vintage))].sort().reverse(),
    [bankingMetrics]
  );
  const latestVintage = allVintages[0];

  const filterOptions = useMemo(() => ({
    businessLine:      ['All', 'Retail', 'Commercial', 'Digital', 'Cards', 'Mortgages'],
    mlCategory:        ['All', 'ML-Classification', 'Non-ML-Classification', 'ML-Non-Classification', 'Non-ML-Non-Classification'],
    domain:            ['All', ...Array.from(new Set(bankingModels.map(m => m.domain).filter(Boolean) as string[])).sort()],
    populationType:    ['All', ...Array.from(new Set(bankingModels.map(m => m.populationType).filter(Boolean) as string[])).sort()],
    model:             ['All', ...bankingModels.map(m => m.name)],
    observationVintage:['All', ...allVintages],
  }), [bankingModels, allVintages]);

  const filteredPortfolioModels = useMemo(() => {
    let models = bankingModels;
    if (filters.mlCategory !== 'All')     models = models.filter(m => m.mlCategory === filters.mlCategory);
    if (filters.domain !== 'All')         models = models.filter(m => m.domain === filters.domain);
    if (filters.populationType !== 'All') models = models.filter(m => m.populationType === filters.populationType);
    if (filters.model !== 'All')          models = models.filter(m => m.name === filters.model);
    if (filters.businessLine !== 'All') {
      const blKeywords: Record<string, string[]> = {
        'Retail':    ['Retail', 'Personal', 'Consumer', 'Cards'],
        'Commercial':['Commercial', 'Corporate', 'SME', 'Business'],
        'Digital':   ['Digital', 'Online', 'Mobile'],
        'Cards':     ['Cards', 'Credit Card', 'Card'],
        'Mortgages': ['Mortgage', 'Home Loan', 'Property', 'Real Estate'],
      };
      const patterns = blKeywords[filters.businessLine] ?? [];
      models = models.filter(m =>
        patterns.some(p => m.portfolio.includes(p) || m.model_type.includes(p) || m.name.includes(p))
      );
    }
    return models;
  }, [bankingModels, filters]);

  const portfolioRows = useMemo(() => {
    const vintageFilter = filters.observationVintage !== 'All' ? filters.observationVintage : null;
    return filteredPortfolioModels.map(model => {
      const modelMetrics = bankingMetrics.filter(m => m.model_id === model.model_id);
      const latestV = vintageFilter
        ? (modelMetrics.some(m => m.vintage === vintageFilter) ? vintageFilter : allVintages.find(v => modelMetrics.some(m => m.vintage === v)))
        : allVintages.find(v => modelMetrics.some(m => m.vintage === v));
      const latestM = modelMetrics.find(m => m.vintage === latestV);
      return { model, metric: latestM };
    }).filter(r => r.metric)
      .filter(r => selectedRAGFilter === 'all' || r.metric!.rag_status === selectedRAGFilter);
  }, [filteredPortfolioModels, bankingMetrics, allVintages, selectedRAGFilter, filters.observationVintage]);

  const ragFilteredMetrics = useMemo(() => {
    return filteredPortfolioModels.map(model => {
      const modelMetrics = bankingMetrics.filter(m => m.model_id === model.model_id);
      const latestV = allVintages.find(v => modelMetrics.some(m => m.vintage === v));
      return modelMetrics.find(m => m.vintage === latestV);
    }).filter(Boolean) as BankingMetrics[];
  }, [filteredPortfolioModels, bankingMetrics, allVintages]);

  // ── Pagination & Search ──────────────────────────────────────────────────────
  const PAGE_SIZE = 20;
  const searchedPortfolioRows = useMemo(() => {
    if (!tableSearch.trim()) return portfolioRows;
    const q = tableSearch.toLowerCase();
    return portfolioRows.filter(({ model }) =>
      model.name.toLowerCase().includes(q) ||
      model.model_id.toLowerCase().includes(q) ||
      model.portfolio.toLowerCase().includes(q) ||
      (model.domain ?? '').toLowerCase().includes(q)
    );
  }, [portfolioRows, tableSearch]);
  const totalPages = Math.max(1, Math.ceil(searchedPortfolioRows.length / PAGE_SIZE));
  const pagedPortfolioRows = useMemo(() =>
    searchedPortfolioRows.slice((tablePage - 1) * PAGE_SIZE, tablePage * PAGE_SIZE),
    [searchedPortfolioRows, tablePage]
  );

  // ── Download CSV ──────────────────────────────────────────────────────────────
  const handleDownloadInventory = () => {
    const hdrs = ['Model ID','Model Name','Domain','Population Type','ML Category','Type','Latest Vintage','KS','PSI','AUC','Gini','MAPE','Status'];
    const rows = portfolioRows.map(({ model, metric: m }) => [
      model.model_id, model.name, model.domain ?? '', model.populationType ?? '', model.mlCategory ?? '',
      m!.model_type, m!.vintage,
      m!.metrics.KS?.toFixed(4) ?? '', m!.metrics.PSI?.toFixed(4) ?? '',
      m!.metrics.AUC?.toFixed(4) ?? '', m!.metrics.Gini?.toFixed(4) ?? '',
      m!.metrics.MAPE?.toFixed(4) ?? '', m!.rag_status ?? '',
    ]);
    const csv = [hdrs, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'model_inventory.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const isAnyFilterActive = Object.entries(filters).some(([k, v]) => v !== 'All');

  const BL_KEYWORDS: Record<string, string[]> = {
    Retail: ['Retail','Personal','Consumer','Home','Cards'],
    Commercial: ['Commercial','Corporate','SME','Business','Enterprise'],
    Digital: ['Digital','Online','Mobile'],
    Cards: ['Cards','Credit Card','Card'],
    Mortgages: ['Mortgage','Home Loan','Property','Real Estate'],
  };
  const deriveBusinessLine = (m: { model_type: string; portfolio: string; name: string }) => {
    for (const [bl, kws] of Object.entries(BL_KEYWORDS)) {
      if (kws.some(k => m.portfolio.includes(k) || m.model_type.includes(k) || m.name.includes(k))) return bl;
    }
    return 'Other';
  };

  const metricCell = (val: number | undefined, key: string) => {
    if (val == null) return <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>—</span>;
    const PCT = new Set(['KS','accuracy','precision','recall','f1_score','HRL','bad_rate','MAPE']);
    const disp = PCT.has(key)
      ? (val * 100).toFixed(1) + '%'
      : key === 'PSI' ? val.toFixed(4)
      : val.toFixed(3);
    let color = '';
    if (key === 'KS')      color = val >= 0.35 ? 'text-green-500' : val >= 0.25 ? 'text-amber-500' : 'text-red-500';
    if (key === 'PSI')     color = val < 0.10 ? 'text-green-500' : val < 0.25 ? 'text-amber-500' : 'text-red-500';
    if (key === 'AUC')     color = val >= 0.75 ? 'text-green-500' : val >= 0.65 ? 'text-amber-500' : 'text-red-500';
    if (key === 'Gini')    color = val >= 0.50 ? 'text-green-500' : val >= 0.30 ? 'text-amber-500' : 'text-red-500';
    if (key === 'HRL')     color = val >= 0.70 ? 'text-green-500' : val >= 0.55 ? 'text-amber-500' : 'text-red-500';
    if (key === 'f1_score')color = val >= 0.70 ? 'text-green-500' : val >= 0.50 ? 'text-amber-500' : 'text-red-500';
    if (key === 'accuracy')color = val >= 0.80 ? 'text-green-500' : val >= 0.65 ? 'text-amber-500' : 'text-red-500';
    return <span className={`font-mono text-xs font-semibold ${color || (isDark ? 'text-slate-300' : 'text-slate-700')}`}>{disp}</span>;
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
      {/* Header */}
      <div className={`border-b ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-2 mb-4">
            <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Home</span>
            <ChevronRight size={16} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
            <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Dashboard</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Model Monitoring Dashboard
              </h1>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Real-time health metrics and risk indicators across your model portfolio
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setExportTab('pdf'); setShowExportModal(true); }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm"
              >
                <Download size={16} />
                Export
              </button>
              <button
                onClick={() => loadSampleData()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 text-sm"
                title="Reload sample data"
              >
                ⟳ Reload Data
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Projects Workflow Success Banner */}
      {showProjectsBanner && (() => {
        const model = bankingModels.find(m => m.model_id === bannerModelId);
        return model ? (
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className={`p-4 rounded-lg border flex items-center justify-between ${isDark ? 'bg-green-900/20 border-green-500/30' : 'bg-green-50 border-green-200'}`}>
              <div className="flex items-center gap-3">
                <CheckCircle size={24} className="text-green-500" />
                <div>
                  <p className={`font-semibold ${isDark ? 'text-green-400' : 'text-green-700'}`}>Successfully loaded from Projects workflow</p>
                  <p className={`text-sm ${isDark ? 'text-green-300/70' : 'text-green-600'}`}>Now viewing: <span className="font-medium">{model.name}</span> ({model.portfolio})</p>
                </div>
              </div>
              <button onClick={() => setShowProjectsBanner(false)} className={`p-1 rounded hover:bg-green-500/10 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                <X size={20} />
              </button>
            </div>
          </div>
        ) : null;
      })()}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* Filter Bar */}
        <div className={`p-4 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Filter size={15} className={isDark ? 'text-slate-400' : 'text-slate-500'} />
              <span className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Filters</span>
            </div>
            <div className={`h-5 w-px ${isDark ? 'bg-slate-600' : 'bg-slate-300'}`} />
            {(
              [
                { key: 'businessLine',     label: 'Product',             opts: filterOptions.businessLine     },
                { key: 'mlCategory',       label: 'Model Type',           opts: filterOptions.mlCategory       },
                { key: 'domain',           label: 'Domain',               opts: filterOptions.domain           },
                { key: 'populationType',   label: 'Population Type',      opts: filterOptions.populationType   },
                { key: 'model',            label: 'Model',                opts: filterOptions.model            },
                { key: 'observationVintage', label: 'Observation Vintage', opts: filterOptions.observationVintage },
              ] as const
            ).map(({ key, label, opts }) => (
              <div key={key} className="flex items-center gap-1.5">
                <label className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{label}:</label>
                <select
                  value={filters[key]}
                  onChange={e => setFilters(prev => ({ ...prev, [key]: e.target.value }))}
                  className={`text-xs px-2 py-1.5 rounded border min-w-[110px] ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                >
                  {opts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
            {isAnyFilterActive && (
              <button
                onClick={() => setFilters({ businessLine: 'All', mlCategory: 'All', domain: 'All', populationType: 'All', model: 'All', observationVintage: 'All' })}
                className={`ml-auto text-xs underline ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
              >
                Clear filters
              </button>
            )}
          </div>
          {isAnyFilterActive && (
            <div className="flex flex-wrap gap-2 mt-3">
              {Object.entries(filters).filter(([, v]) => v !== 'All').map(([k, v]) => (
                <span key={k} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-blue-900/40 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
                  {v}
                  <button onClick={() => setFilters(prev => ({ ...prev, [k]: 'All' }))} className="ml-0.5 hover:opacity-70">x</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <SkeletonLoader count={6} isDark={isDark} variant="card" />
        ) : (
          <>
            {/* ── Portfolio RAG Status (side-by-side: pie + table) ── */}
            <div id="export-rag-status" className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Portfolio RAG Status Distribution
                </h3>
                {selectedRAGFilter !== 'all' && (
                  <button onClick={() => setSelectedRAGFilter('all')} className="text-sm text-blue-600 hover:text-blue-700 underline">
                    Clear RAG filter (showing: {selectedRAGFilter})
                  </button>
                )}
              </div>
              <div className="flex flex-col lg:flex-row gap-6 items-start">
                <div style={{ height: '280px', flex: '0 0 280px', minWidth: 0 }}>
                  <PortfolioRAGChart
                    metrics={ragFilteredMetrics}
                    onRAGClick={(ragStatus) => setSelectedRAGFilter(ragStatus)}
                  />
                </div>
                <div className="flex-1 overflow-auto self-center">
                  <table className="w-full min-w-[280px]">
                    <thead className={`${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                      <tr>
                        <th className={`px-4 py-2 text-left text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>RAG Status</th>
                        <th className={`px-4 py-2 text-left text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Model Count</th>
                        <th className={`px-4 py-2 text-left text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Percentage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(['green','amber','red'] as const).map(status => {
                        const count = ragFilteredMetrics.filter(m => m.rag_status === status).length;
                        const pct = ragFilteredMetrics.length > 0 ? ((count / ragFilteredMetrics.length) * 100).toFixed(1) : '0.0';
                        return (
                          <tr key={status} className={isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}>
                            <td className={`px-4 py-3 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                              <span className="inline-flex items-center gap-2">
                                <span className={`w-3 h-3 rounded-full ${status==='green'?'bg-green-500':status==='amber'?'bg-amber-500':'bg-red-500'}`} />
                                {status.charAt(0).toUpperCase()+status.slice(1)}
                              </span>
                            </td>
                            <td className={`px-4 py-3 font-semibold ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{count}</td>
                            <td className={`px-4 py-3 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{pct}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <ChartCommentary
                sectionId="ragStatus"
                sectionLabel="Portfolio RAG Status"
                comments={ragComments}
                onAdd={c => setRagComments(prev => [...prev, c])}
                onDelete={id => setRagComments(prev => prev.filter(c => c.id !== id))}
                isDark={isDark}
                aiSuggestion={`Portfolio RAG Summary: ${ragFilteredMetrics.filter(m => m.rag_status === 'green').length} Green, ${ragFilteredMetrics.filter(m => m.rag_status === 'amber').length} Amber, ${ragFilteredMetrics.filter(m => m.rag_status === 'red').length} Red out of ${ragFilteredMetrics.length} models. ${ragFilteredMetrics.filter(m => m.rag_status === 'red').length > 0 ? 'ACTION: Red status models require immediate review.' : ragFilteredMetrics.filter(m => m.rag_status === 'amber').length > 0 ? 'ATTENTION: Amber models should be monitored closely.' : 'Portfolio is healthy — all models within thresholds.'}`}
              />
            </div>

            {/* ── Model Portfolio Overview ── */}
            <div className={`p-4 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Model Portfolio Overview
                  </h2>
                  {/* Performance Type tooltip */}
                  <div className="relative group">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border cursor-help ${isDark ? 'bg-slate-700 border-slate-600 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-600'}`}>
                      Full Performance ℹ
                    </span>
                    <div className={`absolute left-0 top-full mt-1 z-20 w-64 p-3 rounded-lg shadow-lg text-xs hidden group-hover:block ${isDark ? 'bg-slate-700 border border-slate-600 text-slate-200' : 'bg-white border border-slate-200 text-slate-700'}`}>
                      <p className="font-semibold mb-1">Performance Type: Full Performance</p>
                      <p>Metrics are computed across the full population for the selected Observation Vintage, reflecting overall model health without segment filtering.</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="text"
                    placeholder="Search model…"
                    value={tableSearch}
                    onChange={e => { setTableSearch(e.target.value); setTablePage(1); }}
                    className={`text-xs px-3 py-1.5 rounded border w-44 ${isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'}`}
                  />
                  <button
                    onClick={handleDownloadInventory}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded border bg-green-600 hover:bg-green-700 text-white border-green-600"
                    title="Download model inventory as CSV"
                  >
                    <Download size={13} /> Download Inventory
                  </button>
                  <span className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                    {searchedPortfolioRows.length} model{searchedPortfolioRows.length !== 1 ? 's' : ''}{isAnyFilterActive ? ' (filtered)' : ''}
                  </span>
                </div>
              </div>

              {portfolioRows.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className={`${isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-700'}`}>
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold whitespace-nowrap sticky left-0 z-10" style={{background: isDark ? '#334155' : '#f1f5f9'}}>Model ID</th>
                          <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Model Name</th>
                          <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Product</th>
                          <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Domain</th>
                          <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Population Type</th>
                          <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Type</th>
                          <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Latest Vintage</th>
                          <th className="px-3 py-2 text-right font-semibold">KS</th>
                          <th className="px-3 py-2 text-right font-semibold">PSI</th>
                          <th className="px-3 py-2 text-right font-semibold">AUC</th>
                          <th className="px-3 py-2 text-right font-semibold">Gini</th>
                          <th className="px-3 py-2 text-right font-semibold">MAPE</th>
                          <th className="px-3 py-2 text-right font-semibold">Accuracy</th>
                          <th className="px-3 py-2 text-right font-semibold">Precision</th>
                          <th className="px-3 py-2 text-right font-semibold">Recall</th>
                          <th className="px-3 py-2 text-right font-semibold">F1</th>
                          <th className="px-3 py-2 text-right font-semibold">HRL</th>
                          <th className="px-3 py-2 text-center font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedPortfolioRows.map(({ model, metric: m }) => {
                          const bl = deriveBusinessLine({ model_type: model.model_type, portfolio: model.portfolio, name: model.name });
                          return (
                            <tr
                              key={model.model_id}
                              className={`border-b ${isDark ? 'border-slate-700 hover:bg-slate-700/50' : 'border-slate-100 hover:bg-slate-50'}`}
                            >
                              <td className={`px-3 py-2 font-mono text-xs font-semibold sticky left-0 ${isDark ? 'text-blue-300 bg-slate-800' : 'text-blue-700 bg-white'}`}>
                                {model.model_id}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                <button
                                  onClick={() => window.open(`${import.meta.env.BASE_URL}dashboard/model/${model.model_id}`, '_blank', 'noopener,noreferrer')}
                                  className={`font-medium hover:underline text-left ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-700 hover:text-blue-800'}`}
                                >
                                  {model.name}
                                </button>
                              </td>
                              <td className="px-3 py-2">
                                <button
                                  onClick={() => setFilters(prev => ({ ...prev, businessLine: bl }))}
                                  className={`text-xs px-1.5 py-0.5 rounded-full font-medium border transition-colors ${
                                    filters.businessLine === bl
                                      ? 'bg-blue-600 text-white border-blue-600'
                                      : isDark ? 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                                  }`}
                                >{bl}</button>
                              </td>
                              <td className={`px-3 py-2 text-xs whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                {model.domain ?? '—'}
                              </td>
                              <td className={`px-3 py-2 text-xs whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                {model.populationType ?? '—'}
                              </td>
                              <td className={`px-3 py-2 text-xs whitespace-nowrap ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{m!.model_type}</td>
                              <td className={`px-3 py-2 font-mono text-xs whitespace-nowrap ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{m!.vintage}</td>
                              <td className="px-3 py-2 text-right">{metricCell(m!.metrics.KS, 'KS')}</td>
                              <td className="px-3 py-2 text-right">{metricCell(m!.metrics.PSI, 'PSI')}</td>
                              <td className="px-3 py-2 text-right">{metricCell(m!.metrics.AUC, 'AUC')}</td>
                              <td className="px-3 py-2 text-right">{metricCell(m!.metrics.Gini, 'Gini')}</td>
                              <td className="px-3 py-2 text-right">{metricCell(m!.metrics.MAPE, 'MAPE')}</td>
                              <td className="px-3 py-2 text-right">{metricCell(m!.metrics.accuracy, 'accuracy')}</td>
                              <td className="px-3 py-2 text-right">{metricCell(m!.metrics.precision, 'precision')}</td>
                              <td className="px-3 py-2 text-right">{metricCell(m!.metrics.recall, 'recall')}</td>
                              <td className="px-3 py-2 text-right">{metricCell(m!.metrics.f1_score, 'f1_score')}</td>
                              <td className="px-3 py-2 text-right">{metricCell(m!.metrics.HRL, 'HRL')}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                  m!.rag_status === 'green' ? 'bg-green-100 text-green-700'
                                  : m!.rag_status === 'amber' ? 'bg-amber-100 text-amber-700'
                                  : 'bg-red-100 text-red-700'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${m!.rag_status === 'green' ? 'bg-green-500' : m!.rag_status === 'amber' ? 'bg-amber-500' : 'bg-red-500'}`} />
                                  {m!.rag_status?.toUpperCase() ?? '–'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination */}
                  <div className="flex items-center justify-between mt-3 px-1">
                    <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Page {tablePage} of {totalPages} · {searchedPortfolioRows.length} model{searchedPortfolioRows.length !== 1 ? 's' : ''}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTablePage(p => Math.max(1, p - 1))}
                        disabled={tablePage === 1}
                        className={`px-3 py-1 rounded text-xs border disabled:opacity-40 ${isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}
                      >← Prev</button>
                      <button
                        onClick={() => setTablePage(p => Math.min(totalPages, p + 1))}
                        disabled={tablePage === totalPages}
                        className={`px-3 py-1 rounded text-xs border disabled:opacity-40 ${isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}
                      >Next →</button>
                    </div>
                  </div>
                </>
              ) : (
                <div className={`text-center py-10 rounded-lg border-2 border-dashed ${isDark ? 'border-slate-600 text-slate-400' : 'border-slate-300 text-slate-500'}`}>
                  {bankingModels.length === 0
                    ? 'No models available. Click "Reload Data" to load sample portfolio.'
                    : 'No models match the current filters.'}
                </div>
              )}
            </div>

            {/* ── Portfolio Analyzer ── */}
            <div>
              <div className={`flex items-center gap-2 mb-3`}>
                <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  📊 Portfolio Analysis
                </h2>
                <span className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                  14 analysis types · ranking, comparison, scatter, bubble, heatmap, correlation, trend & more
                </span>
              </div>
              <PortfolioAnalyzer
                models={filteredPortfolioModels}
                metrics={bankingMetrics}
                isDark={isDark}
                onAddToReport={item => setReportItems(prev => [...prev, item])}
              />
            </div>

            {/* ── Dashboard Commentary ── */}
            <div className={`p-6 rounded-lg border-2 ${isDark ? 'bg-slate-800 border-indigo-700/40' : 'bg-indigo-50 border-indigo-200'}`}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">📝</span>
                <div>
                  <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Dashboard Commentary
                  </h3>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Portfolio-level observations and escalation notes
                  </p>
                </div>
              </div>
              <ChartCommentary
                sectionId="dashboardOverall"
                sectionLabel="Dashboard — Portfolio Level"
                comments={dashboardComments}
                onAdd={c => setDashboardComments(prev => [...prev, c])}
                onDelete={id => setDashboardComments(prev => prev.filter(c => c.id !== id))}
                isDark={isDark}
                aiSuggestion={`Portfolio Overview — ${new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}. Total models monitored: ${ragFilteredMetrics.length}. RAG distribution: ${ragFilteredMetrics.filter(m => m.rag_status === 'green').length} Green (${ragFilteredMetrics.length ? ((ragFilteredMetrics.filter(m => m.rag_status === 'green').length / ragFilteredMetrics.length) * 100).toFixed(0) : 0}%), ${ragFilteredMetrics.filter(m => m.rag_status === 'amber').length} Amber (${ragFilteredMetrics.length ? ((ragFilteredMetrics.filter(m => m.rag_status === 'amber').length / ragFilteredMetrics.length) * 100).toFixed(0) : 0}%), ${ragFilteredMetrics.filter(m => m.rag_status === 'red').length} Red (${ragFilteredMetrics.length ? ((ragFilteredMetrics.filter(m => m.rag_status === 'red').length / ragFilteredMetrics.length) * 100).toFixed(0) : 0}%). ${isAnyFilterActive ? `Note: Dashboard is currently filtered (${Object.entries(filters).filter(([k,v]) => k !== 'timeWindow' ? v !== 'All' : v !== 'Last 30 Days').map(([k,v]) => v).join(', ')}).` : ''} Recommend scheduling model owner review for all Amber and Red models within 5 business days.`}
              />
            </div>
          </>
        )}
      </div>

      {/* ── Floating Report Badge ── */}
      {reportItems.length > 0 && (
        <button
          onClick={() => setShowReportModal(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 text-sm font-semibold"
        >
          📋 Report ({reportItems.length})
        </button>
      )}

      {/* ── Report Builder Modal ── */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className={`${isDark?'bg-slate-800':'bg-white'} rounded-xl p-6 max-w-2xl w-full mx-4 shadow-2xl max-h-[85vh] flex flex-col`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className={`text-xl font-bold ${isDark?'text-white':'text-slate-900'}`}>📋 Analytics Report ({reportItems.length} snapshot{reportItems.length!==1?'s':''})</h3>
              <button onClick={() => setShowReportModal(false)} className={isDark?'text-slate-400 hover:text-white':'text-slate-500 hover:text-slate-900'}><X size={22}/></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 mb-4">
              {reportItems.map((item, idx) => (
                <div key={item.id} className={`flex items-start gap-3 p-3 rounded-lg border ${isDark?'bg-slate-700/50 border-slate-600':'bg-slate-50 border-slate-200'}`}>
                  {item.chartBase64 && <img src={item.chartBase64} alt={item.label} className="w-28 h-16 object-cover rounded border" />}
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm ${isDark?'text-white':'text-slate-900'}`}>{item.label}</p>
                    <p className={`text-xs mt-0.5 ${isDark?'text-slate-400':'text-slate-500'}`}>{item.timestamp}</p>
                    <p className={`text-xs mt-1 line-clamp-2 ${isDark?'text-slate-300':'text-slate-600'}`}>{item.aiSummary}</p>
                  </div>
                  <button onClick={() => setReportItems(prev => prev.filter((_,i) => i!==idx))} className={`text-xs px-2 py-1 rounded ${isDark?'text-slate-400 hover:bg-slate-600':'text-slate-400 hover:bg-slate-200'}`}><X size={14}/></button>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setReportItems([])} className={`px-4 py-2 rounded-lg text-sm ${isDark?'bg-slate-700 text-slate-300 hover:bg-slate-600':'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>Clear All</button>
              <button
                onClick={async () => {
                  const { default: jsPDF } = await import('jspdf');
                  const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
                  reportItems.forEach((item, idx) => {
                    if (idx > 0) doc.addPage();
                    doc.setFontSize(14); doc.text(item.label, 14, 18);
                    doc.setFontSize(8);  doc.text(item.aiSummary, 14, 26, { maxWidth: 268 });
                    if (item.chartBase64) doc.addImage(item.chartBase64, 'PNG', 14, 40, 268, 120);
                    doc.setFontSize(7); doc.text(`Generated: ${item.timestamp}`, 14, 168);
                  });
                  doc.save(`analytics_report_${new Date().toISOString().slice(0,10)}.pdf`);
                  showNotification('Analytics report exported!', 'success');
                  setShowReportModal(false);
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-medium"
              >Export PDF Report</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Export Modal ── */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-lg p-6 max-w-md w-full mx-4 shadow-xl`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Export Dashboard</h3>
              <button onClick={() => setShowExportModal(false)} className={isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'}>
                <X size={24} />
              </button>
            </div>
            <div className={`flex border-b mb-5 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              {([
                { id: 'pdf' as const, label: 'PDF', icon: <FileText size={14} className="mr-1" /> },
                { id: 'ppt' as const, label: 'PowerPoint', icon: <Presentation size={14} className="mr-1" /> },
              ]).map(t => (
                <button
                  key={t.id}
                  onClick={() => setExportTab(t.id)}
                  className={`flex items-center px-4 py-2 text-sm font-medium border-b-2 transition-colors ${exportTab === t.id ? 'border-blue-600 text-blue-600' : `border-transparent ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'}`}`}
                >
                  {t.icon}{t.label}
                </button>
              ))}
            </div>
            <p className={`text-sm mb-5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Export the Portfolio Overview and RAG Status for {portfolioRows.length} model{portfolioRows.length !== 1 ? 's' : ''}{isAnyFilterActive ? ' (filtered)' : ''}.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowExportModal(false)}
                className={`flex-1 px-4 py-2 rounded-lg ${isDark ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' : 'bg-slate-200 text-slate-800 hover:bg-slate-300'}`}
              >Cancel</button>
              <button
                onClick={async () => {
                  setExporting(true);
                  try {
                    const allComments: Record<string, any[]> = {
                      ragStatus: ragComments,
                      dashboardOverall: dashboardComments,
                    };
                    await exportDashboard({
                      format: exportTab,
                      modelMetrics: ragFilteredMetrics,
                      comments: allComments,
                      includeComments: true,
                      includeSections: { kpis: false, ragStatus: true, trends: false, segments: false, volumeBadRate: false, variables: false },
                    });
                    setShowExportModal(false);
                    showNotification('Dashboard exported successfully!', 'success');
                  } catch (err) {
                    console.error('Export error:', err);
                    showNotification('Export failed. Please try again.', 'error');
                  } finally {
                    setExporting(false);
                  }
                }}
                disabled={exporting}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center justify-center gap-2 disabled:bg-gray-400"
              >
                {exporting
                  ? <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />Exporting…</>
                  : <><Download size={16} />Export {exportTab.toUpperCase()}</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
