import fs from 'fs';

const filePath = '/home/ubuntu/workspace/AIDAILY/sync-aidaily.sh';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `FORCE_BUILD=false
BUILD_ONLY=false`;

const replacementStr = `FORCE_BUILD=false
BUILD_ONLY=false
export NODE_OPTIONS="--max-old-space-size=8192"`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacementStr);
  console.log('✅ NODE_OPTIONS agregado a sync-aidaily.sh con éxito.');
  fs.writeFileSync(filePath, content, 'utf8');
} else {
  console.warn('⚠️ No se encontró FORCE_BUILD=false en sync-aidaily.sh.');
}
