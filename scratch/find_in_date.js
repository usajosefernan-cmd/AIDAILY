import fs from 'fs';

const content = fs.readFileSync('src/pages/[date].astro', 'utf8');
const lines = content.split('\n');
console.log('Buscando "formatRelativeDate" en src/pages/[date].astro:');
lines.forEach((line, index) => {
  if (line.includes('formatRelativeDate')) {
    console.log(`Línea ${index + 1}: ${line.trim()}`);
  }
});
