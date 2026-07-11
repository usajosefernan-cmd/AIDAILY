import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dateAstroPath = path.join(__dirname, '..', 'src', 'pages', '[date].astro');

if (!fs.existsSync(dateAstroPath)) {
  console.error(`Error: No se encontró [date].astro en ${dateAstroPath}`);
  process.exit(1);
}

const content = fs.readFileSync(dateAstroPath, 'utf8');
const lines = content.split('\n');

console.log(`Líneas totales originales: ${lines.length}`);

// Queremos buscar el primer bloque <script> que empieza alrededor de la línea 219
// y termina con </script> antes del modal de hashtags alrededor de la línea 2904.
// Para ser precisos, busquemos el primer "<script>" y su correspondiente "</script>".

let firstScriptStart = -1;
let firstScriptEnd = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === '<script>') {
    firstScriptStart = i;
    break;
  }
}

if (firstScriptStart !== -1) {
  for (let i = firstScriptStart + 1; i < lines.length; i++) {
    if (lines[i].trim() === '</script>') {
      firstScriptEnd = i;
      break;
    }
  }
}

if (firstScriptStart !== -1 && firstScriptEnd !== -1) {
  console.log(`Encontrado primer script redundante de línea ${firstScriptStart + 1} a la ${firstScriptEnd + 1}`);
  
  // Eliminar esas líneas (excluyendo el script, o reemplazándolo por un pequeño script vacío o comentario)
  const prefix = lines.slice(0, firstScriptStart);
  const suffix = lines.slice(firstScriptEnd + 1);
  
  // Dejamos un comentario html en su lugar
  const comment = ['  <!-- Primer script redundante (duplicado de index.astro) eliminado en v2.1 -->'];
  const newLines = [...prefix, ...comment, ...suffix];
  
  fs.writeFileSync(dateAstroPath, newLines.join('\n'), 'utf8');
  console.log(`[OK] Script redundante eliminado. Nuevas líneas totales: ${newLines.length}`);
} else {
  console.error('Error: No se pudo identificar el primer bloque de script.');
}
