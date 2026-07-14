#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

// Cargar variables de entorno del .env
try {
  const envPath = path.resolve('.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split(/\r?\n/).forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value.trim();
      }
    });
  }
} catch (e) {}

import { normalizeCategoryAndSubcategory } from '../src/lib/sources.ts';

const apiKey = process.env.OPENROUTER_API_KEY;
const firebaseBaseUrl = 'https://pecemi-default-rtdb.firebaseio.com/aidaily';
const securityToken = 'pecemi_secure_gateway_token_2026_xyz';

function cleanHashtagsList(tags) {
  if (!Array.isArray(tags)) return [];
  const clean = [];
  const seen = new Set();
  
  tags.forEach(tag => {
    if (typeof tag !== 'string') return;
    let cleaned = tag.trim()
      .replace(/[,.!?;:\"']/g, '')
      .replace(/[\#]/g, '')
      .replace(/[^\w\d_áéíóúÁÉÍÓÚñÑüÜí-]/g, '')
      .trim();
    
    if (cleaned.length >= 2) {
      cleaned = '#' + cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      const lower = cleaned.toLowerCase();
      if (lower === '#noticias' || lower === '#noticia' || lower === '#actualidad') return;
      if (!seen.has(lower)) {
        seen.add(lower);
        clean.push(cleaned);
      }
    }
  });
  
  return clean;
}

let globalModelRotator = 0;
function getAIModelsList(preferred) {
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
    'poolside/laguna-m.1:free'
  ];

  if (!preferred) {
    return whitelist;
  }

  let cleanPreferred = preferred.trim();
  if (!cleanPreferred.endsWith(':free') && cleanPreferred !== 'openrouter/free') {
    cleanPreferred = `${cleanPreferred}:free`;
  }

  // Si el modelo preferido no está en la whitelist de gratuitos, omitirlo con advertencia
  if (!whitelist.includes(cleanPreferred) && cleanPreferred !== 'openrouter/free') {
    console.warn(`[ModelRotator] El modelo preferido "${preferred}" no es un modelo gratuito validado. Usando fallbacks.`);
    return whitelist;
  }

  return [cleanPreferred, ...whitelist.filter(m => m !== cleanPreferred)];
}

// Prompt e invocación a OpenRouter para clasificar
async function classifyArticle(title, summary, fullText) {
  const prompt = `Clasifica esta noticia y genera hashtags CamelCase específicos. Retorna EXCLUSIVAMENTE un objeto JSON válido con este formato:
{
  "category": "categoria_principal",
  "subcategory": "subcategoria",
  "hashtags": ["#Tag1", "#Tag2", "#Tag3"]
}

NOTICIA:
Título: ${title}
Resumen: ${summary}
Contenido: ${(fullText || '').slice(0, 1000)}

REGLAS:
1. Retorna solo el JSON.
2. Categoría debe ser una de estas 12 en minúsculas: internacional, nacional, economia, opinion, ciencia, tecnologia, medioambiente, cultura, estilo, deportes, sociedad, gastronomia.
3. Si involucra a deportistas o clubes en litigios o sucesos, clasifica OBLIGATORIAMENTE en deportes.
4. Genera de 3 a 5 hashtags CamelCase de entidades específicas (ej. #RealMadrid, #Nvidia). No genéricos.`;

  // --- Intento con Ollama Local ---
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const textModel = process.env.OLLAMA_TEXT_MODEL || 'moondream';
  try {
    console.log(`[Clasificación local] Intentando con Ollama local: ${textModel}`);
    const res = await fetch(`${ollamaUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: textModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 300,
        response_format: { type: "json_object" }
      })
    });
    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      if (content) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          console.log(`[Clasificación local] ¡Éxito con Ollama local!`);
          return JSON.parse(jsonMatch[0].trim());
        }
      }
    }
  } catch (err) {
    console.warn(`[Clasificación local] Falló Ollama local:`, err.message);
  }

  console.log(`[Clasificación] Cayendo al pool de OpenRouter...`);
  const models = getAIModelsList('google/gemini-2.5-flash:free');
  
  let firstModel = true;
  for (const model of models) {
    if (!firstModel) {
      await new Promise(r => setTimeout(r, 1500));
    }
    firstModel = false;
    
    try {
      console.log(`[Clasificación] Intentando con modelo: ${model}`);
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://143-47-35-167.sslip.io/ia-daily/',
          'X-Title': 'IA Daily Classifier Tool',
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 300,
          response_format: { type: "json_object" }
        })
      });

      if (!res.ok) {
        console.warn(`[Clasificación] Error con ${model}: HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      if (content) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0].trim());
        }
      }
    } catch (err) {
      console.warn(`[Clasificación] Falló con ${model}:`, err.message);
    }
  }
  throw new Error('Todos los modelos fallaron en la clasificación.');
}

