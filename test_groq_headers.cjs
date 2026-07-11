const apiKey = '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';
const model = 'llama-3.3-70b-versatile';

async function run() {
  try {
    const res = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'Di hola' }],
        max_tokens: 5
      })
    });
    console.log(`Status: ${res.status}`);
    for (const [key, value] of res.headers.entries()) {
      if (key.startsWith('x-ratelimit') || key.startsWith('groq') || key.includes('limit')) {
        console.log(`${key}: ${value}`);
      }
    }
  } catch (err) {
    console.error(err);
  }
}
run();
