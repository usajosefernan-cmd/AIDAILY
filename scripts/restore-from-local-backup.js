import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dbPath = path.resolve('data/aidaily.db');
const backupsDir = path.resolve('backups');

async function main() {
  console.log("==================================================");
  console.log("📦 RESTAURADOR DE NOTICIAS DESDE BACKUP LOCAL (22K)");
  console.log("==================================================");

  // 1. Encontrar el archivo de backup de noticias más reciente
  const files = fs.readdirSync(backupsDir)
    .filter(f => f.startsWith('news_backup_') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.error("❌ ERROR: No se encontró ningún archivo de backup de noticias en backups/");
    process.exit(1);
  }

  const latestBackupFile = files[0];
  const backupPath = path.join(backupsDir, latestBackupFile);
  console.log(`📂 Leyendo backup más reciente: ${backupPath} (${(fs.statSync(backupPath).size / 1024 / 1024).toFixed(2)} MB)...`);

  const rawData = fs.readFileSync(backupPath, 'utf-8');
  const backupArts = JSON.parse(rawData);
  const articlesList = Array.isArray(backupArts) ? backupArts : Object.values(backupArts).flat();
  console.log(`✅ Cargados ${articlesList.length} artículos del backup local.`);

  // 2. Conectar y asegurar la base de datos SQLite local
  console.log(`🔌 Conectando a SQLite local en ${dbPath}...`);
  const db = new DatabaseSync(dbPath);

  // Asegurar tabla
  db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      summary TEXT,
      url TEXT NOT NULL,
      source TEXT NOT NULL,
      sourceUrl TEXT,
      publishedAt TEXT NOT NULL,
      imageUrl TEXT,
      imageAlt TEXT,
      category TEXT NOT NULL,
      subcategory TEXT NOT NULL,
      tags TEXT,
      tagsSecundarios TEXT,
      aiSummary TEXT,
      keyPoints TEXT,
      whyMatters TEXT,
      multimedia TEXT,
      fullText TEXT,
      hashtags TEXT,
      fullArticle TEXT,
      scrapedAt TEXT,
      detectedAt TEXT,
      language TEXT DEFAULT 'es',
      relevanceScore INTEGER,
      urgencyScore INTEGER,
      scoreReason TEXT,
      status TEXT DEFAULT 'pendiente_ia'
    );
    CREATE INDEX IF NOT EXISTS idx_articles_status_published ON articles(status, publishedAt DESC);
  `);

  // Columnas adicionales
  const columnsToAdd = [
    { name: 'slug', type: 'TEXT' },
    { name: 'subtitle', type: 'TEXT' },
    { name: 'contentHtml', type: 'TEXT' },
    { name: 'originalUrl', type: 'TEXT' },
    { name: 'author', type: 'TEXT' },
    { name: 'updatedAt', type: 'TEXT' },
    { name: 'entities', type: 'TEXT' },
    { name: 'country', type: 'TEXT' },
    { name: 'importanceScore', type: 'INTEGER' },
    { name: 'qualityScore', type: 'INTEGER' },
    { name: 'editorialScore', type: 'INTEGER' },
    { name: 'trendScore', type: 'INTEGER DEFAULT 0' },
    { name: 'viewCount', type: 'INTEGER DEFAULT 0' },
    { name: 'views1h', type: 'INTEGER DEFAULT 0' },
    { name: 'views24h', type: 'INTEGER DEFAULT 0' },
    { name: 'views7d', type: 'INTEGER DEFAULT 0' },
    { name: 'isBreaking', type: 'INTEGER DEFAULT 0' },
    { name: 'isHotTopic', type: 'INTEGER DEFAULT 0' },
    { name: 'isEvergreen', type: 'INTEGER DEFAULT 0' },
    { name: 'imageCaption', type: 'TEXT' },
    { name: 'relatedArticles', type: 'TEXT' },
    { name: 'rejectionReason', type: 'TEXT' }
  ];

  const tableInfo = db.prepare("PRAGMA table_info(articles)").all();
  const existingColumnNames = tableInfo.map(col => col.name.toLowerCase());

  columnsToAdd.forEach(col => {
    if (!existingColumnNames.includes(col.name.toLowerCase())) {
      db.exec(`ALTER TABLE articles ADD COLUMN ${col.name} ${col.type}`);
    }
  });

  // 3. Insertar masivamente en SQLite usando transacción
  console.log("💾 Insertando artículos en SQLite...");
  db.exec("BEGIN TRANSACTION");

  const insertStmt = db.prepare(`
    INSERT INTO articles (
      id, title, summary, url, source, sourceUrl, publishedAt, imageUrl, imageAlt,
      category, subcategory, tags, tagsSecundarios, aiSummary, keyPoints, whyMatters,
      multimedia, fullText, hashtags, fullArticle, scrapedAt, detectedAt, language,
      relevanceScore, urgencyScore, scoreReason, status, slug, subtitle, viewCount, trendScore
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    ) ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      summary = excluded.summary,
      url = excluded.url,
      source = excluded.source,
      publishedAt = excluded.publishedAt,
      imageUrl = excluded.imageUrl,
      category = excluded.category,
      subcategory = excluded.subcategory,
      tags = excluded.tags,
      hashtags = excluded.hashtags,
      slug = excluded.slug,
      subtitle = excluded.subtitle,
      viewCount = excluded.viewCount,
      trendScore = excluded.trendScore
  `);

  // Función simple para normalizar slug
  function getSlug(title) {
    if (!title) return '';
    return title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .substring(0, 100)
      .replace(/-+$/, '');
  }

  let dbInserted = 0;
  for (const art of articlesList) {
    if (!art.url || !art.title) continue;
    const hashId = art.id || art.url.replace(/[^a-zA-Z0-9]/g, '_');
    const slug = art.slug || getSlug(art.title) || hashId;

    try {
      insertStmt.run(
        hashId,
        String(art.title || ''),
        String(art.summary || art.aiSummary || ''),
        String(art.url || ''),
        String(art.source || 'Desconocido'),
        String(art.sourceUrl || ''),
        String(art.publishedAt || art.date || new Date().toISOString()),
        String(art.imageUrl || ''),
        String(art.imageAlt || ''),
        String(art.category || 'general').toLowerCase(),
        String(art.subcategory || 'general').toLowerCase(),
        JSON.stringify(art.tags || []),
        JSON.stringify(art.tagsSecundarios || []),
        String(art.aiSummary || ''),
        JSON.stringify(art.keyPoints || []),
        String(art.whyMatters || ''),
        JSON.stringify(art.multimedia || []),
        String(art.fullText || ''),
        JSON.stringify(art.hashtags || []),
        String(art.fullArticle || art.body || ''),
        String(art.scrapedAt || new Date().toISOString()),
        String(art.detectedAt || new Date().toISOString()),
        String(art.language || 'es'),
        Number(art.relevanceScore || 0),
        Number(art.urgencyScore || 0),
        String(art.scoreReason || ''),
        String(art.status || 'publicada'),
        slug,
        String(art.subtitle || ''),
        Number(art.viewCount || 0),
        Number(art.trendScore || 0)
      );
      dbInserted++;
    } catch (e) {
      console.error(`Error SQLite artículo ${hashId}:`, e.message);
    }
  }

  db.exec("COMMIT");
  console.log(`✅ SQLite sincronizado con ${dbInserted} artículos.`);

  // Escribir archivo de caché local
  const cachePath = path.resolve('src/data/cache-news.json');
  const cacheData = articlesList.map(a => ({
    ...a,
    slug: a.slug || getSlug(a.title) || a.id
  }));
  fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2), 'utf-8');
  console.log(`✅ cache-news.json local actualizado.`);

  // 4. Subir masivamente a Firebase Realtime Database
  console.log("🚀 Sincronizando de forma masiva a Firebase Realtime Database...");
  const firebaseData = {};
  articlesList.forEach(art => {
    if (!art.url || !art.title) return;
    const hashId = art.id || art.url.replace(/[^a-zA-Z0-9]/g, '_');
    firebaseData[hashId] = {
      ...art,
      status: art.status || 'publicada',
      slug: art.slug || getSlug(art.title) || hashId
    };
  });

  // Dividir en lotes para subir a Firebase (lotes de 2000 artículos)
  const keys = Object.keys(firebaseData);
  const batchSize = 2000;
  for (let i = 0; i < keys.length; i += batchSize) {
    const batchKeys = keys.slice(i, i + batchSize);
    const batchPayload = {};
    batchKeys.forEach(k => {
      batchPayload[k] = firebaseData[k];
    });

    console.log(`📤 Subiendo lote a Firebase (${i} a ${i + batchKeys.length} de ${keys.length})...`);
    try {
      const response = await fetch('https://pecemi-default-rtdb.firebaseio.com/aidaily/articles.json', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchPayload)
      });
      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }
      console.log("  ✅ Lote subido.");
    } catch (firebaseErr) {
      console.error("  ❌ Falló la subida del lote:", firebaseErr.message);
    }
  }

  console.log("🎉 PROCESO COMPLETADO CON ÉXITO.");
}

main().catch(err => {
  console.error("❌ ERROR CRÍTICO:", err.message || err);
  process.exit(1);
});
