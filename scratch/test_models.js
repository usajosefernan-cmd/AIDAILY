const apiKey = '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';

const whitelist = [
  'meta-llama/llama-3.2-3b-instruct:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'nvidia/nemotron-nano-9b-v2:free',
  'openai/gpt-oss-120b:free',
  'openai/gpt-oss-20b:free',
  'liquid/lfm-2.5-1.2b-instruct:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'cohere/north-mini-code:free',
  'liquid/lfm-2.5-1.2b-thinking:free',
  'nex-agi/nex-n2-pro:free',
  'nvidia/nemotron-3.5-content-safety:free',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'poolside/laguna-xs.2:free',
  'poolside/laguna-m.1:free',
  // Añadir algunos modelos gratis nuevos de OpenRouter que son muy estables
  
];

async function testModel(model) {
  const url = 'https://openrouter.ai/api/v1/chat/completions';
  const start = Date.now();
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'Dime hola en JSON. Formato: {"res": "hola"}' }],
        temperature: 0.1,
        max_tokens: 50,
        response_format: { type: "json_object" }
      }),
      signal: AbortSignal.timeout(10000) // 10 segundos timeout
    });

    const elapsed = Date.now() - start;
    if (res.ok) {
      const data = await res.json();
      console.log(`[OK] ${model} - Tiempo: ${elapsed}ms. Respuesta:`, JSON.stringify(data.choices?.[0]?.message?.content));
      return { model, status: 'ok', elapsed };
    } else {
      const errText = await res.text();
      console.warn(`[ERROR] ${model} - HTTP ${res.status}. Tiempo: ${elapsed}ms. Error:`, errText.substring(0, 150));
      return { model, status: 'error', code: res.status, error: errText };
    }
  } catch (e) {
    const elapsed = Date.now() - start;
    console.error(`[FAIL] ${model} - Tiempo: ${elapsed}ms. Exception:`, e.message);
    return { model, status: 'fail', error: e.message };
  }
}

async function run() {
  console.log('Probando modelos gratuitos de OpenRouter...');
  const results = [];
  
  // Probar de forma secuencial con delay de 2 segundos para no meter rate limit artificial
  for (const model of whitelist) {
    const res = await testModel(model);
    results.push(res);
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n=== RESUMEN DE MODELOS QUE FUNCIONAN ===');
  results.filter(r => r.status === 'ok').forEach(r => {
    console.log(`- ${r.model} (${r.elapsed}ms)`);
  });

  console.log('\n=== RESUMEN DE MODELOS QUE FALLAN ===');
  results.filter(r => r.status !== 'ok').forEach(r => {
    console.log(`- ${r.model} (Status: ${r.status}, Error: ${r.error ? r.error.substring(0, 80) : r.error})`);
  });
}

run().catch(console.error);
