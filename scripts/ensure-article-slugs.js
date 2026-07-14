#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { normalizeSlug } from '../lib/slug.js';
import { writeJsonAtomic } from '../lib/atomic-write.js';

const dbPath = process.env.SQLITE_DB_PATH || path.resolve('data/aidaily.db');

async function main() {
  console.log('=== Iniciando Saneamiento y Migración de Slugs Estables ===');
  
  if (!fs.existsSync(dbPath)) {
    console.error(`Error: No existe base de datos SQLite en ${dbPath}`);
    process.exit(1);
  }

  const db = new DatabaseSync(dbPath);
  
  // 1. Cargar todos los artículos
  let articles = [];
  try {
    const stmt = db.prepare('SELECT id, title, slug, status FROM articles');
    articles = stmt.all();
  } catch (err) {
    console.error('Error al leer artículos de SQLite:', err.message);
    process.exit(1);
  }

  console.log(`Leídos ${articles.length} artículos totales de la base de datos.`);

  let articles_without_slug_before = 0;
  let slugs_created = 0;
  let slug_collisions_fixed = 0;
  let invalid_articles = 0;
  
  const usedSlugs = new Set();
  const updateList = [];

  // Recorrido de artículos para detectar slugs asignados previamente
  articles.forEach(art => {
    if (art.slug) {
      usedSlugs.add(art.slug);
    }
  });

  // Asignar slugs
  articles.forEach(art => {
    if (!art.title || art.title.trim() === '') {
      invalid_articles++;
      return;
    }

    let needsUpdate = false;
    let finalSlug = art.slug;

    if (!finalSlug) {
      articles_without_slug_before++;
      finalSlug = normalizeSlug(art.title);
      if (!finalSlug) finalSlug = 'noticia';
      needsUpdate = true;
      slugs_created++;
    }

    // Resolver colisión de slug en memoria
    if (needsUpdate && usedSlugs.has(finalSlug)) {
      const shortId = art.id ? art.id.substring(Math.max(0, art.id.length - 6)) : Math.random().toString(36).substring(2, 8);
      finalSlug = `${finalSlug}-${shortId}`;
      slug_collisions_fixed++;
    }

    if (needsUpdate) {
      usedSlugs.add(finalSlug);
      updateList.push({ id: art.id, slug: finalSlug });
    }
  });

  // 2. Guardar slugs asignados en SQLite en una transacción atómica
  if (updateList.length > 0) {
    console.log(`Actualizando ${updateList.length} artículos en SQLite con sus nuevos slugs estáticos...`);
    try {
      const updateStmt = db.prepare('UPDATE articles SET slug = ? WHERE id = ?');
      
      // Ejecutar de forma transaccional
      db.exec('BEGIN TRANSACTION');
      for (const item of updateList) {
        updateStmt.run(item.slug, item.id);
      }
      db.exec('COMMIT');
      console.log('✅ Base de datos SQLite actualizada correctamente.');
    } catch (err) {
      db.exec('ROLLBACK');
      console.error('❌ Error al actualizar slugs en SQLite:', err.message);
      process.exit(1);
    }
  } else {
    console.log('Todos los artículos ya cuentan con un slug único y estable en SQLite.');
  }

  // 3. Sincronizar con los archivos JSON de caché para que no haya desalineación en el build
  const cacheFiles = [
    { name: 'news.json', path: path.resolve('data/news.json') },
    { name: 'cache-news.json', path: path.resolve('src/data/cache-news.json') }
  ];

  cacheFiles.forEach(fileConfig => {
    if (fs.existsSync(fileConfig.path)) {
      try {
        const raw = fs.readFileSync(fileConfig.path, 'utf-8');
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          let updatedCount = 0;
          
          // Crear mapa rápido de slugs desde SQLite
          const slugMap = new Map();
          try {
            const stmt = db.prepare('SELECT id, slug FROM articles');
            stmt.all().forEach(row => slugMap.set(row.id, row.slug));
          } catch (_) {}

          const updatedList = list.map(art => {
            const dbSlug = slugMap.get(art.id);
            if (dbSlug && art.slug !== dbSlug) {
              updatedCount++;
              return { ...art, slug: dbSlug };
            }
            if (!art.slug && art.title) {
              const fallbackSlug = normalizeSlug(art.title);
              updatedCount++;
              return { ...art, slug: fallbackSlug };
            }
            return art;
          });

          if (updatedCount > 0) {
            writeJsonAtomic(fileConfig.path, updatedList, false);
            console.log(`✅ Sincronizado ${fileConfig.name} (${updatedCount} artículos actualizados con slugs).`);
          }
        }
      } catch (err) {
        console.warn(`[Warning] No se pudo sincronizar ${fileConfig.name}:`, err.message);
      }
    }
  });

  // Conteo de listos para rutas
  let articles_ready_for_routes = 0;
  try {
    const readyCount = db.prepare("SELECT COUNT(*) as cnt FROM articles WHERE status = 'publicada' AND slug IS NOT NULL").get();
    articles_ready_for_routes = readyCount ? readyCount.cnt : 0;
  } catch (_) {}

  // Reporte final estructurado solicitado
  console.log('\n======================================');
  console.log('--- REPORTE DE MIGRACIÓN DE SLUGS ---');
  console.log(`total_articles: ${articles.length}`);
  console.log(`articles_without_slug_before: ${articles_without_slug_before}`);
  console.log(`slugs_created: ${slugs_created}`);
  console.log(`slug_collisions_fixed: ${slug_collisions_fixed}`);
  console.log(`invalid_articles: ${invalid_articles}`);
  console.log(`articles_ready_for_routes: ${articles_ready_for_routes}`);
  console.log('======================================\n');
}

main().catch(err => {
  console.error('Error en migrador de slugs:', err);
  process.exit(1);
});
