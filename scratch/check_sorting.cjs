const fs = require('fs');
const path = require('path');

const dateAstroPath = path.join(__dirname, '..', 'src', 'pages', '[date].astro');
const content = fs.readFileSync(dateAstroPath, 'utf8');

const lines = content.split('\n');
const matches = [];

lines.forEach((line, idx) => {
  if (line.includes('itemsPerPage')) {
    matches.push({ lineNum: idx + 1, content: line.trim() });
  }
});

console.log('Matches:', matches.length);
console.log(matches);
