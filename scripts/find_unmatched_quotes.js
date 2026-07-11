import fs from 'fs';

const filePath = '/home/ubuntu/workspace/AIDAILY/sync-aidaily.sh';
const lines = fs.readFileSync(filePath, 'utf8').split('\n');

let inSingleQuotes = false;
let singleQuoteStartLine = -1;
let singleQuoteStartChar = -1;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  let cleanLine = '';
  let escaped = false;
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '#' && !inSingleQuotes) {
      break; // Comentario en Bash
    }
    if (char === "'") {
      inSingleQuotes = !inSingleQuotes;
      if (inSingleQuotes) {
        singleQuoteStartLine = i + 1;
        singleQuoteStartChar = j + 1;
      } else {
        singleQuoteStartLine = -1;
        singleQuoteStartChar = -1;
      }
    }
  }
}

if (inSingleQuotes) {
  console.log(`❌ Comilla simple abierta sin cerrar encontrada en la línea ${singleQuoteStartLine}, carácter ${singleQuoteStartChar}:`);
  console.log(`> ${lines[singleQuoteStartLine - 1]}`);
} else {
  console.log('✅ Todas las comillas simples parecen estar balanceadas.');
}
