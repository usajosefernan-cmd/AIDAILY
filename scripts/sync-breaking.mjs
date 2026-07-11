#!/usr/bin/env node
/**
 * sync-breaking.mjs — Cron de Última Hora para IA Daily
 * Se ejecuta cada 2 horas vía Hermes Scheduler.
 * Procesa SOLO feeds de alta prioridad y noticias con keywords urgentes.
 * Máximo 10 artículos por ejecución para rapidez.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const GLOBAL_TIMEOUT_MS = 5 * 60 * 1000;
setTimeout(() => {
  console.error(`[BREAKING] Timeout global alcanzado (${GLOBAL_TIMEOUT_MS / 60000} min). Forzando salida.`);
  process.exit(1);
}, GLOBAL_TIMEOUT_MS).unref();

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

process.env.BUILD_ONLY = 'false';

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

const BREAKING_KEYWORDS = [
  'última hora', 'urgente', 'breaking', 'directo', 'en vivo',
  'alerta', 'atentado', 'terremoto', 'dimisión', 'fallece',
  'muere', 'accidente', 'incendio', 'evacuación', 'tsunami',
  'golpe de estado', 'crisis', 'emergencia', 'catástrofe',
  'resultado electoral', 'detenido', 'sentencia', 'histórico'
];

function isBreakingNews(title) {
  const lower = title.toLowerCase();
  return BREAKING_KEYWORDS.some(kw => lower.includes(kw));
}

async function syncBreaking() {
  const startTime = Date.now();
  console.log('[BREAKING] === Iniciando cron de Última Hora ===');

  let feeds = {};
  try {
    const configRes = await fetchWithTimeout('https://pecemi-default-rtdb.firebaseio.com/aidaily/config/feeds.json');
    if (configRes.ok) feeds = await configRes.json();
  } catch (e) {
    console.error('[BREAKING] No se pudieron cargar feeds:', e.message);
    return;
  }

  // Filtrar feeds de alta prioridad (>= 3.0)
  const urgentFeeds = [];
  Object.entries(feeds).forEach(([cat, list]) => {
    if (!Array.isArray(list)) return;
    list.forEach(f => {
      if ((f.priority || 2.0) >= 3.0) {
        urgentFeeds.push({ ...f, sectionCategory: cat });
      }
    });
  });

  console.log(`[BREAKING] Feeds de alta prioridad: ${urgentFeeds.length}`);
  if (urgentFeeds.length === 0) {
    console.log('[BREAKING] No hay feeds urgentes. Finalizando.');
    return;
  }

  // Caché para deduplicación
  const cachePath = path.resolve('./src/data/cache-news.json');
  const cachedUrls = new Set();
  let cachedItems = [];
  if (fs.existsSync(cachePath)) {
    try {
      cachedItems = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      cachedItems.forEach(item => cachedUrls.add(item.url));
    } catch (_) {}
  }

  // Rastrear feeds urgentes
  const { fetchRss, generateAISummary, fetchFullText, extractMultimediaFromUrl, normalizeCategoryAndSubcategory } = await import('../src/lib/sources.ts');
  
  const allItems = [];
  const cutoffTime = Date.now() - 4 * 60 * 60 * 1000;
  
  await Promise.all(urgentFeeds.map(async (feed) => {
    try {
      const items = await fetchRss(feed);
      items.forEach(item => {
        if (!cachedUrls.has(item.url)) {
          const pubTime = new Date(item.publishedAt).getTime();
          if (!isNaN(pubTime) && pubTime > cutoffTime) {
            item._isBreaking = isBreakingNews(item.title);
            item._priority = item._isBreaking ? 10 : (feed.priority || 2.0);
            item.feedCategory = feed.sectionCategory;
            item.feedSubcategory = (feed.tags && feed.tags[0]) || 'general';
            allItems.push(item);
          }
        }
      });
    } catch (e) {
      console.warn(`[BREAKING] Error rastreando ${feed.name}:`, e.message);
    }
  }));

  console.log(`[BREAKING] Artículos nuevos en feeds urgentes: ${allItems.length}`);
  if (allItems.length === 0) {
    console.log('[BREAKING] No hay noticias nuevas. Finalizando.');
    return;
  }

  allItems.sort((a, b) => b._priority - a._priority);
  const toProcess = allItems.slice(0, 10);
  console.log(`[BREAKING] Procesando ${toProcess.length} noticias con IA...`);

  let processedCount = 0;
  
  for (const item of toProcess) {
    try {
      const hashId = crypto.createHash('sha256').update(item.url).digest('hex');
      if (cachedUrls.has(item.url)) continue;
      
      console.log(`[BREAKING] [${processedCount + 1}/${toProcess.length}] "${item.title}"`);
      
      let scrapedText = '';
      let multimedia = [];
      try {
        scrapedText = await fetchFullText(item.url);
        multimedia = await extractMultimediaFromUrl(item.url, item.title);
      } catch (_) {}
      
      if (item.imageUrl && !multimedia.some(m => m.url === item.imageUrl)) {
        multimedia.unshift({ type: 'image', url: item.imageUrl, alt: item.title, caption: 'Imagen de portada' });
      }
      
      const textToAnalyze = scrapedText || item.summary || item.title;
      const norm = normalizeCategoryAndSubcategory(item.feedCategory, item.feedSubcategory, item.title);
      
      let aiResult;
      try {
        aiResult = await Promise.race([
          generateAISummary(textToAnalyze, item.title, item.source, norm.category, norm.subcategory, {}, multimedia),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout IA 60s")), 60000))
        ]);
      } catch (e) {
        console.warn(`[BREAKING] IA falló: ${e.message}`);
        continue;
      }
      
      if (!aiResult || !aiResult.title || aiResult.title === 'Titular en español') continue;
      
      const article = {
        id: hashId,
        url: item.url,
        title: aiResult.title || item.title,
        aiSummary: aiResult.aiSummary || item.summary,
        fullArticle: aiResult.fullArticle || '',
        keyPoints: aiResult.keyPoints || [],
        whyMatters: aiResult.whyMatters || '',
        interestingData: aiResult.interestingData || [],
        links: aiResult.links || [],
        category: norm.category,
        subcategory: norm.subcategory,
        source: item.source,
        sourceUrl: item.sourceUrl,
        publishedAt: item.publishedAt instanceof Date ? item.publishedAt.toISOString() : new Date(item.publishedAt).toISOString(),
        scrapedAt: new Date().toISOString(),
        multimedia: aiResult.multimedia || multimedia.slice(0, 5),
        breakingNews: item._isBreaking || false,
        priority: item._priority || 2.0
      };
      
      cachedItems.unshift(article);
      cachedUrls.add(item.url);
      processedCount++;
      console.log(`[BREAKING] ✅ "${article.title}" ${article.breakingNews ? '[🔴 ÚLTIMA HORA]' : ''}`);
    } catch (e) {
      console.error(`[BREAKING] Error: ${e.message}`);
    }
  }
  
  if (processedCount === 0) {
    console.log('[BREAKING] Ningún artículo procesado. Finalizando sin build.');
    return;
  }
  
  cachedItems.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  fs.writeFileSync(cachePath, JSON.stringify(cachedItems, null, 2), 'utf-8');
  
  const apiDir = path.resolve('public/api');
  if (!fs.existsSync(apiDir)) fs.mkdirSync(apiDir, { recursive: true });
  const pageSize = 500;
  const totalPages = Math.ceil(cachedItems.length / pageSize);
  for (let page = 1; page <= totalPages; page++) {
    fs.writeFileSync(path.join(apiDir, `news-page-${page}.json`), JSON.stringify(cachedItems.slice((page - 1) * pageSize, page * pageSize), null, 2), 'utf-8');
  }
  fs.writeFileSync(path.join(apiDir, 'news-config.json'), JSON.stringify({ totalPages, pageSize, totalItems: cachedItems.length }, null, 2), 'utf-8');
  
  const articlesDir = path.join(apiDir, 'articles');
  if (!fs.existsSync(articlesDir)) fs.mkdirSync(articlesDir, { recursive: true });
  cachedItems.forEach(art => fs.writeFileSync(path.join(articlesDir, `${art.id}.json`), JSON.stringify(art, null, 2), 'utf-8'));
  
  const optimized = {};
  cachedItems.forEach(art => {
    const { fullArticle, whyMatters, keyPoints, interestingData, links, ...light } = art;
    optimized[art.id] = light;
  });
  fs.writeFileSync(path.join(apiDir, 'articles.json'), JSON.stringify(optimized), 'utf-8');
  fs.writeFileSync(path.resolve('.has_changes'), 'true', 'utf-8');
  
  try {
    await fetch(`https://pecemi-default-rtdb.firebaseio.com/aidaily/vps_execution_history/${Date.now()}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        duration_seconds: Math.round((Date.now() - startTime) / 1000),
        articles_added: processedCount,
        total_articles: cachedItems.length,
        status: "BREAKING_NEWS",
        type: "breaking"
      })
    });
  } catch (_) {}
  
  console.log(`[BREAKING] === Finalizado: ${processedCount} noticias en ${Math.round((Date.now() - startTime) / 1000)}s ===`);
}

await syncBreaking();
