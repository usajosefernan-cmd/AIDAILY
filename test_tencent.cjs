const { execSync } = require('child_process');
const stdout = execSync('/usr/local/lib/hermes-agent/venv/bin/python3 /home/ubuntu/workspace/AIDAILY/scripts/get_nous_token.py');
const nous = JSON.parse(stdout);
fetch(nous.base_url + '/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + nous.access_token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'tencent/hy3:free',
    messages: [{ role: 'user', content: 'Di hola' }],
    max_tokens: 10
  })
}).then(r => r.json()).then(d => console.log('RESPONSE:', JSON.stringify(d)));
