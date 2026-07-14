/**
 * scripts/deploy-local.js
 * Script de despliegue local que copia el build de Astro a la carpeta pública de Firebase
 * de la Workspace padre (../../public/pro/aidaily) y ejecuta el deploy a staging o producción.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_DIR = path.resolve(__dirname, '../dist');
const TARGET_DIR = path.resolve(__dirname, '../../public/pro/aidaily');

const args = process.argv.slice(2);
const isProd = args.includes('--prod') || args.includes('production');

// Función de copia recursiva
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

async function deploy() {
  console.log("==================================================");
  console.log("🚀 INICIANDO DESPLIEGUE LOCAL DE AIDAILY");
  console.log(`Origen (dist): ${DIST_DIR}`);
  console.log(`Destino (public/pro/aidaily): ${TARGET_DIR}`);
  console.log(`Modo: ${isProd ? 'PRODUCCIÓN' : 'STAGING/PREVIEW'}`);
  console.log("==================================================");

  // 1. Validar que la carpeta dist/ exista
  if (!fs.existsSync(DIST_DIR)) {
    console.error("❌ ERROR: La carpeta dist/ no existe. Ejecuta 'npm run build:safe' primero.");
    process.exit(1);
  }

  // 2. Limpiar carpeta de destino (con tolerancia a fallos por bloqueos de Windows)
  try {
    if (fs.existsSync(TARGET_DIR)) {
      console.log("🧹 Limpiando carpeta de destino anterior...");
      try {
        fs.rmSync(TARGET_DIR, { recursive: true, force: true });
      } catch (rmErr) {
        console.warn("⚠️ Advertencia al borrar destino, procediendo con sobreescritura directa:", rmErr.message);
      }
    }
    fs.mkdirSync(TARGET_DIR, { recursive: true });
  } catch (err) {
    console.warn("⚠️ Advertencia al asegurar carpeta de destino:", err.message);
  }

  // 3. Copiar recursivamente
  try {
    console.log("📂 Copiando archivos compilados de Astro...");
    copyRecursiveSync(DIST_DIR, TARGET_DIR);
    console.log("✅ Copia de archivos completada con éxito.");
  } catch (err) {
    console.error("❌ ERROR al copiar archivos:", err.message);
    process.exit(1);
  }

  // 4. Copiar de forma explícita articles-light.json a public/pro/aidaily/api/articles-light.json
  const lightSrc = path.resolve(__dirname, '../src/data/articles-light.json');
  const lightDest = path.join(TARGET_DIR, 'api/articles-light.json');
  try {
    if (fs.existsSync(lightSrc)) {
      console.log("📦 Asegurando copia de articles-light.json en el directorio público...");
      fs.mkdirSync(path.dirname(lightDest), { recursive: true });
      fs.copyFileSync(lightSrc, lightDest);
      console.log("✅ articles-light.json copiado.");
    }
  } catch (err) {
    console.warn("⚠️ ADVERTENCIA al copiar articles-light.json:", err.message);
  }

  // 5. Ejecutar comando de deploy de Firebase
  try {
    let command = '';
    if (isProd) {
      console.log("🚀 Desplegando en VIVO a Producción (Firebase Hosting)...");
      command = 'npx firebase deploy --only hosting --project pecemi';
    } else {
      console.log("🚀 Desplegando en el Canal Staging (Firebase Preview)...");
      command = 'npx firebase hosting:channel:deploy aidaily-staging --expires 7d --project pecemi';
    }

    console.log(`💻 Ejecutando: ${command}`);
    // Ejecutar en el directorio padre donde está ubicado firebase.json
    const parentDir = path.resolve(__dirname, '../..');
    const output = execSync(command, { cwd: parentDir, encoding: 'utf-8' });
    console.log(output);
    console.log("🎉 ¡DESPLIEGUE COMPLETADO CON ÉXITO!");
  } catch (err) {
    console.error("❌ ERROR durante el deploy de Firebase:", err.message);
    if (err.stdout) console.log(err.stdout);
    if (err.stderr) console.error(err.stderr);
    process.exit(1);
  }
}

deploy();