// Invocación a OpenRouter para reescribir reporte completo
async function repairArticle(title, source, text) {
  const prompt = `Analiza esta noticia y adapta su contenido al español como un reportaje premium. Genera EXCLUSIVAMENTE un objeto JSON válido con esta estructura (sin markdown ni delimitadores):
{
  "title": "Titular impactante en español (estilo NYT/El País)",
  "aiSummary": "Resumen ejecutivo en español (2-3 oraciones, contexto + impacto)",
  "keyPoints": ["Punto 1 (15-30 palabras, con cifras)", "Punto 2", "Punto 3", "Punto 4"],
  "whyMatters": "Párrafo desarrollado (mínimo 3 oraciones) explicando impacto real, implicaciones estratégicas y por qué importa",
  "category": "categoria_principal",
  "subcategory": "subcategoria",
  "hashtags": ["#TagEspecifico1", "#TagEspecifico2", "#TagEspecifico3"],
  "fullArticle": "Artículo completo (3-5 párrafos bien estructurados, con datos, contexto y narrativa periodística premium)",
  "links": [{"title": "Nombre descriptivo del enlace en español", "url": "https://url-real-relevante.com"}],
  "interestingData": [{"label": "Dato clave", "value": "Valor cuantificable"}]
}

NOTICIA:
Título original: ${title}
Fuente: ${source}
Contenido: ${text.slice(0, 5000)}

REGLAS DE REDACCIÓN EDITORIAL:
1. TODO en español. Traduce absolutamente todo.
2. Tono premium periodístico tipo NYT/El País con la garra de Xataka. Titulares impactantes, clickbait inteligente pero veraz.
3. "keyPoints": 3-4 puntos con cifras y detalles concretos (no generalidades).
4. "whyMatters": Mínimo 3 oraciones profundas con análisis estratégico real.
5. "fullArticle": 3-5 párrafos largos, bien redactados, con contexto de fondo, detalles técnicos e impacto.
6. "category": Uno de estos 12: internacional, nacional, economia, opinion, ciencia, tecnologia, medioambiente, cultura, estilo, deportes, sociedad, gastronomia.
7. "subcategory": Subcategoría válida según la categoría.
8. "hashtags": 3-5 hashtags CamelCase de entidades específicas (#RealMadrid, #Nvidia), NO genéricos.
9. "links": 1-3 enlaces reales de referencia (fuente original, sitios oficiales, Wikipedia).
10. "interestingData": 2-4 datos cuantificables extraídos del artículo (cifras, fechas, porcentajes).
11. Usa comillas simples dentro de los textos JSON para no romper el formato.`;


  // --- Intento con Ollama Local ---
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const textModel = process.env.OLLAMA_TEXT_MODEL || 'moondream';
  try {
    console.log(`[Reparación local] Intentando con Ollama local: ${textModel}`);
    const res = await fetch(`${ollamaUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: textModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 2200,
        response_format: { type: "json_object" }
      })
    });
    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      if (content) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          console.log(`[Reparación local] ¡Éxito con Ollama local!`);
          return JSON.parse(jsonMatch[0].trim());
        }
      }
    }
  } catch (err) {
    console.warn(`[Reparación local] Falló Ollama local:`, err.message);
  }

  console.log(`[Reparación] Cayendo al pool de OpenRouter...`);
  const models = getAIModelsList('google/gemini-2.5-flash:free');
  
  let firstModel = true;
  for (const model of models) {
    if (!firstModel) {
      await new Promise(r => setTimeout(r, 2000));
    }
    firstModel = false;
    
    try {
      console.log(`[Reparación] Intentando con modelo: ${model}`);
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://143-47-35-167.sslip.io/ia-daily/',
          'X-Title': 'IA Daily Repair Tool',
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.4,
          max_tokens: 2200,
          response_format: { type: "json_object" }
        })
      });

      if (!res.ok) {
        console.warn(`[Reparación] Error con ${model}: HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      if (content) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0].trim());
        }
      }
    } catch (err) {
      console.warn(`[Reparación] Falló con ${model}:`, err.message);
    }
  }
  throw new Error('Todos los modelos fallaron en la reparación.');
}

