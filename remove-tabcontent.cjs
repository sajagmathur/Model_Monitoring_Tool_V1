const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/pages/Projects.tsx');
let content = fs.readFileSync(filePath, 'utf8');
content = content.replace(/\r\n/g, '\n');

// Find and remove Tab Content block
const contentStart = content.indexOf('{/* Tab Content - Show detailed analysis for selected dataset */}');
const contentEnd = content.indexOf('{/* Dataset Analysis Section', contentStart);

if (contentStart >= 0 && contentEnd > contentStart) {
  console.log('Found Tab Content block from index ' + contentStart + ' to ' + contentEnd);
  console.log('Tab Content preview:');
  console.log(content.substring(contentStart, Math.min(contentStart + 300, contentEnd)));
  
  const before = content.substring(0, contentStart);
  const after = content.substring(contentEnd);
  
  content = before + '\n' + after;
  console.log('✓ Removed Tab Content block');
} else {
  console.log('✗ Could not find Tab Content block');
  console.log('contentStart=' + contentStart + ', contentEnd=' + contentEnd);
  process.exit(1);
}

// Normalize back to CRLF
content = content.replace(/\n/g, '\r\n');
fs.writeFileSync(filePath, content, 'utf8');
console.log('Done');
