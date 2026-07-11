import fs from 'fs';

const filePath = '/home/ubuntu/workspace/AIDAILY/scripts/sync-firebase.mjs';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `// Timeout de seguridad global de 15 minutos para evitar que el proceso se quede colgado indefinidamente
const GLOBAL_TIMEOUT_MS = 15 * 60 * 1000;
setTimeout(() => {
  console.error(\`[CRITICAL] Timeout global del scraper alcanzado (\${GLOBAL_TIMEOUT_MS / 60000} minutos). Forzando salida con código de error para liberar el bloqueo.\`);
  process.exit(1);
}, GLOBAL_TIMEOUT_MS).unref(); // .unref() permite que Node finalice si no hay otras tareas pendientes`;

const replacementStr = `// Obtener argumentos pasados
const args = process.argv.slice(2);
const isForce = args.includes('--force') || args.includes('-f');

// Timeout de seguridad global (60 minutos para sincronización forzada, 15 minutos para cron normal)
const GLOBAL_TIMEOUT_MS = isForce ? 60 * 60 * 1000 : 15 * 60 * 1000;
setTimeout(() => {
  console.error(\`[CRITICAL] Timeout global del scraper alcanzado (\${GLOBAL_TIMEOUT_MS / 60000} minutos). Forzando salida con código de error para liberar el bloqueo.\`);
  process.exit(1);
}, GLOBAL_TIMEOUT_MS).unref(); // .unref() permite que Node finalice si no hay otras tareas pendientes`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacementStr);
  console.log('✅ Timeout global de seguridad adaptado dinámicamente según --force con éxito.');
  fs.writeFileSync(filePath, content, 'utf8');
} else {
  console.warn('⚠️ No se encontró la definición estática del timeout global.');
}
