#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { CronLogger } from '../lib/logger.js';
import { writeJsonAtomic } from '../lib/atomic-write.js';
import { calculateJaccardSimilarity, cleanTokens, sanitizeUrlForHash } from '../lib/dedupe.js';

const logger = new CronLogger('hot-topics');
const LOCK_FILE = path.resolve('data/hot-topics.lock');

const URGENCY_KEYWORDS = [
  'breaking', 'urgent', 'última hora', 'developing', 'live', 'confirmed', 
  'launch', 'release', 'lawsuit', 'ban', 'regulation', 'acquisition', 
  'funding', 'outage', 'security breach', 'urgente', 'alerta', 'caída'
];

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

async function main() {
  logger.log('=== Iniciando Cron de Temas Calientes (cada 2 horas) ===');
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

  // 1. Cargar las noticias recientes de las últimas 48 horas desde SQLite
  let recentNews = [];
  try {
    const dbPath = process.env.SQLITE_DB_PATH || path.resolve('data/aidaily.db');
    if (!fs.existsSync(dbPath)) {
      logger.warn(`No existe la base de datos en ${dbPath}. Abortando.`);
      process.exit(0);
    }
    const db = new DatabaseSync(dbPath);
    const limitTimeISO = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
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
  } catch (err) {
    logger.error('Error al leer de SQLite en hot-topics-cron.js', err);
    process.exit(1);
  }
  logger.log(`Analizando ${recentNews.length} noticias de las últimas 48 horas desde SQLite...`);

  const breakingNewsList = [];
  const hotTopicsList = [];

  // --- A. DETECTAR URGENCIA (Breaking News) ---
  for (const art of recentNews) {
    const titleLower = (art.title || '').toLowerCase();
    const summaryLower = (art.summary || '').toLowerCase();
    const text = `${titleLower} ${summaryLower}`;

    const isUrgent = URGENCY_KEYWORDS.some(kw => {
      const regex = new RegExp(`\\b${kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "")}\\b`, 'i');
      return regex.test(text.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
    });

    if (isUrgent) {
      const breakingArt = {
        ...art,
        breaking_news: true,
        urgencyScore: Math.max(art.urgencyScore || 0, 8),
        status: 'publicada'
      };
      breakingNewsList.push(breakingArt);
      logger.addSuccess(1);
      logger.addDetail('breaking', breakingArt.title, breakingArt.source);
    }
  }

  // --- B. DETECTAR TENDENCIAS/TEMAS REPETIDOS (Hot Topics) ---
  // Agrupar artículos similares usando Similitud Jaccard de palabras clave
  const clusters = [];
  
  for (const art of recentNews) {
    let matchedCluster = null;
    
    for (const cluster of clusters) {
      const representative = cluster[0];
      const similarity = calculateJaccardSimilarity(art, representative);
      
      // Umbral ajustado para agrupar temas repetidos
      if (similarity > 0.18) {
        matchedCluster = cluster;
        break;
      }
    }

    if (matchedCluster) {
      matchedCluster.push(art);
    } else {
      clusters.push([art]);
    }
  }

  // Si un cluster tiene artículos de al menos 3 fuentes distintas, califica como tendencia caliente
  const hotTopicArticles = new Set();
  
  for (const cluster of clusters) {
    const sources = new Set(cluster.map(art => art.source));
    if (sources.size >= 3) {
      cluster.forEach(art => {
        hotTopicArticles.add(art);
      });
      logger.log(`[Tendencia] Tema caliente detectado con ${cluster.length} artículos en ${sources.size} fuentes distintas: "${cluster[0].title}"`);
    }
  }

  hotTopicArticles.forEach(art => {
    const hotArt = {
      ...art,
      hot_topic: true,
      relevanceScore: Math.max(art.relevanceScore || 0, 8),
      status: 'publicada'
    };
    hotTopicsList.push(hotArt);
    logger.addDetail('hot', hotArt.title, hotArt.source);
  });

  // --- C. ESCRIBIR RESULTADOS DE FORMA ATÓMICA ---
  const breakingPath = path.resolve('data/breaking-news.json');
  const hotTopicsPath = path.resolve('data/hot-topics.json');

  logger.log(`Escribiendo ${breakingNewsList.length} artículos de última hora en data/breaking-news.json...`);
  writeJsonAtomic(breakingPath, breakingNewsList, true);

  logger.log(`Escribiendo ${hotTopicsList.length} artículos de tendencia en data/hot-topics.json...`);
  writeJsonAtomic(hotTopicsPath, hotTopicsList, true);

  // Sincronizar localmente en data/trending_topics.json y en Firebase RTDB /trending_topics.json
  if (hotTopicsList.length > 0) {
    // Extraer las keywords más repetidas del cluster caliente
    const allText = hotTopicsList.map(a => a.title).join(' ');
    const tokens = cleanTokens(allText);
    const keywords = Array.from(tokens).slice(0, 10);
    
    const payload = {
      updatedAt: new Date().toISOString(),
      topics: [
        {
          title: hotTopicsList[0].title,
          keywords: keywords
        }
      ]
    };

    const trendingLocalPath = path.resolve('data/trending_topics.json');
    writeJsonAtomic(trendingLocalPath, payload, false);
    logger.log('Sincronizados trending_topics con data/trending_topics.json local.');
    
    try {
      await fetch('https://pecemi-default-rtdb.firebaseio.com/aidaily/trending_topics.json', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      logger.log('Sincronizados trending_topics con Firebase RTDB para priorización 70/30 en segundo plano.');
    } catch (e) {
      logger.warn('No se pudo actualizar trending_topics en Firebase (no bloqueante):', e.message);
    }
  }

  logger.addScraped(recentNews.length);
  logger.printSummary();
  logger.log('=== Cron de Temas Calientes Finalizado con Éxito ===');
}

main().catch(err => {
  logger.error('Excepción no capturada en main de hot-topics', err);
  process.exit(1);
});
