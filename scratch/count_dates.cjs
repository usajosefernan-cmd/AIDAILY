const fs = require('fs');
const path = require('path');

const cachePath = '/opt/aidaily/src/data/cache-news.json';
if (!fs.existsSync(cachePath)) {
  console.log('No cache file found at ' + cachePath);
  process.exit(1);
}

const all = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
console.log('Total articles in cache:', all.length);

const dates = {};
all.forEach(art => {
  try {
    if (art.publishedAt) {
      const d = new Date(art.publishedAt).toISOString().split('T')[0];
      dates[d] = (dates[d] || 0) + 1;
    }
  } catch(e) {}
});

console.log('Articles per date:', dates);
