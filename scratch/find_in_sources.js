import fs from 'fs';

const content = fs.readFileSync('src/lib/sources.ts', 'utf8');
const lines = content.split('\n');
console.log('Buscando "processCandidatesInParallel" en src/lib/sources.ts:');
lines.forEach((line, index) => {
  if (line.includes('processCandidatesInParallel')) {
    console.log(`Línea ${index + 1}: ${line.trim()}`);
  }
});
