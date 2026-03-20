import React, { useState } from 'react';
import { Upload, FileText, X, Brain, Plus } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export interface UploadedDataset {
  id: string;
  name: string;
  rows: number;
  columns: number;
  uploadedAt: string;
  columnsList: string[];
  sampleData?: Record<string, any>[];
}

export interface ReferenceDatasetConfig {
  vintageFrom: string;
  vintageTo: string;
  /** @deprecated use vintageFrom/vintageTo */
  observationVintages?: string[];
  performanceWindow: string;
  // Score Level
  scoreField: string;
  targetVariable: string;
  segments: string[];
  /** @deprecated use segments */
  segment?: string;
  // Account Level (only when granularity = 'account')
  uniqueKey?: string;
  scoreNode?: string;
  targetVariableAccount?: string;
  segmentAccounts?: string[];
  /** @deprecated use segmentAccounts */
  segmentAccount?: string;
  // Shared
  features: string[];
}

export interface DataSummary {
  totalVolume: number;
  segments: Record<string, { volume: number; badCount: number }>;
  overallBadCount: number;
  overallBadRate: number;
}

export interface EnhancedDataSummary {
  totalRows: number;
  badCount: number;
  badRate: number;
  segments: Record<string, { volume: number; badCount: number }>;
  numericalCols: Array<{ name: string; mean: number; std: number; min: number; max: number; nullRate: number }>;
  categoricalCols: Array<{ name: string; uniqueCount: number; topValue: string; topPercent: number; nullRate: number }>;
  dateCols: Array<{ name: string; minDate: string; maxDate: string; nullRate: number }>;
}

export interface DataIngestionConfig {
  modelId?: string;
  granularity: 'score' | 'account';
  // Legacy single-dataset fields kept for backward compat with DataQualityStep
  referenceDataset?: UploadedDataset;
  datasetConfig?: ReferenceDatasetConfig;
  dataSummary?: DataSummary;
  // Dual dataset fields
  scoreLevelDataset?: UploadedDataset;
  accountLevelDataset?: UploadedDataset;
  scoreLevelConfig?: ReferenceDatasetConfig;
  accountLevelConfig?: ReferenceDatasetConfig;
  trackDatasets?: Record<string, UploadedDataset[]>;
}

interface Workflow {
  selectedModel?: string;
  models?: { id: string; name: string; version?: string }[];
  modelMetricsConfig?: {
    granularity?: 'score' | 'account';
    selectedMetrics?: Array<{ id: string; enabled: boolean; innerThreshold: string; outerThreshold: string }>;
  };
}

const TARGET_HEURISTICS = ['default_flag', 'default', 'bad_flag', 'bad', 'outcome', 'target', 'y', 'label', 'flag'];
const SCORE_HEURISTICS = ['score', 'pd', 'probability', 'prob', 'pred'];
const SEGMENT_HEURISTICS = ['segment', 'seg', 'region', 'country', 'portfolio', 'product', 'channel', 'bucket'];
const KEY_HEURISTICS = ['account_id', 'account', 'id', 'cif', 'customer_id', 'customer', 'key', 'unique_id'];
const EXCLUDE_FEATURES = new Set(['score', 'pd', 'probability', 'prob', 'pred', 'default_flag', 'default', 'bad_flag', 'bad', 'outcome', 'target', 'y', 'label', 'flag']);

const findColumn = (columns: string[], heuristics: string[]): string => {
  const lower = columns.map(c => c.toLowerCase());
  for (const h of heuristics) {
    const idx = lower.findIndex(c => c.includes(h) || h.includes(c));
    if (idx >= 0) return columns[idx];
  }
  return '';
};

const suggestFeatures = (columns: string[]): string[] =>
  columns.filter(c => !EXCLUDE_FEATURES.has(c.toLowerCase()));

// Vintage options grouped by year
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function generateVintagesByYear(): Record<number, string[]> {
  const byYear: Record<number, string[]> = {};
  const now = new Date();
  let year = 2019;
  let month = 0;
  while (year < now.getFullYear() || (year === now.getFullYear() && month <= now.getMonth())) {
    if (!byYear[year]) byYear[year] = [];
    byYear[year].push(`${MONTHS[month]}-${String(year).slice(2)}`);
    month++;
    if (month > 11) { month = 0; year++; }
  }
  return byYear;
}

const VINTAGES_BY_YEAR = generateVintagesByYear();

