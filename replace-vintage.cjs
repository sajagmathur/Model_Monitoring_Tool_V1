// replace-vintage.cjs
// Replaces VintageRangeInput with new VintageYearBuilder in DataIngestionStep.tsx
const fs = require('fs');
const path = 'frontend/src/pages/DataIngestionStep.tsx';
let content = fs.readFileSync(path, 'utf8');

const startMarker = '// VintageSelector Component';
const endMarker = '// AISuggestBadge';

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.error('Markers not found:', startIdx, endIdx);
  process.exit(1);
}

// Find the dashes separator before startMarker
const sepBefore = content.lastIndexOf('// ---', startIdx);
if (sepBefore === -1) { console.error('Sep not found'); process.exit(1); }

const before = content.substring(0, sepBefore);
const after = content.substring(endIdx);

const newComponent = `// -----------------------------------------------------------------------------
// VintageYearBuilder Component
// -----------------------------------------------------------------------------

// Smart summary formatter
function formatVintageSummary(selectedByYear: Record<number, Set<number>>): { label: string; count: number } {
  const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const allPairs: { year: number; m: number }[] = [];
  Object.keys(selectedByYear)
    .map(Number)
    .sort((a, b) => a - b)
    .forEach(year => {
      Array.from(selectedByYear[year])
        .sort((a, b) => a - b)
        .forEach(m => allPairs.push({ year, m }));
    });
  if (allPairs.length === 0) return { label: 'No months selected', count: 0 };
  const runs: { year: number; start: number; end: number }[] = [];
  let cur = { year: allPairs[0].year, start: allPairs[0].m, end: allPairs[0].m };
  for (let i = 1; i < allPairs.length; i++) {
    const { year, m } = allPairs[i];
    if (year === cur.year && m === cur.end + 1) {
      cur.end = m;
    } else {
      runs.push({ ...cur });
      cur = { year, start: m, end: m };
    }
  }
  runs.push({ ...cur });
  const parts = runs.map(r => {
    const yy = String(r.year).slice(2);
    if (r.start === r.end) return MONTH_ABBR[r.start] + "'" + yy;
    return MONTH_ABBR[r.start] + "'" + yy + '-' + MONTH_ABBR[r.end] + "'" + yy;
  });
  return { label: parts.join(','), count: allPairs.length };
}

const _CURRENT_YEAR = new Date().getFullYear();
const AVAILABLE_YEARS: number[] = (() => {
  const ys: number[] = [];
  for (let y = 2019; y <= _CURRENT_YEAR; y++) ys.push(y);
  return ys;
})();
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const VintageRangeInput: React.FC<{
  vintageFrom: string;
  vintageTo: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  isDark: boolean;
}> = ({ vintageFrom, vintageTo, onFromChange, onToChange, isDark }) => {
  const [selectedByYear, setSelectedByYear] = useState<Record<number, Set<number>>>(() => {
    const init: Record<number, Set<number>> = {};
    if (vintageFrom && vintageTo) {
      const allMonths: string[] = [];
      AVAILABLE_YEARS.forEach(y => VINTAGES_BY_YEAR[y]?.forEach((tok: string) => allMonths.push(tok)));
      const fi = allMonths.indexOf(vintageFrom);
      const ti = allMonths.indexOf(vintageTo);
      if (fi !== -1 && ti !== -1) {
        for (let i = Math.min(fi, ti); i <= Math.max(fi, ti); i++) {
          const tok = allMonths[i];
          const [mon, yr] = tok.split('-');
          const year = 2000 + parseInt(yr, 10);
          const monthIdx = MONTHS.indexOf(mon);
          if (!init[year]) init[year] = new Set();
          init[year].add(monthIdx);
        }
      }
    }
    return init;
  });
  const [addYearOpen, setAddYearOpen] = useState(false);

  const addedYears = Object.keys(selectedByYear).map(Number).sort((a, b) => a - b);
  const remainingYears = AVAILABLE_YEARS.filter(y => !addedYears.includes(y));

  const propagate = (next: Record<number, Set<number>>) => {
    const allPairs: { year: number; m: number }[] = [];
    Object.keys(next).map(Number).sort((a, b) => a - b).forEach(year => {
      Array.from(next[year]).sort((a, b) => a - b).forEach(m => allPairs.push({ year, m }));
    });
    if (allPairs.length === 0) { onFromChange(''); onToChange(''); return; }
    const toTok = ({ year, m }: { year: number; m: number }) =>
      MONTHS[m] + '-' + String(year).slice(2);
    onFromChange(toTok(allPairs[0]));
    onToChange(toTok(allPairs[allPairs.length - 1]));
  };

  const toggleMonth = (year: number, mIdx: number) => {
    const next: Record<number, Set<number>> = { ...selectedByYear };
    next[year] = new Set(selectedByYear[year] ?? []);
    if (next[year].has(mIdx)) next[year].delete(mIdx); else next[year].add(mIdx);
    setSelectedByYear(next);
    propagate(next);
  };

  const toggleAllMonthsInYear = (year: number, selectAll: boolean) => {
    const maxM = year === _CURRENT_YEAR ? new Date().getMonth() : 11;
    const next: Record<number, Set<number>> = { ...selectedByYear };
    next[year] = selectAll ? new Set(Array.from({ length: maxM + 1 }, (_, i) => i)) : new Set();
    setSelectedByYear(next);
    propagate(next);
  };

  const removeYear = (year: number) => {
    const next: Record<number, Set<number>> = { ...selectedByYear };
    delete next[year];
    setSelectedByYear(next);
    propagate(next);
  };

  const addYear = (year: number) => {
    const next: Record<number, Set<number>> = { ...selectedByYear, [year]: new Set<number>() };
    setSelectedByYear(next);
    setAddYearOpen(false);
    propagate(next);
  };

  const { label: summaryLabel, count: summaryCount } = formatVintageSummary(selectedByYear);

  return (
    <div className="space-y-3">
      {addedYears.map(year => {
        const sel = selectedByYear[year] ?? new Set<number>();
        const maxM = year === _CURRENT_YEAR ? new Date().getMonth() : 11;
        const availableMonths = Array.from({ length: maxM + 1 }, (_, i) => i);
        const allSelected = availableMonths.length > 0 && availableMonths.every(m => sel.has(m));
        return (
          <div key={year} className={\`rounded-xl border \${isDark ? 'bg-gray-900/40 border-gray-700' : 'bg-white border-gray-200 shadow-sm'}\`}>
            <div className={\`flex items-center justify-between px-4 py-2.5 border-b \${isDark ? 'border-gray-700' : 'border-gray-100'}\`}>
              <span className={\`text-sm font-bold \${isDark ? 'text-gray-100' : 'text-gray-800'}\`}>{year}</span>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={e => toggleAllMonthsInYear(year, e.target.checked)}
                    className="w-3.5 h-3.5 accent-blue-500 cursor-pointer"
                  />
                  <span className={\`text-xs \${isDark ? 'text-gray-400' : 'text-gray-500'}\`}>Select All</span>
                </label>
                <span className={\`text-xs \${isDark ? 'text-gray-500' : 'text-gray-400'}\`}>({sel.size}/{availableMonths.length})</span>
                <button
                  type="button"
                  onClick={() => removeYear(year)}
                  className={\`text-xs px-1.5 py-0.5 rounded transition \${isDark ? 'text-red-400 hover:bg-red-900/30' : 'text-red-500 hover:bg-red-50'}\`}
                  title="Remove year"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 px-4 py-3">
              {MONTH_NAMES.map((name, mIdx) => {
                if (mIdx > maxM) return null;
                const isSel = sel.has(mIdx);
                return (
                  <button
                    key={mIdx}
                    type="button"
                    onClick={() => toggleMonth(year, mIdx)}
                    className={\`text-xs px-2.5 py-1 rounded-full border transition-colors \${
                      isSel
                        ? isDark
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-blue-500 border-blue-500 text-white'
                        : isDark
                          ? 'bg-transparent border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-200'
                          : 'bg-white border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600'
                    }\`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {remainingYears.length > 0 && (
        <div className="relative">
          {addYearOpen ? (
            <div className={\`rounded-xl border overflow-hidden \${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white shadow-md'}\`}>
              <div className={\`px-3 py-2 text-xs font-semibold border-b \${isDark ? 'border-gray-700 text-gray-400' : 'border-gray-100 text-gray-500'}\`}>
                Select year to add
              </div>
              <div className="flex flex-wrap gap-1.5 p-3">
                {remainingYears.map(y => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => addYear(y)}
                    className={\`text-sm px-3 py-1.5 rounded-lg border transition \${isDark ? 'border-gray-600 text-gray-300 hover:bg-blue-600 hover:border-blue-500 hover:text-white' : 'border-gray-300 text-gray-700 hover:bg-blue-500 hover:border-blue-500 hover:text-white'}\`}
                  >
                    {y}
                  </button>
                ))}
              </div>
              <div className="px-3 pb-2">
                <button type="button" onClick={() => setAddYearOpen(false)} className={\`text-xs \${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}\`}>Cancel</button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddYearOpen(true)}
              className={\`flex items-center gap-2 text-sm px-4 py-2 rounded-xl border-2 border-dashed transition w-full justify-center \${isDark ? 'border-gray-700 text-gray-400 hover:border-blue-500 hover:text-blue-400' : 'border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600'}\`}
            >
              <span className="text-lg leading-none">+</span> Add Year
            </button>
          )}
        </div>
      )}

      <p className={\`text-xs \${isDark ? 'text-gray-500' : 'text-gray-400'}\`}>
        Selected:{' '}
        <strong className={isDark ? 'text-gray-300' : 'text-gray-700'}>{summaryLabel}</strong>
        {summaryCount > 0 && (
          <span className={\`ml-1 \${isDark ? 'text-gray-500' : 'text-gray-400'}\`}>({summaryCount} month{summaryCount !== 1 ? 's' : ''})</span>
        )}
      </p>
    </div>
  );
};

`;

const newContent = before + newComponent + after;
fs.writeFileSync(path, newContent, 'utf8');
console.log('Done. New length:', newContent.length);
