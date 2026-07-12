import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dbPath = process.env.SQLITE_DB_PATH || path.resolve('data/aidaily.db');
console.log(`[Standalone Migration] Conectando a la DB en ${dbPath}...`);

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(dbPath);

// Crear tabla por defecto si no existe
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

console.log('[Standalone Migration] Ejecutando migración incremental de columnas...');

try {
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
      console.log(`  -> Añadiendo columna: ${col.name} (${col.type})`);
      try {
        db.exec(`ALTER TABLE articles ADD COLUMN ${col.name} ${col.type}`);
      } catch (alterErr) {
        console.error(`  [X] Error añadiendo ${col.name}:`, alterErr.message || alterErr);
      }
    } else {
      console.log(`  -> Columna existente: ${col.name}`);
    }
  });

  console.log('[Standalone Migration] ✅ Migración completada con éxito.');
} catch (migErr) {
  console.error('[Standalone Migration] ❌ Falló la migración:', migErr.message || migErr);
  process.exit(1);
}
