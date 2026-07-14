// generate-search-index.cjs — Genera el índice de autocompletado y segmentado para el buscador
const fs = require('fs');
const path = require('path');

const CACHE_PATH = path.resolve('src/data/cache-news.json');
const OUTPUT_DIR = path.resolve('public/api/search');
const { DatabaseSync } = require('node:sqlite');
const dbPath = path.resolve('data/aidaily.db');

// Asegurar que existe el directorio de salida
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

let arts = [];

if (fs.existsSync(dbPath)) {
  try {
    const db = new DatabaseSync(dbPath);
    const stmt = db.prepare("SELECT * FROM articles ORDER BY publishedAt DESC");
    const rows = stmt.all();
    arts = rows.map(row => {
      const art = Object.assign({}, row);
      try { art.tags = row.tags ? JSON.parse(row.tags) : []; } catch(_) { art.tags = []; }
      try { art.hashtags = row.hashtags ? JSON.parse(row.hashtags) : []; } catch(_) { art.hashtags = []; }
      try { art.multimedia = row.multimedia ? JSON.parse(row.multimedia) : []; } catch(_) { art.multimedia = []; }
      return art;
    });
    console.log(`[search-index] Cargados ${arts.length} artículos directamente desde la base de datos SQLite.`);
  } catch (err) {
    console.error("[search-index] Error cargando base de datos SQLite:", err.message);
  }
}

if (arts.length === 0) {
  if (fs.existsSync(CACHE_PATH)) {
    const raw = fs.readFileSync(CACHE_PATH, 'utf-8');
    const d = JSON.parse(raw);
    arts = Array.isArray(d) ? d : Object.values(d).flat();
    console.log(`[search-index] Fallback: cargados ${arts.length} artículos desde el caché JSON.`);
  } else {
    console.error(`[search-index] ERROR: No existe base de datos ni archivo de caché en ${CACHE_PATH}`);
    process.exit(1);
  }
}

console.log(`[search-index] Procesando ${arts.length} artículos...`);

// Helper simple para normalizar texto a slug
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

// 1. Recopilar tags, categorías, subcategorías, fuentes y entidades con frecuencia
const tagFreq = {};
const catFreq = {};
const subFreq = {};
const srcFreq = {};
const entFreq = {};

// Extraer entidades (nombres propios) de títulos
function extractEntities(title) {
  if (!title || typeof title !== 'string') return [];
  const words = title.split(/\s+/);
  const entities = [];
  let current = [];
  
  for (const w of words) {
    const clean = w.replace(/[^a-záéíóúñüA-ZÁÉÍÓÚÑÜ0-9]/g, '');
    if (clean.length < 2) { 
      if (current.length > 0) { entities.push(current.join(' ')); current = []; }
      continue; 
    }
    
    // Si empieza con mayúscula
    if (/^[A-ZÁÉÍÓÚÑÜ]/.test(clean)) {
      current.push(clean);
    } else {
      if (current.length > 0) {
        entities.push(current.join(' '));
        current = [];
      }
    }
  }
  if (current.length > 0) entities.push(current.join(' '));
  
  return entities.filter(e => {
    const parts = e.split(' ');
    if (parts.length >= 2) return true;
    if (parts[0].length > 4 && /^[A-ZÁÉÍÓÚÑÜ]/.test(parts[0])) return true;
    return false;
  });
}

arts.forEach(a => {
  if (a.category) {
    const key = a.category.toLowerCase().trim();
    catFreq[key] = (catFreq[key] || 0) + 1;
  }
  if (a.subcategory) {
    const key = a.subcategory.toLowerCase().trim();
    subFreq[key] = (subFreq[key] || 0) + 1;
  }
  if (Array.isArray(a.hashtags)) {
    a.hashtags.forEach(t => {
      const clean = t.replace('#', '').toLowerCase().trim();
      if (clean) tagFreq[clean] = (tagFreq[clean] || 0) + 1;
    });
  }
  if (a.source) {
    const key = a.source.trim();
    srcFreq[key] = (srcFreq[key] || 0) + 1;
  }
  
  // Entidades de títulos (últimos 7 días)
  const now = Date.now();
  const artDate = new Date(a.publishedAt || a.date || 0).getTime();
  if ((now - artDate) < 7 * 24 * 3600 * 1000) {
    const entities = extractEntities(a.title);
    entities.forEach(e => {
      entFreq[e] = (entFreq[e] || 0) + 1;
    });
  }
});

// Helper para sugerencias ordenadas
function topEntries(freq, limit, minCount = 1) {
  return Object.entries(freq)
    .filter(([_, c]) => c >= minCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

const indexData = {
  categories: Object.entries(catFreq)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count, type: 'category' })),
    
  subcategories: topEntries(subFreq, 50, 2)
    .map(s => ({ ...s, type: 'subcategory' })),
  
  tags: topEntries(tagFreq, 200, 2)
    .filter(t => !catFreq[t.label])
    .map(t => ({ ...t, type: 'tag' })),
  
  sources: topEntries(srcFreq, 100, 3)
    .map(s => ({ ...s, type: 'source' })),
    
  entities: topEntries(entFreq, 100, 2)
    .map(e => ({ ...e, type: 'entity' })),
    
  totalArticles: arts.length
};

