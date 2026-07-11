async function run() {
  try {
    console.log('Fetching OpenRouter models...');
    const res = await fetch('https://openrouter.ai/api/v1/models');
    const data = await res.json();
    const freeModels = data.data
      .filter(m => m.id.includes(':free'))
      .map(m => m.id);
    console.log('FREE MODELS:', JSON.stringify(freeModels, null, 2));
  } catch (err) {
    console.error('Error fetching models:', err.message);
  }
}
run();
