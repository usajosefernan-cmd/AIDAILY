import fs from 'fs';

const filePath = '/home/ubuntu/workspace/AIDAILY/src/lib/sources.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Reemplazar el bloque catch de la rotación
const oldCatch =     } catch (e: any) {
      console.warn(\[Rotación IA] Error en llamada a \ con modelo \:\, e.message || e);
    };

const newCatch =     } catch (e: any) {
      console.warn(\[Rotación IA] Error en llamada a \ con modelo \:\, e.message || e);
      const errMsg = (e.message || '').toLowerCase();
      const isRateOrTimeout = errMsg.includes('429') ||
                              errMsg.includes('rate limit') ||
                              errMsg.includes('timeout') ||
                              errMsg.includes('aborted') ||
                              errMsg.includes('reintentos') ||
                              errMsg.includes('limit') ||
                              errMsg.includes('quota') ||
                              errMsg.includes('exhausted') ||
                              errMsg.includes('funds') ||
                              errMsg.includes('balance') ||
                              errMsg.includes('unauthorized') ||
                              errMsg.includes('key');
      if (isRateOrTimeout) {
        console.error(\[Rotación IA] Desactivando proveedor  \ globalmente por error de red/rate-limit persistente en catch.\);
        rateLimitedProvidersGlobal.add(provider);
      }
    };

if (content.includes(oldCatch)) {
  content = content.replace(oldCatch, newCatch);
  console.log('✅ Bloque catch de la rotación reemplazado con éxito.');
} else {
  console.warn('⚠️ No se encontró el bloque catch antiguo de la rotación o ya fue modificado.');
}

// 2. Reemplazar cloudUnavailable
const oldCloudUnavailable =         const cloudUnavailable = rateLimitedProvidersGlobal.has('nous') && 
                                  rateLimitedProvidersGlobal.has('gemini') && 
                                  rateLimitedProvidersGlobal.has('huggingface');;

const newCloudUnavailable =         const cloudUnavailable = (rateLimitedProvidersGlobal.has('nous') || !nous || !nous.access_token) && 
                                  (rateLimitedProvidersGlobal.has('gemini') || !googleApiKey) && 
                                  (rateLimitedProvidersGlobal.has('openrouter') || rateLimitedProvidersGlobal.size >= 3);;

if (content.includes(oldCloudUnavailable)) {
  content = content.replace(oldCloudUnavailable, newCloudUnavailable);
  console.log('✅ Variable cloudUnavailable reemplazada con éxito.');
} else {
  console.warn('⚠️ No se encontró la definición antigua de cloudUnavailable o ya fue modificada.');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Parchado finalizado.');
