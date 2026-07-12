import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dbPath = process.env.SQLITE_DB_PATH || path.resolve('data/aidaily.db');
console.log(`[Restaurador] Conectando a la DB en ${dbPath}...`);
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
    CREATE INDEX IF NOT EXISTS idx_articles_status_published ON articles(status, publishedAt DESC);
  `);

  // Migración automática incremental para nuevas columnas de la arquitectura periodística
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

    const tableInfo = db.prepare("PRAGMA table_info(articles)").all() as any[];
    const existingColumnNames = tableInfo.map(col => col.name.toLowerCase());

    columnsToAdd.forEach(col => {
      if (!existingColumnNames.includes(col.name.toLowerCase())) {
        console.log(`[Restaurador Migration] Añadiendo columna: ${col.name}`);
        db.exec(`ALTER TABLE articles ADD COLUMN ${col.name} ${col.type}`);
      }
    });
  } catch (migErr) {
    console.error('[Restaurador Migration] Error migrando DB:', migErr.message || migErr);
  }
`);

async function main() {
  console.log('[Restaurador] Iniciando descarga paginada desde Firebase RTDB para evitar OOM...');
  
  const insertStmt = db.prepare(`
    INSERT INTO articles (
      id, title, summary, url, source, sourceUrl, publishedAt, imageUrl, imageAlt,
      category, subcategory, tags, tagsSecundarios, aiSummary, keyPoints, whyMatters,
      multimedia, fullText, hashtags, fullArticle, scrapedAt, detectedAt, language,
      relevanceScore, urgencyScore, scoreReason, status
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'publicada'
    ) ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      summary = excluded.summary,
      url = excluded.url,
      source = excluded.source,
      sourceUrl = excluded.sourceUrl,
      publishedAt = excluded.publishedAt,
      imageUrl = excluded.imageUrl,
      imageAlt = excluded.imageAlt,
      category = excluded.category,
      subcategory = excluded.subcategory,
      tags = excluded.tags,
      tagsSecundarios = excluded.tagsSecundarios,
      aiSummary = excluded.aiSummary,
      keyPoints = excluded.keyPoints,
      whyMatters = excluded.whyMatters,
      multimedia = excluded.multimedia,
      fullText = excluded.fullText,
      hashtags = excluded.hashtags,
      fullArticle = excluded.fullArticle,
      scrapedAt = excluded.scrapedAt,
      detectedAt = excluded.detectedAt,
      language = excluded.language,
      relevanceScore = excluded.relevanceScore,
      urgencyScore = excluded.urgencyScore,
      scoreReason = excluded.scoreReason,
      status = 'publicada'
  `);

  let lastKey = null;
  let insertedCount = 0;
  let hasMore = true;
  const limit = 1000;

  db.exec("BEGIN TRANSACTION");

  try {
    while (hasMore) {
      let url = `https://pecemi-default-rtdb.firebaseio.com/aidaily/articles.json?orderBy="$key"&limitToFirst=${limit}`;
      if (lastKey) {
        url += `&startAt=${JSON.stringify(lastKey)}`;
      }

      console.log(`[Restaurador] Descargando lote desde: ${lastKey ? 'ID ' + lastKey : 'inicio'}...`);
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Error HTTP de Firebase: ${res.status}`);
      }

      const data = await res.json();
      if (!data || typeof data !== 'object') {
        console.log('[Restaurador] No hay más datos en Firebase.');
        hasMore = false;
        break;
      }

      const keys = Object.keys(data).sort();
      if (keys.length === 0) {
        hasMore = false;
        break;
      }

      // Si ya solo viene el elemento de startAt, terminamos
      if (keys.length === 1 && keys[0] === lastKey) {
        hasMore = false;
        break;
      }

      let batchCount = 0;
      for (const key of keys) {
        if (key === lastKey) continue; // Omitir startAt repetido
        
        const item = data[key];
        if (!item.url || !item.title) continue;
        const hashId = item.id || item.url.replace(/[^a-zA-Z0-9]/g, '_');

        // Normalizar arrays a strings JSON para SQLite
        const tags = JSON.stringify(item.tags || [item.category || 'general']);
        const tagsSecundarios = JSON.stringify(item.tagsSecundarios || []);
        const keyPoints = JSON.stringify(item.keyPoints || []);
        const multimedia = JSON.stringify(item.multimedia || []);
        const hashtags = JSON.stringify(item.hashtags || []);
        const links = JSON.stringify(item.links || []);
        const interestingData = JSON.stringify(item.interestingData || []);

        // Normalizar strings para evitar errores de binding si son objetos/arrays inesperados en Firebase
        const titleVal = typeof item.title === 'object' ? JSON.stringify(item.title) : String(item.title || '');
        const summaryVal = typeof item.summary === 'object' ? JSON.stringify(item.summary) : String(item.summary || '');
        const urlVal = typeof item.url === 'object' ? JSON.stringify(item.url) : String(item.url || '');
        const sourceVal = typeof item.source === 'object' ? JSON.stringify(item.source) : String(item.source || 'Desconocido');
        const sourceUrlVal = typeof item.sourceUrl === 'object' ? JSON.stringify(item.sourceUrl) : String(item.sourceUrl || '');
        const publishedAtVal = typeof item.publishedAt === 'object' ? JSON.stringify(item.publishedAt) : String(item.publishedAt || new Date().toISOString());
        const imageUrlVal = typeof item.imageUrl === 'object' ? JSON.stringify(item.imageUrl) : String(item.imageUrl || '');
        const imageAltVal = typeof item.imageAlt === 'object' ? JSON.stringify(item.imageAlt) : String(item.imageAlt || '');
        const categoryVal = typeof item.category === 'object' ? JSON.stringify(item.category) : String(item.category || 'general');
        const subcategoryVal = typeof item.subcategory === 'object' ? JSON.stringify(item.subcategory) : String(item.subcategory || 'general');
        const aiSummaryVal = typeof item.aiSummary === 'object' ? JSON.stringify(item.aiSummary) : String(item.aiSummary || '');
        const whyMattersVal = typeof item.whyMatters === 'object' ? JSON.stringify(item.whyMatters) : String(item.whyMatters || '');
        const fullTextVal = typeof item.fullText === 'object' ? JSON.stringify(item.fullText) : String(item.fullText || '');
        const fullArticleVal = typeof item.fullArticle === 'object' ? JSON.stringify(item.fullArticle) : String(item.fullArticle || '');
        const scrapedAtVal = typeof item.scrapedAt === 'object' ? JSON.stringify(item.scrapedAt) : String(item.scrapedAt || new Date().toISOString());
        const detectedAtVal = typeof item.detectedAt === 'object' ? JSON.stringify(item.detectedAt) : String(item.detectedAt || new Date().toISOString());
        const languageVal = typeof item.language === 'object' ? JSON.stringify(item.language) : String(item.language || 'es');
        const scoreReasonVal = typeof item.scoreReason === 'object' ? JSON.stringify(item.scoreReason) : String(item.scoreReason || '');

        try {
          insertStmt.run(
            hashId,
            titleVal,
            summaryVal,
            urlVal,
            sourceVal,
            sourceUrlVal,
            publishedAtVal,
            imageUrlVal,
            imageAltVal,
            categoryVal,
            subcategoryVal,
            tags,
            tagsSecundarios,
            aiSummaryVal,
            keyPoints,
            whyMattersVal,
            multimedia,
            fullTextVal,
            hashtags,
            fullArticleVal,
            scrapedAtVal,
            detectedAtVal,
            languageVal,
            Number(item.relevanceScore || 0),
            Number(item.urgencyScore || 0),
            scoreReasonVal
          );
          insertedCount++;
          batchCount++;
        } catch (err) {
          console.error(`Error insertando artículo ${hashId}:`, err.message);
        }
      }

      lastKey = keys[keys.length - 1];
      console.log(`[Restaurador] Procesado lote con ${batchCount} artículos. Total acumulado: ${insertedCount}`);

      if (keys.length < limit) {
        hasMore = false;
      }
    }
    
    db.exec("COMMIT");
    console.log(`[Restaurador] Restauración completada en SQLite. Total artículos: ${insertedCount}`);

    // Regenerar cachés locales consistentes
    const selectStmt = db.prepare("SELECT * FROM articles WHERE status = 'publicada' ORDER BY publishedAt DESC");
    const rows = selectStmt.all();
    const fullList = rows.map((art) => {
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

    const cachePath = path.resolve('src/data/cache-news.json');
    const newsPath = path.resolve('data/news.json');
    
    fs.writeFileSync(cachePath, JSON.stringify(fullList, null, 2), 'utf-8');
    fs.writeFileSync(newsPath, JSON.stringify(fullList, null, 2), 'utf-8');
    console.log(`[Restaurador] Actualizados cache-news.json y news.json locales con ${fullList.length} artículos.`);

  } catch (err) {
    db.exec("ROLLBACK");
    console.error('[Restaurador] Falló transacción. Rollback ejecutado.', err);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[Restaurador] Error crítico en main:', err);
  process.exit(1);
});
