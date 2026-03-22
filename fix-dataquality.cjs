const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'src', 'pages', 'DataQuality.tsx');
let content = fs.readFileSync(filePath, 'utf8');
// Normalize CRLF→LF so template literal strings match
content = content.replace(/\r\n/g, '\n');

// ── Change 1: Add Layers + List to lucide-react imports ──────────────────────
content = content.replace(
  `  Shield, ChevronRight, CheckCircle, BarChart3, TrendingUp,
  Database, Zap, Download, Folder, Package, ArrowLeft`,
  `  Shield, ChevronRight, CheckCircle, BarChart3, TrendingUp,
  Database, Zap, Download, Folder, Package, ArrowLeft, Layers, List`
);

// ── Change 2: activeTab type ──────────────────────────────────────────────────
content = content.replace(
  `const [activeTab, setActiveTab] = useState<'overview' | 'distributions' | 'volume'>('overview');`,
  `const [activeTab, setActiveTab] = useState<'overview' | 'segments' | 'variable-format' | 'distributions' | 'volume'>('overview');`
);

// ── Change 3: Inject computation helpers before "const metrics = ..." ─────────
const helperFunctions = `
  // ── Segment & variable analysis helpers ──────────────────────────────────
  const getAcctsColumn = (rows: Record<string, any>[]): string | null => {
    if (rows.length === 0) return null;
    const keys = Object.keys(rows[0]);
    return keys.find(k => /^accts?$/i.test(k) || /^accounts?$/i.test(k)) ?? null;
  };

  const getBadsColumn = (rows: Record<string, any>[]): string | null => {
    if (rows.length === 0) return null;
    const keys = Object.keys(rows[0]);
    return (
      keys.find(k => /default_fp|default_ew|_bads?|bad_flag/i.test(k)) ??
      keys.find(k => /^bad$|^bads$/i.test(k)) ??
      null
    );
  };

  const getTotalVolume = (rows: Record<string, any>[]): number => {
    const col = getAcctsColumn(rows);
    if (!col) return rows.length;
    return rows.reduce((sum, r) => sum + (Number(r[col]) || 0), 0);
  };

  const computeSegmentBreakdown = (
    rows: Record<string, any>[],
    colName: string
  ): Array<{ cls: string; volume: number; bads: number }> => {
    const acctCol = getAcctsColumn(rows);
    const badsCol = getBadsColumn(rows);
    const map = new Map<string, { volume: number; bads: number }>();
    for (const r of rows) {
      const key = String(r[colName] ?? '(blank)');
      const v = map.get(key) ?? { volume: 0, bads: 0 };
      v.volume += acctCol ? (Number(r[acctCol]) || 0) : 1;
      v.bads += badsCol ? (Number(r[badsCol]) || 0) : 0;
      map.set(key, v);
    }
    return Array.from(map.entries())
      .map(([cls, { volume, bads }]) => ({ cls, volume, bads }))
      .sort((a, b) => b.volume - a.volume);
  };

  const computeNumericalStats = (
    rows: Record<string, any>[],
    col: string
  ): { count: number; missing: number; missingPct: number; min: number; max: number; mean: number; median: number; std: number; iqr: number } => {
    const vals = rows
      .map(r => r[col])
      .filter(v => v !== '' && v !== null && v !== undefined && !isNaN(Number(v)))
      .map(Number)
      .sort((a, b) => a - b);
    const missing = rows.length - vals.length;
    if (vals.length === 0) return { count: 0, missing, missingPct: 100, min: 0, max: 0, mean: 0, median: 0, std: 0, iqr: 0 };
    const sum = vals.reduce((a, b) => a + b, 0);
    const mean = sum / vals.length;
    const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
    const q1 = vals[Math.floor(vals.length * 0.25)];
    const q3 = vals[Math.floor(vals.length * 0.75)];
    return {
      count: vals.length,
      missing,
      missingPct: rows.length > 0 ? (missing / rows.length) * 100 : 0,
      min: vals[0],
      max: vals[vals.length - 1],
      mean,
      median: vals[Math.floor(vals.length / 2)],
      std: Math.sqrt(variance),
      iqr: q3 - q1,
    };
  };

  const computeCategoricalStats = (
    rows: Record<string, any>[],
    col: string
  ): { count: number; missing: number; missingPct: number; distribution: Array<{ value: string; count: number; pct: number }> } => {
    const freq = new Map<string, number>();
    let missing = 0;
    for (const r of rows) {
      const v = r[col];
      if (v === '' || v === null || v === undefined) { missing++; continue; }
      const key = String(v);
      freq.set(key, (freq.get(key) ?? 0) + 1);
    }
    const total = rows.length;
    const distribution = Array.from(freq.entries())
      .map(([value, count]) => ({ value, count, pct: (count / total) * 100 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    return { count: total - missing, missing, missingPct: total > 0 ? (missing / total) * 100 : 0, distribution };
  };

`;

