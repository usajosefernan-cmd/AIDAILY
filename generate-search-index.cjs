// generate-search-index.cjs — Genera el índice de autocompletado para el buscador inteligente
// Se ejecuta como parte del build o del cron para mantener el índice actualizado

const fs = require('fs');

const CACHE_PATH = process.argv[2] || '/home/ubuntu/workspace/AIDAILY/src/data/cache-news.json';
const OUTPUT_PATH = process.argv[3] || '/home/ubuntu/workspace/AIDAILY/src/data/search-index.json';

const d = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
const arts = Array.isArray(d) ? d : Object.values(d).flat();

console.log(`[search-index] Procesando ${arts.length} artículos...`);

// 1. Recopilar tags, categorías, subcategorías y fuentes con frecuencia
const tagFreq = {};
const catFreq = {};
const subFreq = {};
const srcFreq = {};
const entityFreq = {};

// Stopwords para filtrar entidades
const ENTITY_STOP = new Set([
  'del','los','las','una','que','por','para','con','sin','desde','hasta','entre',
  'todo','todos','toda','todas','cada','más','como','pero','bien','mal','gran','nuevo',
  'nueva','primer','primera','último','última','mejor','peor','según','tras','ante',
  'cómo','cuál','quién','este','esta','estos','estas','esos','esas','aquel','aquella',
  'muy','también','siempre','nunca','ahora','antes','después','hoy','ayer','mañana',
  'the','for','and','with','from','that','this','have','been','will','what','when',
  'how','why','who','which','their','about','just','into','over','more','than','not',
  'its','are','has','can','all','new','out','was','but','one','you','your','had',
]);

// Extraer entidades (nombres propios) de títulos
function extractEntities(title) {
  if (!title || typeof title !== 'string') return [];
  // Buscar secuencias de palabras con mayúscula inicial (nombres propios)
  const words = title.split(/\s+/);
  const entities = [];
  let current = [];
  
  for (const w of words) {
    // Si empieza con mayúscula y no es inicio de frase (posición > 0 o tras punto)
    const clean = w.replace(/[^a-záéíóúñüA-ZÁÉÍÓÚÑÜ0-9]/g, '');
    if (clean.length < 2) { 
      if (current.length > 0) { entities.push(current.join(' ')); current = []; }
      continue; 
    }
    if (/^[A-ZÁÉÍÓÚÑÜ]/.test(clean) && !ENTITY_STOP.has(clean.toLowerCase())) {
      current.push(clean);
    } else {
      if (current.length > 0) { entities.push(current.join(' ')); current = []; }
    }
  }
  if (current.length > 0) entities.push(current.join(' '));
  
  // Filtrar: solo entidades de 2+ palabras o nombres conocidos de 1 palabra (>4 chars, no genérico)
  return entities.filter(e => {
    const parts = e.split(' ');
    if (parts.length >= 2) return true; // Bigramas siempre
    if (parts[0].length > 4 && /^[A-ZÁÉÍÓÚÑÜ]/.test(parts[0])) return true;
    return false;
  });
}

arts.forEach(a => {
  // Tags
  if (a.tags && Array.isArray(a.tags)) {
    a.tags.forEach(t => {
      if (typeof t === 'string') {
        const key = t.trim();
        if (key.length > 1) tagFreq[key] = (tagFreq[key] || 0) + 1;
      }
    });
  }
  
  // Categoría
  if (a.category && typeof a.category === 'string') {
    const key = a.category.trim();
    catFreq[key] = (catFreq[key] || 0) + 1;
  }
  
  // Subcategoría
  if (a.subcategory && typeof a.subcategory === 'string') {
    const key = a.subcategory.trim();
    subFreq[key] = (subFreq[key] || 0) + 1;
  }
  
  // Fuente
  if (a.source && typeof a.source === 'string') {
    const key = a.source.trim();
    srcFreq[key] = (srcFreq[key] || 0) + 1;
  }
  
  // Entidades de títulos (solo últimos 7 días para mantener relevancia)
  const now = Date.now();
  const artDate = new Date(a.date || a.publishedAt || 0).getTime();
  if ((now - artDate) < 7 * 24 * 3600 * 1000) {
    const entities = extractEntities(a.title);
    entities.forEach(e => {
      entityFreq[e] = (entityFreq[e] || 0) + 1;
    });
  }
});

// 2. Construir las sugerencias agrupadas por tipo
function topEntries(freq, limit, minCount = 1) {
  return Object.entries(freq)
    .filter(([_, c]) => c >= minCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

const index = {
  categories: Object.entries(catFreq)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count, type: 'category' })),
  
  subcategories: topEntries(subFreq, 100)
    .map(s => ({ ...s, type: 'subcategory' })),
  
  tags: topEntries(tagFreq, 200, 2)
    .filter(t => !catFreq[t.label]) // No duplicar categorías
    .map(t => ({ ...t, type: 'tag' })),
  
  sources: topEntries(srcFreq, 100, 3)
    .map(s => ({ ...s, type: 'source' })),
  
  entities: topEntries(entityFreq, 150, 3)
    .map(e => ({ ...e, type: 'entity' })),
  
  generatedAt: new Date().toISOString(),
  totalArticles: arts.length
};

// Crear lista plana de todas las sugerencias para el autocompletado rápido
const allSuggestions = [
  ...index.categories,
  ...index.subcategories,
  ...index.entities,
  ...index.tags,
  ...index.sources
];

index.suggestions = allSuggestions;

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(index, null, 2));
console.log(`[search-index] Generado con ${allSuggestions.length} sugerencias`);
console.log(`  Categorías: ${index.categories.length}`);
console.log(`  Subcategorías: ${index.subcategories.length}`);
console.log(`  Tags: ${index.tags.length}`);
console.log(`  Fuentes: ${index.sources.length}`);
console.log(`  Entidades: ${index.entities.length}`);
