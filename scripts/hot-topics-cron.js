#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { CronLogger } from '../lib/logger.js';
import { writeJsonAtomic } from '../lib/atomic-write.js';
import { calculateJaccardSimilarity } from '../lib/dedupe.js';

const logger = new CronLogger('hot-topics');
const LOCK_FILE = path.resolve('data/hot-topics.lock');

function acquireLock() {
  if (fs.existsSync(LOCK_FILE)) {
    try {
      const lockContent = fs.readFileSync(LOCK_FILE, 'utf-8').trim();
      const otherPid = parseInt(lockContent, 10);
      
      if (!isNaN(otherPid)) {
        try {
          process.kill(otherPid, 0);
          logger.warn(`Otra instancia del cron de temas calientes ya está activa (PID: ${otherPid}). Saliendo.`);
          process.exit(0);
        } catch (e) {
          logger.warn(`Se encontró un lockfile huérfano de hot-topics con PID ${otherPid}. Sobrescribiendo...`);
        }
      }
    } catch (err) {
      logger.error('Error al verificar lockfile de hot-topics', err);
    }
  }
  fs.writeFileSync(LOCK_FILE, String(process.pid), 'utf-8');
}

function releaseLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      fs.unlinkSync(LOCK_FILE);
    }
  } catch (err) {
    logger.error('Error al eliminar lockfile de hot-topics', err);
  }
}

process.on('exit', releaseLock);
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

// Helper para obtener claves de horas UTC
const getHourKey = (offsetHours = 0) => {
  const d = new Date(Date.now() - offsetHours * 60 * 60 * 1000);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  return `${yyyy}${mm}${dd}${hh}`;
};

