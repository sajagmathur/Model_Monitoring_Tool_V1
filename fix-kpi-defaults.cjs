// fix-kpi-defaults.cjs
// Sets defaultEnabled: false for non-reference-dataset KPIs in Projects.tsx
const fs = require('fs');
const path = 'frontend/src/pages/Projects.tsx';
let content = fs.readFileSync(path, 'utf8');

// IDs that should be defaultEnabled: false (not in user's reference-dataset list)
const disableIds = ['change_in_ks', 'psi', 'jsd', 'rob', 'r2', 'adjusted_r2', 'rmse', 'csi_features', 'var_level_rob'];

// For each id, find its block in KPI_METRICS and set defaultEnabled: false
// Each block looks like:
//   id: 'change_in_ks',
//   ...
//   defaultEnabled: true,
// We replace the defaultEnabled line that immediately follows the id

let count = 0;
for (const id of disableIds) {
  // Find the id: 'xxx' occurrence within KPI_METRICS array
  const idPattern = "    id: '" + id + "',";
  const idx = content.indexOf(idPattern);
  if (idx === -1) { console.warn('ID not found:', id); continue; }
  // Find defaultEnabled: true within the next 500 chars
  const chunk = content.substring(idx, idx + 500);
  const deIdx = chunk.indexOf("    defaultEnabled: true,");
  if (deIdx === -1) { console.warn('defaultEnabled: true not found for:', id); continue; }
  const absIdx = idx + deIdx;
  content = content.substring(0, absIdx) + "    defaultEnabled: false," + content.substring(absIdx + "    defaultEnabled: true,".length);
  count++;
}

fs.writeFileSync(path, content, 'utf8');
console.log('Updated', count, 'KPI defaults to false.');
