#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { CronLogger } from '../lib/logger.js';
import { writeJsonAtomic } from '../lib/atomic-write.js';
import { extractRequiredTags } from '../lib/tagging.js';
import { computeHeuristicScores } from '../lib/scoring.js';
import { fetchAllNews, normalizeCategoryAndSubcategory } from '../src/lib/sources.ts';
import { findDuplicateInList, sanitizeUrlForHash } from '../lib/dedupe.js';

// Inicializar el logger estructurado
const logger = new CronLogger('news-sync');

// Ruta del lockfile local
const LOCK_FILE = path.resolve('data/news-sync.lock');

/**
 * Intenta adquirir el lockfile local.
 * Si ya existe un proceso activo con ese PID, aborta.
 */
function acquireLock() {
  if (fs.existsSync(LOCK_FILE)) {
    try {
      const lockContent = fs.readFileSync(LOCK_FILE, 'utf-8').trim();
      const otherPid = parseInt(lockContent, 10);
      
      if (!isNaN(otherPid)) {
        // Verificar si el proceso sigue vivo
        try {
          process.kill(otherPid, 0); // Señal 0 no mata al proceso pero comprueba si existe
          logger.warn(`Otra instancia del cron principal ya está activa (PID: ${otherPid}). Saliendo.`);
          process.exit(0);
        } catch (e) {
          // El proceso está muerto, podemos remover el lockfile
          logger.warn(`Se encontró un lockfile huérfano con PID ${otherPid}. Sobrescribiendo...`);
        }
      }
    } catch (err) {
      logger.error('Error al verificar el lockfile. Continuando por seguridad...', err);
    }
  }

  // Asegurar que el directorio data/ existe
  const dataDir = path.dirname(LOCK_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Escribir el PID actual
  fs.writeFileSync(LOCK_FILE, String(process.pid), 'utf-8');
}

/**
 * Libera el lockfile local al terminar.
 */
function releaseLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      fs.unlinkSync(LOCK_FILE);
    }
  } catch (err) {
    logger.error('Error al eliminar el lockfile', err);
  }
}

// Asegurar la liberación de recursos en salida
process.on('exit', releaseLock);
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

