const apiKey = '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';

async function run() {
  console.log("Listando modelos autorizados para tu API Key en Groq...");
  try {
    const res = await fetch(`https://api.groq.com/openai/v1/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
    console.log(`Status: ${res.status} ${res.statusText}`);
    if (res.ok) {
      const data = await res.json();
      console.log("Modelos:", data.data.map(m => m.id));
    } else {
      const text = await res.text();
      console.log("Error:", text);
    }
  } catch (err) {
    console.error("Excepción:", err);
  }
}
run();
