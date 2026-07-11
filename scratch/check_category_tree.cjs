const fs = require('fs');
const path = require('path');

const indexAstroPath = path.join(__dirname, '..', 'src', 'pages', 'index.astro');
const content = fs.readFileSync(indexAstroPath, 'utf8');

const lines = content.split('\n');
const matches = [];
lines.forEach((line, idx) => {
  if (line.includes('CATEGORY_TREE')) {
    matches.push({ lineNum: idx + 1, content: line.trim() });
  }
});

console.log('Matches:', matches.length);
console.log(matches.slice(0, 10));
