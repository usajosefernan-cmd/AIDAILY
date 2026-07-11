import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.resolve(__dirname, '../public');

console.log(`=== Iniciando limpieza de archivos basura en ${publicDir} ===`);

if (!fs.existsSync(publicDir)) {
  console.error(`ERROR: El directorio public no existe en: ${publicDir}`);
  process.exit(1);
}

// 1. Borrar carpetas de fechas (formato YYYY-MM-DD) y carpetas específicas
const dateFolderRegex = /^\d{4}-\d{2}-\d{2}$/;
const foldersToDelete = ['aidaily']; // carpetas específicas a borrar

const entries = fs.readdirSync(publicDir, { withFileTypes: true });

entries.forEach(entry => {
  const fullPath = path.join(publicDir, entry.name);
  
  if (entry.isDirectory()) {
    const isDateFolder = dateFolderRegex.test(entry.name);
    const isTargetFolder = foldersToDelete.includes(entry.name);
    
    if (isDateFolder || isTargetFolder) {
      console.log(`[DELETE] Borrando carpeta recursivamente: ${entry.name}`);
      fs.rmSync(fullPath, { recursive: true, force: true });
    }
  } else if (entry.isFile()) {
    // 2. Borrar archivos específicos de la raíz de public/
    const filesToDelete = ['index.html', 'rss.xml'];
    if (filesToDelete.includes(entry.name)) {
      console.log(`[DELETE] Borrando archivo: ${entry.name}`);
      fs.unlinkSync(fullPath);
    }
  }
});

console.log('=== Limpieza de la carpeta public local finalizada con éxito ===');