const allSuggestions = [
  ...indexData.categories,
  ...indexData.subcategories,
  ...indexData.entities,
  ...indexData.tags,
  ...indexData.sources
];

// Escribir index.json
const indexFilePath = path.join(OUTPUT_DIR, 'index.json');
fs.writeFileSync(indexFilePath, JSON.stringify({ suggestions: allSuggestions, generatedAt: new Date().toISOString() }, null, 2));

// Escribir tags.json, entities.json, sources.json
fs.writeFileSync(path.join(OUTPUT_DIR, 'tags.json'), JSON.stringify({ tags: indexData.tags }, null, 2));
fs.writeFileSync(path.join(OUTPUT_DIR, 'entities.json'), JSON.stringify({ entities: indexData.entities }, null, 2));
fs.writeFileSync(path.join(OUTPUT_DIR, 'sources.json'), JSON.stringify({ sources: indexData.sources }, null, 2));

console.log(`[search-index] Sugerencias escritas en public/api/search/`);

// 2. Segmentar artículos en lotes
const sortedArts = [...arts].sort((a, b) => new Date(b.publishedAt || b.date || 0).getTime() - new Date(a.publishedAt || a.date || 0).getTime());
const batchSize = 250;
let fileIndex = 0;

for (let i = 0; i < sortedArts.length; i += batchSize) {
  const batch = sortedArts.slice(i, i + batchSize).map(a => ({
    id: a.id,
    slug: a.slug || getSlug(a.title) || a.id,
    title: a.title,
    subtitle: a.subtitle || '',
    summary: a.summary || '',
    category: a.category || '',
    tags: a.tags || [],
    source: a.source || '',
    publishedAt: a.publishedAt || a.date,
    imageUrl: a.imageUrl || ''
  }));

  const fileName = `articles-${String(fileIndex).padStart(3, '0')}.json`;
  fs.writeFileSync(path.join(OUTPUT_DIR, fileName), JSON.stringify({ articles: batch }, null, 2));
  fileIndex++;
}

console.log(`[search-index] Segmentación completada. Se generaron ${fileIndex} archivos segmentados articles-XXX.json`);

// 2b. Generar mapeo histórico de slugs para permitir fallback en caliente de noticias antiguas (22k)
const slugMap = {};
sortedArts.forEach((a, idx) => {
  const slug = a.slug || getSlug(a.title) || a.id;
  const batchIndex = Math.floor(idx / batchSize);
  slugMap[slug] = {
    id: a.id,
    batchIndex: batchIndex,
    title: a.title,
    category: a.category || 'general',
    subcategory: a.subcategory || '',
    source: a.source || '',
    publishedAt: a.publishedAt || a.date,
    imageUrl: a.imageUrl || '',
    summary: a.summary || a.aiSummary || '',
    body: a.body || '',
    keyPoints: a.keyPoints || [],
    multimedia: a.multimedia || []
  };
});
fs.writeFileSync(path.join(OUTPUT_DIR, 'slug-map.json'), JSON.stringify(slugMap));
console.log(`[search-index] Generado mapeo histórico de slugs en public/api/search/slug-map.json`);

// 3. Generar base de datos optimizada ligera de artículos (articles-light.json)
const lightArticles = sortedArts.slice(0, 500).map(a => ({
  id: a.id || a.url,
  slug: a.slug || getSlug(a.title) || a.id,
  title: a.title,
  category: a.category,
  subcategory: a.subcategory,
  publishedAt: a.publishedAt || a.date,
  imageUrl: a.imageUrl,
  hashtags: a.hashtags || [],
  tags: a.tags || [],
  source: a.source || ''
}));

// Escribir a public/api/articles-light.json
const publicLightPath = path.resolve('public/api/articles-light.json');
fs.writeFileSync(publicLightPath, JSON.stringify(lightArticles, null, 2));
console.log(`[articles-light] Generado exitosamente en ${publicLightPath}`);

// Escribir a src/data/articles-light.json para compatibilidad de build
const devLightPath = path.resolve('src/data/articles-light.json');
fs.writeFileSync(devLightPath, JSON.stringify(lightArticles, null, 2));
console.log(`[articles-light] Generado exitosamente en ${devLightPath}`);

// Generar /api/build-info.json para telemetría de compilación
const buildInfoPath = path.resolve('public/api/build-info.json');
const buildInfo = {
  buildTime: new Date().toISOString(),
  commitHash: process.env.COMMIT_HASH || 'production_stable',
  dataVersion: new Date().toISOString().split('T')[0],
  articlesCount: arts.length,
  searchIndexCount: allSuggestions.length
};
fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfo, null, 2));
console.log(`[build-info] Generado exitosamente en ${buildInfoPath}`);
