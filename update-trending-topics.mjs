#!/usr/bin/env node
// update-trending-topics.mjs — Detecta temas calientes REALES a partir de los artículos recientes
// Se ejecuta cada 2h vía Hermes cron. NO inventa temas: analiza frecuencia de keywords en titulares.

import fs from 'fs';
import https from 'https';
import http from 'http';

const FIREBASE_URL = 'https://pecemi-default-rtdb.firebaseio.com/aidaily';
const CACHE_PATH = '/home/ubuntu/workspace/AIDAILY/src/data/cache-news.json';
const OUTPUT_PATH = '/home/ubuntu/workspace/AIDAILY/trending_topics.json';
const WINDOW_HOURS = 48;
const MIN_ARTICLES_FOR_TREND = 4; // Bigramas necesitan 4+, unigramas 6+
const MAX_TOPICS = 6;

const STOPWORDS = new Set([
  'de','la','el','en','un','una','los','las','del','al','con','por','para','que','se','su','es',
  'y','a','o','no','mas','como','ya','ha','han','son','fue','ser','puede','pero','sobre','entre',
  'desde','hasta','sin','esta','este','sus','todo','todos','muy','tambien','hay','otro','otra',
  'otros','cada','tras','segun','nuevo','nueva','nuevos','nuevas','gran','primer','primera','mejor',
  'parte','vez','tiempo','forma','donde','dos','tres','ano','anos','dia','dias','mundo','durante',
  'solo','ni','ante','bajo','contra','hacia','como','cual','que','quien','le','lo','me','te',
  'nos','les','mi','ello','ella','ellos','ellas','usted','ustedes','sera','sido','ser','estar',
  'tiene','tienen','hace','hacer','dice','dijo','esto','eso','aqui','asi','bien','mal','poco',
  'mucho','algo','nada','menos','ahora','antes','despues','hoy','ayer','manana','toda',
  'estas','estos','esas','esos','aquellas','aquellos','cual','quien','cuyo','cuya','sino','pues',
  'porque','aunque','mientras','cuando','segun','mediante','dentro','fuera','arriba','abajo',
  'cerca','lejos','aqui','alli','aun','tan','tanto','tanta','tantos','tantas','tal','tales',
  'article','foto','imagen','video','ultima','hora','noticia','noticias','could','would','should',
  'says','said','will','been','have','more','than','into','some','them','their','they','were',
  'what','when','with','about','after','also','back','before','being','between','both','came',
  'come','each','from','going','good','great','here','high','just','know','last','like','long',
  'look','made','make','many','most','much','must','name','never','next','only','other','over',
  'past','same','show','side','since','still','such','sure','take','tell','that','the','then',
  'there','these','this','through','time','turn','under','upon','very','want','well','went',
  'where','which','while','word','work','year','your','tech','technology','tecnologia',
  'inteligencia','artificial','report','reports','update','updates','news',
  // Palabras demasiado genéricas para trending
  'historia','global','millones','dolares','euros','mundo','nueva','nuevo','nuevas','nuevos',
  'primer','primera','primero','segundo','segunda','tercero','tercera','mejor','peor',
  'permite','permite','lanza','lanzamiento','anuncia','presenta','revela','confirma',
  'empresa','empresas','compania','companias','mercado','mercados','sistema','sistemas',
  'modelo','modelos','proyecto','proyectos','servicio','servicios','plataforma','datos',
  'usuarios','usuario','aplicacion','version','futuro','desarrollo','nivel','uso','acceso',
  'segun','dice','afirma','explica','asegura','advierte','senala','indica','destaca',
  'podria','deberia','debe','necesita','quiere','busca','espera','pretende','planea',
  'europa','asia','america','africa','pais','paises','gobierno','gobiernos','presidente',
  'million','billion','percent','years','people','company','companies','market','data',
  'first','major','state','public','health','power','world','international','national',
  'political','economic','social','digital','online','website','program','plan','group',
  'china','eeuu','estados','unidos','rusia','japon','india','reino','unido',
  'clave','importante','importante','principales','principales','posible','necesario',
  'alerta','vida','era','seguridad','manera','forma','caso','casos','tipo','tipos',
  'punto','puntos','cambio','cambios','efecto','efectos','problema','problemas',
  'resultado','resultados','riesgo','riesgos','medida','medidas','paso','pasos',
  'lado','momento','momento','horas','semana','semanas','mes','meses','cifra','cifras',
  'valor','valores','precio','precios','crecimiento','caida','impacto','crisis',
  'acuerdo','decision','propuesta','control','apoyo','estrategia','solucion','avance',
  'record','expertos','analisis','estudio','informe','investigacion','recurso','recursos',
  'sector','industria','red','redes','real','actual','potencial','total','general',
  'gran','grande','grandes','pequeno','pequena','alto','alta','altos','bajo','baja',
  'serie','apuesta','apuestas','tus','equipo','equipos','juego','juegos','lugar','lugares',
  'linea','pesar','frente','libre','cuerpo','mano','manos','ojo','ojos','puerta','puertas',
  'calle','calles','carta','cartas','guerra','paz','ley','leyes','fin','final','inicio',
  'meta','plan','planes','idea','ideas','sueno','suenos','verdad','mentira','fuerza',
  'razon','razones','movimiento','movimientos','regla','reglas','orden','desorden',
  'trump','biden','musk','openai','google','apple','microsoft','amazon','nvidia','meta',
  'gpt','chatgpt','gemini','claude','llama','robot','robots','drone','drones',
  'lider','lideres','jefe','jefes','director','directora','fundador','fundadora',
  'contra','lucha','pelea','enfrentamiento','conflicto','tension','amenaza','ataque',
  'accion','acciones','reaccion','respuesta','posicion','situacion','condicion','condiciones',
  // Verbos comunes
  'convierte','redefine','llega','llegan','podria','muestra','presenta','supera','revela',
  'anuncia','lanza','ofrece','abre','cierra','gana','pierde','sube','baja','logra',
  'cambia','marca','rompe','enfrenta','desvela','destaca','lidera','impulsa','desafia',
  'transforma','promete','amenaza','prepara','alerta','advierte','critica','defiende',
  'celebra','inaugura','estrena','confirma','niega','rechaza','aprueba','exige','pide',
  'denuncia','acusa','propone','dispara','arrasa','sorprende','sacude','golpea',
  'revoluciona','domina','conquista','desafio','desafios','reto','retos','vuelve',
  // Temporales y genéricos
  'julio','junio','agosto','septiembre','octubre','noviembre','diciembre','enero','febrero',
  'marzo','abril','mayo','temporada','temporadas','casa','victoria','derrota','tercer',
  'cuarto','quinto','comienzo','proxima','proximo','proximos','proximas',
  'futbol','tenis','baloncesto','hockey','rugby','boxeo','golf','formula',
  'polemica','polemico','escandalo','contrato','contratos','fichaje','fichajes',
  'transferencia','clasico','derbi','campeonato','competicion','torneo','campeon',
  'seleccion','copa','liga','partido','gol','goles','jugador','jugadores','entrenador',
  'batalla','batallas','regreso','caos','poder','secreto','secretos','misterio','verdadero',
  'clave','cosas','trampa','truco','trucos','razon','razones','dato','error','errores',
  'exito','fracaso','cifras','peligro','peligros','locura','bomba','explosion','tragedia'
]);

