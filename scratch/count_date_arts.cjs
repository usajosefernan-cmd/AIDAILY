const fs = require('fs');
const all = JSON.parse(fs.readFileSync('/opt/aidaily/src/data/cache-news.json', 'utf8'));
const dateCount = {};
all.forEach(a => {
  try {
    const d = new Date(a.publishedAt).toISOString().split('T')[0];
    dateCount[d] = (dateCount[d] || 0) + 1;
  } catch (e) {}
});
console.log(dateCount);
