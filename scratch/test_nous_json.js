const { execSync } = require('child_process');
const fs = require('fs');

async function run() {
  const stdout = execSync('/usr/local/lib/hermes-agent/venv/bin/python3 /home/ubuntu/workspace/AIDAILY/scripts/get_nous_token.py');
  const nous = JSON.parse(stdout);
  console.log('Nous Base URL:', nous.base_url);
  
  const res = await fetch(nous.base_url + '/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + nous.access_token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'stepfun/step-3.7-flash:free',
      messages: [{ role: 'user', content: 'Responde en JSON con { "saludo": "hola" }' }],
      response_format: { type: 'json_object' }
    })
  });
  
  console.log('Status:', res.status);
  console.log('Response:', await res.text());
}

run().catch(console.error);
