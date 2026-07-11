const token = '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';
const model = 'meta-llama/Meta-Llama-3-8B-Instruct';

async function run() {
  console.log("Probando token de Hugging Face con Llama 3 8B en /v1/chat/completions...");
  try {
    const res = await fetch(`https://router.huggingface.co/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'Di la palabra OK' }],
        max_tokens: 10
      })
    });
    console.log(`Status: ${res.status} ${res.statusText}`);
    if (res.ok) {
      const data = await res.json();
      console.log("Respuesta:", JSON.stringify(data.choices?.[0]?.message || data));
    } else {
      const text = await res.text();
      console.log("Error:", text);
    }
  } catch (err) {
    console.error("Excepción:", err);
  }
}
run();