async function main() {
  logger.log('=== Iniciando Cron Principal de Noticias ===');
  acquireLock();

  // 1. Cargar variables de entorno si existe el .env
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
      logger.log('Variables de entorno locales cargadas.');
    }
  } catch (e) {
    logger.error('No se pudo cargar el archivo .env', e);
  }

  // Cargar configuración de orientación para scoring y modelos
  let activeOrientation = null;
  const configLocalPath = path.resolve('data/config.json');
  try {
    let configData = null;
    if (fs.existsSync(configLocalPath)) {
      configData = JSON.parse(fs.readFileSync(configLocalPath, 'utf-8'));
      logger.log('Configuración de modelos cargada desde data/config.json local.');
    } else {
      const configRes = await fetch('https://pecemi-default-rtdb.firebaseio.com/aidaily/config.json');
      if (configRes.ok) {
        configData = await configRes.json();
        if (configData) {
          const dir = path.dirname(configLocalPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          writeJsonAtomic(configLocalPath, configData, false);
          logger.log('Configuración descargada de Firebase y sincronizada en data/config.json.');
        }
      }
    }
    if (configData && configData.orientation) {
      activeOrientation = configData.orientation;
    }
  } catch (e) {
    logger.warn('No se pudo cargar la configuración de Firebase ni local. Usando defaults locales.');
  }

  // 2. Obtener estado previo de la base de datos para identificar qué es nuevo
  const dbPath = process.env.SQLITE_DB_PATH || path.resolve('data/aidaily.db');
  const db = new DatabaseSync(dbPath);
  const existingArticlesMap = new Map();
  try {
    const stmt = db.prepare("SELECT id, url FROM articles WHERE status = 'publicada'");
    const rows = stmt.all();
    rows.forEach(art => {
      existingArticlesMap.set(art.id, art);
    });
    logger.log(`[SQLite DB] Artículos en el historial publicado de SQLite: ${existingArticlesMap.size}`);
  } catch (err) {
    logger.error('Error leyendo artículos previos de SQLite', err);
  }

  // 3. Ejecutar el scraping principal
  try {
    logger.log('Lanzando fetchAllNews() para procesar feeds RSS e IA...');
    const resultList = await fetchAllNews();
    logger.log(`Procesamiento finalizado. Nuevos artículos procesados e incorporados en esta ronda: ${resultList.length}`);

    // 4. Cargar la lista completa unificada de artículos publicados de SQLite para su exportación
    let combinedList = [];
    try {
      const stmt = db.prepare("SELECT * FROM articles WHERE status = 'publicada' ORDER BY publishedAt DESC");
      const rows = stmt.all();
      combinedList = rows.map((art) => {
        const norm = normalizeCategoryAndSubcategory(art.category, art.subcategory);
        return {
          ...art,
          category: norm.category,
          subcategory: norm.subcategory,
          publishedAt: new Date(art.publishedAt).toISOString(),
          tags: art.tags ? JSON.parse(art.tags) : [norm.category],
          tagsSecundarios: art.tagsSecundarios ? JSON.parse(art.tagsSecundarios) : [],
          keyPoints: art.keyPoints ? JSON.parse(art.keyPoints) : [],
          multimedia: art.multimedia ? JSON.parse(art.multimedia) : [],
          hashtags: art.hashtags ? JSON.parse(art.hashtags) : [],
          links: art.links ? JSON.parse(art.links) : [],
          interestingData: art.interestingData ? JSON.parse(art.interestingData) : []
        };
      });
      logger.log(`[SQLite DB] Artículos publicados totales cargados para APIs: ${combinedList.length}`);
    } catch (err) {
      logger.error('Error al recargar base de datos para APIs', err);
      process.exit(1);
    }

    // 5. Post-procesamiento y Enriquecimiento de la lista unificada
    const enrichedList = combinedList; // Todos los artículos ya vienen enriquecidos por SQLite
    let newCount = 0;
    
    // Contadores para loggear tags y categorías asignados en esta ejecución
    const assignedCategories = {};
    const assignedTags = {};

    for (const art of combinedList) {
      const isNew = !existingArticlesMap.has(art.id);
      if (isNew) {
        newCount++;
        logger.addSuccess(1);
        logger.addDetail('new', art.title, art.source, `${art.category}/${art.subcategory}`);
        
        // Contar categorías y tags nuevos
        const cat = art.category || 'general';
        assignedCategories[cat] = (assignedCategories[cat] || 0) + 1;
        if (Array.isArray(art.tagsSecundarios)) {
          art.tagsSecundarios.forEach(tag => {
            assignedTags[tag] = (assignedTags[tag] || 0) + 1;
          });
        }
      }
    }

    // 6. Escritura atómica a /data/news.json y src/data/cache-news.json
    logger.log('Guardando datos consolidados de forma atómica en data/news.json...');
    const dataNewsPath = path.resolve('data/news.json');
    writeJsonAtomic(dataNewsPath, enrichedList, true);

    logger.log('Actualizando caché consolidada en src/data/cache-news.json...');
    const cachePath = path.resolve('src/data/cache-news.json');
    writeJsonAtomic(cachePath, enrichedList, false);

    // 7. Generación de las APIs segmentadas para la web (100% VPS Nginx)
    const apiDir = path.resolve('public/api');
    logger.log(`Generando segmentaciones y APIs locales en ${apiDir} (para ahorro en Firebase)...`);
    
    // A. Segmentación por páginas (500 artículos por página)
    const pageSize = 500;
    const maxPages = 1000;
    const totalItems = Math.min(enrichedList.length, pageSize * maxPages);
    const totalPages = Math.ceil(totalItems / pageSize);

    for (let page = 1; page <= totalPages; page++) {
      const startIdx = (page - 1) * pageSize;
      const endIdx = page * pageSize;
      const pageData = enrichedList.slice(startIdx, endIdx);
      const pagePath = path.join(apiDir, `news-page-${page}.json`);
      writeJsonAtomic(pagePath, pageData, false);
    }

    // B. Configuración de paginación
    const paginationConfig = {
      totalPages,
      pageSize,
      totalItems
    };
    writeJsonAtomic(path.join(apiDir, 'news-config.json'), paginationConfig, false);

    // C. Fichas individuales detalladas de cada noticia
    const articlesDir = path.join(apiDir, 'articles');
    
    // Eliminar la carpeta para limpiar acumulaciones obsoletas del disco
    if (fs.existsSync(articlesDir)) {
      try {
        fs.rmSync(articlesDir, { recursive: true, force: true });
        logger.log('Limpiado directorio de artículos para eliminar acumulaciones obsoletas.');
      } catch (err) {
        logger.warn('No se pudo limpiar el directorio de artículos:', err.message);
      }
    }
    fs.mkdirSync(articlesDir, { recursive: true });

    let writtenCount = 0;
    enrichedList.forEach(art => {
      const detailPath = path.join(articlesDir, `${art.id}.json`);
      writeJsonAtomic(detailPath, art, false);
      writtenCount++;
    });
    logger.log(`Guardadas ${writtenCount} fichas detalladas de noticias en ${articlesDir}.`);

    // D. Consolidado histórico ligero (optimizado para buscador)
    const optimizedArticlesMap = {};
    enrichedList.forEach(art => {
      const { fullArticle, whyMatters, keyPoints, interestingData, links, ...lightweightArt } = art;
      optimizedArticlesMap[art.id] = lightweightArt;
    });
    writeJsonAtomic(path.join(apiDir, 'articles.json'), optimizedArticlesMap, false);

    // E. Exportar la cola actual de SQLite a public/api/queue.json
    try {
      const stmt = db.prepare("SELECT * FROM articles WHERE status = 'pendiente_ia'");
      const rows = stmt.all();
      const queueList = rows.map((art) => {
        const norm = normalizeCategoryAndSubcategory(art.category, art.subcategory);
        return {
          ...art,
          feedCategory: art.category,
          feedSubcategory: art.subcategory,
          tags: art.tags ? JSON.parse(art.tags) : [],
          tagsSecundarios: art.tagsSecundarios ? JSON.parse(art.tagsSecundarios) : [],
          keyPoints: art.keyPoints ? JSON.parse(art.keyPoints) : [],
          multimedia: art.multimedia ? JSON.parse(art.multimedia) : [],
          hashtags: art.hashtags ? JSON.parse(art.hashtags) : [],
          links: art.links ? JSON.parse(art.links) : [],
          interestingData: art.interestingData ? JSON.parse(art.interestingData) : []
        };
      });
      writeJsonAtomic(path.join(apiDir, 'queue.json'), queueList, false);
      logger.log(`[SQLite DB] Exportada cola de ${queueList.length} artículos a public/api/queue.json.`);
    } catch (e) {
      logger.error('Error al exportar la cola a API estática', e);
    }

    // F. Exportar feeds activos a public/api/config-feeds.json
    try {
      if (fs.existsSync(configLocalPath)) {
        const configData = JSON.parse(fs.readFileSync(configLocalPath, 'utf-8'));
        if (configData && configData.feeds) {
          writeJsonAtomic(path.join(apiDir, 'config-feeds.json'), configData.feeds, false);
          logger.log('Fuentes RSS activas exportadas a public/api/config-feeds.json.');
        }
      }
    } catch (e) {
      logger.error('Error al exportar config-feeds a API estática', e);
    }

    // Guardar flag de cambios para deploy
    const hasChanges = newCount > 0;
    fs.writeFileSync(path.resolve('.has_changes'), String(hasChanges), 'utf-8');

    // Imprimir sumario final estructurado
    logger.addScraped(enrichedList.length);
    logger.printSummary();
    
    // Registrar categorías y tags asignados en los logs
    if (Object.keys(assignedCategories).length > 0) {
      logger.log('--- Resumen de Categorías Asignadas ---');
      Object.entries(assignedCategories).forEach(([cat, c]) => {
        logger.log(`  - ${cat}: ${c}`);
      });
    }
    if (Object.keys(assignedTags).length > 0) {
      logger.log('--- Resumen de Etiquetas Secundarias Asignadas ---');
      Object.entries(assignedTags).forEach(([tag, c]) => {
        logger.log(`  - ${tag}: ${c}`);
      });
    }

    logger.log('=== Cron Principal Finalizado con Éxito ===');

  } catch (err) {
    logger.error('Error crítico durante la ejecución del Cron Principal', err);
    process.exit(1);
  }
}

main().catch(err => {
  logger.error('Excepción global no capturada en main', err);
  process.exit(1);
});
