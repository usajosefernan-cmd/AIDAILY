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

const modelsToTest = [
  'stepfun/step-3.7-flash',
  'stepfun/step-3.7-flash:free',
  'deepseek/deepseek-v4-flash',
  'google/gemini-3.5-flash',
  'qwen/qwen3.6-flash',
  'qwen/qwen3.5-plus'
];

async function run() {
  const nous = getNousToken();
  if (!nous) return;
  console.log('Probando modelos en Nous API...');
  for (const model of modelsToTest) {
    try {
      const res = await fetch(`${nous.base_url}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${nous.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: 'Di hola en una palabra' }],
          max_tokens: 10
        }),
      });
      console.log(`Model: ${model} -> Status: ${res.status} ${res.statusText}`);
      if (res.ok) {
        const data = await res.json();
        console.log(`   Response:`, JSON.stringify(data.choices?.[0]?.message || data));
      } else {
        const text = await res.text();
        console.log(`   Error:`, text.slice(0, 200));
      }
    } catch (err) {
      console.log(`Model: ${model} -> Exception: ${err.message}`);
    }
  }
}
run();
