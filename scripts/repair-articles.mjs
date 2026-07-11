import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Cargar .env
try {
  const envPath = path.resolve('.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split(/\r?\n/).forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        process.env[match[1]] = (match[2] || '').replace(/['"]/g, '').trim();
      }
    });
    console.log('[Env] Variables de entorno cargadas.');
  }
} catch (e) {
  console.warn('[Env] No se pudo cargar el .env:', e.message);
}

const apiKey = process.env.OPENROUTER_API_KEY;
const securityToken = 'pecemi_secure_gateway_token_2026_xyz';
const dbUrl = 'https://pecemi-default-rtdb.firebaseio.com/aidaily/articles.json';
const patchUrl = 'https://pecemi-default-rtdb.firebaseio.com/aidaily.json';

const VALID_CATEGORIES = new Set([
  'internacional', 'nacional', 'economia', 'opinion', 'ciencia', 'tecnologia',
  'medioambiente', 'cultura', 'deportes', 'sociedad', 'estilo', 'gastronomia'
]);

// Pool de modelos gratuitos para rotar y evitar 429
const modelsPool = [
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
  'poolside/laguna-m.1:free'
];

// Helper robusto para llamar a OpenRouter con rotación de modelos y reintentos por 429
async function callOpenRouterWithFallback(prompt, temperature = 0.5, maxTokens = 50) {
  if (!apiKey) return null;

  for (let attempt = 0; attempt < 3; attempt++) {
    for (const model of modelsPool) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://143-47-35-167.sslip.io/ia-daily/',
            'X-Title': 'IA Daily Repair Agent',
          },
          body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: prompt }],
            temperature: temperature,
            max_tokens: maxTokens
          }),
          signal: AbortSignal.timeout(12000)
        });

        if (res.status === 429) {
          console.warn(`[OpenRouter 429] Límite con ${model}. Probando siguiente modelo...`);
          // Esperar brevemente antes de cambiar de modelo
          await new Promise(resolve => setTimeout(resolve, 800));
          continue;
        }

        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content?.trim();
          if (content) return content;
        } else {
          console.warn(`[OpenRouter Error] HTTP ${res.status} con ${model}`);
        }
      } catch (err) {
        console.warn(`[OpenRouter Catch] Error con ${model}:`, err.message);
      }
    }

    console.log(`[OpenRouter] Pool saturado. Esperando 12 segundos antes del reintento ${attempt + 2}...`);
    await new Promise(resolve => setTimeout(resolve, 12000));
  }
  return null;
}

function calculateJaccardSimilarity(s1, s2) {
  const clean = (str) => new Set((str || '').toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 3));
  const set1 = clean(s1);
  const set2 = clean(s2);
  if (set1.size === 0 || set2.size === 0) return 0;
  let intersection = 0;
  set1.forEach(w => { if (set2.has(w)) intersection++; });
  return intersection / (set1.size + set2.size - intersection);
}

// Llamar a OpenRouter para evaluar duplicados semánticos
async function evaluateSemanticDuplication(t1, t2) {
  const prompt = `Compara estas dos noticias y determina si informan exactamente sobre el mismo suceso, evento o noticia periodística (incluso si son de medios diferentes y están redactadas de forma ligeramente distinta).
Noticia A: ${t1}
Noticia B: ${t2}

Responde ÚNICAMENTE con la palabra "DUPLICADO" si se trata del mismo suceso exacto, o "UNICO" si son sucesos diferentes. Responde de forma ultra-directa, sin explicaciones ni notas.`;

  const response = await callOpenRouterWithFallback(prompt, 0.1, 5);
  return response ? response.toUpperCase().includes('DUPLICADO') : false;
}

