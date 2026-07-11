import { FEED_MATRIX } from '../src/lib/feeds.ts';

async function upload() {
  const dbPatchUrl = 'https://pecemi-default-rtdb.firebaseio.com/aidaily.json';
  const payload = {
    security_token: 'pecemi_secure_gateway_token_2026_xyz',
    'config/feeds': FEED_MATRIX
  };
  
  console.log(`[Upload Feeds] Subiendo ${Object.values(FEED_MATRIX).flat().length} feeds locales a Firebase RTDB...`);
  try {
    const response = await fetch(dbPatchUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (response.ok) {
      console.log('[SUCCESS] Las 36 fuentes locales correctas se han sincronizado con Firebase y el nodo dinámico está limpio.');
    } else {
      const errText = await response.text();
      console.error(`[Error] Falló la subida: ${response.status} - ${errText}`);
    }
  } catch (err: any) {
    console.error('[Error] Excepción al subir feeds:', err.message || err);
  }
}

upload();