// CSV parser helper — handles quoted fields, commas inside quotes, BOM
function parseCSV(text: string): { headers: string[]; rows: Record<string, any>[] } {
  // Strip UTF-8 BOM if present
  const clean = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;

  // Tokenize: respect double-quoted fields that may contain commas/newlines
  const tokenizeLine = (line: string): string[] => {
    const fields: string[] = [];
    let i = 0;
    while (i <= line.length) {
      if (i === line.length) { fields.push(''); break; }
      if (line[i] === '"') {
        let val = '';
        i++; // skip opening quote
        while (i < line.length) {
          if (line[i] === '"' && line[i + 1] === '"') { val += '"'; i += 2; }
          else if (line[i] === '"') { i++; break; }
          else { val += line[i++]; }
        }
        fields.push(val.trim());
        if (line[i] === ',') i++;
      } else {
        const end = line.indexOf(',', i);
        if (end === -1) { fields.push(line.slice(i).trim()); break; }
        fields.push(line.slice(i, end).trim());
        i = end + 1;
      }
    }
    return fields;
  };

  const lines = clean.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = tokenizeLine(lines[0]).map(h => h.replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map(line => {
    const vals = tokenizeLine(line);
    const obj: Record<string, any> = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
    return obj;
  });
  return { headers, rows };
}

// -----------------------------------------------------------------------------
// Helper: compute data summary from parsed CSV rows
// -----------------------------------------------------------------------------
function computeDataSummary(
  rows: Record<string, any>[],
  targetCol: string,
  segmentCol: string
): DataSummary {
  const segments: Record<string, { volume: number; badCount: number }> = {};
  let overallBadCount = 0;
  for (const row of rows) {
    const seg = segmentCol && row[segmentCol] != null ? String(row[segmentCol]) : 'Overall';
    if (!segments[seg]) segments[seg] = { volume: 0, badCount: 0 };
    segments[seg].volume++;
    const isBad = targetCol && (row[targetCol] === 1 || row[targetCol] === '1' || row[targetCol] === true || String(row[targetCol]).toLowerCase() === 'bad');
    if (isBad) { segments[seg].badCount++; overallBadCount++; }
  }
  const totalVolume = rows.length;
  return { totalVolume, segments, overallBadCount, overallBadRate: totalVolume > 0 ? overallBadCount / totalVolume : 0 };
}

// Helper: compute enhanced data summary (numerical, categorical, date column breakdown)
function computeEnhancedSummary(rows: Record<string, any>[], targetCol: string, segmentCol: string): EnhancedDataSummary {
  if (!rows || rows.length === 0) {
    return { totalRows: 0, badCount: 0, badRate: 0, segments: {}, numericalCols: [], categoricalCols: [], dateCols: [] };
  }

  // Safely get headers — guard against malformed first row
  const headers = rows[0] ? Object.keys(rows[0]).filter(h => h !== '') : [];
  if (headers.length === 0) {
    return { totalRows: rows.length, badCount: 0, badRate: 0, segments: {}, numericalCols: [], categoricalCols: [], dateCols: [] };
  }

  // Detect column types by sampling (skip target/segment cols)
  // Fix: treat empty-string as null — Number('') === 0 which is a false positive for numerical
  const sampleSize = Math.min(100, rows.length);
  const sample = rows.slice(0, sampleSize);
  const isNumericStr = (s: string) => s !== '' && s !== null && !isNaN(Number(s));
  const isDateStr = (s: string) => /^\d{4}-\d{2}-\d{2}/.test(s) || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s);

  const colTypes: Record<string, 'numerical' | 'categorical' | 'date'> = {};
  for (const col of headers) {
    if (col === targetCol || col === segmentCol) continue;
    let numCount = 0, dateCount = 0, nonEmpty = 0;
    for (const row of sample) {
      const v = row[col];
      if (v == null || v === '') continue;
      const str = String(v).trim();
      nonEmpty++;
      if (isNumericStr(str)) numCount++;
      else if (isDateStr(str)) dateCount++;
    }
    const total = nonEmpty || 1;
    if (numCount / total > 0.7) colTypes[col] = 'numerical';
    else if (dateCount / total > 0.6) colTypes[col] = 'date';
    else colTypes[col] = 'categorical';
  }

  // Compute bad count and segments
  let badCount = 0;
  const segments: Record<string, { volume: number; badCount: number }> = {};
  for (const row of rows) {
    const seg = segmentCol && row[segmentCol] != null && row[segmentCol] !== ''
      ? String(row[segmentCol])
      : 'Overall';
    if (!segments[seg]) segments[seg] = { volume: 0, badCount: 0 };
    segments[seg].volume++;
    const tv = row[targetCol];
    const isBad = targetCol && (tv === 1 || tv === '1' || tv === true ||
      (typeof tv === 'string' && tv.toLowerCase() === 'bad'));
    if (isBad) { segments[seg].badCount++; badCount++; }
  }

  // Numerical columns — use reduce for min/max to avoid stack overflow on large arrays
  const numericalCols = headers
    .filter(c => colTypes[c] === 'numerical')
    .slice(0, 10)
    .map(name => {
      let sum = 0, count = 0, nullCount = 0;
      let minVal = Infinity, maxVal = -Infinity;
      for (const row of rows) {
        const v = row[name];
        if (v == null || v === '') { nullCount++; continue; }
        const n = Number(v);
        if (isNaN(n)) { nullCount++; continue; }
        sum += n; count++;
        if (n < minVal) minVal = n;
        if (n > maxVal) maxVal = n;
      }
      const mean = count > 0 ? sum / count : 0;
      let varSum = 0;
      for (const row of rows) {
        const v = row[name];
        if (v == null || v === '') continue;
        const n = Number(v);
        if (!isNaN(n)) varSum += (n - mean) ** 2;
      }
      const std = count > 0 ? Math.sqrt(varSum / count) : 0;
      const min = count > 0 ? minVal : 0;
      const max = count > 0 ? maxVal : 0;
      const nullRate = rows.length > 0 ? nullCount / rows.length : 0;
      return { name, mean, std, min, max, nullRate };
    });

  // Categorical columns
  const categoricalCols = headers
    .filter(c => colTypes[c] === 'categorical')
    .slice(0, 10)
    .map(name => {
      const freq: Record<string, number> = {};
      let nullCount = 0;
      for (const row of rows) {
        const v = row[name];
        if (v == null || v === '') { nullCount++; continue; }
        const key = String(v);
        freq[key] = (freq[key] || 0) + 1;
      }
      const entries = Object.entries(freq).sort((a, b) => b[1] - a[1]);
      const topValue = entries[0]?.[0] || '';
      const topCount = entries[0]?.[1] || 0;
      const nullRate = rows.length > 0 ? nullCount / rows.length : 0;
      return {
        name,
        uniqueCount: entries.length,
        topValue,
        topPercent: rows.length > 0 ? (topCount / rows.length) * 100 : 0,
        nullRate,
      };
    });

  // Date columns
  const dateCols = headers
    .filter(c => colTypes[c] === 'date')
    .slice(0, 10)
    .map(name => {
      let minTs = Infinity, maxTs = -Infinity;
      let minDate = '', maxDate = '';
      let nullCount = 0;
      for (const row of rows) {
        const v = row[name];
        if (v == null || v === '') { nullCount++; continue; }
        const d = new Date(String(v));
        if (isNaN(d.getTime())) continue;
        const ts = d.getTime();
        if (ts < minTs) { minTs = ts; minDate = d.toISOString().split('T')[0]; }
        if (ts > maxTs) { maxTs = ts; maxDate = d.toISOString().split('T')[0]; }
      }
      return { name, minDate, maxDate, nullRate: rows.length > 0 ? nullCount / rows.length : 0 };
    });

  return {
    totalRows: rows.length,
    badCount,
    badRate: rows.length > 0 ? badCount / rows.length : 0,
    segments,
    numericalCols,
    categoricalCols,
    dateCols,
  };
}

