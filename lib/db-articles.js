import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { normalizeSlug } from './slug.js';

const dbPath = path.resolve('data/aidaily.db');

/**
 * Carga los artículos publicados directamente de la base de datos SQLite.
 */
export function getArticlesFromDb() {
  let allArticles = [];

  if (fs.existsSync(dbPath)) {
    try {
      const db = new DatabaseSync(dbPath);
      const stmt = db.prepare("SELECT * FROM articles WHERE status = 'publicada' ORDER BY publishedAt DESC");
      const rows = stmt.all();
      
      allArticles = rows.map(row => {
        const art = Object.assign({}, row);
        
        if (row.tags) {
          try {
            art.tags = JSON.parse(row.tags);
          } catch (_) {
            art.tags = [];
          }
        } else {
          art.tags = [];
        }

        if (row.hashtags) {
          try {
            art.hashtags = JSON.parse(row.hashtags);
          } catch (_) {
            art.hashtags = [];
          }
        } else {
          art.hashtags = [];
        }

        if (row.multimedia) {
          try {
            art.multimedia = JSON.parse(row.multimedia);
          } catch (_) {
            art.multimedia = [];
          }
        } else {
          art.multimedia = [];
        }

        if (!art.slug) {
          art.slug = normalizeSlug(art.title);
        }
        
        return art;
      });
    } catch (err) {
      console.error("Error al leer SQLite en db-articles.js:", err.message);
    }
  }

  // Fallback a articles-light si SQLite está vacío
  if (allArticles.length === 0) {
    try {
      const fallbackPath = path.resolve('src/data/articles-light.json');
      if (fs.existsSync(fallbackPath)) {
        allArticles = JSON.parse(fs.readFileSync(fallbackPath, 'utf-8'));
        allArticles.forEach(art => {
          if (!art.slug) art.slug = normalizeSlug(art.title);
        });
      }
    } catch (_) {}
  }

  return allArticles;
}
