import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directorios de origen (dist) y destino (public en la raíz de hermes)
const distDir = path.resolve(__dirname, '../dist');
const sharedPublicDir = path.resolve(__dirname, '../../public/pro/aidaily'); // Carpeta public/pro/aidaily de hermes

const categories = [
  'ciencia', 'cultura', 'deportes', 'economia', 'estilo', 'gastronomia',
  'internacional', 'medioambiente', 'nacional', 'opinion', 'sociedad', 'tecnologia'
];

// Helper recursivo para copiar directorios
function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('=== Iniciando Propagación a la Raíz del Hosting ===');
console.log(`Origen (dist): ${distDir}`);
console.log(`Destino (public): ${sharedPublicDir}`);

const sourceIndex = path.join(distDir, 'index.html');
if (!fs.existsSync(sourceIndex)) {
  console.error(`ERROR: El archivo compilado de Astro no existe en: ${sourceIndex}. Ejecuta "npm run build" primero.`);
  process.exit(1);
}

// Asegurar directorio de destino
fs.mkdirSync(sharedPublicDir, { recursive: true });

const filesToCopy = [
  { src: 'index.html', dest: 'index.html' },
  { src: 'rss.xml', dest: 'rss.xml' },
  { src: 'archive/index.html', dest: 'archive/index.html' },
  { src: 'admin.html', dest: 'admin.html' },
  { src: 'aidaily/admin.html', dest: 'aidaily/admin.html' }
];

filesToCopy.forEach(f => {
  const srcPath = path.join(distDir, f.src);
  if (fs.existsSync(srcPath)) {
    const sharedDest = path.join(sharedPublicDir, f.dest);
    fs.mkdirSync(path.dirname(sharedDest), { recursive: true });
    fs.copyFileSync(srcPath, sharedDest);
    console.log(`[OK] Copiado ${f.src} a la raíz del hosting: public/${f.dest}`);
  }
});

// 2. Copiar carpetas por fecha y assets a la raíz de public
const entries = fs.readdirSync(distDir, { withFileTypes: true });
entries.forEach(entry => {
  if (entry.isDirectory() && entry.name !== 'archive') {
    const srcPath = path.join(distDir, entry.name);
    const sharedDestPath = path.join(sharedPublicDir, entry.name);
    copyDirSync(srcPath, sharedDestPath);
    console.log(`[OK] Copiado directorio recursivo a public/pro/aidaily/: ${entry.name}`);
  }
});

console.log('=== Propagación a la Raíz Finalizada con Éxito ===');
