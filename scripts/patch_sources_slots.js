import fs from 'fs';

const filePath = '/home/ubuntu/workspace/AIDAILY/src/lib/sources.ts';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `      // Asignar una ranura de hilo libre (thread_0 a thread_3)
      let mySlot = "";
      for (let idx = 0; idx < 4; idx++) {
        if (!runningThreads[\`thread_\${idx}\`]) {
          mySlot = \`thread_\${idx}\`;
          break;
        }
      }
      if (!mySlot) mySlot = "thread_extra_" + Math.random().toString(36).substring(2, 6);`;

const replacementStr = `      // Asignar una ranura de hilo libre dinámicamente
      let mySlot = "";
      for (let idx = 0; idx < 100; idx++) {
        if (!runningThreads[\`thread_\${idx}\`]) {
          mySlot = \`thread_\${idx}\`;
          break;
        }
      }
      if (!mySlot) mySlot = "thread_extra_" + Math.random().toString(36).substring(2, 6);`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacementStr);
  console.log('✅ Asignación de ranuras de hilos expandida a 100 con éxito.');
  fs.writeFileSync(filePath, content, 'utf8');
} else {
  console.warn('⚠️ No se encontró la declaración del bucle de 4 slots.');
}
