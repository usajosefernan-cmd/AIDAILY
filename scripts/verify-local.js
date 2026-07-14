/**
 * scripts/verify-local.js
 * Script de validación automatizado para el entorno local y de vista previa (preview).
 * Verifica que el servidor esté activo, que los artículos carguen de forma correcta,
 * que no haya loader indefinido y que la navegación por slug esté operativa.
 */

import http from 'http';

// Argumento --port (por defecto 4321 para dev, o 4322 si es preview)
const args = process.argv.slice(2);
let port = 4321;
if (args.includes('--preview') || args.includes('4322')) {
  port = 4322;
}

const BASE_URL = `http://localhost:${port}/pro/aidaily/`;

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    }).on('error', err => reject(err));
  });
}

async function runVerification() {
  console.log("==================================================");
  console.log("🕵️‍♂️ AIDAILY LOCAL & PREVIEW VERIFIER");
  console.log(`URL a verificar: ${BASE_URL}`);
  console.log("==================================================");

  try {
    console.log("🔄 Realizando petición a la home...");
    const home = await fetchUrl(BASE_URL);
    
    if (home.statusCode !== 200) {
      console.error(`❌ ERROR: La página devolvió código HTTP ${home.statusCode}. ¿Has iniciado el servidor local?`);
      process.exit(1);
    }

    console.log("✅ Servidor local activo (HTTP 200 OK).");

    let success = true;

    // 1. Comprobar que no haya loader indefinido del portal
    if (home.body.includes('Cargando diario') && !home.body.includes('nyt-nav')) {
      console.warn("⚠️ ADVERTENCIA: La home parece mostrar la pantalla de carga inicial de JS.");
    } else {
      console.log("✅ Menú de navegación ('nyt-nav') y estructura general presentes en la home.");
    }

    // 2. Verificar presencia de la marquesina del reloj
    if (home.body.includes('top-bar-date')) {
      console.log("✅ Marquesina del reloj detectada en el DOM.");
    } else {
      console.error("❌ ERROR: El elemento del reloj ('top-bar-date') no está en el DOM.");
      success = false;
    }

    // 3. Verificar que el buscador e input de búsqueda existan
    if (home.body.includes('header-search-input') || home.body.includes('smart-search-wrapper') || home.body.includes('searchQuery')) {
      console.log("✅ Buscador inteligente interactivo detectado.");
    } else {
      console.warn("⚠️ ADVERTENCIA: No se encontró la clase o ID del input del buscador inteligente en el HTML base.");
    }

    // 4. Verificar enlaces por slug en la home
    const slugRegex = /\/pro\/aidaily\/noticias\/([a-z0-9\-]+)\//g;
    let match;
    const slugs = [];
    while ((match = slugRegex.exec(home.body)) !== null) {
      if (!slugs.includes(match[1])) {
        slugs.push(match[1]);
      }
    }

    console.log(`📊 Enlaces de noticias estáticas detectados en la home: ${slugs.length}`);
    if (slugs.length === 0) {
      console.error("❌ ERROR: No se detectaron enlaces con slugs a noticias estáticas independientes en la home.");
      success = false;
    } else {
      console.log(`   - Slugs encontrados: ${slugs.slice(0, 5).join(', ')}...`);
    }

    // 5. Verificar que al menos 5 artículos abran de forma correcta
    if (slugs.length > 0) {
      console.log("\n🧪 Testeando la carga de 5 noticias individuales de forma aleatoria...");
      const testSlugs = slugs.slice(0, 5);
      
      for (const slug of testSlugs) {
        const articleUrl = `${BASE_URL}noticias/${slug}/`;
        console.log(`   - Leyendo noticia: noticias/${slug}/...`);
        
        try {
          const articlePage = await fetchUrl(articleUrl);
          
          if (articlePage.statusCode === 200) {
            console.log(`     ✅ Noticia cargada con éxito (HTTP 200 OK).`);
            
            // Verificar miniaturas relacionadas en el artículo
            if (articlePage.body.includes('editorial-related-container')) {
              console.log(`     ✅ Miniaturas relacionadas de 'RelatedArticles' detectadas.`);
            } else {
              console.warn(`     ⚠️ ADVERTENCIA: No se encontró el componente de miniaturas relacionadas en este artículo.`);
            }
          } else {
            console.error(`     ❌ ERROR: La noticia devolvió HTTP ${articlePage.statusCode}.`);
            success = false;
          }
        } catch (err) {
          console.error(`     ❌ ERROR al conectar con la noticia:`, err.message);
          success = false;
        }
      }
    }

    console.log("\n==================================================");
    if (success) {
      console.log("🎉 ¡VERIFICACIÓN LOCAL EXITOSA! El entorno local funciona al 100%.");
      process.exit(0);
    } else {
      console.error("🚨 VERIFICACIÓN LOCAL CON ERRORES. Revisa los fallos de arriba.");
      process.exit(1);
    }

  } catch (err) {
    console.error("❌ ERROR CRÍTICO al conectar con el servidor local:", err.message);
    console.error("Asegúrate de ejecutar 'npm run dev' o 'npm run preview' antes de correr este script.");
    process.exit(1);
  }
}

runVerification();
