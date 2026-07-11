const fs = require('fs');
const all = JSON.parse(fs.readFileSync('/opt/aidaily/src/data/cache-news.json', 'utf8'));
console.log(all.slice(0, 3).map(a => a.id));
