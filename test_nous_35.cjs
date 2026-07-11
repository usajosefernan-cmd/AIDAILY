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

async function test() {
  const nous = getNousToken();
  if (!nous) return;
  try {
    const res = await fetch(`${nous.base_url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${nous.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemma-4-31b-it',
        messages: [{ role: 'user', content: 'Di hola y confírmame que estás activo en español en JSON format: {"response": "tu saludo"}' }],
        temperature: 0.5,
        max_tokens: 1000,
        response_format: { type: "json_object" }
      }),
    });
    console.log('Status:', res.status, res.statusText);
    const data = await res.json();
    console.log('Respuesta:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
}
test();