content = content.replace(
  `  const metrics = selectedDataset ? getComprehensiveMetrics(selectedDataset) : null;`,
  helperFunctions + `  const metrics = selectedDataset ? getComprehensiveMetrics(selectedDataset) : null;`
);

// ── Change 4: Update tabs array ───────────────────────────────────────────────
content = content.replace(
  `  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'distributions', label: 'Distributions', icon: TrendingUp },
    { id: 'volume', label: 'Volume/Event Rate', icon: Database },
  ];`,
  `  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'segments', label: 'Segments', icon: Layers },
    { id: 'variable-format', label: 'Variable Format', icon: List },
    { id: 'distributions', label: 'Distributions', icon: TrendingUp },
    { id: 'volume', label: 'Volume/Event Rate', icon: Database },
  ];`
);

// ── Change 5: Insert Segments + Variable Format tabs before Distributions tab ─
const newTabsJSX = `
                  {/* Segments Tab */}
                  {activeTab === 'segments' && (() => {
                    const rows: Record<string, any>[] = (selectedDataset as any).parsedRows ?? [];
                    const colTypes: Record<string, 'numerical' | 'categorical' | 'date'> = (selectedDataset as any).detectedColumnTypes ?? {};
                    const segCols = Object.entries(colTypes).filter(([, t]) => t === 'categorical').map(([c]) => c);
                    const totalVol = getTotalVolume(rows);
                    if (rows.length === 0) {
                      return (
                        <div className={\`p-6 rounded-lg border text-center \${isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'}\`}>
                          <p className={\`text-sm \${isDark ? 'text-amber-300' : 'text-amber-800'}\`}>No parsed data available. Re-upload the dataset from the Data Ingestion step to enable segment analysis.</p>
                        </div>
                      );
                    }
                    return (
                      <div className="space-y-6">
                        <div className={\`p-4 rounded-lg border flex flex-wrap items-center gap-6 \${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}\`}>
                          <div>
                            <p className={\`text-xs font-medium \${isDark ? 'text-slate-400' : 'text-slate-500'}\`}>Total Volume (accts)</p>
                            <p className={\`text-2xl font-bold \${isDark ? 'text-white' : 'text-slate-900'}\`}>{totalVol.toLocaleString()}</p>
                          </div>
                          <div className={\`text-sm \${isDark ? 'text-slate-400' : 'text-slate-500'}\`}>
                            <span>{rows.length.toLocaleString()} rows</span>
                            <span className="mx-2">·</span>
                            <span>{segCols.length} segment variable{segCols.length !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        {segCols.length === 0 && (
                          <div className={\`p-4 rounded-lg border text-center \${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}\`}>
                            <p className={\`text-sm \${isDark ? 'text-slate-400' : 'text-slate-500'}\`}>No categorical columns detected as segment variables.</p>
                          </div>
                        )}
                        {segCols.map(col => {
                          const breakdown = computeSegmentBreakdown(rows, col);
                          const total = breakdown.reduce((s, r) => s + r.volume, 0);
                          return (
                            <div key={col} className={\`p-6 rounded-lg border \${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}\`}>
                              <h4 className={\`text-base font-semibold mb-4 \${isDark ? 'text-white' : 'text-slate-900'}\`}>{col}</h4>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className={\`border-b \${isDark ? 'border-slate-700' : 'border-slate-200'}\`}>
                                      <th className={\`text-left py-2 px-3 \${isDark ? 'text-slate-300' : 'text-slate-700'}\`}>Class</th>
                                      <th className={\`text-right py-2 px-3 \${isDark ? 'text-slate-300' : 'text-slate-700'}\`}>Volume</th>
                                      <th className={\`text-right py-2 px-3 \${isDark ? 'text-slate-300' : 'text-slate-700'}\`}>% Share</th>
                                      <th className={\`text-right py-2 px-3 \${isDark ? 'text-slate-300' : 'text-slate-700'}\`}>Bads</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {breakdown.map((row, idx) => (
                                      <tr key={idx} className={\`border-b \${isDark ? 'border-slate-700' : 'border-slate-200'}\`}>
                                        <td className={\`py-2 px-3 \${isDark ? 'text-white' : 'text-slate-900'}\`}>{row.cls}</td>
                                        <td className={\`py-2 px-3 text-right \${isDark ? 'text-slate-300' : 'text-slate-700'}\`}>{row.volume.toLocaleString()}</td>
                                        <td className={\`py-2 px-3 text-right \${isDark ? 'text-slate-300' : 'text-slate-700'}\`}>{total > 0 ? ((row.volume / total) * 100).toFixed(1) : '\u2013'}%</td>
                                        <td className={\`py-2 px-3 text-right \${isDark ? 'text-slate-300' : 'text-slate-700'}\`}>{row.bads.toLocaleString()}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot>
                                    <tr className={\`font-semibold border-t \${isDark ? 'border-slate-600 text-white' : 'border-slate-300 text-slate-900'}\`}>
                                      <td className="py-2 px-3">Total</td>
                                      <td className="py-2 px-3 text-right">{total.toLocaleString()}</td>
                                      <td className="py-2 px-3 text-right">100%</td>
                                      <td className="py-2 px-3 text-right">{breakdown.reduce((s, r) => s + r.bads, 0).toLocaleString()}</td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Variable Format Tab */}
                  {activeTab === 'variable-format' && (() => {
                    const rows: Record<string, any>[] = (selectedDataset as any).parsedRows ?? [];
                    const colTypes: Record<string, 'numerical' | 'categorical' | 'date'> = (selectedDataset as any).detectedColumnTypes ?? {};
                    const colNames = Object.keys(colTypes);
                    if (rows.length === 0 || colNames.length === 0) {
                      return (
                        <div className={\`p-6 rounded-lg border text-center \${isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'}\`}>
                          <p className={\`text-sm \${isDark ? 'text-amber-300' : 'text-amber-800'}\`}>No parsed data available. Re-upload the dataset from the Data Ingestion step to enable variable format analysis.</p>
                        </div>
                      );
                    }
                    return (
                      <div className={\`rounded-lg border \${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}\`}>
                        <div className={\`p-4 border-b \${isDark ? 'border-slate-700' : 'border-slate-200'}\`}>
                          <h4 className={\`text-base font-semibold \${isDark ? 'text-white' : 'text-slate-900'}\`}>{colNames.length} variables detected</h4>
                        </div>
                        <div className={\`divide-y \${isDark ? 'divide-slate-700' : 'divide-slate-200'}\`}>
                          {colNames.map(col => {
                            const type = colTypes[col];
                            const numStats = type === 'numerical' ? computeNumericalStats(rows, col) : null;
                            const catStats = type !== 'numerical' ? computeCategoricalStats(rows, col) : null;
                            const count = numStats ? numStats.count : catStats!.count;
                            const missing = numStats ? numStats.missing : catStats!.missing;
                            const missingPct = numStats ? numStats.missingPct : catStats!.missingPct;
                            return (
                              <details key={col} className="group">
                                <summary className={\`flex items-center gap-3 p-4 cursor-pointer select-none list-none \${isDark ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'}\`}>
                                  <span className={\`text-xs px-2 py-0.5 rounded-full font-mono shrink-0 \${
                                    type === 'numerical'
                                      ? isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
                                      : type === 'date'
                                      ? isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'
                                      : isDark ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700'
                                  }\`}>{type}</span>
                                  <span className={\`flex-1 font-medium text-sm \${isDark ? 'text-white' : 'text-slate-900'}\`}>{col}</span>
                                  <span className={\`text-xs shrink-0 \${isDark ? 'text-slate-400' : 'text-slate-500'}\`}>{count.toLocaleString()} non-null</span>
                                  <span className={\`text-xs shrink-0 ml-4 \${missingPct > 0 ? isDark ? 'text-red-400' : 'text-red-600' : isDark ? 'text-slate-500' : 'text-slate-400'}\`}>{missingPct.toFixed(1)}% missing</span>
                                  <ChevronRight size={14} className={\`ml-2 shrink-0 transition-transform group-open:rotate-90 \${isDark ? 'text-slate-500' : 'text-slate-400'}\`} />
                                </summary>
                                <div className={\`px-4 pb-4 pt-2 \${isDark ? 'bg-slate-700/30' : 'bg-slate-50'}\`}>
                                  {numStats && (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                      {([['Min', numStats.min.toLocaleString(undefined, { maximumFractionDigits: 4 })], ['Max', numStats.max.toLocaleString(undefined, { maximumFractionDigits: 4 })], ['Mean', numStats.mean.toFixed(4)], ['Median', numStats.median.toFixed(4)], ['Std Dev', numStats.std.toFixed(4)], ['IQR', numStats.iqr.toFixed(4)], ['Count', numStats.count.toLocaleString()], ['Missing', numStats.missing.toLocaleString()]] as [string, string][]).map(([label, val]) => (
                                        <div key={label} className={\`p-2 rounded \${isDark ? 'bg-slate-800' : 'bg-white border border-slate-200'}\`}>
                                          <p className={\`text-xs mb-0.5 \${isDark ? 'text-slate-400' : 'text-slate-500'}\`}>{label}</p>
                                          <p className={\`font-semibold \${isDark ? 'text-white' : 'text-slate-900'}\`}>{val}</p>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {catStats && (
                                    <table className="w-full text-xs mt-1">
                                      <thead>
                                        <tr className={\`border-b \${isDark ? 'border-slate-600' : 'border-slate-200'}\`}>
                                          <th className={\`text-left py-1.5 px-2 \${isDark ? 'text-slate-400' : 'text-slate-600'}\`}>Value</th>
                                          <th className={\`text-right py-1.5 px-2 \${isDark ? 'text-slate-400' : 'text-slate-600'}\`}>Count</th>
                                          <th className={\`text-right py-1.5 px-2 \${isDark ? 'text-slate-400' : 'text-slate-600'}\`}>%</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {catStats.distribution.map((d, i) => (
                                          <tr key={i} className={\`border-b \${isDark ? 'border-slate-700' : 'border-slate-100'}\`}>
                                            <td className={\`py-1.5 px-2 \${isDark ? 'text-white' : 'text-slate-900'}\`}>{d.value}</td>
                                            <td className={\`py-1.5 px-2 text-right \${isDark ? 'text-slate-300' : 'text-slate-700'}\`}>{d.count.toLocaleString()}</td>
                                            <td className={\`py-1.5 px-2 text-right \${isDark ? 'text-slate-300' : 'text-slate-700'}\`}>{d.pct.toFixed(1)}%</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              </details>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

`;

content = content.replace(
  `                  {/* Distributions Tab */}
                  {activeTab === 'distributions' && (`,
  newTabsJSX + `                  {/* Distributions Tab */}
                  {activeTab === 'distributions' && (`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('DataQuality.tsx updated successfully');
