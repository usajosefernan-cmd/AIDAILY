const { execSync } = require('child_process');
const stdout = execSync('/usr/local/lib/hermes-agent/venv/bin/python3 /home/ubuntu/workspace/AIDAILY/scripts/get_nous_token.py');
const nous = JSON.parse(stdout);
fetch(nous.base_url + '/models', {
  headers: {
    'Authorization': 'Bearer ' + nous.access_token
  }
}).then(r => r.json()).then(d => {
  const free = d.data.filter(m => m.id.includes(':free')).map(m => m.id);
  console.log('FREE NOUS MODELS:', JSON.stringify(free, null, 2));
});
