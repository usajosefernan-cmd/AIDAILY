import fs from 'fs';

const filePath = '/home/ubuntu/workspace/AIDAILY/src/lib/sources.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Reemplazar la definición incorrecta de cloudUnavailable por una con getNousToken()
const oldCloudUnavailable = `        const cloudUnavailable = (rateLimitedProvidersGlobal.has('nous') || !nous || !nous.access_token) && 
                                  (rateLimitedProvidersGlobal.has('gemini') || !googleApiKey) && 
                                  (rateLimitedProvidersGlobal.has('openrouter') || rateLimitedProvidersGlobal.size >= 3);`;

const newCloudUnavailable = `        const nousToken = getNousToken();
        const cloudUnavailable = (rateLimitedProvidersGlobal.has('nous') || !nousToken || !nousToken.access_token) && 
                                  (rateLimitedProvidersGlobal.has('gemini') || !googleApiKey) && 
                                  (rateLimitedProvidersGlobal.has('openrouter') || rateLimitedProvidersGlobal.size >= 3);`;

if (content.includes(oldCloudUnavailable)) {
  content = content.replace(oldCloudUnavailable, newCloudUnavailable);
  console.log('✅ Variable cloudUnavailable con getNousToken() corregida con éxito.');
} else {
  // Intentar reemplazar desde la definición original por si acaso
  const originalCloudUnavailable = `        const cloudUnavailable = rateLimitedProvidersGlobal.has('nous') && 
                                  rateLimitedProvidersGlobal.has('gemini') && 
                                  rateLimitedProvidersGlobal.has('huggingface');`;
  if (content.includes(originalCloudUnavailable)) {
    content = content.replace(originalCloudUnavailable, newCloudUnavailable);
    console.log('✅ Variable original cloudUnavailable reemplazada directamente.');
  } else {
    console.warn('⚠️ No se encontró la definición de cloudUnavailable.');
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Parchado finalizado.');
