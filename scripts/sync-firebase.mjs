#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

// Timeout de seguridad global de 15 minutos para evitar que el proceso se quede colgado indefinidamente
const GLOBAL_TIMEOUT_MS = 15 * 60 * 1000;
setTimeout(() => {
  console.error(`[CRITICAL] Timeout global del scraper alcanzado (${GLOBAL_TIMEOUT_MS / 60000} minutos). Forzando salida con código de error para liberar el bloqueo.`);
  process.exit(1);
}, GLOBAL_TIMEOUT_MS).unref(); // .unref() permite que Node finalice si no hay otras tareas pendientes

// Cargar variables de entorno del .env antes de importar otros modulos
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
    console.log('[Env] Variables de entorno locales cargadas con éxito.');
  }
} catch (e) {
  console.warn('[Env] Advertencia: No se pudo cargar el archivo .env:', e);
}

// Forzar que el script de sincronización ejecute siempre el scraper real, ignorando el modo build
process.env.BUILD_ONLY = 'false';
import { fetchAllNews, normalizeCategoryAndSubcategory } from '../src/lib/sources.ts';
import crypto from 'crypto';

async function fetchWithTimeout(url, options = {}, timeoutMs = 25000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

async function sync() {
  const syncStartTime = Date.now();
  console.log('[Firebase Sync] Iniciando obtención de noticias...');
  
  let cutoffHours = 24; // Por defecto 24 horas (1 día)
  try {
    console.log('[Firebase Sync] Descargando configuración para obtener cutoffHours...');
    const configRes = await fetchWithTimeout('https://pecemi-default-rtdb.firebaseio.com/aidaily/config.json');
    if (configRes.ok) {
      const configData = await configRes.json();
      if (configData && configData.orientation && configData.orientation.cutoffHours) {
        cutoffHours = parseInt(configData.orientation.cutoffHours) || cutoffHours;
        console.log(`[Firebase Sync] cutoffHours cargado desde Firebase: ${cutoffHours} horas.`);
      }
    }
  } catch (e) {
    console.warn('[Firebase Sync] No se pudo cargar cutoffHours de Firebase, usando valor por defecto:', e.message);
  }

  const cutoffTime = Date.now() - cutoffHours * 60 * 60 * 1000;

  try {
    const items = await fetchAllNews();
    console.log(`[Firebase Sync] Obtenidos ${items.length} artículos del scraper.`);

    // 1. Obtener configuración de feeds para alineación retroactiva
    let feedsMap = {};
    try {
      console.log('[Firebase Sync] Descargando configuración de feeds para mapeo retroactivo...');
      const feedsRes = await fetchWithTimeout('https://pecemi-default-rtdb.firebaseio.com/aidaily/config/feeds.json');
      if (feedsRes.ok) {
        const feedsData = await feedsRes.json();
        if (feedsData && typeof feedsData === 'object') {
          Object.entries(feedsData).forEach(([cat, list]) => {
            if (Array.isArray(list)) {
              list.forEach(f => {
                if (f.url) {
                  feedsMap[f.url.trim()] = {
                    category: cat,
                    subcategory: (f.tags && f.tags[0]) ? f.tags[0].trim() : 'General'
                  };
                }
              });
            }
          });
          console.log(`[Firebase Sync] Cargadas ${Object.keys(feedsMap).length} URLs de feeds para alineación retroactiva.`);
        }
      }
    } catch (e) {
      console.warn('[Firebase Sync] No se pudo descargar feeds.json para alineación retroactiva:', e.message);
    }

    // 1.5. Obtener artículos existentes del caché local (100% VPS)
    let existingArticles = {};
    let downloadSuccess = true; // Siempre true porque leemos localmente
    
    console.log('[Firebase Sync] Cargando artículos existentes desde el caché local del VPS (100% Local)...');
    const cachePath = path.resolve('src/data/cache-news.json');
    if (fs.existsSync(cachePath)) {
      try {
        const cacheContent = fs.readFileSync(cachePath, 'utf-8');
        const cacheData = JSON.parse(cacheContent);
        if (Array.isArray(cacheData)) {
          cacheData.forEach(art => {
            const artId = art.id || crypto.createHash('sha256').update(art.url).digest('hex');
            existingArticles[artId] = art;
          });
          console.log(`[Firebase Sync] Cargados ${Object.keys(existingArticles).length} artículos del caché local.`);
        }
      } catch (cacheErr) {
        console.error('[Firebase Sync] Error leyendo caché local:', cacheErr.message);
      }
    } else {
      console.log('[Firebase Sync] No hay caché local disponible. Inicializando base de datos local vacía.');
    }

    // 2. Mezclar los nuevos artículos con los existentes (conservando todo el histórico independientemente de si la fuente está activa)
    const combinedArticles = {};
    let inactiveFeedsCount = 0;
    
    Object.entries(existingArticles).forEach(([hashId, art]) => {
      combinedArticles[hashId] = art;
      const artSourceUrl = art.sourceUrl ? art.sourceUrl.trim() : '';
      if (!artSourceUrl || !feedsMap[artSourceUrl]) {
        inactiveFeedsCount++;
      }
    });
    if (inactiveFeedsCount > 0) {
      console.log(`[Firebase Sync] Histórico: ${inactiveFeedsCount} artículos pertenecen a fuentes no activas en el Excel/Firebase (se conservan).`);
    }

    let newCount = 0;
    for (const item of items) {
      const hashId = crypto.createHash('sha256').update(item.url).digest('hex');
      const { fullText, ...cleanItem } = item;
      
      // Si el artículo ya existía, conservamos su scrapedAt original
      const existing = existingArticles[hashId];
      const scrapedAt = existing && existing.scrapedAt ? existing.scrapedAt : (cleanItem.scrapedAt || new Date().toISOString());

      if (!combinedArticles[hashId]) {
        newCount++;
      }

      combinedArticles[hashId] = {
        ...cleanItem,
        id: hashId,
        scrapedAt
      };
    }
    console.log(`[Firebase Sync] Fusionados: ${newCount} nuevos artículos agregados al historial completo de ${Object.keys(existingArticles).length} artículos.`);

    // 3. Alinear categorías/subcategorías con prioridad para la clasificación de la IA
    const finalArticlesList = [];
    Object.values(combinedArticles).forEach(art => {
      // Priorizar la categoría y subcategoría determinada por la IA
      let rawCat = art.category || '';
      let rawSub = art.subcategory || '';
      
      // Solo si el artículo no tiene clasificación o es genérica, usamos el mapeo estático del feed como fallback
      if ((!rawCat || rawCat === 'tecnologia' && rawSub === 'general') && art.sourceUrl && feedsMap[art.sourceUrl.trim()]) {
        const mapped = feedsMap[art.sourceUrl.trim()];
        rawCat = mapped.category;
        rawSub = mapped.subcategory;
      }
      
      const norm = normalizeCategoryAndSubcategory(rawCat || 'tecnologia', rawSub || 'general', art.title);
      art.category = norm.category;
      art.subcategory = norm.subcategory;
      finalArticlesList.push(art);
    });

    const filteredList = finalArticlesList.filter(art => {
      const pubTime = new Date(art.publishedAt).getTime();
      return !isNaN(pubTime) && pubTime > cutoffTime;
    });
    console.log(`[Firebase Sync] Conservando todo el historial acumulado de ${finalArticlesList.length} artículos (retención ilimitada).`);

    // Ordenar la lista final por fecha descendente para la estructura global
    const sortedList = finalArticlesList.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    const finalArticlesMap = {};
    sortedList.forEach(art => {
      finalArticlesMap[art.id] = art;
    });

    const payload = {
      security_token: 'pecemi_secure_gateway_token_2026_xyz',
      articles: finalArticlesMap
    };

    console.log(`[VPS Local] Saltando subida a Firebase RTDB por configuración de ahorro de almacenamiento.`);
    console.log('[VPS Local] Escribiendo localmente la caché actualizada para asegurar que el build de Astro esté sincronizado...');
    
    try {
      const cachePath = path.resolve('src/data/cache-news.json');
      const dir = path.dirname(cachePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Leer el conteo del caché anterior para determinar si hay cambios reales de tamaño
      let cacheCount = 0;
      try {
        if (fs.existsSync(cachePath)) {
          const cacheContent = fs.readFileSync(cachePath, 'utf-8');
          const cacheData = JSON.parse(cacheContent);
          if (Array.isArray(cacheData)) {
            cacheCount = cacheData.length;
          }
        }
      } catch (_) {}

      // Escribir caché de noticias local consolidada
      fs.writeFileSync(cachePath, JSON.stringify(sortedList, null, 2), 'utf-8');
      console.log(`[VPS Local] Caché de noticias local actualizada con éxito (${sortedList.length} artículos guardados).`);

      // Guardar la segmentación de noticias para scroll infinito (páginas de 500 artículos, límite 1000 páginas)
      const apiDir = path.resolve('public/api');
      if (!fs.existsSync(apiDir)) {
        fs.mkdirSync(apiDir, { recursive: true });
      }

      const pageSize = 500;
      const maxPages = 1000; // Permitir hasta 500.000 artículos en total
      const totalItems = Math.min(sortedList.length, pageSize * maxPages);
      const totalPages = Math.ceil(totalItems / pageSize);

      for (let page = 1; page <= totalPages; page++) {
        const startIdx = (page - 1) * pageSize;
        const endIdx = page * pageSize;
        const pageData = sortedList.slice(startIdx, endIdx);
        const pagePath = path.join(apiDir, `news-page-${page}.json`);
        fs.writeFileSync(pagePath, JSON.stringify(pageData, null, 2), 'utf-8');
      }

      const configPath = path.join(apiDir, 'news-config.json');
      const paginationConfig = {
        totalPages,
        pageSize,
        totalItems
      };

      fs.writeFileSync(configPath, JSON.stringify(paginationConfig, null, 2), 'utf-8');
      console.log(`[VPS Local] Paginación de noticias generada en ${apiDir}: ${totalPages} páginas escritas.`);

      // Guardar fichas detalladas individuales de cada noticia para lazy-loading bajo demanda
      const articlesDir = path.join(apiDir, 'articles');
      if (!fs.existsSync(articlesDir)) {
        fs.mkdirSync(articlesDir, { recursive: true });
      }
      sortedList.forEach(art => {
        const detailPath = path.join(articlesDir, `${art.id}.json`);
        fs.writeFileSync(detailPath, JSON.stringify(art, null, 2), 'utf-8');
      });
      console.log(`[VPS Local] Fichas de detalle individuales de ${sortedList.length} artículos guardadas con éxito en ${articlesDir}.`);

      // Guardar el consolidado histórico completo optimizado (sin campos pesados) para búsquedas rápidas en el cliente
      const optimizedArticlesMap = {};
      sortedList.forEach(art => {
        const { fullArticle, whyMatters, keyPoints, interestingData, links, ...lightweightArt } = art;
        optimizedArticlesMap[art.id] = lightweightArt;
      });

      const articlesConsolidatedPath = path.join(apiDir, 'articles.json');
      fs.writeFileSync(articlesConsolidatedPath, JSON.stringify(optimizedArticlesMap), 'utf-8');
      console.log(`[VPS Local] Consolidado histórico optimizado de ${Object.keys(optimizedArticlesMap).length} artículos guardado con éxito en ${articlesConsolidatedPath}.`);

      // Calcular si ha habido cambios
      const hasChanges = (items.length > 0) || (sortedList.length !== cacheCount);
      const hasChangesPath = path.resolve('.has_changes');
      fs.writeFileSync(hasChangesPath, String(hasChanges), 'utf-8');
      console.log(`[VPS Local] Flag de cambios guardado en ${hasChangesPath}: ${hasChanges} (Nuevos/Procesados: ${items.length}, Local Consolidado: ${sortedList.length}, Caché Local Anterior: ${cacheCount})`);

      // Registrar entrada exitosa en el histórico de ejecución de la VPS
      try {
        const historyEntry = {
          timestamp: new Date().toISOString(),
          duration_seconds: Math.round((Date.now() - syncStartTime) / 1000),
          articles_scraped: items.length,
          articles_added: newCount,
          total_articles: sortedList.length,
          status: "SUCCESS"
        };
        await fetch(`https://pecemi-default-rtdb.firebaseio.com/aidaily/vps_execution_history/${Date.now()}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(historyEntry)
        });
      } catch (historyErr) {
        console.warn('[VPS Local] No se pudo escribir el histórico de runs:', historyErr.message);
      }
    } catch (cacheWriteErr) {
      console.error('[VPS Local] Error escribiendo la caché de noticias local:', cacheWriteErr.message);
    }
  } catch (err) {
    console.error('[Firebase Sync] Error crítico durante la sincronización:', err);
    // Registrar entrada de error en el histórico
    try {
      const historyEntry = {
        timestamp: new Date().toISOString(),
        duration_seconds: Math.round((Date.now() - syncStartTime) / 1000),
        status: "ERROR",
        error_message: err.message || String(err)
      };
      await fetch(`https://pecemi-default-rtdb.firebaseio.com/aidaily/vps_execution_history/${Date.now()}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(historyEntry)
      });
    } catch (_) {}
  }
}

await sync();
