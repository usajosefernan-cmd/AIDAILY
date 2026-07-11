#!/usr/bin/env node
const OPENROUTER_KEY = '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';

const models = [
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'openai/gpt-oss-20b:free',
  'liquid/lfm-2.5-1.2b-instruct:free',
  'google/gemma-4-26b-a4b-it:free',
  'openai/gpt-oss-120b:free'
];

const prompt = `Eres un periodista español de alto nivel. Redacta un resumen profesional de 3 frases sobre esta noticia: "Apple presenta el chip M5 Ultra con motor de inteligencia artificial integrado capaz de ejecutar modelos de lenguaje de 70.000 millones de parámetros de forma local". Responde SOLO en español, con estilo periodístico serio.`;

async function testModel(model) {
  const t0 = Date.now();
  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_KEY}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.5
      }),
      signal: AbortSignal.timeout(20000)
    });
    const d = await r.json();
    const ms = Date.now() - t0;
    const txt = d.choices?.[0]?.message?.content || null;
    const finish = d.choices?.[0]?.finish_reason || '?';
    console.log(`\n=== ${model} | ${ms}ms | finish: ${finish} ===`);
    if (txt) {
      console.log(txt.substring(0, 400));
    } else {
      console.log('[SIN CONTENIDO - content null]');
    }
  } catch (e) {
    const ms = Date.now() - t0;
    console.log(`\n=== ${model} | ${ms}ms | ERROR ===`);
    console.log(e.message);
  }
}

(async () => {
  console.log('Testing free OpenRouter models for AIDAILY news writing...\n');
  for (const m of models) {
    await testModel(m);
  }
  console.log('\n--- FIN ---');
})();
