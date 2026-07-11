#!/usr/bin/env node
/**
 * update-trending-topics.mjs
 * Corre en la VPS cada 2h (o en cada cron).
 * Analiza el historial reciente de noticias y decide dinámicamente
 * los "Temas Calientes" (Trending Topics) en base a la actualidad real.
 */
import fs from 'fs';
import path from 'path';

// Cargar .env
try {
  const envPath = path.resolve('.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split(/\r?\n/).forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        process.env[key] = value.trim();
      }
    });
  }
} catch (_) {}

async function updateTrendingTopics() {
  console.log('[TRENDS] === Iniciando detección dinámica de Temas Calientes ===');

  const cachePath = path.resolve('./src/data/cache-news.json');
  if (!fs.existsSync(cachePath)) {
    console.error('[TRENDS] No se encontró el archivo de caché de noticias.');
    return;
  }

  let articles = [];
  try {
    articles = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
  } catch (e) {
    console.error('[TRENDS] Error leyendo caché:', e.message);
    return;
  }

  const limit48h = Date.now() - 48 * 60 * 60 * 1000;
  const recentArticles = articles.filter(art => {
    try {
      return new Date(art.publishedAt).getTime() > limit48h;
    } catch {
      return false;
    }
  });

  console.log(`[TRENDS] Analizando ${recentArticles.length} noticias de las últimas 48h...`);
  if (recentArticles.length === 0) {
    console.log('[TRENDS] No hay noticias recientes suficientes. Finalizando.');
    return;
  }

  const headlines = recentArticles.map(art => `- [${art.category}] ${art.title}`).slice(0, 80).join('\n');

  let existingTrends = {};
  try {
    const res = await fetch('https://pecemi-default-rtdb.firebaseio.com/aidaily/trending_topics.json');
    if (res.ok) {
      existingTrends = await res.json() || {};
    }
  } catch (e) {
    console.warn('[TRENDS] No se pudieron obtener temas existentes de Firebase:', e.message);
  }

  const prompt = `Analiza estos titulares recientes de prensa y decide de forma autónoma cuáles son los 3 a 5 Temas Calientes (Trending Topics) de la actualidad informativa en España y el mundo ahora mismo.
No inventes temas genéricos; enfócate en eventos reales, sucesos, tendencias tecnológicas o eventos deportivos que tengan un pico de noticias.

Titulares a analizar:
${headlines}

Temas calientes que ya están activos actualmente en la base de datos (mantenlos si siguen siendo relevantes, ajustando o refrescando sus datos si es necesario):
${JSON.stringify(existingTrends, null, 2)}

Devuelve una estructura JSON con los temas calientes recomendados. Cada tema debe tener obligatoriamente:
- id: un slug único en minúsculas sin espacios (ej: 'tour-de-francia-2026').
- title: título legible e impactante (ej: 'Tour de Francia 2026').
- type: 'event' (para grandes eventos que duran semanas), 'breaking' (para sucesos urgentes de pocas horas como incendios o elecciones) o 'trend' (para tendencias de varios días como lanzamientos o debates políticos).
- status: 'active'.
- popularity: puntuación entre 0.50 y 1.00 basada en el volumen de noticias.
- keywords: 3 a 6 palabras clave en minúsculas para buscar noticias relacionadas en el feed (ej: ["tour de francia", "pogacar", "vingegaard", "etapa"]).
- expiresAt: fecha ISO en que caducará por defecto (ej: un suceso dura 8h, un debate político 72h, el Tour de Francia 25 días).
- menu (OPCIONAL, solo si type es 'event'): menú contextual con 3 o 4 pestañas de navegación para el feed. Cada pestaña debe tener:
  * label: etiqueta de la pestaña (ej: 'Etapas', 'Clasificación', 'Noticias').
  * action: 'filter' (para filtrar en caliente) o 'url' (para enlace externo).
  * query (si es action='filter'): término de búsqueda (ej: 'etapa' o 'noticias').
  * url (si es action='url'): enlace externo oficial (ej: clasificaciones oficiales).

Responde estrictamente en formato JSON válido. No añadas introducciones, explicaciones ni bloques de código markdown. Devuelve SOLO el objeto JSON principal.`;

  // 5. Intentar llamada a la IA con Nous Research (Prioritario), luego OpenRouter, luego Ollama local
  const apiKey = process.env.OPENROUTER_API_KEY;
  let trendsResult = null;
  const models = [
    'stepfun/step-3.7-flash:free',
    'tencent/hy3:free',
    'nousresearch/hermes-3-llama-3.1-405b:free',
    'google/gemma-4-31b-it:free',
    'meta-llama/llama-3.2-3b-instruct:free'
  ];

  // Intentar obtener token de Nous
  let nousToken = null;
  try {
    const { execSync } = await import('child_process');
    const tokenJson = execSync('python3 /home/ubuntu/workspace/AIDAILY/scripts/get_nous_token.py').toString().trim();
    nousToken = JSON.parse(tokenJson);
  } catch (e) {
    console.warn('[TRENDS] No se pudo obtener el token dinámico de Nous:', e.message);
  }

  // A. FASE 1: Llamar a través de Nous API (Si está disponible)
  if (nousToken && nousToken.access_token) {
    console.log('[TRENDS] Usando API de Nous Research para la inferencia de temas calientes...');
    for (const model of models) {
      try {
        console.log(`[TRENDS] [Nous API] Probando ${model}...`);
        const res = await fetch(`${nousToken.base_url}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${nousToken.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3
          })
        });

        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            const cleanJson = content.replace(/```json|```/g, '').trim();
            trendsResult = JSON.parse(cleanJson);
            console.log(`[TRENDS] ✅ Éxito con ${model} en Nous API.`);
            break;
          }
        }
      } catch (e) {
        console.warn(`[TRENDS] Error en Nous con ${model}:`, e.message);
      }
    }
  }

  // B. FASE 2: Fallback a OpenRouter Directo (Si el anterior falló)
  if (!trendsResult && apiKey) {
    console.log('[TRENDS] Fallback: Usando OpenRouter directo...');
    for (const model of models) {
      try {
        console.log(`[TRENDS] [OpenRouter] Probando ${model}...`);
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3
          })
        });

        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            const cleanJson = content.replace(/```json|```/g, '').trim();
            trendsResult = JSON.parse(cleanJson);
            console.log(`[TRENDS] ✅ Éxito con ${model} en OpenRouter.`);
            break;
          }
        }
      } catch (e) {
        console.warn(`[TRENDS] Error en OpenRouter con ${model}:`, e.message);
      }
    }
  }

  // C. FASE 3: Fallback final a Ollama Local en CPU (Si todo lo anterior falló)
  if (!trendsResult) {
    console.log('[TRENDS] Fallback crítico: Usando Ollama local en CPU de la VPS...');
    try {
      const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      const localModel = process.env.OLLAMA_FILTER_MODEL || 'qwen2.5:1.5b';
      
      const res = await fetch(`${ollamaUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: localModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3
        })
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const cleanJson = content.replace(/```json|```/g, '').trim();
          trendsResult = JSON.parse(cleanJson);
          console.log(`[TRENDS] ✅ Éxito con Ollama local (${localModel}).`);
        }
      }
    } catch (e) {
      console.error('[TRENDS] Falló también Ollama local:', e.message);
    }
  }

  if (!trendsResult) {
    console.error('[TRENDS] No se pudo obtener respuesta de ningún modelo de IA.');
    return;
  }

  const finalTrends = {};
  const now = new Date();

  // Normalizar trendsResult (puede ser Array o un Objeto de temas calientes)
  let rawList = [];
  if (Array.isArray(trendsResult)) {
    rawList = trendsResult;
  } else if (trendsResult && typeof trendsResult === 'object') {
    // Si la IA devolvió un wrapper tipo { trends: [...] }
    if (Array.isArray(trendsResult.trends)) {
      rawList = trendsResult.trends;
    } else {
      // De lo contrario es un diccionario de tipo { "slug": { ... } }
      rawList = Object.entries(trendsResult).map(([k, val]) => {
        return { ...val, id: val.id || k };
      });
    }
  }

  // Guardar usando el slug (id) como clave primaria
  rawList.forEach(t => {
    if (!t || !t.id) return;
    const slug = String(t.id).toLowerCase().replace(/[^a-z0-9-]/g, '-');
    finalTrends[slug] = {
      ...t,
      id: slug,
      status: 'active',
      createdAt: t.createdAt || new Date().toISOString()
    };
  });

  // Procesar decaimiento (decay) para temas calientes existentes
  Object.entries(existingTrends || {}).forEach(([id, t]) => {
    // Ignorar campos de control de Firebase y registros rotos, incluyendo claves numéricas antiguas
    if (['updatedAt', 'windowHours', 'totalRecentArticles', 'topics', 'popularity'].includes(id)) return;
    if (!isNaN(Number(id))) return; // Descartar claves numéricas antiguas
    if (typeof t !== 'object' || !t || !t.title || !t.expiresAt) return;

    if (!finalTrends[id]) {
      const expiresAt = new Date(t.expiresAt);
      if (expiresAt < now) {
        console.log(`[TRENDS] Tema caducado eliminado: "${t.title}" (Expiró el ${t.expiresAt})`);
      } else {
        const newPopularity = Math.max(0, (t.popularity || 0.5) - 0.1);
        if (newPopularity >= 0.3) {
          finalTrends[id] = {
            ...t,
            popularity: parseFloat(newPopularity.toFixed(2))
          };
          console.log(`[TRENDS] Aplicando decay al tema: "${t.title}" (Nueva popularidad: ${newPopularity})`);
        } else {
          console.log(`[TRENDS] Tema con baja popularidad archivado: "${t.title}"`);
        }
      }
    }
  });

  console.log(`[TRENDS] Guardando ${Object.keys(finalTrends).length} temas calientes en Firebase...`);
  try {
    const saveRes = await fetch('https://pecemi-default-rtdb.firebaseio.com/aidaily/trending_topics.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalTrends)
    });
    if (saveRes.ok) {
      console.log('[TRENDS] ✅ Temas calientes actualizados con éxito en la nube.');
    } else {
      console.error(`[TRENDS] Falló subida a Firebase. Status: ${saveRes.status}`);
    }
  } catch (e) {
    console.error('[TRENDS] Error de red al guardar en Firebase:', e.message);
  }
}

await updateTrendingTopics();
