import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import fs from 'node:fs';

const dbPath = process.env.SQLITE_DB_PATH || resolve('data/aidaily.db');

if (!fs.existsSync(dbPath)) {
  console.error(`[Error] No existe la base de datos en: ${dbPath}`);
  process.exit(1);
}

try {
  const db = new DatabaseSync(dbPath);
  
  // Lista de palabras no deseadas en deportes, política y moda
  const keywords = [
    'fútbol', 'futbol', 'champions', 'laliga', 'boxeo', 'tenis', 'wimbledon', 
    'medvedev', 'ciclismo', 'rugby', 'springboks', 'atletismo', 'juegos olímpicos', 
    'tour de france', 'mundial', 'ryder cup', 'fórmula 1', 'motogp', 
    'sanchez', 'feijoo', 'psoe', 'partido popular', 'podemos', 'vox', 'sumar', 
    'elecciones', 'parlamento', 'congreso', 'senado', 'ministro', 'diputados', 
    'moda', 'pasarela', 'diseñador', 'tendencias', 'boxeo', 'combate', 'ring'
  ];
  
  let updatedCount = 0;
  
  for (const kw of keywords) {
    const stmt = db.prepare("UPDATE articles SET status = 'descartada' WHERE status = 'publicada' AND (title LIKE ? OR summary LIKE ?)");
    const res = stmt.run('%' + kw + '%', '%' + kw + '%');
    updatedCount += res.changes;
  }
  
  console.log('==================================================');
  console.log('--- SANEAMIENTO SQLITE EN LA VPS COMPLETADO ---');
  console.log('Artículos basura marcados como descartados:', updatedCount);
  console.log('==================================================');
  process.exit(0);

} catch (err) {
  console.error('[Error] Falló la limpieza de SQLite:', err.message);
  process.exit(1);
}
