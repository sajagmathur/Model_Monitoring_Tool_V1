const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/pages/Projects.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Check if activeTab state is present
if (content.includes("const [activeTab, setActiveTab] = useState<'overview' | 'distributions' | 'volume'>('overview');")) {
  console.log('ERROR: activeTab state still present. Script did not apply properly.');
  console.log('File content around line 2595:');
  const idx = content.indexOf("const [selectedDatasetId");
  console.log(content.substring(idx, idx + 500));
  process.exit(1);
} else {
  console.log('OK: activeTab state was successfully removed');
}

if (content.includes('const hasScoreDataset')) {
  console.log('OK: hasScoreDataset variable present');
} else {
  console.log('ERROR: hasScoreDataset variable NOT found');
}

if (content.includes('const metrics = selectedDataset ? getComprehensiveMetrics')) {
  console.log('ERROR: const metrics still present');
} else {
  console.log('OK: const metrics was removed');
}

if (content.includes("const tabs = [")) {
  console.log('ERROR: const tabs still present');
} else {
  console.log('OK: const tabs was removed');
}
