const apiKey = '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';
const model = 'llama-3.3-70b-versatile';

async function run() {
  console.log("Probando API de Groq con la Key provista...");
  try {
    const res = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'Di hola en una palabra' }],
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
