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
    console.error('Error Nous Token:', e.message);
  }
  return null;
}

async function run() {
  const nous = getNousToken();
  if (!nous) return;
  console.log('Probando stepfun/step-3.7-flash:free...');
  try {
    const res = await fetch(`${nous.base_url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${nous.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'stepfun/step-3.7-flash:free',
        messages: [{ role: 'user', content: 'Genera un JSON con un saludo. Formato: {"saludo": "hola"}' }],
        max_tokens: 4096
      })
    });
    const data = await res.json();
    const msg = data.choices?.[0]?.message || {};
    console.log('CONTENT:', msg.content);
    console.log('REASONING:', msg.reasoning ? msg.reasoning.slice(0, 300) : 'null');
    console.log('REASONING_DETAILS:', JSON.stringify(msg.reasoning_details ? msg.reasoning_details[0] : 'null'));
  } catch (err) {
    console.error('Error:', err.message);
  }
}
run();
