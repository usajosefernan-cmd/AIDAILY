const fs = require('fs');
const path = require('path');

const premiumCssPath = path.join(__dirname, '..', 'src', 'styles', 'premium.css');
const content = fs.readFileSync(premiumCssPath, 'utf8');

console.log('Total lineas:', content.split('\n').length);

const queries = ['top-bar', 'ticker', 'clock', 'date', 'top_bar'];

queries.forEach(q => {
  const matches = [];
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.toLowerCase().includes(q)) {
      matches.push({ lineNum: idx + 1, content: line.trim() });
    }
  });
  console.log(`Búsqueda de "${q}":`, matches.length, 'coincidencias');
  if (matches.length > 0) {
    console.log(matches.slice(0, 5));
  }
});
