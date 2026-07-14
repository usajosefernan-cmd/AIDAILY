import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_PATH = path.resolve(__dirname, '../dist');

// Leer argumento --url
const args = process.argv.slice(2);
let targetUrl = null;
const urlArgIdx = args.findIndex(a => a.startsWith('--url='));
if (urlArgIdx !== -1) {
  targetUrl = args[urlArgIdx].split('=')[1];
} else {
  const urlIdx = args.indexOf('--url');
  if (urlIdx !== -1 && args[urlIdx + 1]) {
    targetUrl = args[urlIdx + 1];
  }
}

// Si la URL es "staging", intentaremos resolverla leyendo el canal preview de Firebase o usando el fallback de pecemi-staging.web.app
if (targetUrl === 'staging') {
  targetUrl = 'https://aidaily-staging.web.app/pro/aidaily';
  console.log(`ℹ️ Resolviendo alias de staging a: ${targetUrl}`);
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data, headers: res.headers }));
    }).on('error', err => reject(err));
  });
}

async function verifyLocalFiles() {
  console.log("\n📁 [Fase Local] Verificando existencia de archivos críticos en dist...");
  if (!fs.existsSync(DIST_PATH)) {
    console.error("❌ ERROR: El directorio 'dist' no existe. ¡Debes compilar el proyecto primero!");
    return false;
  }

  let success = true;
  const criticalFiles = ['index.html', 'api/articles-light.json', 'pro/aidaily/admin.html'];
  for (const file of criticalFiles) {
    if (fs.existsSync(path.join(DIST_PATH, file))) {
      console.log(`✅ Archivo crítico presente: ${file}`);
    } else {
      console.error(`❌ ERROR: Falta archivo crítico: ${file}`);
      success = false;
    }
  }

  // Verificar artículos e integridad
  try {
    const apiPath = path.join(DIST_PATH, 'api/articles-light.json');
    const articles = JSON.parse(fs.readFileSync(apiPath, 'utf-8'));
    console.log(`✅ API ligera local cargada con ${articles.length} artículos.`);
  } catch (err) {
    console.error(`❌ ERROR leyendo api/articles-light.json:`, err.message);
    success = false;
  }

  return success;
}

async function verifyRemoteUrl(baseUrl) {
  // Asegurar barra al final
  const cleanUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  console.log(`\n🌍 [Fase Remota] Iniciando testeo HTTP contra: ${cleanUrl}`);

  let success = true;

  // 1. Verificar que responde la home
  try {
    const home = await fetchUrl(cleanUrl);
    if (home.statusCode === 200) {
      console.log("✅ Home cargada con éxito (HTTP 200 OK).");
      if (home.body.includes('nyt-nav')) {
        console.log("✅ Menú de navegación detectado en el DOM remoto.");
      }
      if (home.body.includes('top-bar-date')) {
        console.log("✅ Marquesina del reloj detectada en el DOM remoto.");
      }
    } else {
      console.error(`❌ ERROR: La home respondió con HTTP ${home.statusCode}`);
      success = false;
    }
  } catch (err) {
    console.error(`❌ ERROR conectando con la home:`, err.message);
    return false;
  }

  // 2. Verificar API ligera y que no tenga redirección a HTML (200 OK y JSON real)
  const apiUrl = `${cleanUrl}api/articles-light.json`;
  let sampleSlug = '';
  try {
    const apiRes = await fetchUrl(apiUrl);
    if (apiRes.statusCode === 200) {
      const articles = JSON.parse(apiRes.body);
      if (Array.isArray(articles) && articles.length > 0) {
        console.log(`✅ API articles-light.json remota responde correctamente con ${articles.length} artículos.`);
        
        // Comprobar campos clave
        const art = articles[0];
        if (art.slug && art.title) {
          console.log(`   - Campo slug ('${art.slug}') y title ('${art.title}') validados en caliente.`);
          sampleSlug = art.slug;
        } else {
          console.error("❌ ERROR: Estructura del JSON ligera remota no tiene campos slug/title.");
          success = false;
        }
      } else {
        console.error("❌ ERROR: El JSON remoto de la API ligera no es un array válido o está vacío.");
        success = false;
      }
    } else {
      console.error(`❌ ERROR: La API ligera devolvió HTTP ${apiRes.statusCode}`);
      success = false;
    }
  } catch (err) {
    console.error(`❌ ERROR validando la API ligera remota:`, err.message);
    success = false;
  }

  // 3. Verificar que al menos un artículo estático abra
  if (sampleSlug) {
    const articleUrl = `${cleanUrl}noticias/${sampleSlug}/`;
    try {
      const artRes = await fetchUrl(articleUrl);
      if (artRes.statusCode === 200) {
        console.log(`✅ Artículo estático independiente cargado con éxito: noticias/${sampleSlug}/`);
        if (artRes.body.includes('editorial-related-container')) {
          console.log("✅ Componente 'RelatedArticles' (miniaturas relacionadas) presente en el HTML remoto.");
        } else {
          console.error("❌ ERROR: No se encontró el componente de miniaturas relacionadas en el HTML remoto.");
          success = false;
        }
      } else {
        console.error(`❌ ERROR: El artículo estático remoto devolvió HTTP ${artRes.statusCode}`);
        success = false;
      }
    } catch (err) {
      console.error(`❌ ERROR conectando con el artículo estático remoto:`, err.message);
      success = false;
    }
  }

  // 4. Verificar build-info.json
  const buildInfoUrl = `${cleanUrl}api/build-info.json`;
  try {
    const buildRes = await fetchUrl(buildInfoUrl);
    if (buildRes.statusCode === 200) {
      const info = JSON.parse(buildRes.body);
      console.log(`✅ Archivo build-info.json cargado: Hash: ${info.commitHash} | Time: ${info.buildTime} | Artículos: ${info.articlesCount}`);
    } else {
      console.warn(`⚠️ ADVERTENCIA: No se pudo obtener build-info.json (HTTP ${buildRes.statusCode}).`);
    }
  } catch (err) {
    console.warn(`⚠️ ADVERTENCIA: Falló petición a build-info.json:`, err.message);
  }

  return success;
}

async function verifyAll() {
  console.log("==================================================");
  console.log("🕵️‍♂️ AIDAILY INTEGRITY VERIFIER");
  console.log(`Fecha: ${new Date().toISOString()}`);
  console.log("==================================================");

  let success = true;

  if (targetUrl) {
    success = await verifyRemoteUrl(targetUrl);
  } else {
    success = await verifyLocalFiles();
  }

  console.log("\n==================================================");
  if (success) {
    console.log("🎉 ¡VERIFICACIÓN EXITOSA!");
    process.exit(0);
  } else {
    console.error("🚨 VERIFICACIÓN CON ERRORES. Revisa el log de arriba.");
    process.exit(1);
  }
}

verifyAll();
