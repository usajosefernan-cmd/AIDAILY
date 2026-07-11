#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
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
  try {
    const configRes = await fetch('https://pecemi-default-rtdb.firebaseio.com/aidaily/config.json');
    if (configRes.ok) {
      const configData = await configRes.json();
      if (configData) {
        if (configData.orientation) {
          activeOrientation = configData.orientation;
        }
        // Guardar configuración localmente en data/config.json
        const configLocalPath = path.resolve('data/config.json');
        writeJsonAtomic(configLocalPath, configData, false);
        logger.log('Configuración de modelos y orientación de Firebase sincronizada en data/config.json.');
      }
    }
  } catch (e) {
    logger.warn('No se pudo cargar la configuración desde Firebase. Usando defaults locales.');
  }

  // 2. Obtener estado previo de la caché de noticias para identificar qué es nuevo
  const cachePath = path.resolve('src/data/cache-news.json');
  const existingArticlesMap = new Map();
  if (fs.existsSync(cachePath)) {
    try {
      const cacheContent = fs.readFileSync(cachePath, 'utf-8');
      const cacheList = JSON.parse(cacheContent);
      if (Array.isArray(cacheList)) {
        cacheList.forEach(art => {
          existingArticlesMap.set(art.id, art);
        });
      }
    } catch (err) {
      logger.error('Error leyendo caché inicial', err);
    }
  }

  // 3. Ejecutar el scraping principal
  try {
    logger.log('Lanzando fetchAllNews() para procesar feeds RSS e IA...');
    // fetchAllNews escribe incrementalmente en cachePath, así que tras finalizar
    // el archivo en cachePath contendrá la lista combinada (viejos + nuevos sin procesar localmente)
    const resultList = await fetchAllNews();
    logger.log(`Procesamiento finalizado. Nuevos artículos scrapeados e incorporados en esta ronda: ${resultList.length}`);

    // 4. Cargar la lista completa unificada desde la caché local para su enriquecimiento
    let combinedList = [];
    if (fs.existsSync(cachePath)) {
      try {
        const cacheContent = fs.readFileSync(cachePath, 'utf-8');
        combinedList = JSON.parse(cacheContent);
        if (!Array.isArray(combinedList)) combinedList = [];
      } catch (err) {
        logger.error('Error al recargar caché consolidada', err);
        process.exit(1);
      }
    }

    // 5. Post-procesamiento y Enriquecimiento de la lista unificada
    const enrichedList = [];
    let newCount = 0;
    
    // Contadores para loggear tags y categorías asignados en esta ejecución
    const assignedCategories = {};
    const assignedTags = {};

    for (const art of combinedList) {
      const isNew = !existingArticlesMap.has(art.id);
      
      // Enriquecer campos si faltan o si el artículo es nuevo
      const detectedAt = art.detectedAt || art.scrapedAt || new Date().toISOString();
      const language = art.language || 'es';
      
      // Extraer tags secundarios
      const tagsSecundarios = art.tagsSecundarios || extractRequiredTags(art.title, art.summary, art.tags || []);
      
      // Calcular score de relevancia y urgencia heurísticos
      const scores = (art.relevanceScore && art.urgencyScore) 
        ? { relevanceScore: art.relevanceScore, urgencyScore: art.urgencyScore, scoreReason: art.scoreReason }
        : computeHeuristicScores(art, activeOrientation);
      
      const enrichedArt = {
        ...art,
        detectedAt,
        language,
        tagsSecundarios,
        relevanceScore: scores.relevanceScore,
        urgencyScore: scores.urgencyScore,
        scoreReason: scores.scoreReason,
        status: isNew ? 'nueva' : (art.status || 'publicada')
      };

      enrichedList.push(enrichedArt);

      // Registrar métricas en el logger únicamente si es un artículo nuevo procesado en esta ejecución
      if (isNew) {
        newCount++;
        logger.addSuccess(1);
        logger.addDetail('new', enrichedArt.title, enrichedArt.source, `${enrichedArt.category}/${enrichedArt.subcategory}`);
        
        // Contar categorías y tags nuevos
        const cat = enrichedArt.category || 'general';
        assignedCategories[cat] = (assignedCategories[cat] || 0) + 1;
        if (Array.isArray(tagsSecundarios)) {
          tagsSecundarios.forEach(tag => {
            assignedTags[tag] = (assignedTags[tag] || 0) + 1;
          });
        }
      }
    }

    // Ordenar de forma descendente por fecha de publicación
    enrichedList.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    // 6. Escritura atómica a /data/news.json y src/data/cache-news.json
    logger.log('Guardando datos consolidados de forma atómica en data/news.json...');
    const dataNewsPath = path.resolve('data/news.json');
    writeJsonAtomic(dataNewsPath, enrichedList, true);

    logger.log('Actualizando caché consolidada en src/data/cache-news.json...');
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
    logger.log(`Guardando fichas individuales de ${enrichedList.length} artículos en ${articlesDir}...`);
    enrichedList.forEach(art => {
      const detailPath = path.join(articlesDir, `${art.id}.json`);
      writeJsonAtomic(detailPath, art, false);
    });

    // D. Consolidado histórico ligero (optimizado para buscador)
    const optimizedArticlesMap = {};
    enrichedList.forEach(art => {
      const { fullArticle, whyMatters, keyPoints, interestingData, links, ...lightweightArt } = art;
      optimizedArticlesMap[art.id] = lightweightArt;
    });
    writeJsonAtomic(path.join(apiDir, 'articles.json'), optimizedArticlesMap, false);

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
