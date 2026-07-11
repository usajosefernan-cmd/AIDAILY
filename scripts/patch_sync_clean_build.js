import fs from 'fs';

const filePath = '/home/ubuntu/workspace/AIDAILY/sync-aidaily.sh';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `(cd /opt/aidaily && BUILD_ONLY=true PUBLIC_BASE_PATH=/pro/aidaily npm run build)`;
const replacementStr = `(cd /opt/aidaily && rm -rf dist && BUILD_ONLY=true PUBLIC_BASE_PATH=/pro/aidaily npm run build)`;

if (content.includes(targetStr)) {
  content = content.replaceAll(targetStr, replacementStr);
  console.log('✅ Comando npm run build en sync-aidaily.sh adaptado para limpiar dist/ en cada intento.');
  fs.writeFileSync(filePath, content, 'utf8');
} else {
  console.warn('⚠️ No se encontró la firma clásica del build de Astro.');
}
