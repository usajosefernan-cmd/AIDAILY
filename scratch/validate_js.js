import fs from 'fs';
import { Parser } from 'htmlparser2'; // Si no está disponible, usaremos una expresión regular
import vm from 'vm';

try {
  const html = fs.readFileSync('public/aidaily/index.html', 'utf-8');
  
  // Extraer el script principal utilizando una expresión regular simple
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let count = 0;
  
  while ((match = scriptRegex.exec(html)) !== null) {
    const code = match[1];
    count++;
    try {
      new vm.Script(code);
      console.log(`Script ${count}: Sintaxis OK (longitud: ${code.length})`);
    } catch (err) {
      console.error(`ERROR de sintaxis en el Script ${count}:`, err.message);
      // Imprimir el contexto del error si es posible
      const lines = code.split('\n');
      const lineMatch = err.stack.match(/evalmachine\.<anonymous>:(\d+)/);
      if (lineMatch) {
        const errorLine = parseInt(lineMatch[1]) - 1;
        console.error('Líneas alrededor del error:');
        for (let i = Math.max(0, errorLine - 5); i < Math.min(lines.length, errorLine + 6); i++) {
          console.error(`${i + 1}: ${lines[i]}`);
        }
      }
    }
  }
} catch (e) {
  console.error('Error al ejecutar el validador:', e);
}