function patchFirebase(path, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const url = new URL(`${FIREBASE_URL}/${path}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(options, (res) => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => resolve(d));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

import { execSync } from 'child_process';

function getNousToken() {
  try {
    const scriptPath = '/home/ubuntu/workspace/AIDAILY/scripts/get_nous_token.py';
    const pythonPath = '/usr/local/lib/hermes-agent/venv/bin/python3';
    if (!fs.existsSync(scriptPath)) {
      return null;
    }
    const stdout = execSync(`"${pythonPath}" "${scriptPath}"`, { encoding: 'utf8', timeout: 15000 });
    const res = JSON.parse(stdout);
    if (res.success && res.access_token) {
      return { access_token: res.access_token, base_url: res.base_url };
    }
  } catch (e) {
    // Silencioso
  }
  return null;
}

async function callGroqAPI(prompt) {
  console.log(`[Trending IA] Iniciando rotación inteligente de modelos...`);
  
  // --- PASO 1: Ollama Local (Prioridad máxima por ser local, rápido e ilimitado) ---
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const localModel = process.env.OLLAMA_FILTER_MODEL || 'qwen2.5:1.5b';
  console.log(`[Trending IA] Intentando con Ollama Local (${localModel})...`);
  try {
    const res = await fetch(`${ollamaUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000), // 15s timeout rápido
      body: JSON.stringify({
        model: localModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })
    });
    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      if (content) {
        console.log(`[Trending IA] ✅ Éxito con Ollama Local.`);
        return content;
      }
    } else {
      console.warn(`[Trending IA] Ollama Local devolvió status ${res.status}`);
    }
  } catch (e) {
    console.warn(`[Trending IA] Error con Ollama Local:`, e.message || e);
  }

  // --- PASO 2: Nous Research (Portal gratuito e ilimitado) ---
  const nous = getNousToken();
  if (nous && nous.access_token) {
    const nousModel = 'stepfun/step-3.7-flash:free';
    console.log(`[Trending IA] Intentando con Nous Research (${nousModel})...`);
    try {
      const res = await fetch(`${nous.base_url}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${nous.access_token}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          model: nousModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          response_format: { type: 'json_object' }
        })
      });
      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        if (content) {
          console.log(`[Trending IA] ✅ Éxito con Nous Research.`);
          return content;
        }
      } else {
        console.warn(`[Trending IA] Nous Research devolvió status ${res.status}`);
      }
    } catch (e) {
      console.warn(`[Trending IA] Error con Nous Research:`, e.message || e);
    }
  }

  // --- PASO 3: Cloudflare Workers AI (Gratuito, cuota holgada) ---
  const cfToken = process.env.CLOUDFLARE_API_KEY;
  if (cfToken && cfToken.trim() !== '') {
    const cfModel = '@cf/meta/llama-3.1-8b-instruct';
    console.log(`[Trending IA] Intentando con Cloudflare Workers AI (${cfModel})...`);
    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/9d248b8b5baed3559e743ef138d25b64/ai/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cfToken}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          model: cfModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1
        })
      });
      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        if (content) {
          console.log(`[Trending IA] ✅ Éxito con Cloudflare Workers AI.`);
          return content;
        }
      } else {
        console.warn(`[Trending IA] Cloudflare Workers AI devolvió status ${res.status}`);
      }
    } catch (e) {
      console.warn(`[Trending IA] Error con Cloudflare Workers AI:`, e.message || e);
    }
  }

  // --- PASO 4: OpenRouter Modelos Gratuitos ---
  const orKey = process.env.OPENROUTER_API_KEY;
  if (orKey && orKey.trim() !== '') {
    const orModels = [
      'meta-llama/llama-3.2-3b-instruct:free',
      'google/gemma-2-9b-it:free',
      'tencent/hy3:free'
    ];
    for (const model of orModels) {
      console.log(`[Trending IA] Intentando con OpenRouter Gratis (${model})...`);
      try {
        const res = await fetch(`https://openrouter.ai/api/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${orKey}`,
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(35000),
          body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1
          })
        });
        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content?.trim();
          if (content) {
            console.log(`[Trending IA] ✅ Éxito con OpenRouter Gratis (${model}).`);
            return content;
          }
        } else {
          console.warn(`[Trending IA] OpenRouter Gratis (${model}) devolvió status ${res.status}`);
        }
      } catch (e) {
        console.warn(`[Trending IA] Error con OpenRouter Gratis (${model}):`, e.message || e);
      }
    }
  }

  // --- PASO 5: OpenRouter Comercial (Fallback Final de Pago) ---
  if (orKey && orKey.trim() !== '') {
    const backupModel = 'meta-llama/llama-3.3-70b-instruct';
    console.log(`[Trending IA] Intentando con OpenRouter Comercial (${backupModel}) [PAGO]...`);
    try {
      const res = await fetch(`https://openrouter.ai/api/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${orKey}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          model: backupModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          response_format: { type: 'json_object' }
        })
      });
      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        if (content) {
          console.log(`[Trending IA] ✅ Éxito con OpenRouter Comercial (Pago).`);
          return content;
        }
      } else {
        console.warn(`[Trending IA] OpenRouter Comercial devolvió status ${res.status}`);
      }
    } catch (e) {
      console.warn(`[Trending IA] Error con OpenRouter Comercial:`, e.message || e);
    }
  }

  throw new Error("Todos los proveedores del pool de Trending IA fallaron.");
}

function extractBigrams(words) {
  const bigrams = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(words[i] + ' ' + words[i + 1]);
  }
  return bigrams;
}

function tokenize(title) {
  if (!title || typeof title !== 'string') return [];
  return title.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
}

async function main() {
  console.log(`[${new Date().toISOString()}] Analizando temas calientes...`);

  let articles = [];
  try {
    const raw = fs.readFileSync(CACHE_PATH, 'utf-8');
    const data = JSON.parse(raw);
    articles = Array.isArray(data) ? data : Object.values(data).flat();
  } catch (e) {
    console.error('Error leyendo cache:', e.message);
    process.exit(1);
  }

  console.log(`  Total articulos en cache: ${articles.length}`);

  const now = Date.now();
  const cutoff = now - WINDOW_HOURS * 3600 * 1000;
  const recent = articles.filter(a => {
    const t = new Date(a.date || a.publishedAt || a.created_at || 0).getTime();
    return t > cutoff && !isNaN(t);
  });

  console.log(`  Articulos recientes (${WINDOW_HOURS}h): ${recent.length}`);

  if (recent.length < 5) {
    console.log('  Muy pocos articulos recientes, manteniendo trending anterior.');
    process.exit(0);
  }

  const unigramFreq = new Map();
  const bigramFreq = new Map();
  const unigramArticles = new Map();
  const bigramArticles = new Map();

  recent.forEach((art, idx) => {
    const words = tokenize(art.title);
    const seen = new Set();

    words.forEach(w => {
      unigramFreq.set(w, (unigramFreq.get(w) || 0) + 1);
      if (!seen.has(w)) {
        if (!unigramArticles.has(w)) unigramArticles.set(w, new Set());
        unigramArticles.get(w).add(idx);
        seen.add(w);
      }
    });

    const bigrams = extractBigrams(words);
    const seenBi = new Set();
    bigrams.forEach(bi => {
      bigramFreq.set(bi, (bigramFreq.get(bi) || 0) + 1);
      if (!seenBi.has(bi)) {
        if (!bigramArticles.has(bi)) bigramArticles.set(bi, new Set());
        bigramArticles.get(bi).add(idx);
        seenBi.add(bi);
      }
    });
  });

  const candidates = [];

  for (const [bigram, count] of bigramFreq) {
    if (count < MIN_ARTICLES_FOR_TREND) continue;
    const artSet = bigramArticles.get(bigram);
    const artIndices = [...artSet];
    const recentCount = artIndices.filter(i => {
      const t = new Date(recent[i].date || recent[i].publishedAt || 0).getTime();
      return (now - t) < 6 * 3600 * 1000;
    }).length;
    const score = count * 2 + recentCount * 3;
    candidates.push({
      label: bigram.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      keywords: bigram.split(' '),
      articleCount: artSet.size, score, type: 'bigram', recentCount
    });
  }

  for (const [word, count] of unigramFreq) {
    if (count < MIN_ARTICLES_FOR_TREND + 6) continue; // Unigramas necesitan 10+ artículos
    // Saltar números puros (años sueltos como "2027")
    if (/^\d+$/.test(word)) continue;
    // Saltar palabras de menos de 4 caracteres
    if (word.length < 4) continue;
    const inBigram = candidates.some(c => c.keywords.includes(word));
    if (inBigram) continue;
    const artSet = unigramArticles.get(word);
    if (!artSet) continue;
    const artIndices = [...artSet];
    const recentCount = artIndices.filter(i => {
      const t = new Date(recent[i].date || recent[i].publishedAt || 0).getTime();
      return (now - t) < 6 * 3600 * 1000;
    }).length;
    const score = count + recentCount * 3;
    candidates.push({
      label: word.charAt(0).toUpperCase() + word.slice(1),
      keywords: [word],
      articleCount: artSet.size, score, type: 'unigram', recentCount
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  let final = [];
  const usedArticles = new Set();

  // ----- INTEGRACIÓN DE IA (GROQ) PARA CRITERIO EDITORIAL Y FILTRADO -----
  console.log(`  Enviando ${Math.min(15, candidates.length)} candidatos heurísticos a Groq para filtrado editorial...`);
  const prompt = `Actúa como el Editor Jefe de un periódico digital de prestigio internacional (como El País o The New York Times).
Tu tarea es filtrar y seleccionar de la siguiente lista de "Candidatos a Tendencia" aquellos que representen noticias de verdadero impacto nacional o internacional en tiempo real, eventos de gran cobertura, o sucesos de última hora relevantes.

REGLAS EDITORIALES ESTRICTAS:
1. DEBES DESCARTAR CATEGÓRICAMENTE:
   - Temas corporativos cotidianos o menores (ej. lanzamientos de series de Netflix como películas normales, actualizaciones de software cotidianas de WhatsApp, ofertas de Amazon, juegos añadidos a Xbox, etc.).
   - Menciones rutinarias de marcas o productos cotidianos, a menos de que sea por una noticia de impacto global extraordinario (ej. la quiebra de una multinacional, un ciberataque global masivo, o una compra corporativa histórica).
   - Palabras sueltas vacías de significado noticioso.
2. DEBES PRIORIZAR:
   - Acontecimientos geopolíticos y noticias de impacto global/nacional de última hora (ej. conflictos, elecciones, cumbres internacionales, leyes clave).
   - Eventos de gran cobertura continuada e interés en vivo (ej. Tour de Francia, Juegos Olímpicos, Copa del Mundo, ceremonias de premios como los Emmy o los Oscar, etc.).
   - Sucesos graves o accidentes de última hora de gran relevancia nacional.
3. FORMATO DE TÍTULO ELEGANTE:
   - Los títulos de los temas seleccionados deben estar escritos en minúsculas capitalizadas muy estéticas y legibles (ej. "Mundial 2026", "Tour de Francia", "Crisis en Oriente Medio", "Premios Emmy"). Está estrictamente prohibido usar mayúsculas completas.
4. CLASIFICACIÓN DE TIPO:
   - 'breaking': Sucesos repentinos graves de última hora que requieren atención inmediata.
   - 'event': Eventos planificados de cobertura continuada (deportes, festivales, elecciones).
   - 'trending': Temas de gran interés popular pero no urgentes.

Lista de Candidatos (ordenados por volumen):
${JSON.stringify(candidates.slice(0, 15), null, 2)}

Muestra de Titulares Recientes de las últimas 24h para contexto:
${recent.slice(0, 35).map(a => `- ${a.title}`).join('\n')}

Responde ÚNICAMENTE con un array en formato JSON con la siguiente estructura (máximo 6 elementos):
{
  "topics": [
    {
      "id": "id-del-tema-en-minusculas-con-guiones",
      "title": "Título Capitalizado Elegante",
      "keywords": ["keyword1", "keyword2"],
      "category": "Deportes",
      "type": "event",
      "popularity": 85
    }
  ]
}
No incluyes ninguna explicación, texto introductorio, ni bloques de código markdown. Devuelve únicamente el string JSON válido.`;

  let parsedAI = null;
  try {
    const rawRes = await callGroqAPI(prompt);
    console.log("  Respuesta de IA recibida con éxito.");
    parsedAI = JSON.parse(rawRes);
  } catch (err) {
    console.error("  [FALLBACK] Error llamando a Groq API, recurriendo a heurística tradicional:", err.message);
  }

  if (parsedAI && Array.isArray(parsedAI.topics) && parsedAI.topics.length > 0) {
    console.log("  Poblando temas calientes validados por la IA.");
    parsedAI.topics.forEach(t => {
      // Buscar artículos en caché asociados
      const keywords = t.keywords || [t.title];
      const artSet = new Set();
      
      recent.forEach((art, idx) => {
        const matches = keywords.some(kw => {
          const q = kw.toLowerCase().trim();
          const titleText = (art.title || '').toLowerCase();
          const summaryText = (art.summary || '').toLowerCase();
          return titleText.includes(q) || summaryText.includes(q);
        });
        if (matches) artSet.add(idx);
      });

      final.push({
        id: t.id || t.title.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        title: t.title,
        keywords: keywords,
        articleCount: artSet.size || 3,
        popularity: t.popularity || 75,
        category: t.category || 'General',
        type: t.type || 'trending',
        recentCount: artSet.size,
        detectedAt: new Date().toISOString(),
        expiresAt: new Date(now + (t.type === 'event' ? 72 : 12) * 3600 * 1000).toISOString(),
        subMenus: []
      });
      
      artSet.forEach(idx => usedArticles.add(idx));
    });
  } else {
    // Fallback tradicional
    console.log("  [FALLBACK] Generando temas calientes por algoritmo de frecuencia.");
    for (const c of candidates) {
      if (final.length >= MAX_TOPICS) break;
      const artSet = c.type === 'bigram'
        ? bigramArticles.get(c.keywords.join(' '))
        : unigramArticles.get(c.keywords[0]);
      if (!artSet) continue;

      let overlap = 0;
      artSet.forEach(idx => { if (usedArticles.has(idx)) overlap++; });
      if (artSet.size > 0 && overlap / artSet.size > 0.5) continue;

      const catCount = {};
      artSet.forEach(idx => {
        const cat = recent[idx]?.category || recent[idx]?.subcategory || 'General';
        catCount[cat] = (catCount[cat] || 0) + 1;
      });
      const topCategory = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Tecnologia';

      const dates = [...artSet].map(i => new Date(recent[i].date || recent[i].publishedAt || 0).getTime()).filter(t => !isNaN(t));
      const span = dates.length > 1 ? (Math.max(...dates) - Math.min(...dates)) / (3600 * 1000) : 0;
      const isEvent = span > 24;

      const maxPossibleScore = recent.length * 2;
      const popularity = Math.min(100, Math.round((c.score / maxPossibleScore) * 100 * 10));

      final.push({
        id: c.keywords.join('-').toLowerCase().replace(/[^a-z0-9-]/g, ''),
        title: c.label,
        keywords: c.keywords,
        articleCount: c.articleCount,
        popularity,
        category: topCategory,
        type: isEvent ? 'event' : 'trending',
        recentCount: c.recentCount,
        detectedAt: new Date().toISOString(),
        expiresAt: new Date(now + (isEvent ? 72 : 12) * 3600 * 1000).toISOString(),
        subMenus: []
      });

      artSet.forEach(idx => usedArticles.add(idx));
    }
  }

  // ===== GENERAR SUB-MENÚS CONTEXTUALES =====
  // Para cada tema, escanear títulos de artículos asociados y detectar sub-temas
  
  const SUB_PATTERNS = {
    // Deportes - Fases de competición
    phases: [
      { pattern: /octavos?\s*(de\s*final)?/i, label: 'Octavos de Final', icon: '⚔️' },
      { pattern: /cuartos?\s*(de\s*final)?/i, label: 'Cuartos de Final', icon: '🏆' },
      { pattern: /semis?finales?/i, label: 'Semifinales', icon: '🔥' },
      { pattern: /final\b(?!\s*(de\s*(fase|grupo)))/i, label: 'Final', icon: '👑' },
      { pattern: /fase\s*de\s*grupos?/i, label: 'Fase de Grupos', icon: '📊' },
      { pattern: /clasificaci[oó]n|eliminatorias?/i, label: 'Clasificación', icon: '📋' },
      { pattern: /sorteo/i, label: 'Sorteo', icon: '🎲' },
    ],
    // Ciclismo - Etapas
    stages: [
      { pattern: /etapa\s*(\d+)/i, label: (m) => `Etapa ${m[1]}`, icon: '🚴' },
      { pattern: /contrarreloj/i, label: 'Contrarreloj', icon: '⏱️' },
      { pattern: /monta[ñn]a/i, label: 'Montaña', icon: '⛰️' },
      { pattern: /sprint/i, label: 'Sprint', icon: '💨' },
      { pattern: /l[ií]der|maillot\s*(amarillo|rojo|verde|blanco)/i, label: (m) => `Líder / Maillot`, icon: '🟡' },
      { pattern: /clasificaci[oó]n\s*general/i, label: 'Clasificación General', icon: '📊' },
    ],
    // Tecnología - Productos y empresas
    tech: [
      { pattern: /lanzamiento|estreno|disponible/i, label: 'Lanzamientos', icon: '🚀' },
      { pattern: /actualizaci[oó]n|update/i, label: 'Actualizaciones', icon: '🔄' },
      { pattern: /precio|coste|cost/i, label: 'Precios', icon: '💰' },
      { pattern: /opini[oó]n|review|an[aá]lisis/i, label: 'Análisis', icon: '🔍' },
    ],
    // Geopolítica
    geo: [
      { pattern: /reuni[oó]n|cumbre|summit/i, label: 'Cumbres', icon: '🤝' },
      { pattern: /sanci[oó]n|sanciones/i, label: 'Sanciones', icon: '⚖️' },
      { pattern: /acuerdo|tratado|pacto/i, label: 'Acuerdos', icon: '📝' },
      { pattern: /conflicto|tensi[oó]n|crisis/i, label: 'Tensiones', icon: '⚡' },
    ]
  };

  // Determine which pattern set to use based on topic keywords
  function getPatternSets(topic) {
    const kw = topic.keywords.join(' ').toLowerCase();
    const cat = (topic.category || '').toLowerCase();
    const sets = [];
    
    if (kw.includes('mundial') || kw.includes('copa') || kw.includes('euro') || kw.includes('champions')) {
      sets.push('phases');
    }
    if (kw.includes('tour') || kw.includes('vuelta') || kw.includes('giro') || kw.includes('ciclismo')) {
      sets.push('stages');
    }
    if (cat.includes('tecnologia') || cat.includes('ciencia')) {
      sets.push('tech');
    }
    if (cat.includes('internacional') || kw.includes('otan') || kw.includes('cumbre') || kw.includes('guerra')) {
      sets.push('geo');
    }
    // Always try phases for sports events
    if (cat.includes('deportes') && !sets.includes('phases')) {
      sets.push('phases');
    }
    return sets;
  }

  for (const topic of final) {
    const patternSets = getPatternSets(topic);
    if (patternSets.length === 0) continue;
    
    // Get article titles for this topic
    const topicQuery = topic.keywords.map(k => k.toLowerCase());
    const matchedTitles = recent
      .filter(a => {
        const title = (typeof a.title === 'string' ? a.title : '').toLowerCase();
        return topicQuery.every(kw => title.includes(kw));
      })
      .map(a => typeof a.title === 'string' ? a.title : '');
    
    const subMenus = new Map(); // label -> { count, icon, query }
    
    for (const setName of patternSets) {
      const patterns = SUB_PATTERNS[setName];
      if (!patterns) continue;
      
      for (const pat of patterns) {
        let count = 0;
        let lastMatch = null;
        for (const title of matchedTitles) {
          const m = title.match(pat.pattern);
          if (m) { count++; lastMatch = m; }
        }
        if (count >= 2) { // Al menos 2 artículos mencionan este sub-tema
          const label = typeof pat.label === 'function' ? pat.label(lastMatch) : pat.label;
          if (!subMenus.has(label)) {
            const query = topic.keywords.join(' ').toLowerCase() + ' ' + label.toLowerCase().split('/')[0].trim();
            subMenus.set(label, { label, icon: pat.icon, count, query });
          } else {
            subMenus.get(label).count += count;
          }
        }
      }
    }
    
    // Also detect dynamic stage numbers (Etapa 1, Etapa 2, etc.)
    if (patternSets.includes('stages')) {
      const stageNums = new Map();
      for (const title of matchedTitles) {
        const m = title.match(/etapa\s*(\d+)/i);
        if (m) {
          const num = parseInt(m[1]);
          stageNums.set(num, (stageNums.get(num) || 0) + 1);
        }
      }
      // Add individual stages with 2+ articles
      for (const [num, cnt] of [...stageNums.entries()].sort((a, b) => a[0] - b[0])) {
        if (cnt >= 2) {
          const label = `Etapa ${num}`;
          if (!subMenus.has(label)) {
            subMenus.set(label, { label, icon: '🚴', count: cnt, query: topic.keywords.join(' ').toLowerCase() + ` etapa ${num}` });
          }
        }
      }
    }
    
    topic.subMenus = [...subMenus.values()].sort((a, b) => b.count - a.count).slice(0, 8);
    if (topic.subMenus.length > 0) {
      // Add "Ver Todo" at the start
      topic.subMenus.unshift({
        label: 'Ver Todo',
        icon: '📰',
        count: topic.articleCount,
        query: topic.keywords.join(' ').toLowerCase()
      });
    }
  }

  console.log(`\n  Temas calientes detectados: ${final.length}`);
  final.forEach((t, i) => {
    console.log(`    ${i + 1}. "${t.title}" (${t.articleCount} arts, pop=${t.popularity}, type=${t.type}, cat=${t.category})`);
    if (t.subMenus && t.subMenus.length > 0) {
      console.log(`       Sub-menús: ${t.subMenus.map(s => `${s.icon} ${s.label}(${s.count})`).join(', ')}`);
    }
  });

  const output = {
    topics: final,
    updatedAt: new Date().toISOString(),
    windowHours: WINDOW_HOURS,
    totalRecentArticles: recent.length
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`  Guardado en ${OUTPUT_PATH}`);

  try {
    await patchFirebase('trending_topics.json', output);
    console.log('  Subido a Firebase RTDB');
  } catch (e) {
    console.error('  Error subiendo a Firebase:', e.message);
  }

  console.log(`[${new Date().toISOString()}] Trending topics actualizado.`);
}

main().catch(e => {
  console.error('Error fatal:', e);
  process.exit(1);
});
