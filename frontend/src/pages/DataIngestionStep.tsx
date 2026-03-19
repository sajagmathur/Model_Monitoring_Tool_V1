import React, { useState } from 'react';
import { Upload, FileText, X, Brain, ChevronDown, ChevronRight } from 'lucide-react';
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
  observationVintages: string[];
  performanceWindow: string;
  // Score Level
  scoreField: string;
  targetVariable: string;
  segment: string;
  // Account Level (only when granularity = 'account')
  uniqueKey?: string;
  scoreNode?: string;
  targetVariableAccount?: string;
  exclusionField?: string;
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

// Suggest last 12 months as default vintages
function suggestRecentVintages(): string[] {
  const now = new Date();
  const result: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push(`${MONTHS[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`);
  }
  return result;
}

// CSV parser helper
function parseCSV(text: string): { headers: string[]; rows: Record<string, any>[] } {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map(line => {
    const vals = line.split(',');
    const obj: Record<string, any> = {};
    headers.forEach((h, i) => { obj[h] = vals[i]?.trim().replace(/^"|"$/g, '') ?? ''; });
    return obj;
  });
  return { headers, rows };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Helper: compute data summary from parsed CSV rows
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// VintageSelector Component
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const VintageSelector: React.FC<{
  selected: string[];
  onChange: (vintages: string[]) => void;
  onAISuggest: () => void;
  isDark: boolean;
}> = ({ selected, onChange, onAISuggest, isDark }) => {
  const [expandedYears, setExpandedYears] = useState<Record<number, boolean>>({});
  const [customVintage, setCustomVintage] = useState('');

  const toggle = (v: string) => {
    if (selected.includes(v)) onChange(selected.filter(x => x !== v));
    else onChange([...selected, v]);
  };

  const toggleYear = (year: number) => {
    const yearVintages = VINTAGES_BY_YEAR[year] ?? [];
    const allSelected = yearVintages.every(v => selected.includes(v));
    if (allSelected) onChange(selected.filter(v => !yearVintages.includes(v)));
    else onChange([...new Set([...selected, ...yearVintages])]);
  };

  const toggleExpand = (year: number) =>
    setExpandedYears(prev => ({ ...prev, [year]: !prev[year] }));

  const addCustom = () => {
    const v = customVintage.trim();
    if (v && !selected.includes(v)) onChange([...selected, v]);
    setCustomVintage('');
  };

  const years = Object.keys(VINTAGES_BY_YEAR).map(Number).sort((a, b) => b - a);

  const monthBtn = (sel: boolean) =>
    `px-2 py-0.5 rounded text-xs font-medium transition-colors ${
      sel ? 'bg-blue-600 text-white' : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
    }`;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {selected.length} vintage{selected.length !== 1 ? 's' : ''} selected
        </span>
        <button
          type="button"
          onClick={onAISuggest}
          className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
            isDark ? 'bg-purple-900/40 text-purple-300 hover:bg-purple-900/60' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
          }`}
        >
          <Brain size={12} /> AI Suggest (last 12 months)
        </button>
      </div>

      {/* Year accordion */}
      <div className={`rounded-lg border ${isDark ? 'border-gray-600 bg-gray-900' : 'border-gray-300 bg-gray-50'} max-h-64 overflow-y-auto`}>
        {years.map(year => {
          const yearVintages = VINTAGES_BY_YEAR[year] ?? [];
          const selectedCount = yearVintages.filter(v => selected.includes(v)).length;
          const allSel = selectedCount === yearVintages.length;
          const expanded = expandedYears[year] ?? false;
          return (
            <div key={year} className={`border-b last:border-b-0 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <div
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-xs font-semibold transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-gray-100 text-gray-800'}`}
                onClick={() => toggleExpand(year)}
              >
                {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span>{year}</span>
                <span className={`ml-0.5 font-normal ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  ({selectedCount}/{yearVintages.length})
                </span>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); toggleYear(year); }}
                  className={`ml-auto text-xs px-2 py-0.5 rounded font-medium ${
                    allSel
                      ? isDark ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700'
                      : isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {allSel ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              {expanded && (
                <div className="px-4 pb-2 flex flex-wrap gap-1">
                  {yearVintages.map(v => (
                    <button key={v} type="button" onClick={() => toggle(v)} className={monthBtn(selected.includes(v))}>
                      {v}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Custom vintage input */}
      <div className="flex gap-2 mt-2">
        <input
          type="text"
          value={customVintage}
          onChange={e => setCustomVintage(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addCustom(); }}
          placeholder="Custom vintage (e.g. Mar-25)"
          className={`flex-1 rounded-md px-3 py-1.5 text-xs border ${isDark ? 'bg-gray-900 border-gray-600 text-gray-100 placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'}`}
        />
        <button type="button" onClick={addCustom} className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700">Add</button>
      </div>

      {/* Selected tags */}
      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {selected.map(v => (
            <span key={v} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
              {v}
              <button type="button" onClick={() => toggle(v)} className="hover:text-red-400"><X size={10} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// FileDropZone Component
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// AISuggestBadge
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Main Component
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const DataIngestionStepComponent: React.FC<{
  workflow: Workflow;
  onComplete: (config: DataIngestionConfig) => void;
}> = ({ workflow, onComplete }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // â”€â”€ Dataset state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [scoreLevelDataset, setScoreLevelDataset] = useState<UploadedDataset | null>(null);
  const [scoreParsedRows, setScoreParsedRows] = useState<Record<string, any>[]>([]);
  const [accountLevelDataset, setAccountLevelDataset] = useState<UploadedDataset | null>(null);

  // â”€â”€ Score level config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [scoreConfig, setScoreConfig] = useState<Partial<ReferenceDatasetConfig>>({
    observationVintages: [],
    performanceWindow: '',
    scoreField: '',
    targetVariable: '',
    segment: '',
    features: [],
  });

  // â”€â”€ Account level config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [accountConfig, setAccountConfig] = useState<Partial<ReferenceDatasetConfig>>({
    observationVintages: [],
    performanceWindow: '',
    scoreField: '',
    targetVariable: '',
    segment: '',
    uniqueKey: '',
    scoreNode: '',
    targetVariableAccount: '',
    exclusionField: '',
    segmentAccount: '',
    features: [],
  });

  // â”€â”€ UI state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [configSaved, setConfigSaved] = useState(false);
  const [dataSummary, setDataSummary] = useState<DataSummary | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, string | string[] | null>>({});

  // â”€â”€ Selected model label â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const selectedModelObj = workflow.models?.find(m => m.id === workflow.selectedModel);
  const selectedModelLabel = selectedModelObj
    ? `${selectedModelObj.name}${selectedModelObj.version ? ` (v${selectedModelObj.version})` : ''}`
    : workflow.selectedModel
    ? `Model ${workflow.selectedModel.slice(-6)}`
    : 'No model selected';

  // â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const updateScore = (patch: Partial<ReferenceDatasetConfig>) =>
    setScoreConfig(prev => ({ ...prev, ...patch }));
  const updateAccount = (patch: Partial<ReferenceDatasetConfig>) =>
    setAccountConfig(prev => ({ ...prev, ...patch }));

  const scoreColumns = scoreLevelDataset?.columnsList ?? [];
  const accountColumns = accountLevelDataset?.columnsList ?? [];

  // â”€â”€ File parsers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        segment: findColumn(headers, SEGMENT_HEURISTICS),
        features: suggestFeatures(headers),
      }));
      setConfigSaved(false);
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
      setAccountConfig(prev => ({
        ...prev,
        uniqueKey: findColumn(headers, KEY_HEURISTICS),
        scoreNode: findColumn(headers, SCORE_HEURISTICS),
        targetVariableAccount: findColumn(headers, TARGET_HEURISTICS),
        segmentAccount: findColumn(headers, SEGMENT_HEURISTICS),
        features: suggestFeatures(headers),
      }));
      setConfigSaved(false);
    };
    reader.readAsText(file);
  };

  // â”€â”€ AI suggestion handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Save config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleSaveConfig = () => {
    if (scoreLevelDataset) {
      const summary = computeDataSummary(
        scoreParsedRows,
        scoreConfig.targetVariable ?? '',
        scoreConfig.segment ?? ''
      );
      setDataSummary(summary);
    }
    setConfigSaved(true);
  };

  // â”€â”€ Continue â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Column feature multi-selector â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className={`space-y-6 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>

      {/* Selected Model */}
      <div className={card}>
        <p className={lbl}>Selected Model</p>
        <p className={`text-sm font-semibold ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
          {selectedModelLabel}
        </p>
      </div>

      {/* Step 1: Upload Datasets */}
      <div className={card}>
        <p className={secTitle}>Step 1 &mdash; Upload Reference Datasets</p>
        <p className={`text-xs mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Upload one or both datasets. Score Level data is used for discriminatory and stability metrics; Account Level data drives feature-based analysis.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Score Level */}
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
          </div>
          {/* Account Level */}
          <div className={`p-4 rounded-lg border ${isDark ? 'bg-gray-900/40 border-purple-700/30' : 'bg-purple-50 border-purple-200'}`}>
            <p className={`text-xs font-bold uppercase tracking-wide mb-3 ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
              Account Level Dataset
            </p>
            <FileDropZone
              dataset={accountLevelDataset}
              onFile={handleAccountFile}
              onClear={() => { setAccountLevelDataset(null); setConfigSaved(false); }}
              inputId="account-csv-input"
              description="One row per account with feature values"
              isDark={isDark}
            />
            {accountLevelDataset && (
              <p className={`mt-1.5 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {accountLevelDataset.rows.toLocaleString()} rows &middot; {accountLevelDataset.columns} columns
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Step 2: Observation Vintages (shared between both datasets) */}
      {(scoreLevelDataset || accountLevelDataset) && (
        <div className={card}>
          <p className={secTitle}>Step 2 &mdash; Observation Vintages</p>
          <p className={`text-xs mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Select which monthly cohorts to include in the monitoring run. Applies to both Score and Account datasets.
          </p>
          <VintageSelector
            selected={scoreConfig.observationVintages ?? []}
            onChange={vintages => {
              updateScore({ observationVintages: vintages });
              updateAccount({ observationVintages: vintages });
            }}
            onAISuggest={() => {
              const suggested = suggestRecentVintages();
              updateScore({ observationVintages: suggested });
              updateAccount({ observationVintages: suggested });
            }}
            isDark={isDark}
          />

          {/* Performance Window */}
          <div className="mt-4">
            <label className={lbl}>Performance Window</label>
            <select
              className={sel}
              value={scoreConfig.performanceWindow ?? ''}
              onChange={e => { updateScore({ performanceWindow: e.target.value }); updateAccount({ performanceWindow: e.target.value }); }}
            >
              <option value="">Select performance window</option>
              {PERF_WINDOWS.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Step 3: Score Level Configuration */}
      {scoreLevelDataset && (
        <div className={card}>
          <p className={secTitle}>Step 3 &mdash; Score Level Configuration</p>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-900/60' : 'bg-blue-50/50'}`}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
              {/* Segment */}
              <div>
                <label className={lbl}>Segment Column</label>
                <div className="flex gap-1">
                  <select className={`${sel} flex-1`} value={scoreConfig.segment ?? ''} onChange={e => updateScore({ segment: e.target.value })}>
                    <option value="">None</option>
                    {scoreColumns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button
                    type="button"
                    title="AI Suggest"
                    onClick={() => triggerSuggest('score_segment')}
                    className={`px-2 rounded border ${isDark ? 'border-gray-600 bg-gray-700 text-purple-300 hover:bg-purple-900/30' : 'border-gray-300 bg-white text-purple-600 hover:bg-purple-50'}`}
                  >
                    <Brain size={13} />
                  </button>
                </div>
                {aiSuggestions['score_segment'] && typeof aiSuggestions['score_segment'] === 'string' && (
                  <AISuggestBadge
                    suggestion={aiSuggestions['score_segment']}
                    onAccept={() => { updateScore({ segment: aiSuggestions['score_segment'] as string }); dismissSuggestion('score_segment'); }}
                    onDismiss={() => dismissSuggestion('score_segment')}
                    isDark={isDark}
                  />
                )}
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
              <div>
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
              {/* Segment */}
              <div>
                <label className={lbl}>Segment Column</label>
                <div className="flex gap-1">
                  <select className={`${sel} flex-1`} value={accountConfig.segmentAccount ?? ''} onChange={e => updateAccount({ segmentAccount: e.target.value })}>
                    <option value="">None</option>
                    {accountColumns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button
                    type="button"
                    title="AI Suggest"
                    onClick={() => triggerSuggest('account_segment')}
                    className={`px-2 rounded border ${isDark ? 'border-gray-600 bg-gray-700 text-purple-300 hover:bg-purple-900/30' : 'border-gray-300 bg-white text-purple-600 hover:bg-purple-50'}`}
                  >
                    <Brain size={13} />
                  </button>
                </div>
                {aiSuggestions['account_segment'] && typeof aiSuggestions['account_segment'] === 'string' && (
                  <AISuggestBadge
                    suggestion={aiSuggestions['account_segment']}
                    onAccept={() => { updateAccount({ segmentAccount: aiSuggestions['account_segment'] as string }); dismissSuggestion('account_segment'); }}
                    onDismiss={() => dismissSuggestion('account_segment')}
                    isDark={isDark}
                  />
                )}
              </div>
              {/* Exclusion Field */}
              <div>
                <label className={lbl}>Exclusion Field</label>
                <select className={sel} value={accountConfig.exclusionField ?? ''} onChange={e => updateAccount({ exclusionField: e.target.value })}>
                  <option value="">None</option>
                  {accountColumns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
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
      {(scoreLevelDataset || accountLevelDataset) && (
        <button
          type="button"
          onClick={handleSaveConfig}
          className="w-full py-2.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors"
        >
          Save Configuration &amp; Compute Summary
        </button>
      )}

      {/* Data Summary */}
      {configSaved && dataSummary && (
        <div className={card}>
          <p className={secTitle}>Data Summary</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {[
              { label: 'Total Volume', value: dataSummary.totalVolume.toLocaleString() },
              { label: 'Segments', value: Object.keys(dataSummary.segments).length },
              { label: 'Overall Bad Count', value: dataSummary.overallBadCount.toLocaleString() },
              { label: 'Overall Bad Rate', value: `${(dataSummary.overallBadRate * 100).toFixed(2)}%` },
            ].map(({ label: l, value }) => (
              <div key={l} className={`rounded-lg p-4 text-center ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
                <p className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{l}</p>
                <p className={`text-lg font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{value}</p>
              </div>
            ))}
          </div>
          {Object.keys(dataSummary.segments).length > 1 && (
            <div className="overflow-x-auto">
              <table className={`w-full text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                <thead>
                  <tr className={isDark ? 'border-b border-gray-700' : 'border-b border-gray-200'}>
                    <th className="text-left py-2 pr-4">Segment</th>
                    <th className="text-right py-2 pr-4">Volume</th>
                    <th className="text-right py-2 pr-4">Bad Count</th>
                    <th className="text-right py-2">Bad Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(dataSummary.segments).map(([seg, info]) => (
                    <tr key={seg} className={isDark ? 'border-b border-gray-700/50' : 'border-b border-gray-100'}>
                      <td className="py-1.5 pr-4 font-medium">{seg}</td>
                      <td className="text-right py-1.5 pr-4">{info.volume.toLocaleString()}</td>
                      <td className="text-right py-1.5 pr-4">{info.badCount.toLocaleString()}</td>
                      <td className="text-right py-1.5">{info.volume > 0 ? `${(info.badCount / info.volume * 100).toFixed(2)}%` : 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
