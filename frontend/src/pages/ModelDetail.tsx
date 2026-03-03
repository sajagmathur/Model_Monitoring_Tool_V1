import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useGlobal } from '../contexts/GlobalContext';
import { useNotification } from '../hooks/useNotification';
import {
  ArrowLeft, Download, FileText, Presentation, X, ChevronDown, ChevronRight,
} from 'lucide-react';
import { exportDashboard } from '../utils/dashboardExport';
import { BankingMetricsTrendChart } from '../components/charts/BankingMetricsTrendChart';
import { SegmentComparisonChart } from '../components/charts/SegmentComparisonChart';
import { VariableStabilityTable } from '../components/charts/VariableStabilityTable';
import { VolumeVsBadRateChart } from '../components/charts/VolumeVsBadRateChart';
import { ChartCommentary, SectionComment } from '../components/ChartCommentary';
import {
  generateSegmentMetrics,
  generateVariableStability,
  generateScoreBandData,
  generateBaselineMetrics,
  calculateRAGStatus,
  type BankingMetrics,
} from '../utils/bankingMetricsMock';
import ROBChart from '../components/charts/ROBChart';
import ConfusionMatrixChart from '../components/charts/ConfusionMatrixChart';
import VariableLevelChart from '../components/charts/VariableLevelChart';
import { METRIC_DESCRIPTIONS, DEFAULT_SELECTED_METRICS } from '../utils/metricDescriptions';
import { exportDashboardToExcel } from '../utils/excelExport';

const AVAILABLE_DASHBOARD_METRICS = [
  'volume_bad_rate', 'KS', 'PSI', 'AUC', 'Gini', 'bad_rate', 'CA_at_10', 'change_in_KS',
  'accuracy', 'precision', 'recall', 'f1_score', 'HRL', 'ROB', 'ConfusionMatrix',
];

const PCT_METRICS = new Set(['KS', 'accuracy', 'precision', 'recall', 'f1_score', 'HRL', 'bad_rate']);
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

