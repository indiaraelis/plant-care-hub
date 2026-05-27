const fs = require('fs');
const path = require('path');

const c = fs.readFileSync(path.join(__dirname, '../frontend/src/data/PlantDatabase.js'), 'utf8');

const lines = c.split('\n');
let currentId = null;
let hasWatering = false;
const missing = [];

for (let i = 0; i < lines.length; i++) {
  const idMatch = lines[i].match(/"id":\s*"([^"]+)"/);
  if (idMatch) {
    if (currentId && !hasWatering) missing.push(currentId);
    currentId = idMatch[1];
    hasWatering = false;
  }
  if (lines[i].includes('wateringFrequencyDays')) hasWatering = true;
}
if (currentId && !hasWatering) missing.push(currentId);

console.log('Missing care (' + missing.length + '):', missing.join(', '));
