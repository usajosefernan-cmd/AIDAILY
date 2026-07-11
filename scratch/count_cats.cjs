const fs = require('fs');
const all = JSON.parse(fs.readFileSync('/opt/aidaily/src/data/cache-news.json', 'utf8'));
const cats = {};
all.forEach(a => cats[a.category] = (cats[a.category] || 0) + 1);
console.log(cats);
