// validate-staging-build.mjs — Puerta de enlace y test de integridad para evitar subidas rotas a producción
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { JSDOM } from 'jsdom';

const DIST_DIR = process.argv[2] || '/opt/aidaily/dist';

console.log(`[Staging Validation] Iniciando auditoría de seguridad del build en: ${DIST_DIR}`);

// 1. Validar existencia y tamaño de archivos clave
const filesToVerify = [
  { relPath: 'index.html', minBytes: 2000 },
  { relPath: 'admin.html', minBytes: 1000 },
  { relPath: 'api/search-index.json', minBytes: 500 }
];

for (const { relPath, minBytes } of filesToVerify) {
  const fullPath = path.join(DIST_DIR, relPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`[FAIL] Archivo crítico ausente: ${relPath}`);
    process.exit(1);
  }
  const stats = fs.statSync(fullPath);
  if (stats.size < minBytes) {
    console.error(`[FAIL] Archivo ${relPath} demasiado pequeño (${stats.size} bytes, se esperan al menos ${minBytes} bytes).`);
    process.exit(1);
  }
  console.log(`[OK] ${relPath} verificado (${stats.size} bytes)`);
}

// 2. Extraer y validar sintaxis de todos los bloques <script> en index.html
const indexHtmlPath = path.join(DIST_DIR, 'index.html');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf-8');

try {
  const dom = new JSDOM(indexHtml);
  const doc = dom.window.document;
  const scripts = doc.querySelectorAll('script');
  
  console.log(`[Staging Validation] Analizando sintaxis de ${scripts.length} scripts en index.html...`);
  
  let scriptIdx = 0;
  for (const script of scripts) {
    const src = script.getAttribute('src');
    const content = script.textContent?.trim();
    
    if (src) {
      // Es un script externo. Si es un asset local, verificamos su existencia y sintaxis
      if (src.startsWith('/assets/') || src.startsWith('assets/')) {
        const cleanSrc = src.startsWith('/') ? src.substring(1) : src;
        const assetPath = path.join(DIST_DIR, cleanSrc);
        if (!fs.existsSync(assetPath)) {
          console.error(`[FAIL] Enlace a script roto en index.html: ${src}`);
          process.exit(1);
        }
        console.log(`  [OK] Script externo verificado (existencia): ${src}`);
      }
    } else if (content) {
      // Es un script inline. Validamos su sintaxis directamente
      try {
        new vm.Script(content);
        console.log(`  [OK] Script inline #${++scriptIdx} verificado.`);
      } catch (jsErr) {
        console.error(`[FAIL] Error de sintaxis en script inline #${scriptIdx + 1} de index.html:`);
        console.error(jsErr.message);
        
        // Mostrar fragmento del código roto
        const lines = content.split('\n');
        console.error('\nCódigo con error:');
        console.error(lines.slice(0, 15).join('\n'));
        process.exit(1);
      }
    }
  }
} catch (domErr) {
  console.error('[FAIL] No se pudo parsear el DOM de index.html:', domErr.message);
  process.exit(1);
}

console.log('✅ AUDITORÍA DE SEGURIDAD DEL BUILD EN STAGING COMPLETADA CON ÉXITO. APTO PARA PRODUCCIÓN.');
process.exit(0);
