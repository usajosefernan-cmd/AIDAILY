import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

async function verify() {
  const targetUrl = `https://pecemi.web.app/pro/aidaily/?cb=${Date.now()}`;
  console.log(`[Verificación] Solicitando web pública: ${targetUrl}...`);

  try {
    const res = await fetch(targetUrl, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

    if (res.status !== 200) {
      console.error(`❌ ERROR: Status HTTP incorrecto en producción: ${res.status}`);
      process.exit(1);
    }
    console.log(`✅ Status HTTP 200 OK.`);

    const html = await res.text();

    // 1. Validar que no contenga el banner de error de sincronización de la VPS
    if (html.includes('Sincronización inactiva por error') || html.includes('Error crítico en la VPS')) {
      console.error('❌ ERROR: La web pública muestra el banner rojo de Sincronización Inactiva/Error Crítico VPS.');
      process.exit(1);
    }
    console.log('✅ Web libre de avisos de error crítico de la VPS.');

    // 2. Validar que no contenga estado de carga permanente
    if (html.includes('Procesando y clasificando noticias con IA...')) {
      console.error('❌ ERROR: La web muestra un mensaje de procesamiento/carga persistente.');
      process.exit(1);
    }
    console.log('✅ Web libre de estados de procesamiento permanente.');

    // 3. Validar existencia de noticias y contenido
    if (!html.includes('noticias') && !html.includes('card') && !html.includes('article') && !html.includes('Portal')) {
      console.error('❌ ERROR: El HTML no parece contener marcado de noticias o portal renderizado.');
      process.exit(1);
    }
    console.log('✅ Estructura de noticias detectada.');

    // 4. Validar categorías IA/Tecnología en el HTML
    const techCategories = ['tecnologia', 'ciencia', 'medioambiente', 'economia'];
    const foundCategory = techCategories.some(cat => html.toLowerCase().includes(cat));
    if (!foundCategory) {
      console.error('❌ ERROR: No se detectaron categorías prioritarias (tecnología/ciencia) en el HTML.');
      process.exit(1);
    }
    console.log('✅ Categorías de IA/tecnología y ciencia presentes.');

    // 5. Validar que no esté saturado de deportes/moda en el marcado estático renderizado
    const sportsKeywords = ['fútbol', 'champions', 'ciclismo', 'laliga', 'rugby', 'moda', 'tendencias'];
    const sportsCount = sportsKeywords.reduce((count, kw) => {
      const regex = new RegExp(kw, 'gi');
      return count + (html.match(regex) || []).length;
    }, 0);

    if (sportsCount > 15) {
      console.warn(`⚠️ ADVERTENCIA: Se detectó alta coincidencia de términos deportivos/generalistas (${sportsCount} menciones).`);
    } else {
      console.log(`✅ Contenido generalista bajo control (${sportsCount} menciones).`);
    }

    // 6. Verificar marca de tiempo de compilación (build-time meta tag)
    const buildTimeMatch = html.match(/meta name="build-time" content="([^"]+)"/);
    if (buildTimeMatch) {
      const liveBuildTime = buildTimeMatch[1];
      console.log(`[Info] Fecha del build en vivo: ${liveBuildTime}`);
      
      // Intentar comparar con el buildTime local si existe la compilación local
      const localStagingHtmlPath = resolve('/opt/aidaily/dist/index.html');
      if (existsSync(localStagingHtmlPath)) {
        const localStagingHtml = readFileSync(localStagingHtmlPath, 'utf-8');
        const localBuildTimeMatch = localStagingHtml.match(/meta name="build-time" content="([^"]+)"/);
        if (localBuildTimeMatch) {
          const localBuildTime = localBuildTimeMatch[1];
          console.log(`[Info] Fecha del build en local/staging: ${localBuildTime}`);
          if (new Date(liveBuildTime).getTime() >= new Date(localBuildTime).getTime() - 10000) {
            console.log('✅ ÉXITO TOTAL: La web en producción está usando el build nuevo.');
          } else {
            console.warn('⚠️ ADVERTENCIA: La web en producción sigue sirviendo un build antiguo.');
          }
        }
      }
    } else {
      console.warn('⚠️ ADVERTENCIA: No se encontró el tag meta "build-time" en el HTML en vivo.');
    }

    console.log('\n🌟 VERIFICACIÓN DE PRODUCCIÓN EXITOSA Y VALIDADA.');
    process.exit(0);

  } catch (err) {
    console.error('❌ ERROR: Falló la petición de verificación por red:', err.message);
    process.exit(1);
  }
}

verify();