async function main() {
  logger.log('=== Iniciando Cron de Temas Calientes e Ingesta de Visitas ===');
  acquireLock();

  // Cargar variables de entorno si existe el .env
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

  // 1. Descargar métricas de vistas en caliente desde Firebase RTDB
  let viewsData = {};
  try {
    logger.log('Descargando datos de visitas en caliente desde Firebase RTDB...');
    const res = await fetch('https://pecemi-default-rtdb.firebaseio.com/aidaily/views/articles.json');
    if (res.ok) {
      viewsData = await res.json() || {};
      logger.log(`Cargadas visitas para ${Object.keys(viewsData).length} artículos desde Firebase.`);
    } else {
      logger.warn(`Firebase devolvió status HTTP ${res.status}. Usando visitas vacías.`);
    }
  } catch (e) {
    logger.error('Error descargando visitas de Firebase RTDB. Pasando a visitas vacías...', e.message);
  }

  // 2. Cargar las noticias de las últimas 72 horas desde SQLite
  const dbPath = process.env.SQLITE_DB_PATH || path.resolve('data/aidaily.db');
  if (!fs.existsSync(dbPath)) {
    logger.warn(`No existe la base de datos en ${dbPath}. Abortando.`);
    process.exit(0);
  }
  const db = new DatabaseSync(dbPath);

  let recentNews = [];
  try {
    const limitTimeISO = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    const stmt = db.prepare("SELECT * FROM articles WHERE status = 'publicada' AND publishedAt > ? ORDER BY publishedAt DESC");
    const rows = stmt.all();
    recentNews = rows.map((art) => {
      return {
        ...art,
        tags: art.tags ? JSON.parse(art.tags) : [art.category],
        tagsSecundarios: art.tagsSecundarios ? JSON.parse(art.tagsSecundarios) : [],
        keyPoints: art.keyPoints ? JSON.parse(art.keyPoints) : [],
        multimedia: art.multimedia ? JSON.parse(art.multimedia) : [],
        hashtags: art.hashtags ? JSON.parse(art.hashtags) : [],
        links: art.links ? JSON.parse(art.links) : [],
        interestingData: art.interestingData ? JSON.parse(art.interestingData) : []
      };
    });
    logger.log(`Cargados ${recentNews.length} artículos recientes desde SQLite para cálculo de tendencias.`);
  } catch (err) {
    logger.error('Error leyendo artículos desde SQLite:', err.message);
    process.exit(1);
  }

  // 3. Procesar las visitas de cada artículo y calcular visitas1h y visitas24h
  recentNews.forEach(art => {
    const cleanId = art.id.replace(/[^a-zA-Z0-9]/g, '_');
    const artViews = viewsData[cleanId] || {};
    
    // Visitas totales
    art.viewCount = artViews.total || 0;
    
    // Visitas en la última hora (UTC)
    const currentHourKey = getHourKey(0);
    art.views1h = artViews.hours?.[currentHourKey] || 0;
    
    // Visitas en las últimas 24 horas (UTC)
    let views24 = 0;
    for (let i = 0; i < 24; i++) {
      const hk = getHourKey(i);
      views24 += artViews.hours?.[hk] || 0;
    }
    art.views24h = views24;
  });

  // 4. Calcular el tagMomentum
  // tagMomentum = Suma de views24h de todos los artículos que comparten al menos un tag en común (excluyendo el propio artículo)
  recentNews.forEach(art => {
    let momentum = 0;
    const artTags = new Set(art.tags.map(t => String(t).toLowerCase().trim()));
    
    recentNews.forEach(other => {
      if (other.id === art.id) return;
      const sharesTag = other.tags.some(t => artTags.has(String(t).toLowerCase().trim()));
      if (sharesTag) {
        momentum += other.views24h || 0;
      }
    });
    art.tagMomentum = momentum;
  });

  // 5. Calcular trendScore dinámico y actualizar SQLite
  const updateStmt = db.prepare(`
    UPDATE articles SET
      views1h = ?,
      views24h = ?,
      viewCount = ?,
      trendScore = ?,
      isHotTopic = ?
    WHERE id = ?
  `);

  logger.log('Calculando trendScore y actualizando registros de SQLite en caliente...');
  const updatedList = [];

  recentNews.forEach(art => {
    const views1h = art.views1h || 0;
    const views24h = art.views24h || 0;
    const tagMomentum = art.tagMomentum || 0;
    const urgency = art.urgencyScore || 0;
    
    const hoursSincePublished = Math.max(0, (Date.now() - new Date(art.publishedAt).getTime()) / (60 * 60 * 1000));
    // Penalización de obsolescencia: 1.5 puntos por cada hora transcurrida
    const stalenessPenalty = hoursSincePublished * 1.5;

    // Fórmula del trendScore:
    // trendScore = views1h * 5 + views24h * 2 + tagMomentum * 3 + urgencyScore * 2 - stalenessPenalty
    const trendScore = (views1h * 5) + (views24h * 2) + (tagMomentum * 3) + (urgency * 2) - stalenessPenalty;
    
    art.trendScore = Number(trendScore.toFixed(2));
    // Es Hot Topic si su score es relevante o si está muy demandado en la última hora
    art.isHotTopic = (trendScore > 15 || views1h >= 5) ? 1 : 0;

    try {
      updateStmt.run(
        art.views1h,
        art.views24h,
        art.viewCount,
        art.trendScore,
        art.isHotTopic,
        art.id
      );
      updatedList.push(art);
    } catch (dbErr) {
      logger.error(`Error actualizando artículo ${art.id} en SQLite:`, dbErr.message);
    }
  });

  logger.log(`Actualizados ${updatedList.length} artículos en SQLite.`);

  // 6. Ordenar por trendScore descendente y filtrar artículos calientes
  // Las tendencias se eligen de los artículos con mayor trendScore
  const hotTopicsList = updatedList
    .filter(art => art.trendScore > 0 || art.viewCount > 0)
    .sort((a, b) => b.trendScore - a.trendScore)
    .slice(0, 30);

  // Escribir a data/hot-topics.json localmente
  const hotTopicsPath = path.resolve('data/hot-topics.json');
  logger.log(`Escribiendo ${hotTopicsList.length} artículos calientes a ${hotTopicsPath}...`);
  writeJsonAtomic(hotTopicsPath, hotTopicsList, true);

  // Escribir sitemap de tendencias a data/trending_topics.json y a Firebase
  if (hotTopicsList.length > 0) {
    const payload = {
      updatedAt: new Date().toISOString(),
      topics: hotTopicsList.map(art => ({
        id: art.id,
        title: art.title,
        slug: art.slug || art.id,
        category: art.category,
        trendScore: art.trendScore,
        views24h: art.views24h,
        keywords: art.tags.slice(0, 5)
      }))
    };

    const trendingLocalPath = path.resolve('data/trending_topics.json');
    writeJsonAtomic(trendingLocalPath, payload, false);
    logger.log('Escrito data/trending_topics.json localmente.');

    try {
      await fetch('https://pecemi-default-rtdb.firebaseio.com/aidaily/trending_topics.json', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      logger.log('Sincronizadas tendencias trending_topics.json con Firebase RTDB de forma exitosa.');
    } catch (e) {
      logger.warn('No se pudo actualizar trending_topics en Firebase (no bloqueante):', e.message);
    }
  }

  logger.addScraped(recentNews.length);
  logger.printSummary();
  logger.log('=== Cron de Temas Calientes Finalizado con Éxito ===');
}

main().catch(err => {
  logger.error('Excepción no capturada en main de hot-topics-cron', err);
  process.exit(1);
});
