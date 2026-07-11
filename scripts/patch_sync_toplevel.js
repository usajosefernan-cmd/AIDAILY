import fs from 'fs';

const filePath = '/home/ubuntu/workspace/AIDAILY/scripts/sync-firebase.mjs';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `await sync();`;

const replacementStr = `sync()
  .then(() => {
    console.log('[Firebase Sync] Proceso completado exitosamente.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[Firebase Sync] Excepción global no capturada en la ejecución:', err);
    process.exit(1);
  });`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacementStr);
  console.log('✅ Top-level await en sync-firebase.mjs envuelto en then/catch con éxito.');
  fs.writeFileSync(filePath, content, 'utf8');
} else {
  console.warn('⚠️ No se encontró la llamada await sync(); al final del archivo.');
}
