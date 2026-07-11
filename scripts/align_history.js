async function main() {
  console.log('[Align History] Iniciando alineación retroactiva...');
  
  // 1. Descargar config de feeds
  let feedsMap = {};
  try {
    const feedsRes = await fetch('https://pecemi-default-rtdb.firebaseio.com/aidaily/config/feeds.json');
    if (feedsRes.ok) {
      const feedsData = await feedsRes.json();
      if (feedsData && typeof feedsData === 'object') {
        Object.entries(feedsData).forEach(([cat, list]) => {
          if (Array.isArray(list)) {
            list.forEach(f => {
              if (f.url) {
                feedsMap[f.url.trim()] = {
                  category: cat,
                  subcategory: (f.tags && f.tags[0]) ? f.tags[0].trim() : 'General'
                };
              }
            });
          }
        });
        console.log(`[Align History] Cargadas ${Object.keys(feedsMap).length} URLs de feeds.`);
      }
    }
  } catch (e) {
    console.error('[Align History] Error cargando feeds:', e.message);
    process.exit(1);
  }

  // 2. Descargar artículos existentes
  let articles = {};
  try {
    const artRes = await fetch('https://pecemi-default-rtdb.firebaseio.com/aidaily/articles.json');
    if (artRes.ok) {
      articles = await artRes.json();
      console.log(`[Align History] Descargados ${Object.keys(articles).length} artículos.`);
    }
  } catch (e) {
    console.error('[Align History] Error cargando artículos:', e.message);
    process.exit(1);
  }

  if (!articles || Object.keys(articles).length === 0) {
    console.log('[Align History] No hay artículos para alinear.');
    return;
  }

  // 3. Alinear
  let alignedCount = 0;
  Object.values(articles).forEach(art => {
    if (art.sourceUrl && feedsMap[art.sourceUrl.trim()]) {
      const mapped = feedsMap[art.sourceUrl.trim()];
      if (art.category !== mapped.category || art.subcategory !== mapped.subcategory) {
        art.category = mapped.category;
        art.subcategory = mapped.subcategory;
        alignedCount++;
      }
    }
  });

  console.log(`[Align History] Alineados ${alignedCount} artículos de forma retroactiva.`);

  // 4. Subir a Firebase
  const payload = {
    security_token: 'pecemi_secure_gateway_token_2026_xyz',
    articles: articles
  };

  try {
    const writeRes = await fetch('https://pecemi-default-rtdb.firebaseio.com/aidaily.json', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (writeRes.ok) {
      console.log('[SUCCESS] Alineación del historial subida correctamente a Firebase.');
    } else {
      console.error(`[Error] Falló la subida: ${writeRes.status}`);
    }
  } catch (e) {
    console.error('[Align History] Error subiendo alineación:', e.message);
  }
}

main();
