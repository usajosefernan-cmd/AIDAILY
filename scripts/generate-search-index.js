#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { writeJsonAtomic } from '../lib/atomic-write.js';

const dbPath = process.env.SQLITE_DB_PATH || path.resolve('data/aidaily.db');
const outputIndexDir = path.resolve('public/api/search');
const outputIndexPath = path.join(outputIndexDir, 'index.json');
const outputSuggestionsPath = path.join(outputIndexDir, 'suggestions.json');

// Stopwords para filtrar entidades en autocompletado
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
  const words = title.split(/\s+/);
  const entities = [];
  let current = [];
  
  for (const w of words) {
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
  
  return entities.filter(e => {
    const parts = e.split(' ');
    if (parts.length >= 2) return true;
    if (parts[0].length > 4 && /^[A-ZÁÉÍÓÚÑÜ]/.test(parts[0])) return true;
    return false;
  });
}

async function main() {
  console.log('=== Generando Índices Ligeros de Búsqueda Segmentada ===');
  
  if (!fs.existsSync(dbPath)) {
    console.error(`Error: No existe base de datos SQLite en ${dbPath}`);
    process.exit(1);
  }

  const db = new DatabaseSync(dbPath);
  
  // 1. Cargar metadatos ultraligeros de todos los artículos publicados de SQLite
  let searchItems = [];
  try {
    const stmt = db.prepare(`
      SELECT id, slug, title, summary, category, subcategory, tags, tagsSecundarios, source, publishedAt, imageUrl 
      FROM articles 
      WHERE status = 'publicada' 
      ORDER BY publishedAt DESC
    `);
    const rows = stmt.all();
    
    searchItems = rows.map(art => {
      let parsedTags = [];
      try {
        parsedTags = art.tags ? JSON.parse(art.tags) : [art.category];
        if (art.tagsSecundarios) {
          const sec = JSON.parse(art.tagsSecundarios);
          if (Array.isArray(sec)) parsedTags.push(...sec);
        }
      } catch (_) {}
      
      // Sanitizar tags deduplicándolos
      const cleanTags = Array.from(new Set(parsedTags.map(t => String(t).toLowerCase().trim()))).filter(t => t.length > 1);

      return {
        id: art.id,
        slug: art.slug || art.id,
        title: art.title,
        summary: art.summary ? art.summary.substring(0, 140) + '...' : '',
        category: art.category,
        subcategory: art.subcategory,
        tags: cleanTags,
        source: art.source,
        publishedAt: art.publishedAt,
        imageUrl: art.imageUrl || ''
      };
    });
    console.log(`[Buscador] Leídos ${searchItems.length} artículos publicados de SQLite.`);
  } catch (err) {
    console.error('Error al consultar artículos en SQLite:', err.message);
    process.exit(1);
  }

  // Asegurar que el directorio de salida existe
  if (!fs.existsSync(outputIndexDir)) {
    fs.mkdirSync(outputIndexDir, { recursive: true });
  }

  // 2. Guardar el índice de búsqueda ultra-ligero
  console.log(`[Buscador] Escribiendo índice ultra-ligero a ${outputIndexPath}...`);
  writeJsonAtomic(outputIndexPath, searchItems, false);

  // 3. Recopilar frecuencias de sugerencias
  const tagFreq = {};
  const catFreq = {};
  const subFreq = {};
  const srcFreq = {};
  const entityFreq = {};

  searchItems.forEach(art => {
    // Categoría
    if (art.category) {
      const key = art.category.trim();
      catFreq[key] = (catFreq[key] || 0) + 1;
    }
    // Subcategoría
    if (art.subcategory) {
      const key = art.subcategory.trim();
      subFreq[key] = (subFreq[key] || 0) + 1;
    }
    // Fuente
    if (art.source) {
      const key = art.source.trim();
      srcFreq[key] = (srcFreq[key] || 0) + 1;
    }
    // Tags
    if (Array.isArray(art.tags)) {
      art.tags.forEach(t => {
        tagFreq[t] = (tagFreq[t] || 0) + 1;
      });
    }

    // Entidades de títulos (solo últimos 15 días)
    const limit15d = Date.now() - 15 * 24 * 3600 * 1000;
    const artTime = new Date(art.publishedAt).getTime();
    if (artTime > limit15d) {
      const entities = extractEntities(art.title);
      entities.forEach(e => {
        entityFreq[e] = (entityFreq[e] || 0) + 1;
      });
    }
  });

  const getTopEntries = (freq, limit, minCount = 1) => {
    return Object.entries(freq)
      .filter(([_, c]) => c >= minCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([label, count]) => ({ label, count }));
  };

  const suggestions = {
    categories: Object.entries(catFreq).map(([label, count]) => ({ label, count, type: 'category' })),
    subcategories: getTopEntries(subFreq, 60).map(s => ({ ...s, type: 'subcategory' })),
    tags: getTopEntries(tagFreq, 120, 2).filter(t => !catFreq[t.label]).map(t => ({ ...t, type: 'tag' })),
    sources: getTopEntries(srcFreq, 60, 2).map(s => ({ ...s, type: 'source' })),
    entities: getTopEntries(entityFreq, 80, 2).map(e => ({ ...e, type: 'entity' })),
    generatedAt: new Date().toISOString()
  };

  suggestions.suggestions = [
    ...suggestions.categories,
    ...suggestions.subcategories,
    ...suggestions.tags,
    ...suggestions.sources,
    ...suggestions.entities
  ];

  console.log(`[Buscador] Escribiendo sugerencias de autocompletado a ${outputSuggestionsPath}...`);
  writeJsonAtomic(outputSuggestionsPath, suggestions, false);

  console.log('=== Índices de Búsqueda Creados Exitosamente ===');
}

main().catch(err => {
  console.error('Error no capturado en generador de buscador:', err);
  process.exit(1);
});