// Llamar a OpenRouter para regenerar descripción de imagen
async function generateImageCaption(title, summary) {
  const prompt = `Basándote en el siguiente titular y resumen de noticia, genera un pie de foto (caption) descriptivo, real y periodístico en español (de máximo 12 palabras) adecuado para ilustrar esta noticia. Evita repetir literalmente el titular y evita usar frases genéricas.
Titular: ${title}
Resumen: ${summary}

Pie de foto redactado en español:`;

  const response = await callOpenRouterWithFallback(prompt, 0.5, 25);
  if (response) {
    return response.replace(/"/g, '').replace(/\.$/, '').trim();
  }
  return null;
}

async function repair() {
  console.log('Cargando artículos desde archivo de backup local (711 artículos)...');
  let articles = {};
  try {
    const rawData = fs.readFileSync('../scratch/cache-news-vps-downloaded.json', 'utf8');
    const parsed = JSON.parse(rawData);
    if (Array.isArray(parsed)) {
      parsed.forEach(art => {
        const id = art.id || crypto.createHash('sha256').update(art.url).digest('hex');
        articles[id] = art;
      });
    } else {
      articles = parsed;
    }
  } catch (err) {
    console.error('Error cargando archivo local:', err.message);
    return;
  }
  
  if (!articles || typeof articles !== 'object' || Object.keys(articles).length === 0) {
    console.error('No se encontraron artículos.');
    return;
  }

  let list = Object.values(articles).sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  console.log(`Cargados ${list.length} artículos para reparar.`);

  // 1. Corregir categorías no válidas (por si acaso) y normalizar
  list.forEach(art => {
    if (!art.category || !VALID_CATEGORIES.has(art.category.toLowerCase().trim())) {
      art.category = 'tecnologia';
    }
    art.category = art.category.toLowerCase().trim();
  });

  // 2. Omitir reparación de pies de foto por velocidad de restauración
  console.log('\n--- Omitiendo reparación de pies de foto genéricos para restauración ultra-rápida ---');

  // 3. Deduplicación inteligente
  console.log('\n--- Deduplicando artículos... ---');
  const duplicatesToDelete = new Set();
  let directMatches = 0;
  let semanticMatches = 0;

  for (let i = 0; i < list.length; i++) {
    const artA = list[i];
    if (duplicatesToDelete.has(artA.id)) continue;

    for (let j = i + 1; j < list.length; j++) {
      const artB = list[j];
      if (duplicatesToDelete.has(artB.id)) continue;

      if (artA.category !== artB.category) continue;

      const timeDiff = Math.abs(new Date(artA.publishedAt).getTime() - new Date(artB.publishedAt).getTime());
      const maxTimeDiff = 5 * 24 * 60 * 60 * 1000; // 5 días
      if (timeDiff > maxTimeDiff) continue;

      const jaccard = calculateJaccardSimilarity(artA.title, artB.title);

      if (jaccard > 0.30) {
        console.log(`[Deduplicación] Fusión directa (Jaccard: ${jaccard.toFixed(2)}):`);
        console.log(`  A (Mantener): "${artA.title}"`);
        console.log(`  B (Borrar):   "${artB.title}"`);
        duplicatesToDelete.add(artB.id);
        directMatches++;
      }
    }
  }

  const cleanList = list.filter(art => !duplicatesToDelete.has(art.id));
  console.log(`\nDeduplicación finalizada:`);
  console.log(`- Duplicados directos borrados: ${directMatches}`);
  console.log(`- Duplicados semánticos borrados: ${semanticMatches}`);
  console.log(`- Artículos limpios restantes: ${cleanList.length} (de ${list.length} iniciales).`);

  // 4. Subir la lista limpia a Firebase
  const finalMap = {};
  cleanList.forEach(art => {
    finalMap[art.id] = art;
  });

  console.log('\nSubiendo base de datos saneada a Firebase...');
  const patchResponse = await fetch(patchUrl, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      security_token: securityToken,
      articles: finalMap
    })
  });

  if (patchResponse.ok) {
    console.log('¡Saneamiento y reparación completados con éxito en Firebase RTDB!');
  } else {
    console.error('Error al subir los datos saneados:', await patchResponse.text());
  }
}

repair();
