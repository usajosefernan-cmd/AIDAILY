const { execSync } = require('child_process');
const fs = require('fs');

async function run() {
  const stdout = execSync('/usr/local/lib/hermes-agent/venv/bin/python3 /home/ubuntu/workspace/AIDAILY/scripts/get_nous_token.py');
  const nous = JSON.parse(stdout);
  console.log('Nous Base URL:', nous.base_url);
  
  const res = await fetch(nous.base_url + '/models', {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + nous.access_token
    }
  });
  
  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Models:', JSON.stringify(data, null, 2));
}

run().catch(console.error);
