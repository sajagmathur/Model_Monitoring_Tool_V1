const fs = require('fs');
const file = 'c:/Users/sajag/Desktop/GIT/ML_Monitoring_Studio/Model_Monitoring_Tool_V1/frontend/src/pages/DataIngestionStep.tsx';
let c = fs.readFileSync(file, 'utf8');
const anchor = 'const VintageSelector: React.FC<{';
const idx = c.indexOf(anchor);
if (idx < 0) { console.log('ANCHOR NOT FOUND'); process.exit(1); }

const helper = `// Helper: compute enhanced per-column summary
function computeEnhancedSummary(
  rows: Record<string, any>[],
  targetCol: string,
  segmentCol: string
): EnhancedDataSummary {
  if (rows.length === 0) {
    return { totalRows: 0, badCount: 0, badRate: 0, segments: {}, numericalCols: [], categoricalCols: [], dateCols: [] };
  }
  const columns = Object.keys(rows[0]);
  const DATE_RE = /^\\d{4}[-\\/]\\d{1,2}[-\\/]\\d{1,2}$|^\\d{1,2}[-\\/]\\d{1,2}[-\\/]\\d{4}$/;
  const colType = (col: string): 'numerical' | 'date' | 'categorical' => {
    const samples = rows.slice(0, 50).map((r: any) => r[col]).filter((v: any) => v !== '' && v != null);
    if (samples.length === 0) return 'categorical';
    const numCount = samples.filter((v: any) => !isNaN(Number(v))).length;
    const dateCount = samples.filter((v: any) => DATE_RE.test(String(v))).length;
    if (numCount / samples.length >= 0.7) return 'numerical';
    if (dateCount / samples.length >= 0.6) return 'date';
    return 'categorical';
  };
  const numericalCols: EnhancedDataSummary['numericalCols'] = [];
  const categoricalCols: EnhancedDataSummary['categoricalCols'] = [];
  const dateCols: EnhancedDataSummary['dateCols'] = [];
  for (const col of columns.slice(0, 20)) {
    const vals = rows.map((r: any) => r[col]);
    const nullCount = vals.filter((v: any) => v === '' || v == null).length;
    const nullRate = nullCount / rows.length;
    const type = colType(col);
    if (type === 'numerical') {
      const nums = vals.map(Number).filter((v: any) => !isNaN(v));
      if (nums.length === 0) continue;
      const mean = nums.reduce((a: number, b: number) => a + b, 0) / nums.length;
      const std = Math.sqrt(nums.reduce((a: number, b: number) => a + (b - mean) ** 2, 0) / nums.length);
      numericalCols.push({ name: col, mean, std, min: Math.min(...nums), max: Math.max(...nums), nullRate });
    } else if (type === 'date') {
      const dates = vals.filter((v: any) => v !== '' && v != null).map(String).sort();
      dateCols.push({ name: col, minDate: dates[0] || '', maxDate: dates[dates.length - 1] || '', nullRate });
    } else {
      const freq: Record<string, number> = {};
      vals.filter((v: any) => v !== '' && v != null).forEach((v: any) => { const s = String(v); freq[s] = (freq[s] || 0) + 1; });
      const topEntry = Object.entries(freq).sort((a: any, b: any) => b[1] - a[1])[0];
      const nonNull = vals.filter((v: any) => v !== '' && v != null).length;
      categoricalCols.push({ name: col, uniqueCount: Object.keys(freq).length, topValue: (topEntry as any)?.[0] || '', topPercent: topEntry && nonNull > 0 ? ((topEntry as any)[1] / nonNull) * 100 : 0, nullRate });
    }
  }
  const segments: Record<string, { volume: number; badCount: number }> = {};
  let overallBadCount = 0;
  for (const row of rows) {
    const seg = segmentCol && row[segmentCol] != null ? String(row[segmentCol]) : 'Overall';
    if (!segments[seg]) segments[seg] = { volume: 0, badCount: 0 };
    segments[seg].volume++;
    const isBad = targetCol && (row[targetCol] === 1 || row[targetCol] === '1' || row[targetCol] === true || String(row[targetCol]).toLowerCase() === 'bad');
    if (isBad) { segments[seg].badCount++; overallBadCount++; }
  }
  return { totalRows: rows.length, badCount: overallBadCount, badRate: rows.length > 0 ? overallBadCount / rows.length : 0, segments, numericalCols, categoricalCols, dateCols };
}

`;

c = c.slice(0, idx) + helper + c.slice(idx);
fs.writeFileSync(file, c, 'utf8');
console.log('Done. New file length:', c.length);
console.log('Has computeEnhancedSummary:', c.includes('computeEnhancedSummary'));
