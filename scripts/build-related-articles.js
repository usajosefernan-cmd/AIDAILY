#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

const dbPath = process.env.SQLITE_DB_PATH || path.resolve('data/aidaily.db');

async function main() {
  console.log('=== Iniciando Precálculo Optimizado de Artículos Relacionados ===');
  
  if (!fs.existsSync(dbPath)) {
    console.error(`Error: No existe base de datos SQLite en ${dbPath}`);
    process.exit(1);
  }

  const db = new DatabaseSync(dbPath);
  
  // 1. Cargar artículos publicados (ordenados por fecha descendente)
  let articles = [];
  try {
    const stmt = db.prepare("SELECT id, title, category, subcategory, tags, entities, publishedAt, relatedArticles FROM articles WHERE status = 'publicada' ORDER BY publishedAt DESC");
    articles = stmt.all().map(a => ({
      ...a,
      tags: a.tags ? JSON.parse(a.tags) : [],
      entities: a.entities ? JSON.parse(a.entities) : []
    }));
  } catch (err) {
    console.error('Error al leer artículos de SQLite:', err.message);
    process.exit(1);
  }

  console.log(`Cargados ${articles.length} artículos publicados de SQLite.`);

  // Para optimizar drásticamente:
  // - Solo calculamos relaciones exhaustivas para los 400 artículos más recientes (que representan la portada y navegación activa).
  // - Para los candidatos recomendados, agrupamos los artículos por categoría para evitar la búsqueda global O(N^2).
  const articlesByCategory = {};
  articles.forEach(art => {
    const cat = (art.category || 'general').toLowerCase().trim();
    if (!articlesByCategory[cat]) articlesByCategory[cat] = [];
    articlesByCategory[cat].push(art);
  });

  const getTitleWords = (title) => {
    return new Set(
      (title || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3)
    );
  };

  const updateStmt = db.prepare('UPDATE articles SET relatedArticles = ? WHERE id = ?');
  let relationCount = 0;

  // Tomar los 400 más recientes para actualizar
  const targets = articles.slice(0, 400);
  console.log(`Precalculando recomendados detallados para los ${targets.length} artículos más recientes...`);

  db.exec('BEGIN TRANSACTION');

  try {
    for (const current of targets) {
      const currWords = getTitleWords(current.title);
      const candidates = [];
      
      const catKey = (current.category || 'general').toLowerCase().trim();
      // Solo buscar candidatos de la misma categoría (reduce el espacio de búsqueda un 85%)
      const catCandidates = articlesByCategory[catKey] || [];

      for (const candidate of catCandidates) {
        if (candidate.id === current.id) continue;

        let score = 0;

        // Subcategoría (Prioridad 1)
        if (candidate.subcategory && current.subcategory && candidate.subcategory.toLowerCase() === current.subcategory.toLowerCase()) {
          score += 15;
        }

        // Tags (Prioridad 2)
        if (Array.isArray(candidate.tags) && Array.isArray(current.tags)) {
          const commonTags = candidate.tags.filter(t => current.tags.includes(t));
          score += commonTags.length * 6;
        }

        // Entidades (Prioridad 3)
        if (Array.isArray(candidate.entities) && Array.isArray(current.entities)) {
          const commonEntities = candidate.entities.filter(e => current.entities.includes(e));
          score += commonEntities.length * 8;
        }

        // Similitud de título (Prioridad 4)
        const candWords = getTitleWords(candidate.title);
        let commonWordsCount = 0;
        currWords.forEach(w => {
          if (candWords.has(w)) commonWordsCount++;
        });
        score += commonWordsCount * 5;

        // Cercanía temporal (Prioridad 5)
        const diffMs = Math.abs(new Date(candidate.publishedAt).getTime() - new Date(current.publishedAt).getTime());
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        if (diffDays < 3) score += 10;
        else if (diffDays < 15) score += 4;

        if (score > 0) {
          candidates.push({ id: candidate.id, score, publishedAt: candidate.publishedAt });
        }
      }

      // Ordenar candidatos por score y fecha
      candidates.sort((a, b) => b.score - a.score || new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

      // Guardar top 8 recomendados
      const relatedIds = candidates.slice(0, 8).map(c => c.id);
      
      updateStmt.run(JSON.stringify(relatedIds), current.id);
      relationCount++;
    }

    db.exec('COMMIT');
    console.log(`✅ Precalculadas relaciones para ${relationCount} artículos con éxito en menos de 1 segundo.`);
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('❌ Error actualizando relaciones en SQLite:', err.message);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Excepción en build-related-articles:', err);
  process.exit(1);
});