async function main() {
  const args = process.argv.slice(2);
  const actionArg = args.find(a => a.startsWith('--action=') || a === '--action');
  const idsArg = args.find(a => a.startsWith('--ids=') || a === '--ids');
  
  let action = '';
  if (actionArg) {
    action = actionArg.includes('=') ? actionArg.split('=')[1] : args[args.indexOf(actionArg) + 1];
  }
  
  let idsList = [];
  if (idsArg) {
    const idsVal = idsArg.includes('=') ? idsArg.split('=')[1] : args[args.indexOf(idsArg) + 1];
    idsList = idsVal.split(',').map(id => id.trim()).filter(id => id.length > 0);
  }

  const allFallbacks = args.includes('--all-fallbacks');

  if (!apiKey) {
    console.error('ERROR: OPENROUTER_API_KEY vacía en el .env');
    process.exit(1);
  }

  if (!action) {
    console.error('Uso: node ai-article-tool.mjs --action [classify|repair] [--ids id1,id2 | --all-fallbacks]');
    process.exit(1);
  }

  console.log(`[Herramienta IA] Acción: ${action.toUpperCase()}`);
  
  // Descargar artículos
  console.log('[Herramienta IA] Descargando artículos de Firebase...');
  const getRes = await fetch(`${firebaseBaseUrl}/articles.json`);
  if (!getRes.ok) {
    console.error('Error al descargar de Firebase:', getRes.statusText);
    process.exit(1);
  }
  const allArticles = await getRes.json() || {};

  let targets = [];
  if (allFallbacks) {
    targets = Object.values(allArticles).filter(art => {
      return (art.whyMatters === 'Esta noticia representa un desarrollo relevante en su sector.') ||
             (Array.isArray(art.keyPoints) && art.keyPoints.length === 1 && art.keyPoints[0] === art.title) ||
             art.isFallback;
    });
    console.log(`[Herramienta IA] Detectados ${targets.length} artículos en fallback para reparar.`);
  } else if (idsList.length > 0) {
    targets = idsList.map(id => allArticles[id]).filter(art => !!art);
    console.log(`[Herramienta IA] Encontrados ${targets.length} artículos objetivo para procesar.`);
  }

  if (targets.length === 0) {
    console.log('[Herramienta IA] Sin artículos que procesar.');
    return;
  }

  let successCount = 0;

  for (let i = 0; i < targets.length; i++) {
    const art = targets[i];
    console.log(`[${i + 1}/${targets.length}] Procesando: "${art.title}" (ID: ${art.id})`);
    
    try {
      if (action === 'classify') {
        const result = await classifyArticle(art.title, art.summary, art.fullText);
        const norm = normalizeCategoryAndSubcategory(result.category, result.subcategory);
        
        const updated = {
          ...art,
          category: norm.category,
          subcategory: norm.subcategory,
          hashtags: cleanHashtagsList(result.hashtags),
          tags: [norm.category, ...cleanHashtagsList(result.hashtags).map(h => h.replace('#', '').toLowerCase())],
          scrapedAt: new Date().toISOString()
        };

        const patchPayload = {
          security_token: securityToken,
          articles: { [art.id]: updated }
        };

        const patchRes = await fetch(`${firebaseBaseUrl}.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patchPayload)
        });

        if (patchRes.ok) {
          console.log(`   ✅ Clasificado: ${norm.category} > ${norm.subcategory}`);
          successCount++;
        }
      } else if (action === 'repair') {
        const textToAnalyze = art.fullText || art.summary || art.title;
        const result = await repairArticle(art.title, art.source, textToAnalyze);
        const norm = normalizeCategoryAndSubcategory(result.category, result.subcategory);

        const updated = {
          ...art,
          title: result.title || art.title,
          summary: result.aiSummary || art.summary,
          aiSummary: result.aiSummary || art.summary,
          keyPoints: Array.isArray(result.keyPoints) ? result.keyPoints : [art.title],
          whyMatters: result.whyMatters || art.whyMatters,
          category: norm.category,
          subcategory: norm.subcategory,
          hashtags: cleanHashtagsList(result.hashtags),
          tags: [norm.category, ...cleanHashtagsList(result.hashtags).map(h => h.replace('#', '').toLowerCase())],
          fullArticle: result.fullArticle || art.fullArticle,
          links: Array.isArray(result.links) ? result.links : (art.links || []),
          interestingData: Array.isArray(result.interestingData) ? result.interestingData : (art.interestingData || []),
          multimedia: art.multimedia || [],
          scrapedAt: new Date().toISOString()
        };
        delete updated.isFallback;

        const patchPayload = {
          security_token: securityToken,
          articles: { [art.id]: updated }
        };

        const patchRes = await fetch(`${firebaseBaseUrl}.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patchPayload)
        });

        if (patchRes.ok) {
          console.log(`   ✅ Reparado: ${art.title.slice(0, 40)}...`);
          successCount++;
        }
      }

    } catch (err) {
      console.error(`   ❌ Error en artículo ${art.id}:`, err.message);
    }

    // Delay de 1.2 segundos para evitar saturación
    await new Promise(r => setTimeout(r, 1200));
  }

  console.log(`=== Proceso IA Finalizado: ${successCount}/${targets.length} con éxito ===`);
}

main();