// -----------------------------------------------------------------------------
// VintageSelector Component
// -------------------------------------------------------------------------
const VintageRangeInput: React.FC<{
  vintageFrom: string;
  vintageTo: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  isDark: boolean;
}> = ({ vintageFrom, vintageTo, onFromChange, onToChange, isDark }) => {
  // Flat ordered list of all month tokens, e.g. ["Jan-19","Feb-19",...]
  const allMonths: string[] = Object.keys(VINTAGES_BY_YEAR)
    .map(Number)
    .sort((a, b) => a - b)
    .flatMap(y => VINTAGES_BY_YEAR[y]);

  // Expand a from/to range into every month in between
  const rangeToSet = (from: string, to: string): Set<string> => {
    const s = new Set<string>();
    const fi = allMonths.indexOf(from);
    const ti = allMonths.indexOf(to);
    if (fi === -1 || ti === -1) return s;
    for (let i = Math.min(fi, ti); i <= Math.max(fi, ti); i++) s.add(allMonths[i]);
    return s;
  };

  const [selected, setSelected] = useState<Set<string>>(() =>
    rangeToSet(vintageFrom, vintageTo)
  );
  const [aiSuggestion, setAiSuggestion] = useState<string[] | null>(null);

  // Propagate min/max of selected set to parent
  const propagate = (next: Set<string>) => {
    if (next.size === 0) { onFromChange(''); onToChange(''); return; }
    const sorted = allMonths.filter(m => next.has(m));
    onFromChange(sorted[0]);
    onToChange(sorted[sorted.length - 1]);
  };

  const toggle = (token: string) => {
    const next = new Set(selected);
    if (next.has(token)) next.delete(token); else next.add(token);
    setSelected(next);
    propagate(next);
  };

  const toggleYear = (year: number) => {
    const ym = VINTAGES_BY_YEAR[year];
    const allSel = ym.every(m => selected.has(m));
    const next = new Set(selected);
    if (allSel) ym.forEach(m => next.delete(m));
    else ym.forEach(m => next.add(m));
    setSelected(next);
    propagate(next);
  };

  const selectAll = () => {
    const next = new Set(allMonths);
    setSelected(next);
    propagate(next);
  };

  const clearAll = () => {
    setSelected(new Set());
    onFromChange('');
    onToChange('');
  };

  const suggestRange = () => {
    const now = new Date();
    const suggested: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - 1 - i, 1);
      suggested.push(`${MONTHS[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`);
    }
    setAiSuggestion(suggested.filter(m => allMonths.includes(m)));
  };

  const acceptSuggestion = () => {
    if (!aiSuggestion) return;
    const next = new Set(aiSuggestion);
    setSelected(next);
    propagate(next);
    setAiSuggestion(null);
  };

  const years = Object.keys(VINTAGES_BY_YEAR).map(Number).sort((a, b) => a - b);
  const sortedSelected = allMonths.filter(m => selected.has(m));
  const summary =
    selected.size === 0
      ? 'No months selected'
      : selected.size === 1
      ? sortedSelected[0]
      : `${sortedSelected[0]} - ${sortedSelected[sortedSelected.length - 1]} (${selected.size} months)`;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          Reference Vintage
        </span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={clearAll}
            className={`text-xs px-2 py-0.5 rounded hover:underline ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>
            Clear
          </button>
          <button type="button" onClick={selectAll}
            className={`text-xs px-2 py-0.5 rounded hover:underline ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>
            All
          </button>
          <button type="button" onClick={suggestRange}
            className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium ${isDark ? 'text-purple-300 hover:bg-purple-900/30' : 'text-purple-600 hover:bg-purple-50'}`}>
            <Brain size={11} /> AI Suggest
          </button>
        </div>
      </div>

      {/* Year/month grid */}
      <div className={`rounded-lg border divide-y overflow-hidden ${isDark ? 'border-gray-700 divide-gray-700' : 'border-gray-200 divide-gray-200'}`}>
        {years.map(year => {
          const ym = VINTAGES_BY_YEAR[year];
          const allSel = ym.every(m => selected.has(m));
          const someSel = !allSel && ym.some(m => selected.has(m));
          return (
            <div key={year} className={`px-3 py-2 ${isDark ? 'bg-gray-900/40' : 'bg-white'}`}>
              {/* Year row */}
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id={`yr-${year}`}
                  checked={allSel}
                  ref={el => { if (el) el.indeterminate = someSel; }}
                  onChange={() => toggleYear(year)}
                  className="w-3.5 h-3.5 cursor-pointer accent-blue-500"
                />
                <label htmlFor={`yr-${year}`}
                  className={`text-xs font-semibold cursor-pointer select-none ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>
                  {year}
                </label>
                <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  ({ym.filter(m => selected.has(m)).length}/{ym.length})
                </span>
              </div>
              {/* Month pills */}
              <div className="flex flex-wrap gap-1">
                {ym.map(token => {
                  const isSel = selected.has(token);
                  return (
                    <button
                      key={token}
                      type="button"
                      onClick={() => toggle(token)}
                      className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                        isSel
                          ? isDark
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-blue-500 border-blue-500 text-white'
                          : isDark
                            ? 'bg-transparent border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-200'
                            : 'bg-white border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600'
                      }`}
                    >
                      {token.split('-')[0]}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <p className={`text-xs mt-1.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
        Selected: <strong>{summary}</strong>
      </p>

      {/* AI suggestion banner */}
      {aiSuggestion && (
        <div className={`mt-2 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${isDark ? 'bg-purple-900/30 border border-purple-700/40 text-purple-300' : 'bg-purple-50 border border-purple-200 text-purple-700'}`}>
          <Brain size={11} />
          <span className="flex-1">
            AI suggests: last 12 months ({aiSuggestion[0]} - {aiSuggestion[aiSuggestion.length - 1]})
          </span>
          <button type="button" onClick={acceptSuggestion} className="font-semibold underline">Accept</button>
          <button type="button" onClick={() => setAiSuggestion(null)} className="opacity-60 hover:opacity-100"><X size={10} /></button>
        </div>
      )}
    </div>
  );
};

// -----------------------------------------------------------------------------
// FileDropZone Component
// -----------------------------------------------------------------------------
const FileDropZone: React.FC<{
  dataset: UploadedDataset | null;
  onFile: (file: File) => void;
  onClear: () => void;
  inputId: string;
  description: string;
  isDark: boolean;
}> = ({ dataset, onFile, onClear, inputId, description, isDark }) => {
  const [isDragging, setIsDragging] = useState(false);
  return (
    <div
      className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
        isDragging ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
        : isDark ? 'border-gray-600 hover:border-gray-400' : 'border-gray-300 hover:border-gray-400'
      }`}
      onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={e => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]); }}
      onClick={() => document.getElementById(inputId)?.click()}
    >
      <Upload className={`mx-auto mb-2 ${isDark ? 'text-gray-400' : 'text-gray-400'}`} size={24} />
      {dataset ? (
        <div className="flex items-center justify-center gap-2">
          <FileText size={14} className="text-green-500" />
          <span className="text-sm font-medium text-green-600 dark:text-green-400">{dataset.name}</span>
          <button className="ml-2 text-red-400 hover:text-red-600" onClick={e => { e.stopPropagation(); onClear(); }}>
            <X size={12} />
          </button>
        </div>
      ) : (
        <>
          <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Drag & drop a CSV, or click to browse</p>
          <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{description}</p>
        </>
      )}
      <input id={inputId} type="file" accept=".csv" className="hidden" onChange={e => { if (e.target.files?.[0]) onFile(e.target.files[0]); }} />
    </div>
  );
};

// -----------------------------------------------------------------------------
// AISuggestBadge
// -----------------------------------------------------------------------------
const AISuggestBadge: React.FC<{
  suggestion: string;
  onAccept: () => void;
  onDismiss: () => void;
  isDark: boolean;
}> = ({ suggestion, onAccept, onDismiss, isDark }) => (
  <div className={`mt-1.5 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${isDark ? 'bg-purple-900/30 border border-purple-700/40 text-purple-300' : 'bg-purple-50 border border-purple-200 text-purple-700'}`}>
    <Brain size={11} />
    <span className="flex-1">AI suggests: <strong>{suggestion}</strong></span>
    <button type="button" onClick={onAccept} className="font-semibold underline">Accept</button>
    <button type="button" onClick={onDismiss} className="opacity-60 hover:opacity-100"><X size={10} /></button>
  </div>
);

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------
export const DataIngestionStepComponent: React.FC<{
  workflow: Workflow;
  onComplete: (config: DataIngestionConfig) => void;
}> = ({ workflow, onComplete }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // -- Dataset state -------------------------------------------------------
  const [datasetType, setDatasetType] = useState<'score' | 'account' | null>(null);
  const [scoreLevelDataset, setScoreLevelDataset] = useState<UploadedDataset | null>(null);
  const [scoreParsedRows, setScoreParsedRows] = useState<Record<string, any>[]>([]);
  const [accountParsedRows, setAccountParsedRows] = useState<Record<string, any>[]>([]);
  const [accountLevelDataset, setAccountLevelDataset] = useState<UploadedDataset | null>(null);

  // -- Score level config --------------------------------------------------
  const [scoreConfig, setScoreConfig] = useState<Partial<ReferenceDatasetConfig>>({
    vintageFrom: '',
    vintageTo: '',
    performanceWindow: '',
    scoreField: '',
    targetVariable: '',
    segments: [],
    features: [],
  });

  // -- Account level config ------------------------------------------------
  const [accountConfig, setAccountConfig] = useState<Partial<ReferenceDatasetConfig>>({
    vintageFrom: '',
    vintageTo: '',
    performanceWindow: '',
    scoreField: '',
    targetVariable: '',
    segments: [],
    uniqueKey: '',
    scoreNode: '',
    targetVariableAccount: '',
    segmentAccounts: [],
    features: [],
  });

  // -- UI state ------------------------------------------------------------
  const [configSaved, setConfigSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [dataSummary, setDataSummary] = useState<DataSummary | null>(null);
  const [scoreEnhancedSummary, setScoreEnhancedSummary] = useState<EnhancedDataSummary | null>(null);
  const [accountEnhancedSummary, setAccountEnhancedSummary] = useState<EnhancedDataSummary | null>(null);
  const [summaryTab, setSummaryTab] = useState<'score' | 'account'>('score');
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, string | string[] | null>>({});
  const [customPerfValue, setCustomPerfValue] = useState('');
  const [customPerfUnit, setCustomPerfUnit] = useState('Months');

  // -- Selected model label ------------------------------------------------
  const selectedModelObj = workflow.models?.find(m => m.id === workflow.selectedModel);
  const selectedModelLabel = selectedModelObj
    ? `${selectedModelObj.name}${selectedModelObj.version ? ` (${selectedModelObj.version})` : ''}`
    : workflow.selectedModel
    ? `Model ${workflow.selectedModel.slice(-6)}`
    : 'No model selected';

  // -- Helpers -------------------------------------------------------------
  const updateScore = (patch: Partial<ReferenceDatasetConfig>) =>
    setScoreConfig(prev => ({ ...prev, ...patch }));
  const updateAccount = (patch: Partial<ReferenceDatasetConfig>) =>
    setAccountConfig(prev => ({ ...prev, ...patch }));

  const scoreColumns = scoreLevelDataset?.columnsList ?? [];
  const accountColumns = accountLevelDataset?.columnsList ?? [];

  // -- File parsers ---------------------------------------------------------
  const handleScoreFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const { headers, rows } = parseCSV(e.target?.result as string);
      if (!headers.length) return;
      const ds: UploadedDataset = {
        id: Date.now().toString(),
        name: file.name,
        rows: rows.length,
        columns: headers.length,
        uploadedAt: new Date().toLocaleString(),
        columnsList: headers,
        sampleData: rows.slice(0, 5),
      };
      setScoreLevelDataset(ds);
      setScoreParsedRows(rows);
      setScoreConfig(prev => ({
        ...prev,
        targetVariable: findColumn(headers, TARGET_HEURISTICS),
        scoreField: findColumn(headers, SCORE_HEURISTICS),
        segments: findColumn(headers, SEGMENT_HEURISTICS) ? [findColumn(headers, SEGMENT_HEURISTICS)] : [],
        features: suggestFeatures(headers),
      }));
      setConfigSaved(false);
      setSaveError(null);
      setSaveSuccess(false);
    };
    reader.readAsText(file);
  };

  const handleAccountFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const { headers, rows } = parseCSV(e.target?.result as string);
      if (!headers.length) return;
      const ds: UploadedDataset = {
        id: (Date.now() + 1).toString(),
        name: file.name,
        rows: rows.length,
        columns: headers.length,
        uploadedAt: new Date().toLocaleString(),
        columnsList: headers,
        sampleData: rows.slice(0, 5),
      };
      setAccountLevelDataset(ds);
      setAccountParsedRows(rows);
      setAccountConfig(prev => ({
        ...prev,
        uniqueKey: findColumn(headers, KEY_HEURISTICS),
        scoreNode: findColumn(headers, SCORE_HEURISTICS),
        targetVariableAccount: findColumn(headers, TARGET_HEURISTICS),
        segmentAccounts: findColumn(headers, SEGMENT_HEURISTICS) ? [findColumn(headers, SEGMENT_HEURISTICS)] : [],
        features: suggestFeatures(headers),
      }));
      setConfigSaved(false);
      setSaveError(null);
      setSaveSuccess(false);
    };
    reader.readAsText(file);
  };

  // -- AI suggestion handlers ----------------------------------------------
  const triggerSuggest = (type: string) => {
    if (type === 'score_target') {
      const s = findColumn(scoreColumns, TARGET_HEURISTICS);
      if (s) setAiSuggestions(prev => ({ ...prev, score_target: s }));
    }
    if (type === 'score_segment') {
      const s = findColumn(scoreColumns, SEGMENT_HEURISTICS);
      if (s) setAiSuggestions(prev => ({ ...prev, score_segment: s }));
    }
    if (type === 'score_features') {
      setAiSuggestions(prev => ({ ...prev, score_features: suggestFeatures(scoreColumns) }));
    }
    if (type === 'account_target') {
      const s = findColumn(accountColumns, TARGET_HEURISTICS);
      if (s) setAiSuggestions(prev => ({ ...prev, account_target: s }));
    }
    if (type === 'account_segment') {
      const s = findColumn(accountColumns, SEGMENT_HEURISTICS);
      if (s) setAiSuggestions(prev => ({ ...prev, account_segment: s }));
    }
    if (type === 'account_features') {
      setAiSuggestions(prev => ({ ...prev, account_features: suggestFeatures(accountColumns) }));
    }
  };

  const dismissSuggestion = (key: string) =>
    setAiSuggestions(prev => ({ ...prev, [key]: null }));

  // -- Save config ----------------------------------------------------------
  const handleSaveConfig = () => {
    setSaveError(null);
    setSaveSuccess(false);

    // Validation: require at least one uploaded dataset
    if (!scoreLevelDataset && !accountLevelDataset) {
      setSaveError('Please upload at least one dataset (Score Level or Account Level) before saving the configuration.');
      return;
    }

    try {
      if (scoreLevelDataset) {
        if (scoreParsedRows.length === 0) {
          setSaveError('Score Level CSV appears to be empty or could not be parsed. Please verify the file format (UTF-8 CSV with headers).');
          return;
        }
        const summary = computeDataSummary(
          scoreParsedRows,
          scoreConfig.targetVariable ?? '',
          scoreConfig.segments?.[0] ?? ''
        );
        setDataSummary(summary);
        setScoreEnhancedSummary(computeEnhancedSummary(scoreParsedRows, scoreConfig.targetVariable ?? '', scoreConfig.segments?.[0] ?? ''));
      }
      if (accountLevelDataset) {
        if (accountParsedRows.length === 0) {
          setSaveError('Account Level CSV appears to be empty or could not be parsed. Please verify the file format (UTF-8 CSV with headers).');
          return;
        }
        setAccountEnhancedSummary(computeEnhancedSummary(accountParsedRows, accountConfig.targetVariableAccount ?? '', accountConfig.segmentAccounts?.[0] ?? ''));
      }
      setConfigSaved(true);
      setSaveSuccess(true);
    } catch (err) {
      console.error('Error computing data summary:', err);
      setSaveError('An unexpected error occurred while computing the summary. Please verify your CSV files are valid and try again.');
    }
  };

  // -- Continue -------------------------------------------------------------
  const handleContinue = () => {
    if (!configSaved) return;
    const primaryDataset = scoreLevelDataset ?? accountLevelDataset;
    const primaryConfig = scoreLevelDataset ? scoreConfig : accountConfig;
    const trackDatasets: Record<string, UploadedDataset[]> = {};
    if (scoreLevelDataset) trackDatasets['score'] = [scoreLevelDataset];
    if (accountLevelDataset) trackDatasets['account'] = [accountLevelDataset];
    onComplete({
      modelId: workflow.selectedModel,
      granularity: scoreLevelDataset ? 'score' : 'account',
      referenceDataset: primaryDataset ?? undefined,
      datasetConfig: primaryConfig as ReferenceDatasetConfig,
      dataSummary: dataSummary ?? undefined,
      scoreLevelDataset: scoreLevelDataset ?? undefined,
      accountLevelDataset: accountLevelDataset ?? undefined,
      scoreLevelConfig: scoreLevelDataset ? (scoreConfig as ReferenceDatasetConfig) : undefined,
      accountLevelConfig: accountLevelDataset ? (accountConfig as ReferenceDatasetConfig) : undefined,
      trackDatasets,
    });
  };

  // -- Styles ----------------------------------------------------------------
  const card = isDark
    ? 'bg-gray-800 border border-gray-700 rounded-xl p-5'
    : 'bg-white border border-gray-200 rounded-xl p-5 shadow-sm';
  const lbl = `block text-xs font-semibold mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`;
  const inp = `w-full rounded-md px-3 py-2 text-sm border ${
    isDark ? 'bg-gray-900 border-gray-600 text-gray-100 placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
  } focus:outline-none focus:ring-2 focus:ring-blue-500`;
  const sel = inp;
  const secTitle = `text-sm font-bold mb-3 ${isDark ? 'text-gray-100' : 'text-gray-800'}`;
  const PERF_WINDOWS = ['1 Month', '3 Months', '6 Months', '9 Months', '12 Months', '18 Months', '24 Months'];

  const canContinue = (scoreLevelDataset || accountLevelDataset) && configSaved;

  // -- Column feature multi-selector -----------------------------------------
  const ColSelector: React.FC<{
    columns: string[];
    selected: string[];
    onChange: (cols: string[]) => void;
    suggestKey: string;
  }> = ({ columns, selected, onChange, suggestKey: sk }) => {
    const toggle = (col: string) => {
      if (selected.includes(col)) onChange(selected.filter(c => c !== col));
      else onChange([...selected, col]);
    };
    const suggestion = aiSuggestions[sk];
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={lbl}>Feature Columns</label>
          <button
            type="button"
            onClick={() => triggerSuggest(sk)}
            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium ${isDark ? 'text-purple-300 hover:bg-purple-900/30' : 'text-purple-600 hover:bg-purple-50'}`}
          >
            <Brain size={11} /> AI Suggest
          </button>
        </div>
        {suggestion && Array.isArray(suggestion) && (
          <AISuggestBadge
            suggestion={`${(suggestion as string[]).length} columns (excluding score/target fields)`}
            onAccept={() => { onChange(suggestion as string[]); dismissSuggestion(sk); }}
            onDismiss={() => dismissSuggestion(sk)}
            isDark={isDark}
          />
        )}
        <div className={`mt-1.5 max-h-32 overflow-y-auto rounded-md border p-2 flex flex-wrap gap-1 ${isDark ? 'border-gray-600 bg-gray-900' : 'border-gray-300 bg-gray-50'}`}>
          {columns.map(col => {
            const isSel = selected.includes(col);
            return (
              <button
                key={col}
                type="button"
                onClick={() => toggle(col)}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${isSel ? 'bg-indigo-600 text-white' : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              >
                {col}
              </button>
            );
          })}
        </div>
        <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{selected.length} of {columns.length} selected</p>
      </div>
    );
  };

  // -- Render ----------------------------------------------------------------
  return (
    <div className={`space-y-6 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>

      {/* Selected Model */}
      <div className={card}>
        <p className={lbl}>Selected Model</p>
        <p className={`text-sm font-semibold ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
          {selectedModelLabel}
        </p>
      </div>

      {/* Step 1: Select Dataset Type + Upload */}
      <div className={card}>
        <p className={secTitle}>Step 1 &mdash; Select Dataset Type</p>
        <p className={`text-xs mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Choose one dataset type. Score Level data drives discriminatory &amp; stability metrics; Account Level data drives feature-based analysis.
        </p>
        {/* Type selector */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          {/* Score Level card */}
          <button
            type="button"
            onClick={() => {
              if (datasetType === 'account') {
                setAccountLevelDataset(null);
                setAccountParsedRows([]);
                setConfigSaved(false);
              }
              setDatasetType('score');
            }}
            className={`text-left p-4 rounded-xl border-2 transition-all ${
              datasetType === 'score'
                ? (isDark ? 'border-blue-500 bg-blue-900/20' : 'border-blue-500 bg-blue-50')
                : (isDark ? 'border-gray-700 bg-gray-900/30 hover:border-blue-700/60' : 'border-gray-200 bg-white hover:border-blue-300')
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                datasetType === 'score' ? 'border-blue-500 bg-blue-500' : (isDark ? 'border-gray-500' : 'border-gray-400')
              }`}>
                {datasetType === 'score' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <div>
                <p className={`text-sm font-semibold ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>Score Level</p>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  One row per scored observation. Enables KS, AUC, Gini, PSI, Rank Order &amp; more.
                </p>
              </div>
            </div>
          </button>
          {/* Account Level card */}
          <button
            type="button"
            onClick={() => {
              if (datasetType === 'score') {
                setScoreLevelDataset(null);
                setScoreParsedRows([]);
                setConfigSaved(false);
              }
              setDatasetType('account');
            }}
            className={`text-left p-4 rounded-xl border-2 transition-all ${
              datasetType === 'account'
                ? (isDark ? 'border-purple-500 bg-purple-900/20' : 'border-purple-500 bg-purple-50')
                : (isDark ? 'border-gray-700 bg-gray-900/30 hover:border-purple-700/60' : 'border-gray-200 bg-white hover:border-purple-300')
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                datasetType === 'account' ? 'border-purple-500 bg-purple-500' : (isDark ? 'border-gray-500' : 'border-gray-400')
              }`}>
                {datasetType === 'account' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <div>
                <p className={`text-sm font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>Account Level</p>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  One row per account with feature values. Enables CSI, IV, WoE Shift &amp; feature drift.
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* Upload zone — shown only after type is selected */}
        {datasetType === 'score' && (
          <div className={`p-4 rounded-lg border ${isDark ? 'bg-gray-900/40 border-blue-700/30' : 'bg-blue-50 border-blue-200'}`}>
            <p className={`text-xs font-bold uppercase tracking-wide mb-3 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
              Score Level Dataset
            </p>
            <FileDropZone
              dataset={scoreLevelDataset}
              onFile={handleScoreFile}
              onClear={() => { setScoreLevelDataset(null); setScoreParsedRows([]); setConfigSaved(false); }}
              inputId="score-csv-input"
              description="One row per scored account / observation"
              isDark={isDark}
            />
            {scoreLevelDataset && (
              <p className={`mt-1.5 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {scoreLevelDataset.rows.toLocaleString()} rows &middot; {scoreLevelDataset.columns} columns
              </p>
            )}
            <button
              type="button"
              onClick={() => alert('Database connection coming soon. Supported: Snowflake, BigQuery, PostgreSQL, S3.')}
              className={`mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                isDark ? 'border-blue-700/50 text-blue-400 hover:bg-blue-900/20' : 'border-blue-300 text-blue-600 hover:bg-blue-100'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
              Connect to Dataset / Database
            </button>
          </div>
        )}
        {datasetType === 'account' && (
          <div className={`p-4 rounded-lg border ${isDark ? 'bg-gray-900/40 border-purple-700/30' : 'bg-purple-50 border-purple-200'}`}>
            <p className={`text-xs font-bold uppercase tracking-wide mb-3 ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
              Account Level Dataset
            </p>
            <FileDropZone
              dataset={accountLevelDataset}
              onFile={handleAccountFile}
              onClear={() => { setAccountLevelDataset(null); setAccountParsedRows([]); setConfigSaved(false); }}
              inputId="account-csv-input"
              description="One row per account with feature values"
              isDark={isDark}
            />
            {accountLevelDataset && (
              <p className={`mt-1.5 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {accountLevelDataset.rows.toLocaleString()} rows &middot; {accountLevelDataset.columns} columns
              </p>
            )}
            <button
              type="button"
              onClick={() => alert('Database connection coming soon. Supported: Snowflake, BigQuery, PostgreSQL, S3.')}
              className={`mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                isDark ? 'border-purple-700/50 text-purple-400 hover:bg-purple-900/20' : 'border-purple-300 text-purple-600 hover:bg-purple-100'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
              Connect to Dataset / Database
            </button>
          </div>
        )}
      </div>

      {/* Raw Data Preview */}
      {(scoreLevelDataset || accountLevelDataset) && (
        <div className={card}>
          <p className={secTitle}>Raw Data Preview</p>
          <p className={`text-xs mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            First 5 rows of the uploaded dataset(s). Verify your data before configuring.
          </p>
          <div className="space-y-5">
            {scoreLevelDataset && scoreLevelDataset.sampleData && scoreLevelDataset.sampleData.length > 0 && (
              <div>
                <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                  Score Level &mdash; {scoreLevelDataset.name}
                </p>
                <div className="overflow-x-auto">
                  <table className={`w-full text-xs border-collapse ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    <thead>
                      <tr>
                        {scoreLevelDataset.columnsList.map(col => (
                          <th key={col} className={`text-left px-2 py-1.5 border whitespace-nowrap font-semibold ${isDark ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-gray-100 border-gray-200 text-gray-700'}`}>
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {scoreLevelDataset.sampleData.map((row, ri) => (
                        <tr key={ri} className={isDark ? 'border-b border-gray-700/40' : 'border-b border-gray-100'}>
                          {scoreLevelDataset.columnsList.map(col => (
                            <td key={col} className={`px-2 py-1 border whitespace-nowrap ${isDark ? 'border-gray-700/30' : 'border-gray-100'}`}>
                              {String(row[col] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Showing 5 of {scoreLevelDataset.rows.toLocaleString()} rows</p>
              </div>
            )}
            {accountLevelDataset && accountLevelDataset.sampleData && accountLevelDataset.sampleData.length > 0 && (
              <div>
                <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                  Account Level &mdash; {accountLevelDataset.name}
                </p>
                <div className="overflow-x-auto">
                  <table className={`w-full text-xs border-collapse ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    <thead>
                      <tr>
                        {accountLevelDataset.columnsList.map(col => (
                          <th key={col} className={`text-left px-2 py-1.5 border whitespace-nowrap font-semibold ${isDark ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-gray-100 border-gray-200 text-gray-700'}`}>
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {accountLevelDataset.sampleData.map((row, ri) => (
                        <tr key={ri} className={isDark ? 'border-b border-gray-700/40' : 'border-b border-gray-100'}>
                          {accountLevelDataset.columnsList.map(col => (
                            <td key={col} className={`px-2 py-1 border whitespace-nowrap ${isDark ? 'border-gray-700/30' : 'border-gray-100'}`}>
                              {String(row[col] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Showing 5 of {accountLevelDataset.rows.toLocaleString()} rows</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Reference Vintage (shared between both datasets) */}
      {(scoreLevelDataset || accountLevelDataset) && (
        <div className={card}>
          <p className={secTitle}>Step 2 &mdash; Reference Vintage</p>
          <p className={`text-xs mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Specify the reference vintage date range for this monitoring run. Applies to both Score and Account datasets.
          </p>
          <VintageRangeInput
            vintageFrom={scoreConfig.vintageFrom ?? ''}
            vintageTo={scoreConfig.vintageTo ?? ''}
            onFromChange={v => { updateScore({ vintageFrom: v }); updateAccount({ vintageFrom: v }); }}
            onToChange={v => { updateScore({ vintageTo: v }); updateAccount({ vintageTo: v }); }}
            isDark={isDark}
          />

          {/* Performance Window */}
          <div className="mt-4">
            <label className={lbl}>Performance Window</label>
            {scoreConfig.performanceWindow === '__custom__' ? (
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 6"
                  value={customPerfValue}
                  onChange={e => setCustomPerfValue(e.target.value)}
                  className={`w-24 rounded-md px-3 py-2 text-sm border ${isDark ? 'bg-gray-900 border-gray-600 text-gray-100 placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
                <select
                  value={customPerfUnit}
                  onChange={e => setCustomPerfUnit(e.target.value)}
                  className={sel}
                >
                  {['Days', 'Weeks', 'Months', 'Quarters', 'Years'].map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (customPerfValue) {
                      const pw = `${customPerfValue} ${customPerfUnit}`;
                      updateScore({ performanceWindow: pw });
                      updateAccount({ performanceWindow: pw });
                    }
                  }}
                  className="px-3 py-2 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                >Set</button>
                <button
                  type="button"
                  onClick={() => { updateScore({ performanceWindow: '' }); updateAccount({ performanceWindow: '' }); }}
                  className={`px-3 py-2 rounded-md text-xs font-semibold ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                >Cancel</button>
              </div>
            ) : (
              <select
                className={sel}
                value={scoreConfig.performanceWindow ?? ''}
                onChange={e => {
                  const v = e.target.value;
                  if (v === '__custom__') {
                    updateScore({ performanceWindow: '__custom__' });
                    updateAccount({ performanceWindow: '__custom__' });
                  } else {
                    updateScore({ performanceWindow: v });
                    updateAccount({ performanceWindow: v });
                  }
                }}
              >
                <option value="">Select performance window</option>
                {PERF_WINDOWS.map(w => <option key={w} value={w}>{w}</option>)}
                <option value="__custom__">Other (custom)...</option>
              </select>
            )}
            {scoreConfig.performanceWindow && scoreConfig.performanceWindow !== '__custom__' && (
              <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                Selected: <strong>{scoreConfig.performanceWindow}</strong>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Score Level Configuration */}
      {scoreLevelDataset && (
        <div className={card}>
          <p className={secTitle}>Step 3 &mdash; Score Level Configuration</p>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-900/60' : 'bg-blue-50/50'}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Score Field */}
              <div>
                <label className={lbl}>Score Field</label>
                <select className={sel} value={scoreConfig.scoreField ?? ''} onChange={e => updateScore({ scoreField: e.target.value })}>
                  <option value="">Select column</option>
                  {scoreColumns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {/* Target Variable */}
              <div>
                <label className={lbl}>Target Variable</label>
                <div className="flex gap-1">
                  <select className={`${sel} flex-1`} value={scoreConfig.targetVariable ?? ''} onChange={e => updateScore({ targetVariable: e.target.value })}>
                    <option value="">Select column</option>
                    {scoreColumns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button
                    type="button"
                    title="AI Suggest"
                    onClick={() => triggerSuggest('score_target')}
                    className={`px-2 rounded border ${isDark ? 'border-gray-600 bg-gray-700 text-purple-300 hover:bg-purple-900/30' : 'border-gray-300 bg-white text-purple-600 hover:bg-purple-50'}`}
                  >
                    <Brain size={13} />
                  </button>
                </div>
                {aiSuggestions['score_target'] && typeof aiSuggestions['score_target'] === 'string' && (
                  <AISuggestBadge
                    suggestion={aiSuggestions['score_target']}
                    onAccept={() => { updateScore({ targetVariable: aiSuggestions['score_target'] as string }); dismissSuggestion('score_target'); }}
                    onDismiss={() => dismissSuggestion('score_target')}
                    isDark={isDark}
                  />
                )}
              </div>
            </div>
            {/* Segment Variables — multiple */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <label className={lbl}>Segment Variables</label>
                <button
                  type="button"
                  onClick={() => triggerSuggest('score_segment')}
                  className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium ${isDark ? 'text-purple-300 hover:bg-purple-900/30' : 'text-purple-600 hover:bg-purple-50'}`}
                >
                  <Brain size={11} /> AI Suggest
                </button>
              </div>
              {aiSuggestions['score_segment'] && typeof aiSuggestions['score_segment'] === 'string' && (
                <AISuggestBadge
                  suggestion={aiSuggestions['score_segment']}
                  onAccept={() => { updateScore({ segments: [...(scoreConfig.segments ?? []), aiSuggestions['score_segment'] as string] }); dismissSuggestion('score_segment'); }}
                  onDismiss={() => dismissSuggestion('score_segment')}
                  isDark={isDark}
                />
              )}
              <div className="space-y-2 mt-1.5">
                {(scoreConfig.segments ?? []).map((seg, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select
                      className={`${sel} flex-1`}
                      value={seg}
                      onChange={e => {
                        const segs = [...(scoreConfig.segments ?? [])];
                        segs[idx] = e.target.value;
                        updateScore({ segments: segs });
                      }}
                    >
                      <option value="">Select column</option>
                      {scoreColumns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => updateScore({ segments: (scoreConfig.segments ?? []).filter((_, i) => i !== idx) })}
                      className={`p-1.5 rounded ${isDark ? 'text-red-400 hover:bg-red-900/20' : 'text-red-500 hover:bg-red-50'}`}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => updateScore({ segments: [...(scoreConfig.segments ?? []), ''] })}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${isDark ? 'border-blue-700/50 text-blue-400 hover:bg-blue-900/20' : 'border-blue-300 text-blue-600 hover:bg-blue-50'}`}
                >
                  <Plus size={12} /> Add Segment Variable
                </button>
              </div>
            </div>
            {/* Feature columns */}
            <ColSelector
              columns={scoreColumns}
              selected={scoreConfig.features ?? []}
              onChange={cols => updateScore({ features: cols })}
              suggestKey="score_features"
            />
          </div>
        </div>
      )}

      {/* Step 4 (or 3): Account Level Configuration */}
      {accountLevelDataset && (
        <div className={card}>
          <p className={secTitle}>Step {scoreLevelDataset ? '4' : '3'} &mdash; Account Level Configuration</p>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-900/60' : 'bg-purple-50/50'}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Unique Key */}
              <div>
                <label className={lbl}>Unique Key</label>
                <select className={sel} value={accountConfig.uniqueKey ?? ''} onChange={e => updateAccount({ uniqueKey: e.target.value })}>
                  <option value="">Select column</option>
                  {accountColumns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {/* Score Node */}
              <div>
                <label className={lbl}>Score Node</label>
                <select className={sel} value={accountConfig.scoreNode ?? ''} onChange={e => updateAccount({ scoreNode: e.target.value })}>
                  <option value="">Select column</option>
                  {accountColumns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {/* Target Variable */}
              <div className="md:col-span-2">
                <label className={lbl}>Target Variable</label>
                <div className="flex gap-1">
                  <select className={`${sel} flex-1`} value={accountConfig.targetVariableAccount ?? ''} onChange={e => updateAccount({ targetVariableAccount: e.target.value })}>
                    <option value="">Select column</option>
                    {accountColumns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button
                    type="button"
                    title="AI Suggest"
                    onClick={() => triggerSuggest('account_target')}
                    className={`px-2 rounded border ${isDark ? 'border-gray-600 bg-gray-700 text-purple-300 hover:bg-purple-900/30' : 'border-gray-300 bg-white text-purple-600 hover:bg-purple-50'}`}
                  >
                    <Brain size={13} />
                  </button>
                </div>
                {aiSuggestions['account_target'] && typeof aiSuggestions['account_target'] === 'string' && (
                  <AISuggestBadge
                    suggestion={aiSuggestions['account_target']}
                    onAccept={() => { updateAccount({ targetVariableAccount: aiSuggestions['account_target'] as string }); dismissSuggestion('account_target'); }}
                    onDismiss={() => dismissSuggestion('account_target')}
                    isDark={isDark}
                  />
                )}
              </div>
            </div>
            {/* Segment Variables — multiple */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <label className={lbl}>Segment Variables</label>
                <button
                  type="button"
                  onClick={() => triggerSuggest('account_segment')}
                  className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium ${isDark ? 'text-purple-300 hover:bg-purple-900/30' : 'text-purple-600 hover:bg-purple-50'}`}
                >
                  <Brain size={11} /> AI Suggest
                </button>
              </div>
              {aiSuggestions['account_segment'] && typeof aiSuggestions['account_segment'] === 'string' && (
                <AISuggestBadge
                  suggestion={aiSuggestions['account_segment']}
                  onAccept={() => { updateAccount({ segmentAccounts: [...(accountConfig.segmentAccounts ?? []), aiSuggestions['account_segment'] as string] }); dismissSuggestion('account_segment'); }}
                  onDismiss={() => dismissSuggestion('account_segment')}
                  isDark={isDark}
                />
              )}
              <div className="space-y-2 mt-1.5">
                {(accountConfig.segmentAccounts ?? []).map((seg, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select
                      className={`${sel} flex-1`}
                      value={seg}
                      onChange={e => {
                        const segs = [...(accountConfig.segmentAccounts ?? [])];
                        segs[idx] = e.target.value;
                        updateAccount({ segmentAccounts: segs });
                      }}
                    >
                      <option value="">Select column</option>
                      {accountColumns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => updateAccount({ segmentAccounts: (accountConfig.segmentAccounts ?? []).filter((_, i) => i !== idx) })}
                      className={`p-1.5 rounded ${isDark ? 'text-red-400 hover:bg-red-900/20' : 'text-red-500 hover:bg-red-50'}`}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => updateAccount({ segmentAccounts: [...(accountConfig.segmentAccounts ?? []), ''] })}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${isDark ? 'border-purple-700/50 text-purple-400 hover:bg-purple-900/20' : 'border-purple-300 text-purple-600 hover:bg-purple-50'}`}
                >
                  <Plus size={12} /> Add Segment Variable
                </button>
              </div>
            </div>
            {/* Feature columns */}
            <ColSelector
              columns={accountColumns}
              selected={accountConfig.features ?? []}
              onChange={cols => updateAccount({ features: cols })}
              suggestKey="account_features"
            />
          </div>
        </div>
      )}

      {/* Save Config button */}
      <div>
        <button
          type="button"
          onClick={handleSaveConfig}
          disabled={!scoreLevelDataset && !accountLevelDataset}
          className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            scoreLevelDataset || accountLevelDataset
              ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer'
              : isDark
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Save Configuration &amp; Compute Summary
        </button>
        {saveError && (
          <div className={`mt-2 flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs font-medium border ${
            isDark
              ? 'bg-red-900/30 border-red-700/50 text-red-300'
              : 'bg-red-50 border-red-300 text-red-700'
          }`}>
            <svg className="flex-shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>{saveError}</span>
          </div>
        )}
        {saveSuccess && !saveError && (
          <div className={`mt-2 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border ${
            isDark
              ? 'bg-green-900/30 border-green-700/50 text-green-300'
              : 'bg-green-50 border-green-300 text-green-700'
          }`}>
            <svg className="flex-shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <span>Configuration saved! Data summary computed successfully.</span>
          </div>
        )}
      </div>

      {/* Data Summary */}
      {configSaved && (scoreEnhancedSummary || accountEnhancedSummary) && (
        <div className={card}>
          <div className="flex items-center justify-between mb-4">
            <p className={secTitle}>Data Summary</p>
            {scoreEnhancedSummary && accountEnhancedSummary && (
              <div className={`flex border rounded-lg overflow-hidden ${isDark ? 'border-gray-600' : 'border-gray-200'}`}>
                {(['score', 'account'] as const).map(lvl => (
                  <button
                    key={lvl}
                    onClick={() => setSummaryTab(lvl)}
                    className={`px-4 py-1.5 text-xs font-semibold capitalize transition ${
                      summaryTab === lvl
                        ? 'bg-blue-600 text-white'
                        : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {lvl === 'score' ? 'Score Level' : 'Account Level'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {(() => {
            const enh = (scoreEnhancedSummary && accountEnhancedSummary)
              ? (summaryTab === 'score' ? scoreEnhancedSummary : accountEnhancedSummary)
              : (scoreEnhancedSummary || accountEnhancedSummary);
            if (!enh) return null;
            const colCount = enh.numericalCols.length + enh.categoricalCols.length + enh.dateCols.length;
            return (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                  {[
                    { label: 'Total Rows', value: enh.totalRows.toLocaleString() },
                    { label: 'Columns', value: colCount.toString() },
                    { label: 'Bad Count', value: enh.badCount.toLocaleString() },
                    { label: 'Bad Rate', value: `${(enh.badRate * 100).toFixed(2)}%` },
                  ].map(({ label: l, value }) => (
                    <div key={l} className={`rounded-lg p-3 text-center ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
                      <p className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{l}</p>
                      <p className={`text-base font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2 mb-5">
                  {[
                    { label: 'Numerical', count: enh.numericalCols.length, color: isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700' },
                    { label: 'Categorical', count: enh.categoricalCols.length, color: isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700' },
                    { label: 'Date', count: enh.dateCols.length, color: isDark ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700' },
                  ].map(({ label, count, color }) => (
                    <div key={label} className={`rounded-lg p-3 text-center ${color}`}>
                      <p className="text-lg font-bold">{count}</p>
                      <p className="text-xs font-medium">{label} cols</p>
                    </div>
                  ))}
                </div>

                {enh.numericalCols.length > 0 && (
                  <div className="mb-4">
                    <p className={`text-xs font-semibold mb-2 uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Numerical Variables</p>
                    <div className="overflow-x-auto">
                      <table className={`w-full text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        <thead>
                          <tr className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                            {['Column', 'Mean', 'Std Dev', 'Min', 'Max', 'Null%'].map(h => (
                              <th key={h} className="text-left py-1.5 pr-4">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {enh.numericalCols.slice(0, 8).map(col => (
                            <tr key={col.name} className={`border-b ${isDark ? 'border-gray-700/50' : 'border-gray-100'}`}>
                              <td className="py-1.5 pr-4 font-medium">{col.name}</td>
                              <td className="py-1.5 pr-4">{col.mean.toFixed(2)}</td>
                              <td className="py-1.5 pr-4">{col.std.toFixed(2)}</td>
                              <td className="py-1.5 pr-4">{col.min.toFixed(2)}</td>
                              <td className="py-1.5 pr-4">{col.max.toFixed(2)}</td>
                              <td className="py-1.5">{(col.nullRate * 100).toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {enh.categoricalCols.length > 0 && (
                  <div className="mb-4">
                    <p className={`text-xs font-semibold mb-2 uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Categorical Variables</p>
                    <div className="overflow-x-auto">
                      <table className={`w-full text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        <thead>
                          <tr className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                            {['Column', 'Unique', 'Top Value', 'Top%', 'Null%'].map(h => (
                              <th key={h} className="text-left py-1.5 pr-4">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {enh.categoricalCols.slice(0, 8).map(col => (
                            <tr key={col.name} className={`border-b ${isDark ? 'border-gray-700/50' : 'border-gray-100'}`}>
                              <td className="py-1.5 pr-4 font-medium">{col.name}</td>
                              <td className="py-1.5 pr-4">{col.uniqueCount}</td>
                              <td className="py-1.5 pr-4 max-w-24 truncate">{col.topValue}</td>
                              <td className="py-1.5 pr-4">{col.topPercent.toFixed(1)}%</td>
                              <td className="py-1.5">{(col.nullRate * 100).toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {enh.dateCols.length > 0 && (
                  <div className="mb-4">
                    <p className={`text-xs font-semibold mb-2 uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Date Variables</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {enh.dateCols.slice(0, 4).map(col => (
                        <div key={col.name} className={`rounded-lg p-3 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
                          <p className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>{col.name}</p>
                          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{col.minDate} → {col.maxDate}</p>
                          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Null: {(col.nullRate * 100).toFixed(1)}%</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {Object.keys(enh.segments).length > 1 && (
                  <div>
                    <p className={`text-xs font-semibold mb-2 uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Segment Breakdown</p>
                    <div className="overflow-x-auto">
                      <table className={`w-full text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        <thead>
                          <tr className={isDark ? 'border-b border-gray-700' : 'border-b border-gray-200'}>
                            <th className="text-left py-1.5 pr-4">Segment</th>
                            <th className="text-right py-1.5 pr-4">Volume</th>
                            <th className="text-right py-1.5 pr-4">Bad Count</th>
                            <th className="text-right py-1.5">Bad Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(enh.segments).map(([seg, info]) => (
                            <tr key={seg} className={isDark ? 'border-b border-gray-700/50' : 'border-b border-gray-100'}>
                              <td className="py-1 pr-4 font-medium">{seg}</td>
                              <td className="text-right py-1 pr-4">{info.volume.toLocaleString()}</td>
                              <td className="text-right py-1 pr-4">{info.badCount.toLocaleString()}</td>
                              <td className="text-right py-1">{info.volume > 0 ? `${(info.badCount / info.volume * 100).toFixed(2)}%` : 'N/A'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Continue */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleContinue}
          disabled={!canContinue}
          className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
            canContinue
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
              : isDark ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Continue &rarr;
        </button>
      </div>
    </div>
  );
};
