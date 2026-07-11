import fs from 'fs';

const filePath = '/home/ubuntu/workspace/AIDAILY/src/lib/sources.ts';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 5000); // 5 segundos de timeout estricto para evitar deadlocks con Firebase`;

const replacementStr = `  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 15000); // 15 segundos de timeout para evitar aborts falsos en cargas paralelas altas con Firebase`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacementStr);
  console.log('✅ Timeout de firebaseFetch aumentado a 15 segundos.');
  fs.writeFileSync(filePath, content, 'utf8');
} else {
  console.warn('⚠️ No se encontró la declaración del timeout de 5 segundos.');
}