const ModelDetail: React.FC = () => {
  const { modelId } = useParams<{ modelId: string }>();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { showNotification } = useNotification();
  const {
    bankingModels = [],
    bankingMetrics = [],
    loadSampleData,
  } = useGlobal();

  const selectedBankingModel = modelId ?? '';

  // ── Controls state ──────────────────────────────────────────────────────────
  const [selectedSegment, setSelectedSegment] = useState<'all' | 'thin_file' | 'thick_file'>('all');
  const [compareMode, setCompareMode] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<'training' | 'monitoring'>('monitoring');
  const [baselineDataset, setBaselineDataset] = useState<'training' | 'monitoring'>('training');
  const [currentDataset, setCurrentDataset] = useState<'training' | 'monitoring'>('monitoring');
  const [volumeDisplayMode, setVolumeDisplayMode] = useState<'quarterly' | 'scorebands'>('quarterly');
  const [selectedVintages, setSelectedVintages] = useState<string[]>([]);
  const [selectedVariable, setSelectedVariable] = useState<string>('');

  const [viewModes, setViewModes] = useState<{
    trends: 'chart' | 'table';
    segments: 'chart' | 'table';
    volumeBadRate: 'chart' | 'table';
    variables: 'chart' | 'table';
    rob: 'chart' | 'table';
    confusionMatrix: 'chart' | 'table';
  }>({
    trends: 'chart',
    segments: 'chart',
    volumeBadRate: 'chart',
    variables: 'table',
    rob: 'chart',
    confusionMatrix: 'chart',
  });

  // ── Export state ────────────────────────────────────────────────────────────
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportSections, setExportSections] = useState({
    kpis: true,
    ragStatus: true,
    trends: true,
    rob: true,
    confusionMatrix: true,
    segments: true,
    volumeBadRate: true,
    variables: true,
    includeComments: true,
  });
  const [exporting, setExporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportTab, setExportTab] = useState<'pdf' | 'ppt' | 'excel'>('pdf');
  const [exportKPIs, setExportKPIs] = useState<string[]>(['KS', 'PSI', 'AUC', 'Gini', 'bad_rate', 'HRL']);

  // ── Metric selector ─────────────────────────────────────────────────────────
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(DEFAULT_SELECTED_METRICS);
  const [metricDropdownOpen, setMetricDropdownOpen] = useState(false);
  const [tooltipMetric, setTooltipMetric] = useState<string | null>(null);
  const [segmentSelectedMetric, setSegmentSelectedMetric] = useState<string>('KS');

  const swapMetric = (idx: number, dir: -1 | 1) =>
    setSelectedMetrics(prev => {
      const arr = [...prev]; const ti = idx + dir;
      if (ti < 0 || ti >= arr.length) return arr;
      [arr[idx], arr[ti]] = [arr[ti], arr[idx]]; return arr;
    });

  // ── Comments ─────────────────────────────────────────────────────────────────
  const [chartComments, setChartComments] = useState<Record<string, SectionComment[]>>({});

  useEffect(() => {
    if (!selectedBankingModel) return;
    const saved = localStorage.getItem(`dashboard_comments_${selectedBankingModel}`);
    if (saved) {
      try { setChartComments(JSON.parse(saved)); } catch { setChartComments({}); }
    } else {
      setChartComments({});
    }
  }, [selectedBankingModel]);

  useEffect(() => {
    if (!selectedBankingModel) return;
    localStorage.setItem(`dashboard_comments_${selectedBankingModel}`, JSON.stringify(chartComments));
  }, [chartComments, selectedBankingModel]);

  const handleAddComment = (sectionId: string, comment: SectionComment) => {
    setChartComments(prev => ({ ...prev, [sectionId]: [...(prev[sectionId] ?? []), comment] }));
  };
  const handleDeleteComment = (sectionId: string, id: string) => {
    setChartComments(prev => ({ ...prev, [sectionId]: (prev[sectionId] ?? []).filter(c => c.id !== id) }));
  };

  // Auto-reset segment when compare mode activates
  useEffect(() => {
    if (compareMode) setSelectedSegment('all');
  }, [compareMode]);

  // Ensure sample data is loaded
  useEffect(() => {
    if (bankingModels.length === 0) loadSampleData();
  }, [bankingModels.length]);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const thinFileRawMetrics = useMemo((): BankingMetrics[] => {
    if (!selectedBankingModel) return [];
    return bankingMetrics.filter(m => m.model_id === selectedBankingModel && m.segment === 'thin_file');
  }, [bankingMetrics, selectedBankingModel]);

  const thickFileRawMetrics = useMemo((): BankingMetrics[] => {
    if (!selectedBankingModel) return [];
    return bankingMetrics.filter(m => m.model_id === selectedBankingModel && m.segment === 'thick_file');
  }, [bankingMetrics, selectedBankingModel]);

  const hasDualSegmentData = thinFileRawMetrics.length > 0 && thickFileRawMetrics.length > 0;
  const isDualSegmentMode = selectedSegment === 'all' && hasDualSegmentData;
  // Segment display labels: internal ids kept, UI labels renamed
  const segmentLabel = selectedSegment === 'thin_file' ? 'Current'
    : selectedSegment === 'thick_file' ? 'Delinquent'
    : undefined;

  const segmentFilteredMetrics = useMemo((): BankingMetrics[] => {
    if (!selectedBankingModel) return [];
    const allModelMetrics = bankingMetrics.filter(m => m.model_id === selectedBankingModel);
    if (selectedSegment === 'all') {
      const thinM = allModelMetrics.filter(m => m.segment === 'thin_file');
      const thickM = allModelMetrics.filter(m => m.segment === 'thick_file');
      const unseg = allModelMetrics.filter(m => !m.segment);
      if (thinM.length > 0 && thickM.length > 0) {
        const vintages = [...new Set(allModelMetrics.map(m => m.vintage))].sort();
        return vintages.map(vintage => {
          const thin = thinM.find(m => m.vintage === vintage);
          const thick = thickM.find(m => m.vintage === vintage);
          if (!thin && !thick) return null as any;
          if (!thin) return thick!;
          if (!thick) return thin!;
          const totalVol = thin.volume + thick.volume;
          const wt = thin.volume / totalVol;
          const wk = thick.volume / totalVol;
          const wavg = (a?: number, b?: number) =>
            a !== undefined && b !== undefined ? a * wt + b * wk : (a ?? b);
          return {
            ...thin,
            segment: undefined,
            volume: totalVol,
            metrics: {
              KS:        wavg(thin.metrics.KS,        thick.metrics.KS),
              PSI:       wavg(thin.metrics.PSI,       thick.metrics.PSI),
              AUC:       wavg(thin.metrics.AUC,       thick.metrics.AUC),
              Gini:      wavg(thin.metrics.Gini,      thick.metrics.Gini),
              bad_rate:  wavg(thin.metrics.bad_rate,  thick.metrics.bad_rate),
              CA_at_10:  wavg(thin.metrics.CA_at_10,  thick.metrics.CA_at_10),
              accuracy:  wavg(thin.metrics.accuracy,  thick.metrics.accuracy),
              precision: wavg(thin.metrics.precision, thick.metrics.precision),
              recall:    wavg(thin.metrics.recall,    thick.metrics.recall),
              f1_score:  wavg(thin.metrics.f1_score,  thick.metrics.f1_score),
              HRL:       wavg(thin.metrics.HRL,       thick.metrics.HRL),
            },
            rag_status: calculateRAGStatus(
              wavg(thin.metrics.KS, thick.metrics.KS),
              wavg(thin.metrics.PSI, thick.metrics.PSI)
            ),
          } as BankingMetrics;
        }).filter(Boolean);
      }
      return unseg.length > 0 ? unseg : allModelMetrics;
    }
    const filtered = allModelMetrics.filter(m => m.segment === selectedSegment);
    if (filtered.length > 0) return filtered;
    const unsegmentedFallback = allModelMetrics.filter(m => !m.segment);
    return unsegmentedFallback.length > 0 ? unsegmentedFallback : [];
  }, [selectedBankingModel, bankingMetrics, selectedSegment]);

  const baselineFilteredMetrics = useMemo((): BankingMetrics[] => {
    if (!compareMode || !selectedBankingModel) return [];
    const selectedModel = bankingModels.find(m => m.model_id === selectedBankingModel);
    if (!selectedModel) return [];
    const seg = selectedSegment !== 'all' ? selectedSegment : undefined;
    return generateBaselineMetrics(selectedModel, seg);
  }, [compareMode, selectedBankingModel, selectedSegment, bankingModels]);

  const currentModeMetrics = useMemo((): BankingMetrics[] => {
    if (!compareMode && selectedDataset === 'training') {
      const selectedModel = bankingModels.find(m => m.model_id === selectedBankingModel);
      if (!selectedModel) return [];
      const seg = selectedSegment !== 'all' ? selectedSegment : undefined;
      return generateBaselineMetrics(selectedModel, seg);
    }
    return segmentFilteredMetrics;
  }, [compareMode, selectedDataset, selectedBankingModel, selectedSegment, bankingModels, segmentFilteredMetrics]);

  const thinFileBaselineM = useMemo((): BankingMetrics[] => {
    if (!compareMode || !selectedBankingModel) return [];
    const model = bankingModels.find(m => m.model_id === selectedBankingModel);
    if (!model) return [];
    return generateBaselineMetrics(model, 'thin_file');
  }, [compareMode, selectedBankingModel, bankingModels]);

  const thickFileBaselineM = useMemo((): BankingMetrics[] => {
    if (!compareMode || !selectedBankingModel) return [];
    const model = bankingModels.find(m => m.model_id === selectedBankingModel);
    if (!model) return [];
    return generateBaselineMetrics(model, 'thick_file');
  }, [compareMode, selectedBankingModel, bankingModels]);

  // Latest vintage across all metrics (for segment/variable lookups)
  const latestVintageOverall = useMemo(() => {
    const allVintages = [...new Set(bankingMetrics.map(m => m.vintage))].sort().reverse();
    return allVintages[0] ?? '2024-12';
  }, [bankingMetrics]);

  // Reference vintage = earliest vintage for this model (used as training baseline)
  const referenceVintage = useMemo(() => {
    const modelVins = [...new Set(
      bankingMetrics.filter(m => m.model_id === selectedBankingModel).map(m => m.vintage)
    )].sort();
    return modelVins[0] ?? latestVintageOverall;
  }, [bankingMetrics, selectedBankingModel, latestVintageOverall]);

  // ── If model not found, redirect back ────────────────────────────────────────
  const selectedModel = bankingModels.find(m => m.model_id === selectedBankingModel);

  if (!selectedModel && bankingModels.length > 0) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-6 ${isDark ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'}`}>
        <p className="text-lg font-semibold">Model not found: {modelId}</p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const modelMetrics = currentModeMetrics;
  const filteredByVintage = selectedVintages.length > 0
    ? modelMetrics.filter(m => selectedVintages.includes(m.vintage))
    : modelMetrics;
  const thinFiltered = selectedVintages.length > 0
    ? thinFileRawMetrics.filter(m => selectedVintages.includes(m.vintage))
    : thinFileRawMetrics;
  const thickFiltered = selectedVintages.length > 0
    ? thickFileRawMetrics.filter(m => selectedVintages.includes(m.vintage))
    : thickFileRawMetrics;

  const showDual = !compareMode && isDualSegmentMode;
  const cProps = {
    metrics: compareMode ? filteredByVintage : filteredByVintage,
    thinFileMetrics: showDual ? thinFiltered : undefined,
    thickFileMetrics: showDual ? thickFiltered : undefined,
    thinFileBaselineMetrics: undefined,
    thickFileBaselineMetrics: undefined,
    baselineMetrics: compareMode && baselineFilteredMetrics.length > 0
      ? baselineFilteredMetrics
      : undefined,
    segmentLabel,
    currentLabel: compareMode ? 'Current (Monitoring)' : undefined,
    baselineLabel: compareMode ? 'Baseline (Training)' : undefined,
  };

  const latestMetric = [...modelMetrics].sort((a, b) => b.vintage.localeCompare(a.vintage))[0];
  const availVintages = [...new Set(modelMetrics.map(m => m.vintage))].sort();

  // Reference KS and Change-in-KS data for trend chart
  const referenceKSValue = useMemo(() => {
    const refM = bankingMetrics.find(m => m.model_id === selectedBankingModel && m.vintage === referenceVintage && !m.segment);
    return refM?.metrics.KS;
  }, [bankingMetrics, selectedBankingModel, referenceVintage]);

  const changeInKSMetrics = useMemo((): BankingMetrics[] => {
    if (referenceKSValue === undefined || referenceKSValue === 0) return [];
    const unsegMetrics = bankingMetrics.filter(m => m.model_id === selectedBankingModel && !m.segment);
    return unsegMetrics.map(m => ({
      ...m,
      metrics: { ...(m.metrics as any), change_in_KS: m.metrics.KS !== undefined ? (m.metrics.KS - referenceKSValue) / referenceKSValue * 100 : undefined },
    })) as BankingMetrics[];
  }, [bankingMetrics, selectedBankingModel, referenceKSValue]);

  // Segment/Volume data
  const currentDatasetType = compareMode ? currentDataset : selectedDataset;
  const segmentData = generateSegmentMetrics(selectedBankingModel, latestVintageOverall, currentDatasetType);
  const baselineSegDataForChart = compareMode
    ? generateSegmentMetrics(selectedBankingModel, latestVintageOverall, baselineDataset)
    : undefined;

  // ── Volume vs Bad Rate data ──────────────────────────────────────────────────
  // In quarterly mode: derive directly from the same BankingMetrics data that drives
  // all other trend charts (filteredByVintage etc.) so vintage selection is always in sync.
  // In scorebands mode: use score-band generator (bands have no vintage concept).

  /** Convert a BankingMetrics array (sorted by vintage) → VolumeDataPoint array */
  const metricsToVolData = (arr: typeof filteredByVintage) =>
    [...arr]
      .sort((a, b) => a.vintage.localeCompare(b.vintage))
      .map(d => ({ label: d.vintage, volume: d.volume, badRate: d.metrics.bad_rate ?? 0 }));

  // Monitoring data
  const volumeData = volumeDisplayMode === 'quarterly'
    ? metricsToVolData(filteredByVintage)
    : generateScoreBandData(selectedBankingModel, selectedSegment, currentDatasetType)
        .map(d => ({ label: d.shortLabel, volume: d.volume, badRate: d.badRate }));

  // Thin / thick file data for All Segments dual mode (only used when NOT in compare mode)
  const thinFileVolumeData = (!compareMode && selectedSegment === 'all')
    ? (volumeDisplayMode === 'quarterly'
        ? metricsToVolData(thinFiltered)
        : generateScoreBandData(selectedBankingModel, 'thin_file', currentDatasetType)
            .map(d => ({ label: d.shortLabel, volume: d.volume, badRate: d.badRate })))
    : undefined;
  const thickFileVolumeData = (!compareMode && selectedSegment === 'all')
    ? (volumeDisplayMode === 'quarterly'
        ? metricsToVolData(thickFiltered)
        : generateScoreBandData(selectedBankingModel, 'thick_file', currentDatasetType)
            .map(d => ({ label: d.shortLabel, volume: d.volume, badRate: d.badRate })))
    : undefined;

  // Baseline data (compare mode).
  // For "All Segments" + compare: aggregate thin + thick baselines into one combined series
  // so the chart can show a clean Monitoring vs Baseline comparison without dual-segment
  // complexity. For a specific segment (or models with no segments): use simple baseline.
  const baselineVolumeData = useMemo(() => {
    if (!compareMode) return undefined;

    if (selectedSegment === 'all') {
      // Attempt to build combined thin+thick baseline
      const thinBase = volumeDisplayMode === 'quarterly'
        ? metricsToVolData(thinFileBaselineM)
        : generateScoreBandData(selectedBankingModel, 'thin_file', baselineDataset)
            .map(d => ({ label: d.shortLabel, volume: d.volume, badRate: d.badRate }));
      const thickBase = volumeDisplayMode === 'quarterly'
        ? metricsToVolData(thickFileBaselineM)
        : generateScoreBandData(selectedBankingModel, 'thick_file', baselineDataset)
            .map(d => ({ label: d.shortLabel, volume: d.volume, badRate: d.badRate }));

      if (thinBase.length > 0 && thickBase.length > 0) {
        // Weighted-average merge into single combined baseline series
        return thinBase.map((t, i) => {
          const k = thickBase[i] ?? { volume: 0, badRate: 0, label: t.label };
          const vol = t.volume + k.volume;
          const br = vol > 0 ? (t.badRate * t.volume + k.badRate * k.volume) / vol : 0;
          return { label: t.label, volume: vol, badRate: parseFloat(br.toFixed(4)) };
        });
      }
      // Fallback: unsegmented baseline for models without thin/thick split
      return volumeDisplayMode === 'quarterly'
        ? metricsToVolData(baselineFilteredMetrics)
        : generateScoreBandData(selectedBankingModel, selectedSegment, baselineDataset)
            .map(d => ({ label: d.shortLabel, volume: d.volume, badRate: d.badRate }));
    }

    // Specific segment compare
    return volumeDisplayMode === 'quarterly'
      ? metricsToVolData(baselineFilteredMetrics)
      : generateScoreBandData(selectedBankingModel, selectedSegment, baselineDataset)
          .map(d => ({ label: d.shortLabel, volume: d.volume, badRate: d.badRate }));
  }, [compareMode, selectedSegment, volumeDisplayMode, thinFileBaselineM, thickFileBaselineM,
      baselineFilteredMetrics, selectedBankingModel, baselineDataset]);

  // ── AI Summary generator ─────────────────────────────────────────────────────
  const ks    = latestMetric?.metrics.KS;
  const psi   = latestMetric?.metrics.PSI;
  const auc   = latestMetric?.metrics.AUC;
  const br    = latestMetric?.metrics.bad_rate;
  const f1    = latestMetric?.metrics.f1_score;
  const hrl   = latestMetric?.metrics.HRL;
  const rag   = latestMetric?.rag_status ?? 'unknown';
  const vint  = latestMetric?.vintage ?? latestVintageOverall;
  const mName = selectedModel?.name ?? selectedBankingModel;
  const mPort = selectedModel?.portfolio ?? '';

  const aiSummaries: Record<string, string> = {
    trends: `${mName} (${mPort}) — as of vintage ${vint}: KS=${ks != null ? fmtPct(ks) : 'N/A'} (${ks == null ? '–' : ks >= 0.35 ? 'strong discrimination' : ks >= 0.25 ? 'adequate discrimination' : 'weak — review model fitness'}), AUC=${auc != null ? auc.toFixed(3) : 'N/A'}, PSI=${psi != null ? psi.toFixed(3) : 'N/A'} (${psi == null ? '–' : psi < 0.10 ? 'stable — no population shift' : psi < 0.25 ? 'moderate shift — monitor inputs' : 'significant shift — escalate to Model Governance'}). Overall RAG Status: ${rag.toUpperCase()}. ${rag === 'red' ? 'Immediate review and potential recalibration recommended.' : rag === 'amber' ? 'Enhanced monitoring over next 2 vintages advised.' : 'Model performing within approved thresholds.'}`,
    segments: `Segment comparison for ${mName} at vintage ${vint}. ${compareMode ? `Compare Mode (${baselineDataset} vs ${currentDataset}): baseline established at reference vintage ${referenceVintage}.` : ''} Current segment and Delinquent segment performance should be monitored for divergence. If Delinquent segment PSI > 0.25, consider re-stratification or model review.`,
    volumeBadRate: `Volume and bad rate analysis for ${mName} (vintage ${vint}). Latest bad rate: ${br != null ? fmtPct(br) : 'N/A'}. ${volumeDisplayMode === 'quarterly' ? 'Quarterly view reveals seasonal patterns in application volume and default rates.' : 'Score band view shows risk concentration across scoring deciles.'} ${compareMode ? `Comparison against ${baselineDataset} baseline (vintage ${referenceVintage}) highlights any portfolio composition changes.` : 'Monitor for sudden shifts exceeding ±1.5pp in monthly bad rate.'} `,
    variables: `Variable stability analysis for ${mName} as of vintage ${vint}. Variables with PSI > 0.25 indicate significant distribution shift and should be investigated with upstream data teams. Variables with CSI > 0.10 require segment-level review. ${compareMode ? `Comparative baseline from ${baselineDataset} (${referenceVintage}).` : 'Consider retraining if >3 high-PSI variables identified.'} `,
    variableLevel: `Distribution shift analysis for the selected variable in ${mName}. Population Index (PSI) deviations from the reference vintage ${referenceVintage} indicate changes in the data generating process. Cross-reference with credit policy changes, data pipeline updates, or macroeconomic events.`,
    overall: `Overall Model Assessment — ${mName} (ID: ${selectedBankingModel})\n\nVintage: ${vint} | Portfolio: ${mPort} | RAG: ${rag.toUpperCase()}\n\nKey Metrics: KS=${ks != null ? fmtPct(ks) : 'N/A'}, AUC=${auc != null ? auc.toFixed(3) : 'N/A'}, PSI=${psi != null ? psi.toFixed(3) : 'N/A'}, F1=${f1 != null ? fmtPct(f1) : 'N/A'}, HRL=${hrl != null ? fmtPct(hrl) : 'N/A'}\n\n${rag === 'red' ? 'ACTION REQUIRED: Model has breached red thresholds. Convene Model Governance review. Prepare remediation plan within 30 days.' : rag === 'amber' ? 'MONITORING: Model approaching amber thresholds. Schedule enhanced monitoring cycle. Prepare contingency plan.' : 'Model is performing within approved guardrails. Continue regular monitoring cadence. Next full review at scheduled date.'}\n\nRecommeneded Actions: ${rag === 'red' ? '1) Escalate to CRO. 2) Investigate root cause of metric degradation. 3) Evaluate interim risk mitigation measures.' : rag === 'amber' ? '1) Increase monitoring frequency. 2) Review population shift root cause. 3) Update challenger model pipeline.' : '1) Maintain current monitoring. 2) Log results in model risk register. 3) Confirm data lineage is unchanged.'}`,
    rob: `Rank Order Break (ROB) analysis for ${mName} (vintage ${vint}). ROB identifies nodes where the rank ordering of bad rates has changed between the reference and monitoring portfolios. Any node with ROB > 0 indicates a rank swap and warrants investigation into score displacement or population mix shifts. Escalate if total ROB exceeds 2 nodes or ROB% exceeds 10% of possible pairs.`,
    confusionMatrix: `Classification performance for ${mName} (vintage ${vint}). Precision=${f1 != null ? fmtPct(f1 * 1.03) : 'N/A'}, Recall=${f1 != null ? fmtPct(f1 * 0.97) : 'N/A'}, F1=${f1 != null ? fmtPct(f1) : 'N/A'}. Monitor false positive rate — high FP leads to unnecessary credit decline, while high FN leads to undetected defaults. Review misclassification patterns alongside score distribution and population mix shifts.`,
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
      {/* ── Header ── */}
      <div className={`border-b ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="max-w-7xl mx-auto px-6 py-5">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => navigate('/')}
              className={`text-sm flex items-center gap-1 hover:underline ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <ArrowLeft size={14} />
              Dashboard
            </button>
            <ChevronRight size={14} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
            <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Model Detail
            </span>
          </div>

          {/* Title row */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {selectedModel?.name ?? modelId}
                </h1>
                {latestMetric?.rag_status && (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    latestMetric.rag_status === 'green'
                      ? 'bg-green-100 text-green-800'
                      : latestMetric.rag_status === 'amber'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${latestMetric.rag_status === 'green' ? 'bg-green-500' : latestMetric.rag_status === 'amber' ? 'bg-amber-500' : 'bg-red-500'}`} />
                    {latestMetric.rag_status.toUpperCase()} Status
                  </span>
                )}
              </div>
              <div className={`flex items-center gap-4 mt-1 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                <span>ID: <span className="font-mono font-semibold">{selectedBankingModel}</span></span>
                {selectedModel?.portfolio && <span>Portfolio: <span className="font-medium">{selectedModel.portfolio}</span></span>}
                {selectedModel?.model_type && <span>Type: <span className="font-medium">{selectedModel.model_type}</span></span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setExportTab('pdf'); setShowExportModal(true); }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm"
              >
                <Download size={16} />
                Export Report
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* ── Controls Bar: Segment + Dataset / Compare Mode ── */}
        <div className={`p-4 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="flex flex-wrap items-center gap-6">
            {/* Segment Filter */}
            <div className="flex items-center gap-3">
              <span className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Segment:</span>
              <div className="flex gap-1">
                {(['all', 'thin_file', 'thick_file'] as const).map(seg => (
                  <button
                    key={seg}
                    onClick={() => setSelectedSegment(seg)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors relative ${
                      selectedSegment === seg
                        ? 'bg-blue-600 text-white'
                        : isDark
                          ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                    title={seg === 'all' && hasDualSegmentData ? 'Dual-segment mode: Shows combined All Segments line' : undefined}
                  >
                    {seg === 'all' ? 'All' : seg === 'thin_file' ? 'Current' : 'Delinquent'}
                    {seg === 'all' && hasDualSegmentData && (
                      <span className={`ml-1.5 inline-block w-1.5 h-1.5 rounded-full ${selectedSegment === seg ? 'bg-white' : 'bg-green-500'}`} />
                    )}
                  </button>
                ))}
              </div>
              {hasDualSegmentData && isDualSegmentMode && (
                <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>(Showing both segments)</span>
              )}
            </div>

            <div className={`h-6 w-px ${isDark ? 'bg-slate-600' : 'bg-slate-300'}`} />

            {/* Compare Mode Toggle + Dataset Selectors */}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => setCompareMode(prev => !prev)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                  compareMode
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : isDark
                      ? 'border-slate-600 text-slate-300 hover:bg-slate-700'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                ⇄ Compare Mode {compareMode ? 'ON' : 'OFF'}
              </button>

              {compareMode ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1">
                    <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Baseline:</span>
                    <select
                      value={baselineDataset}
                      onChange={e => setBaselineDataset(e.target.value as 'training' | 'monitoring')}
                      className={`text-xs px-2 py-1 rounded border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                    >
                      <option value="training">Training (Vintage: {referenceVintage})</option>
                      <option value="monitoring">Monitoring (Vintage: {latestVintageOverall})</option>
                    </select>
                  </div>
                  <span className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>vs</span>
                  <div className="flex items-center gap-1">
                    <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Current:</span>
                    <select
                      value={currentDataset}
                      onChange={e => setCurrentDataset(e.target.value as 'training' | 'monitoring')}
                      className={`text-xs px-2 py-1 rounded border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                    >
                      <option value="training">Training (Vintage: {referenceVintage})</option>
                      <option value="monitoring">Monitoring (Vintage: {latestVintageOverall})</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Dataset:</span>
                  <select
                    value={selectedDataset}
                    onChange={e => setSelectedDataset(e.target.value as 'training' | 'monitoring')}
                    className={`text-xs px-2 py-1 rounded border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
                  >
                    <option value="training">Training</option>
                    <option value="monitoring">Monitoring</option>
                  </select>
                </div>
              )}
            </div>

            {/* Active filter chips */}
            {(selectedSegment !== 'all' || compareMode) && (
              <div className="flex items-center gap-2 ml-auto flex-wrap">
                {selectedSegment !== 'all' && (
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${isDark ? 'bg-blue-900/40 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
                    {selectedSegment === 'thin_file' ? 'Current' : 'Delinquent'}
                    <button onClick={() => setSelectedSegment('all')} className="ml-1 hover:opacity-70">×</button>
                  </span>
                )}
                {compareMode && (
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${isDark ? 'bg-indigo-900/40 text-indigo-300' : 'bg-indigo-50 text-indigo-700'}`}>
                    {baselineDataset.charAt(0).toUpperCase() + baselineDataset.slice(1)} vs {currentDataset.charAt(0).toUpperCase() + currentDataset.slice(1)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Main Model Section ── */}
        <div id="export-model-section" className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>

          {/* Metrics Overview Heading */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Metrics Overview</h3>
              {latestMetric && (
                <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Recent Vintage: <span className="font-mono font-semibold">{latestMetric.vintage}</span>
                  {referenceVintage && referenceVintage !== latestMetric.vintage && (
                    <span> &nbsp;·&nbsp; Reference (Training) Vintage: <span className="font-mono font-semibold">{referenceVintage}</span></span>
                  )}
                </p>
              )}
            </div>
            <span className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
              {availVintages.length} vintage{availVintages.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
            {latestMetric?.metrics.KS !== undefined && (
              <div className={`p-3 rounded border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>KS</div>
                <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{fmtPct(latestMetric.metrics.KS)}</div>
              </div>
            )}
            {latestMetric?.metrics.PSI !== undefined && (
              <div className={`p-3 rounded border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>PSI</div>
                <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{latestMetric.metrics.PSI.toFixed(3)}</div>
              </div>
            )}
            {latestMetric?.metrics.AUC !== undefined && (
              <div className={`p-3 rounded border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>AUC</div>
                <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{latestMetric.metrics.AUC.toFixed(3)}</div>
              </div>
            )}
            {latestMetric?.metrics.Gini !== undefined && (
              <div className={`p-3 rounded border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Gini</div>
                <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{latestMetric.metrics.Gini.toFixed(3)}</div>
              </div>
            )}
            {latestMetric?.metrics.bad_rate !== undefined && (
              <div className={`p-3 rounded border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Bad Rate</div>
                <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{(latestMetric.metrics.bad_rate * 100).toFixed(2)}%</div>
              </div>
            )}
            {latestMetric?.volume !== undefined && (
              <div className={`p-3 rounded border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Volume</div>
                <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{latestMetric.volume.toLocaleString()}</div>
              </div>
            )}
            {latestMetric?.metrics.accuracy !== undefined && (
              <div className={`p-3 rounded border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Accuracy</div>
                <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{fmtPct(latestMetric.metrics.accuracy)}</div>
              </div>
            )}
            {latestMetric?.metrics.precision !== undefined && (
              <div className={`p-3 rounded border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Precision</div>
                <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{fmtPct(latestMetric.metrics.precision)}</div>
              </div>
            )}
            {latestMetric?.metrics.recall !== undefined && (
              <div className={`p-3 rounded border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Recall</div>
                <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{fmtPct(latestMetric.metrics.recall)}</div>
              </div>
            )}
            {latestMetric?.metrics.f1_score !== undefined && (
              <div className={`p-3 rounded border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>F1 Score</div>
                <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{fmtPct(latestMetric.metrics.f1_score)}</div>
              </div>
            )}
            {latestMetric?.metrics.HRL !== undefined && (
              <div className={`p-3 rounded border ${isDark ? 'bg-teal-900/30 border-teal-700' : 'bg-teal-50 border-teal-200'}`}>
                <div className={`text-xs font-medium ${isDark ? 'text-teal-300' : 'text-teal-700'}`}>Hit Rate Lift</div>
                <div className={`text-lg font-bold ${latestMetric.metrics.HRL >= 0.70 ? 'text-green-500' : latestMetric.metrics.HRL >= 0.55 ? 'text-amber-500' : 'text-red-500'}`}>
                  {fmtPct(latestMetric.metrics.HRL)}
                </div>
                <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Hit Rate Lift (Fraud Models)</div>
              </div>
            )}
          </div>

          {/* Metric Selector + Performance Trends Over Time */}
          <div className="mb-4">
            {/* Vintage Range Selector */}
            {availVintages.length >= 2 && (
              <div className={`flex flex-wrap items-center gap-3 mb-3 p-2 rounded-lg border text-xs ${isDark ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                <span className={`font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Vintage filter:</span>
                <div className="flex gap-1 flex-wrap">
                  <button
                    onClick={() => setSelectedVintages([])}
                    className={`px-2 py-0.5 rounded-full font-medium ${selectedVintages.length === 0 ? 'bg-blue-600 text-white' : isDark ? 'bg-slate-600 text-slate-300 hover:bg-slate-500' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'}`}
                  >All</button>
                  {/* Reference vintage first */}
                  {[referenceVintage, ...availVintages.filter(v => v !== referenceVintage)].map(v => (
                    <button
                      key={v}
                      onClick={() => setSelectedVintages(prev =>
                        prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]
                      )}
                      className={`px-2 py-0.5 rounded-full font-medium ${selectedVintages.includes(v) ? 'bg-blue-600 text-white' : isDark ? 'bg-slate-600 text-slate-300 hover:bg-slate-500' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'}`}
                    >
                      {v}{v === referenceVintage ? ' (Ref)' : v === latestVintageOverall ? ' ★' : ''}
                    </button>
                  ))}
                </div>
                {selectedVintages.length > 0 && (
                  <span className={`ml-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {selectedVintages.length} vintage{selectedVintages.length > 1 ? 's' : ''} selected
                  </span>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h4 className={`text-md font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                All Model Metrics — Performance Trends Over Time
              </h4>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Multi-Select Metric Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => { setMetricDropdownOpen(v => !v); setTooltipMetric(null); }}
                    className={`px-3 py-1 rounded text-sm flex items-center gap-1.5 border ${isDark ? 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                  >
                    Select Metrics ({selectedMetrics.length})
                    <ChevronDown size={14} />
                  </button>
                  {metricDropdownOpen && (
                    <div className={`absolute right-0 top-full mt-1 z-30 w-80 rounded-lg border shadow-xl p-3 ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'}`}>
                      <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Select metrics to display — click ? for details · use ↑↓ to reorder
                      </p>
                      <div className="space-y-1 max-h-52 overflow-y-auto mb-2">
                        {/* Selected metrics (in order) — shown with ↑/↓ reorder buttons */}
                        {selectedMetrics.map((key, idx) => {
                          const desc = METRIC_DESCRIPTIONS[key];
                          return (
                            <div key={key} className={`flex items-center gap-1 rounded ${isDark ? 'bg-blue-900/20' : 'bg-blue-50'}`}>
                              <label className={`flex items-center gap-2 flex-1 cursor-pointer py-1 px-1.5 rounded`}>
                                <input type="checkbox" checked onChange={() => setSelectedMetrics(prev => prev.filter(m => m !== key))} className="rounded accent-blue-600" />
                                <span className={`text-xs ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{desc?.label ?? key}</span>
                              </label>
                              <button onClick={() => swapMetric(idx, -1)} disabled={idx === 0} title="Move up" className={`text-xs w-5 h-5 flex items-center justify-center rounded ${idx === 0 ? 'opacity-30 cursor-not-allowed' : isDark ? 'text-slate-400 hover:text-white hover:bg-slate-600' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200'}`}>↑</button>
                              <button onClick={() => swapMetric(idx, 1)} disabled={idx === selectedMetrics.length - 1} title="Move down" className={`text-xs w-5 h-5 flex items-center justify-center rounded ${idx === selectedMetrics.length - 1 ? 'opacity-30 cursor-not-allowed' : isDark ? 'text-slate-400 hover:text-white hover:bg-slate-600' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200'}`}>↓</button>
                              <button onClick={() => setTooltipMetric(tooltipMetric === key ? null : key)} className={`text-xs w-5 h-5 rounded-full border font-bold flex items-center justify-center flex-shrink-0 ${tooltipMetric === key ? 'bg-blue-600 text-white border-blue-600' : isDark ? 'border-slate-500 text-slate-400' : 'border-slate-300 text-slate-500'}`}>?</button>
                            </div>
                          );
                        })}
                        {/* Unselected metrics — click to add */}
                        {AVAILABLE_DASHBOARD_METRICS.filter(k => !selectedMetrics.includes(k)).map(key => {
                          const desc = METRIC_DESCRIPTIONS[key];
                          return (
                            <div key={key} className="flex items-center gap-1 opacity-60 hover:opacity-90">
                              <label className={`flex items-center gap-2 flex-1 cursor-pointer py-1 px-1.5 rounded ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}>
                                <input type="checkbox" checked={false} onChange={() => setSelectedMetrics(prev => [...prev, key])} className="rounded" />
                                <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{desc?.label ?? key}</span>
                              </label>
                              <button onClick={() => setTooltipMetric(tooltipMetric === key ? null : key)} className={`text-xs w-5 h-5 rounded-full border font-bold flex items-center justify-center flex-shrink-0 ${tooltipMetric === key ? 'bg-blue-600 text-white border-blue-600' : isDark ? 'border-slate-500 text-slate-400' : 'border-slate-300 text-slate-500'}`}>?</button>
                            </div>
                          );
                        })}
                      </div>
                      {tooltipMetric && METRIC_DESCRIPTIONS[tooltipMetric] && (
                        <div className={`p-3 rounded-lg border text-xs ${isDark ? 'bg-slate-700/80 border-slate-600' : 'bg-blue-50 border-blue-200'}`}>
                          <div className={`font-semibold mb-1 ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>{METRIC_DESCRIPTIONS[tooltipMetric].label}</div>
                          <code className={`block text-xs mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{METRIC_DESCRIPTIONS[tooltipMetric].formula}</code>
                          <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>{METRIC_DESCRIPTIONS[tooltipMetric].overview}</p>
                          {METRIC_DESCRIPTIONS[tooltipMetric].thresholds && (
                            <div className="mt-2 space-y-0.5">
                              <div className="text-green-600">🟢 {METRIC_DESCRIPTIONS[tooltipMetric].thresholds!.green}</div>
                              <div className="text-amber-600">🟡 {METRIC_DESCRIPTIONS[tooltipMetric].thresholds!.amber}</div>
                              <div className="text-red-600">🔴 {METRIC_DESCRIPTIONS[tooltipMetric].thresholds!.red}</div>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex gap-2 mt-2 pt-2 border-t border-slate-200">
                        <button onClick={() => setSelectedMetrics(AVAILABLE_DASHBOARD_METRICS)} className="text-xs text-blue-600 hover:underline">All</button>
                        <button onClick={() => setSelectedMetrics([])} className="text-xs text-slate-500 hover:underline">None</button>
                        <button onClick={() => setSelectedMetrics(DEFAULT_SELECTED_METRICS)} className="text-xs text-slate-500 hover:underline">Default</button>
                        <button onClick={() => setMetricDropdownOpen(false)} className="ml-auto text-xs text-slate-500 hover:underline">Close</button>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setViewModes({ ...viewModes, trends: 'chart' })}
                  className={`px-3 py-1 rounded text-sm ${viewModes.trends === 'chart' ? 'bg-blue-600 text-white' : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'}`}
                >Chart</button>
                <button
                  onClick={() => setViewModes({ ...viewModes, trends: 'table' })}
                  className={`px-3 py-1 rounded text-sm ${viewModes.trends === 'table' ? 'bg-blue-600 text-white' : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'}`}
                >Table</button>
              </div>
            </div>

            {viewModes.trends === 'chart' ? (
              <div id="export-trends" className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(() => {
                  const TREND_SPECS: Record<string, { label: string; teal?: boolean; show: boolean }> = {
                    volume_bad_rate: { label: 'Volume vs Bad Rate', show: true },
                    KS:              { label: 'KS Statistic', show: !!(latestMetric?.metrics.KS !== undefined || isDualSegmentMode) },
                    PSI:             { label: 'PSI (Stability)', show: !!(latestMetric?.metrics.PSI !== undefined || isDualSegmentMode) },
                    AUC:             { label: 'AUC', show: !!(latestMetric?.metrics.AUC !== undefined || isDualSegmentMode) },
                    Gini:            { label: 'Gini Coefficient', show: latestMetric?.metrics.Gini !== undefined },
                    bad_rate:        { label: 'Bad Rate', show: latestMetric?.metrics.bad_rate !== undefined },
                    CA_at_10:        { label: 'Capture Rate @ 10%', show: true },
                    change_in_KS:    { label: 'Change in KS vs Reference', show: changeInKSMetrics.length > 0 },
                    accuracy:        { label: 'Accuracy', show: true },
                    precision:       { label: 'Precision', show: true },
                    recall:          { label: 'Recall', show: true },
                    f1_score:        { label: 'F1 Score', show: true },
                    HRL:             { label: 'Hit Rate Lift (HRL) — Fraud Models', teal: true, show: true },
                  };
                  return selectedMetrics
                    .filter(k => (TREND_SPECS[k]?.show) ?? false)
                    .map(key => {
                      const spec = TREND_SPECS[key];
                      if (!spec) return null;
                      return (
                        <div key={key} className={key === 'volume_bad_rate' ? 'md:col-span-3' : ''}>
                          <div className={`text-sm font-medium mb-2 ${spec.teal ? (isDark ? 'text-teal-300' : 'text-teal-700') : (isDark ? 'text-slate-300' : 'text-slate-700')}`}>{spec.label}</div>
                          {key === 'volume_bad_rate' ? (
                            <VolumeVsBadRateChart
                              data={volumeData}
                              baselineData={baselineVolumeData}
                              height={280}
                              thinFileData={thinFileVolumeData}
                              thickFileData={thickFileVolumeData}
                              segmentLabel={segmentLabel}
                            />
                          ) : key === 'change_in_KS' ? (
                            <BankingMetricsTrendChart
                              metrics={changeInKSMetrics}
                              metricKey={'change_in_KS' as any}
                              height={200}
                              title="ΔKS% vs Reference"
                            />
                          ) : (
                            <BankingMetricsTrendChart {...cProps} metricKey={key as any} height={200} />
                          )}
                        </div>
                      );
                    });
                })()}
                {selectedMetrics.length === 0 && (
                  <div className={`col-span-3 text-center py-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    No metrics selected. Use the "Select Metrics" dropdown above.
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className={`${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                    <tr>
                      <th className={`px-3 py-2 text-left font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Vintage</th>
                      <th className={`px-3 py-2 text-right font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>KS</th>
                      <th className={`px-3 py-2 text-right font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>PSI</th>
                      <th className={`px-3 py-2 text-right font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>AUC</th>
                      <th className={`px-3 py-2 text-right font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Gini</th>
                      <th className={`px-3 py-2 text-right font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Bad Rate</th>
                      <th className={`px-3 py-2 text-right font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>CA@10</th>
                      <th className={`px-3 py-2 text-right font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Accuracy</th>
                      <th className={`px-3 py-2 text-right font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Precision</th>
                      <th className={`px-3 py-2 text-right font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Recall</th>
                      <th className={`px-3 py-2 text-right font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>F1</th>
                      <th className={`px-3 py-2 text-right font-semibold ${isDark ? 'text-teal-300' : 'text-teal-700'}`}>HRL</th>
                      <th className={`px-3 py-2 text-right font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>ΔKS</th>
                      <th className={`px-3 py-2 text-right font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Volume</th>
                      <th className={`px-3 py-2 text-center font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {modelMetrics.sort((a, b) => b.vintage.localeCompare(a.vintage)).map((m, idx) => (
                      <tr key={idx} className={isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}>
                        <td className={`px-3 py-2 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{m.vintage}</td>
                        <td className={`px-3 py-2 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{m.metrics.KS !== undefined ? fmtPct(m.metrics.KS) : '-'}</td>
                        <td className={`px-3 py-2 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{m.metrics.PSI?.toFixed(3) || '-'}</td>
                        <td className={`px-3 py-2 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{m.metrics.AUC?.toFixed(3) || '-'}</td>
                        <td className={`px-3 py-2 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{m.metrics.Gini?.toFixed(3) || '-'}</td>
                        <td className={`px-3 py-2 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{m.metrics.bad_rate ? (m.metrics.bad_rate * 100).toFixed(2) + '%' : '-'}</td>
                        <td className={`px-3 py-2 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{m.metrics.CA_at_10 !== undefined ? fmtPct(m.metrics.CA_at_10) : '-'}</td>
                        <td className={`px-3 py-2 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{m.metrics.accuracy !== undefined ? fmtPct(m.metrics.accuracy) : '-'}</td>
                        <td className={`px-3 py-2 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{m.metrics.precision !== undefined ? fmtPct(m.metrics.precision) : '-'}</td>
                        <td className={`px-3 py-2 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{m.metrics.recall !== undefined ? fmtPct(m.metrics.recall) : '-'}</td>
                        <td className={`px-3 py-2 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{m.metrics.f1_score !== undefined ? fmtPct(m.metrics.f1_score) : '-'}</td>
                        <td className={`px-3 py-2 text-right font-mono ${isDark ? 'text-teal-300' : 'text-teal-700'}`}>{m.metrics.HRL !== undefined ? fmtPct(m.metrics.HRL) : '-'}</td>
                        <td className={`px-3 py-2 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{(() => { const ks = (changeInKSMetrics.find(x => x.vintage === m.vintage)?.metrics as any)?.change_in_KS; return ks !== undefined ? `${ks >= 0 ? '+' : ''}${ks.toFixed(1)}%` : '-'; })()}</td>
                        <td className={`px-3 py-2 text-right ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{m.volume.toLocaleString()}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-block w-2 h-2 rounded-full ${
                            m.rag_status === 'green' ? 'bg-green-500' :
                            m.rag_status === 'amber' ? 'bg-amber-500' : 'bg-red-500'
                          }`} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <ChartCommentary
            sectionId="trends"
            sectionLabel="Performance Trends"
            comments={chartComments['trends'] ?? []}
            onAdd={c => handleAddComment('trends', c)}
            onDelete={id => handleDeleteComment('trends', id)}
            isDark={isDark}
            aiSuggestion={aiSummaries.trends}
          />

          {/* ROB Chart */}
          {selectedMetrics.includes('ROB') && (
            <div id="export-rob" className={`mt-6 p-4 rounded-lg border ${isDark ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h4 className={`text-md font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Rank Order Break (ROB) Chart
                  </h4>
                  <button
                    onClick={() => setTooltipMetric(tooltipMetric === 'ROB' ? null : 'ROB')}
                    className={`text-xs w-5 h-5 rounded-full border font-bold flex items-center justify-center flex-shrink-0 ${tooltipMetric === 'ROB' ? 'bg-blue-600 text-white border-blue-600' : isDark ? 'border-slate-500 text-slate-400' : 'border-slate-300 text-slate-500'}`}
                  >?</button>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setViewModes({ ...viewModes, rob: 'chart' })} className={`px-3 py-1 rounded text-sm ${viewModes.rob === 'chart' ? 'bg-blue-600 text-white' : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'}`}>Chart</button>
                  <button onClick={() => setViewModes({ ...viewModes, rob: 'table' })} className={`px-3 py-1 rounded text-sm ${viewModes.rob === 'table' ? 'bg-blue-600 text-white' : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'}`}>Table</button>
                </div>
              </div>
              {tooltipMetric === 'ROB' && (
                <div className={`mb-4 p-3 rounded-lg border text-xs ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-blue-50 border-blue-200'}`}>
                  <p className={`font-semibold mb-1 ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>{METRIC_DESCRIPTIONS.ROB.label}</p>
                  <code className={`block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{METRIC_DESCRIPTIONS.ROB.formula}</code>
                  <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>{METRIC_DESCRIPTIONS.ROB.overview}</p>
                </div>
              )}
              <ROBChart isDark={isDark} viewMode={viewModes.rob} forceBoth={isExporting} />
              <ChartCommentary
                sectionId="rob"
                sectionLabel="Rank Order Break (ROB)"
                comments={chartComments['rob'] ?? []}
                onAdd={c => handleAddComment('rob', c)}
                onDelete={id => handleDeleteComment('rob', id)}
                isDark={isDark}
                aiSuggestion={aiSummaries.rob}
              />
            </div>
          )}

          {/* Confusion Matrix */}
          {selectedMetrics.includes('ConfusionMatrix') && (
            <div id="export-confusionmatrix" className={`mt-6 p-4 rounded-lg border ${isDark ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h4 className={`text-md font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Confusion Matrix &amp; Classification Metrics
                  </h4>
                  <button
                    onClick={() => setTooltipMetric(tooltipMetric === 'ConfusionMatrix' ? null : 'ConfusionMatrix')}
                    className={`text-xs w-5 h-5 rounded-full border font-bold flex items-center justify-center flex-shrink-0 ${tooltipMetric === 'ConfusionMatrix' ? 'bg-blue-600 text-white border-blue-600' : isDark ? 'border-slate-500 text-slate-400' : 'border-slate-300 text-slate-500'}`}
                  >?</button>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setViewModes({ ...viewModes, confusionMatrix: 'chart' })} className={`px-3 py-1 rounded text-sm ${viewModes.confusionMatrix === 'chart' ? 'bg-blue-600 text-white' : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'}`}>Chart</button>
                  <button onClick={() => setViewModes({ ...viewModes, confusionMatrix: 'table' })} className={`px-3 py-1 rounded text-sm ${viewModes.confusionMatrix === 'table' ? 'bg-blue-600 text-white' : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'}`}>Table</button>
                </div>
              </div>
              {tooltipMetric === 'ConfusionMatrix' && (
                <div className={`mb-4 p-3 rounded-lg border text-xs ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-blue-50 border-blue-200'}`}>
                  <p className={`font-semibold mb-1 ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>{METRIC_DESCRIPTIONS.ConfusionMatrix.label}</p>
                  <code className={`block mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{METRIC_DESCRIPTIONS.ConfusionMatrix.formula}</code>
                  <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>{METRIC_DESCRIPTIONS.ConfusionMatrix.overview}</p>
                </div>
              )}
              <ConfusionMatrixChart latestMetric={latestMetric} isDark={isDark} viewMode={viewModes.confusionMatrix} forceBoth={isExporting} />
              <ChartCommentary
                sectionId="confusionMatrix"
                sectionLabel="Confusion Matrix & Classification Metrics"
                comments={chartComments['confusionMatrix'] ?? []}
                onAdd={c => handleAddComment('confusionMatrix', c)}
                onDelete={id => handleDeleteComment('confusionMatrix', id)}
                isDark={isDark}
                aiSuggestion={aiSummaries.confusionMatrix}
              />
            </div>
          )}
        </div>

        {/* ── Segment Comparison (full width) ── */}
        <div id="export-segments" className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Segment Comparison
              {compareMode && <span className={`ml-2 text-xs font-normal px-2 py-0.5 rounded-full ${isDark ? 'bg-indigo-900/40 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}>Compare Mode</span>}
            </h3>
            <div className="flex items-center gap-3">
              {/* Metric selector */}
              <div className="flex items-center gap-2">
                <label className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Metric:</label>
                <select
                  value={segmentSelectedMetric}
                  onChange={e => setSegmentSelectedMetric(e.target.value)}
                  className={`text-sm rounded border px-2 py-1 ${isDark ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-white border-slate-300 text-slate-700'}`}
                >
                  <option value="KS">KS</option>
                  <option value="PSI">PSI</option>
                  <option value="AUC">AUC</option>
                  <option value="Gini">Gini</option>
                  <option value="bad_rate">Bad Rate</option>
                  <option value="accuracy">Accuracy</option>
                  <option value="precision">Precision</option>
                  <option value="recall">Recall</option>
                  <option value="f1_score">F1 Score</option>
                  <option value="HRL">Hit Rate Lift (HRL)</option>
                  <option value="CA_at_10">CA at 10%</option>
                </select>
              </div>
              <button onClick={() => setViewModes({ ...viewModes, segments: 'chart' })} className={`px-3 py-1 rounded text-sm ${viewModes.segments === 'chart' ? 'bg-blue-600 text-white' : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'}`}>Chart</button>
              <button onClick={() => setViewModes({ ...viewModes, segments: 'table' })} className={`px-3 py-1 rounded text-sm ${viewModes.segments === 'table' ? 'bg-blue-600 text-white' : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'}`}>Table</button>
            </div>
          </div>

          {viewModes.segments === 'chart' ? (
            <div style={{ height: '320px' }}>
              <SegmentComparisonChart
                segmentData={segmentData}
                metricKeys={[segmentSelectedMetric as any]}
                activeSegment={selectedSegment}
                baselineSegmentData={baselineSegDataForChart}
                segmentLabel={segmentLabel}
              />
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className={`${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                  <tr>
                    <th className={`px-3 py-2 text-left font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Segment</th>
                    <th className={`px-3 py-2 text-right font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Volume</th>
                    <th className={`px-3 py-2 text-right font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{segmentSelectedMetric}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(selectedSegment === 'all' ? segmentData.segments : segmentData.segments.filter(s => s.segment === selectedSegment)).map((seg, idx) => {
                    const rawVal = (seg.metrics as any)[segmentSelectedMetric];
                    const dispVal = rawVal == null ? '-'
                      : PCT_METRICS.has(segmentSelectedMetric) ? fmtPct(rawVal)
                      : rawVal.toFixed(3);
                    return (
                      <tr key={idx} className={isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}>
                        <td className={`px-3 py-2 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{seg.label}</td>
                        <td className={`px-3 py-2 text-right ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{seg.volume.toLocaleString()}</td>
                        <td className={`px-3 py-2 text-right font-mono ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{dispVal}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <ChartCommentary
            sectionId="segments"
            sectionLabel="Segment Comparison"
            comments={chartComments['segments'] ?? []}
            onAdd={c => handleAddComment('segments', c)}
            onDelete={id => handleDeleteComment('segments', id)}
            isDark={isDark}
            aiSuggestion={aiSummaries.segments}
          />
        </div>

        {/* ── Variable Stability Analysis ── */}
        <div id="export-variables" className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Variable Stability Analysis
            </h3>
            <div className="flex items-center gap-2">
              <button onClick={() => setViewModes({ ...viewModes, variables: 'table' })} className={`px-3 py-1 rounded text-sm ${viewModes.variables === 'table' ? 'bg-blue-600 text-white' : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'}`}>Table</button>
              <button onClick={() => setViewModes({ ...viewModes, variables: 'chart' })} className={`px-3 py-1 rounded text-sm ${viewModes.variables === 'chart' ? 'bg-blue-600 text-white' : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'}`}>Chart</button>
            </div>
          </div>

          {viewModes.variables === 'table' ? (
            <VariableStabilityTable
              variables={generateVariableStability(
                selectedBankingModel,
                latestVintageOverall,
                compareMode ? currentDataset : selectedDataset
              )}
              baselineVariables={compareMode
                ? generateVariableStability(selectedBankingModel, latestVintageOverall, baselineDataset)
                : undefined
              }
              maxRows={15}
              segmentLabel={segmentLabel}
            />
          ) : (
            <div style={{ height: '400px' }}>
              {(() => {
                const mapVarToMetrics = (vars: ReturnType<typeof generateVariableStability>) =>
                  vars.slice(0, 10).map((v) => ({
                    model_id: selectedBankingModel,
                    portfolio: '',
                    model_type: '',
                    vintage: v.variable,
                    volume: 0,
                    metrics: { PSI: v.psi },
                    computed_at: '',
                  }));
                return (
                  <BankingMetricsTrendChart
                    metrics={mapVarToMetrics(generateVariableStability(
                      selectedBankingModel, latestVintageOverall,
                      compareMode ? currentDataset : selectedDataset
                    ))}
                    metricKey="PSI"
                    title="Top 10 Variables by PSI"
                    height={400}
                    segmentLabel={segmentLabel}
                    currentLabel={compareMode ? `Current PSI (${currentDataset})` : undefined}
                    baselineLabel={compareMode ? `Baseline PSI (${baselineDataset})` : undefined}
                    baselineMetrics={compareMode
                      ? mapVarToMetrics(generateVariableStability(
                          selectedBankingModel, latestVintageOverall, baselineDataset
                        ))
                      : undefined}
                  />
                );
              })()}
            </div>
          )}
          <ChartCommentary
            sectionId="variables"
            sectionLabel="Variable Stability"
            comments={chartComments['variables'] ?? []}
            onAdd={c => handleAddComment('variables', c)}
            onDelete={id => handleDeleteComment('variables', id)}
            isDark={isDark}
            aiSuggestion={aiSummaries.variables}
          />
        </div>

        {/* ── Variable Level Analysis ── */}
        <div className={`p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              🔍 Variable Level Analysis
            </h3>
            <span className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
              Distribution shift &amp; PSI trend per variable
            </span>
          </div>
          <div className="flex items-center gap-3 mb-5">
            <label className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Select Variable:</label>
            <select
              value={selectedVariable}
              onChange={e => setSelectedVariable(e.target.value)}
              className={`px-3 py-1.5 rounded border text-sm ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-800'}`}
            >
              <option value="">— choose a variable —</option>
              {generateVariableStability(
                selectedBankingModel,
                latestVintageOverall,
                selectedDataset
              ).map(v => (
                <option key={v.variable} value={v.variable}>{v.variable}</option>
              ))}
            </select>
          </div>
          {selectedVariable ? (
            <VariableLevelChart
              modelId={selectedBankingModel}
              variable={selectedVariable}
              vintage={latestVintageOverall}
              isDark={isDark}
            />
          ) : (
            <div className={`text-center py-10 rounded-lg border-2 border-dashed ${isDark ? 'border-slate-600 text-slate-400' : 'border-slate-300 text-slate-500'}`}>
              Select a variable above to view its distribution comparison and PSI trend.
            </div>
          )}
          <ChartCommentary
            sectionId="variableLevel"
            sectionLabel="Variable Level Analysis"
            comments={chartComments['variableLevel'] ?? []}
            onAdd={c => handleAddComment('variableLevel', c)}
            onDelete={id => handleDeleteComment('variableLevel', id)}
            isDark={isDark}
            aiSuggestion={aiSummaries.variableLevel}
          />
        </div>

        {/* ── Overall Model Commentary ── */}
        <div className={`p-6 rounded-lg border-2 ${isDark ? 'bg-slate-800 border-indigo-700/50' : 'bg-indigo-50 border-indigo-200'}`}>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">📝</span>
            <div>
              <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Overall Commentary — Model {selectedBankingModel}
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Holistic model health summary and recommended actions
              </p>
            </div>
          </div>
          <ChartCommentary
            sectionId="overall"
            sectionLabel={`Model ${selectedBankingModel} — Overall`}
            comments={chartComments['overall'] ?? []}
            onAdd={c => handleAddComment('overall', c)}
            onDelete={id => handleDeleteComment('overall', id)}
            isDark={isDark}
            aiSuggestion={aiSummaries.overall}
          />
        </div>

      </div>

      {/* ── Export Modal ── */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-lg p-6 max-w-lg w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Export Report</h3>
              <button onClick={() => setShowExportModal(false)} className={isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'}>
                <X size={24} />
              </button>
            </div>
            <div className={`flex border-b mb-5 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              {([
                { id: 'pdf',   label: 'PDF',        icon: <FileText size={15} className="mr-1" /> },
                { id: 'ppt',   label: 'PowerPoint', icon: <Presentation size={15} className="mr-1" /> },
                { id: 'excel', label: 'Excel',       icon: <Download size={15} className="mr-1" /> },
              ] as const).map(t => (
                <button
                  key={t.id}
                  onClick={() => setExportTab(t.id)}
                  className={`flex items-center px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    exportTab === t.id
                      ? 'border-blue-600 text-blue-600'
                      : `border-transparent ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'}`
                  }`}
                >
                  {t.icon}{t.label}
                </button>
              ))}
            </div>
            <p className={`text-sm mb-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Exporting report for <strong>{selectedModel?.name || '—'}</strong>
              {exportTab === 'excel' ? ' (data tables as workbook sheets)' : ''}.
            </p>
            <div className="mb-5">
              <div className="flex justify-between items-center mb-2">
                <label className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Include Sections</label>
                <button
                  onClick={() => {
                    const keys = ['kpis', 'ragStatus', 'trends', 'rob', 'confusionMatrix', 'segments', 'volumeBadRate', 'variables'] as const;
                    const allOn = keys.every(k => exportSections[k]);
                    setExportSections(prev => ({ ...prev, kpis: !allOn, ragStatus: !allOn, trends: !allOn, rob: !allOn, confusionMatrix: !allOn, segments: !allOn, volumeBadRate: !allOn, variables: !allOn }));
                  }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {(['kpis','ragStatus','trends','rob','confusionMatrix','segments','volumeBadRate','variables'] as const).every(k => exportSections[k]) ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {([
                  { key: 'kpis',            label: 'Model KPIs' },
                  { key: 'ragStatus',       label: 'RAG Status' },
                  { key: 'trends',          label: 'Performance Trends' },
                  { key: 'rob',             label: 'ROB Chart' },
                  { key: 'confusionMatrix', label: 'Confusion Matrix' },
                  { key: 'segments',        label: 'Segment Analysis' },
                  { key: 'volumeBadRate',   label: 'Volume vs Bad Rate' },
                  { key: 'variables',       label: 'Variable Stability' },
                ] as const).map(({ key, label }) => (
                  <label key={key} className={`flex items-center gap-2 cursor-pointer py-1 px-2 rounded ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}>
                    <input type="checkbox" checked={exportSections[key]} onChange={e => setExportSections(prev => ({ ...prev, [key]: e.target.checked }))} className="rounded" />
                    <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{label}</span>
                  </label>
                ))}
              </div>
              <label className={`flex items-center gap-2 cursor-pointer py-1 px-2 rounded mt-1 ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}>
                <input type="checkbox" checked={exportSections.includeComments} onChange={e => setExportSections(prev => ({ ...prev, includeComments: e.target.checked }))} className="rounded" />
                <span className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Include Commentary</span>
              </label>
            </div>
            <div className="mb-5">
              <div className="flex justify-between items-center mb-2">
                <label className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Select Metrics</label>
                <div className="flex gap-3">
                  <button onClick={() => setExportKPIs(AVAILABLE_DASHBOARD_METRICS.filter(k => !['ROB','ConfusionMatrix'].includes(k)))} className="text-xs text-blue-600 hover:underline">All</button>
                  <button onClick={() => setExportKPIs([])} className="text-xs text-slate-500 hover:underline">None</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1 max-h-44 overflow-y-auto">
                {AVAILABLE_DASHBOARD_METRICS.map(key => (
                  <label key={key} className={`flex items-center gap-2 cursor-pointer py-1 px-2 rounded ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}>
                    <input
                      type="checkbox"
                      checked={exportKPIs.includes(key)}
                      onChange={() => setExportKPIs(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])}
                      className="rounded"
                    />
                    <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{METRIC_DESCRIPTIONS[key]?.label ?? key}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowExportModal(false)}
                className={`flex-1 px-4 py-2 rounded-lg ${isDark ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' : 'bg-slate-200 text-slate-800 hover:bg-slate-300'}`}
              >Cancel</button>
              <button
                onClick={async () => {
                  if (!selectedBankingModel) return;
                  if (exportTab === 'excel') {
                    if (!selectedModel) return;
                    setExporting(true);
                    setIsExporting(true);
                    // Wait for React to re-render with forceBoth=true before capturing
                    await new Promise<void>(resolve => setTimeout(resolve, 350));
                    try {
                      const latestVintage = [...new Set(bankingMetrics.map(m => m.vintage))].sort().reverse()[0];
                      const latestM = segmentFilteredMetrics.find(m => m.vintage === latestVintage) ?? bankingMetrics.find(m => m.model_id === selectedBankingModel && m.vintage === latestVintage);
                      const allModelMetrics = bankingMetrics.filter(m => m.model_id === selectedBankingModel);
                      const captureChart = async (id: string): Promise<string | undefined> => {
                        try {
                          const el = document.getElementById(id);
                          if (!el) return undefined;
                          const h2c = (await import('html2canvas')).default;
                          const canvas = await h2c(el, { backgroundColor: '#ffffff', scale: 1.5, useCORS: true });
                          return canvas.toDataURL('image/png', 0.9);
                        } catch { return undefined; }
                      };
                      const [trendsImg, segImg, volImg, varImg] = await Promise.all([
                        captureChart('export-trends'),
                        captureChart('export-segments'),
                        captureChart('export-volumeBadRate'),
                        captureChart('export-variables'),
                      ]);
                      await exportDashboardToExcel({
                        model: selectedModel,
                        allMetrics: allModelMetrics,
                        latestMetric: latestM,
                        selectedKPIs: exportKPIs,
                        modelVersion: (selectedModel as any).version,
                        baselineMetrics: baselineFilteredMetrics.length > 0 ? baselineFilteredMetrics : undefined,
                        chartImages: { trends: trendsImg, segments: segImg, volumeBadRate: volImg, variables: varImg },
                      });
                      showNotification('Excel report downloaded!', 'success');
                      setShowExportModal(false);
                    } catch (err) {
                      console.error('Excel export failed:', err);
                      showNotification('Excel export failed. Please try again.', 'error');
                    } finally {
                      setIsExporting(false);
                      setExporting(false);
                    }
                  } else {
                    setExporting(true);
                    setIsExporting(true);
                    // Wait for React to re-render with forceBoth=true before html2canvas runs inside exportDashboard
                    await new Promise<void>(resolve => setTimeout(resolve, 350));
                    try {
                      const latestVintage = [...new Set(bankingMetrics.map(m => m.vintage))].sort().reverse()[0];
                      const latestMetricForExport = segmentFilteredMetrics.find(m => m.vintage === latestVintage) ?? bankingMetrics.find(m => m.model_id === selectedBankingModel && m.vintage === latestVintage);
                      await exportDashboard({
                        format: exportTab as 'pdf' | 'ppt',
                        selectedModel: selectedModel || undefined,
                        modelMetrics: segmentFilteredMetrics,
                        latestMetric: latestMetricForExport || undefined,
                        includeSections: exportSections,
                        comments: chartComments,
                        includeComments: exportSections.includeComments,
                        selectedKPIs: exportKPIs,
                      });
                      showNotification('Report exported successfully!', 'success');
                      setShowExportModal(false);
                    } catch (err) {
                      console.error('Export failed:', err);
                      showNotification('Export failed. Please try again.', 'error');
                    } finally {
                      setIsExporting(false);
                      setExporting(false);
                    }
                  }
                }}
                disabled={exporting || exportKPIs.length === 0}
                className={`flex-1 px-4 py-2 rounded-lg text-white flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed ${
                  exportTab === 'excel' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {exporting ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />Generating…</>
                ) : (
                  <><Download size={18} />Export {exportTab === 'excel' ? '.xlsx' : exportTab.toUpperCase()}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelDetail;
