const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Cargar .env
const envPath = path.resolve('.env');
let apiKey = '';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split(/\r?\n/).forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match && match[1] === 'OPENROUTER_API_KEY') {
      apiKey = (match[2] || '').trim().replace(/['"]/g, '');
    }
  });
}

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

async function testOpenRouter() {
  console.log('\n--- PROBANDO OPENROUTER ---');
  if (!apiKey) {
    console.log('No hay API key de OpenRouter en .env');
    return;
  }
  const models = [
    'nousresearch/hermes-3-llama-3.1-405b:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'google/gemma-4-31b-it:free'
  ];
  for (const model of models) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: 'Di ok' }],
          max_tokens: 5
        })
      });
      console.log(`OpenRouter Model: ${model} -> Status: ${res.status} ${res.statusText}`);
      const text = await res.text();
      console.log(`   Response:`, text.slice(0, 300));
    } catch (e) {
      console.log(`OpenRouter Model: ${model} -> Error:`, e.message);
    }
  }
}

async function testNousAPI() {
  console.log('\n--- PROBANDO NOUS API ---');
  const nous = getNousToken();
  if (!nous) {
    console.log('No se pudo obtener token de Nous');
    return;
  }
  const models = ['stepfun/step-3.7-flash:free', 'tencent/hy3:free'];
  for (const model of models) {
    console.log(`Probando ${model} en Nous con un prompt de redacci?n real (noticia corta)...`);
    try {
      const res = await fetch(`${nous.base_url}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${nous.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: 'Analiza la noticia de que Apple ha lanzado el iPhone 17. Genera un JSON con "title" y "fullArticle" en espa?ol de unas 150 palabras.' }],
          max_tokens: 1500
        })
      });
      console.log(`Nous Model: ${model} -> Status: ${res.status} ${res.statusText}`);
      const text = await res.text();
      console.log(`   Length: ${text.length} chars`);
      console.log(`   Snippet:`, text.slice(0, 400));
      console.log(`   Snippet End:`, text.slice(-200));
    } catch (e) {
      console.log(`Nous Model: ${model} -> Error:`, e.message);
    }
  }
}

async function main() {
  await testOpenRouter();
  await testNousAPI();
}
main();
