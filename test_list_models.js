const { execSync } = require('child_process');

function getNousToken() {
  try {
    const scriptPath = '/home/ubuntu/workspace/AIDAILY/scripts/get_nous_token.py';
    const pythonPath = '/usr/local/lib/hermes-agent/venv/bin/python3';
    const stdout = execSync(`"${pythonPath}" "${scriptPath}"`, { encoding: 'utf8' });
    const res = JSON.parse(stdout);
    if (res.success && res.access_token) {
      return { access_token: res.access_token, base_url: res.base_url };
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
  return null;
}

async function run() {
  const nous = getNousToken();
  if (!nous) {
    console.error('No nous token');
    return;
  }
  try {
    const res = await fetch(nous.base_url + '/models', {
      headers: { 'Authorization': 'Bearer ' + nous.access_token }
    });
    const data = await res.json();
    console.log('MODELOS DISPONIBLES EN NOUS API:');
    console.log(data.data.map(m => m.id));
  } catch (err) {
    console.error('Error fetching models:', err.message);
  }
}
run();
