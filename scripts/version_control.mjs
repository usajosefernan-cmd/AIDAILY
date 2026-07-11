import fs from 'fs';
import path from 'path';

const PROJECT_DIR = process.cwd();
const DIST_DIR = path.resolve('dist');

console.log(`[VersionControl] Iniciando auditoría de integridad en: ${DIST_DIR}`);

// 1. Obtener versión desde package.json
let version = '1.0.0';
try {
  const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf-8'));
  version = pkg.version || '1.0.0';
  console.log(`[VersionControl] Versión del proyecto detectada: v${version}`);
} catch (e) {
  console.warn('[VersionControl] No se pudo leer package.json. Usando fallback v1.0.0');
}

// 2. Comprobaciones de existencia de directorios clave
if (!fs.existsSync(DIST_DIR)) {
  console.error(`[VersionControl] ❌ ERROR: El directorio de salida 'dist/' no existe.`);
  process.exit(1);
}

// 3. Buscar recursivamente todos los archivos HTML y verificar sus recursos de assets
function getFilesRecursively(dir, extension) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(fullPath, extension));
    } else if (file.endsWith(extension)) {
      results.push(fullPath);
    }
  });
  return results;
}

const htmlFiles = getFilesRecursively(DIST_DIR, '.html');
console.log(`[VersionControl] Encontrados ${htmlFiles.length} archivos HTML para auditar.`);

let integrityOk = true;
const errors = [];

// Analizar recursos en cada HTML
htmlFiles.forEach(htmlPath => {
  const relativeHtmlPath = path.relative(DIST_DIR, htmlPath);
  const content = fs.readFileSync(htmlPath, 'utf-8');

  // Buscar URLs de estilos (href="...")
  const cssRegex = /href="([^"]+\.css)"/g;
  let match;
  while ((match = cssRegex.exec(content)) !== null) {
    const cssUrl = match[1];
    
    // Omitir enlaces externos
    if (cssUrl.startsWith('http://') || cssUrl.startsWith('https://') || cssUrl.startsWith('//')) {
      continue;
    }

    // Traducir ruta absoluta/relativa a ruta física
    let localPath = cssUrl;
    if (cssUrl.startsWith('/pro/aidaily/')) {
      localPath = cssUrl.replace('/pro/aidaily/', '');
    } else if (cssUrl.startsWith('/')) {
      localPath = cssUrl.substring(1);
    }
    
    const fullLocalPath = path.join(DIST_DIR, localPath);
    if (!fs.existsSync(fullLocalPath)) {
      integrityOk = false;
      const msg = `HTML '${relativeHtmlPath}' referencia CSS inexistente: ${cssUrl} (Físico: ${fullLocalPath})`;
      errors.push(msg);
      console.error(`[VersionControl] ❌ ${msg}`);
    }
  }

  // Buscar URLs de scripts (src="...")
  const jsRegex = /src="([^"]+\.js)"/g;
  while ((match = jsRegex.exec(content)) !== null) {
    const jsUrl = match[1];
    
    if (jsUrl.startsWith('http://') || jsUrl.startsWith('https://') || jsUrl.startsWith('//')) {
      continue;
    }

    let localPath = jsUrl;
    if (jsUrl.startsWith('/pro/aidaily/')) {
      localPath = jsUrl.replace('/pro/aidaily/', '');
    } else if (jsUrl.startsWith('/')) {
      localPath = jsUrl.substring(1);
    }

    const fullLocalPath = path.join(DIST_DIR, localPath);
    if (!fs.existsSync(fullLocalPath)) {
      integrityOk = false;
      const msg = `HTML '${relativeHtmlPath}' referencia JS inexistente: ${jsUrl} (Físico: ${fullLocalPath})`;
      errors.push(msg);
      console.error(`[VersionControl] ❌ ${msg}`);
    }
  }
});

if (integrityOk) {
  console.log(`[VersionControl] ✅ Control de integridad de assets aprobado sin errores.`);
  process.exit(0);
} else {
  console.error(`[VersionControl] ❌ CONTROL DE INTEGRIDAD FALLIDO: Se encontraron ${errors.length} assets rotos.`);
  process.exit(1);
}
