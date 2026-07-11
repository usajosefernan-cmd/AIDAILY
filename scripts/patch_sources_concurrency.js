import fs from 'fs';

const filePath = '/home/ubuntu/workspace/AIDAILY/src/lib/sources.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Definir la parte a buscar y reemplazar para la cabecera
const oldHeader = `  const batchToProcess = itemsToProcessFromQueue;
  console.log(\`[Cola] Iniciando procesamiento con IA en paralelo de \${batchToProcess.length} artículos (concurrencia: 4)...\`);
  
  let completedCount = 0;
  const runningThreads: Record<string, any> = {};

  await runWithConcurrencyLimit(
    batchToProcess,
    async (queueItem) => {`;

const newHeader = `  const batchToProcess = itemsToProcessFromQueue;
  const nousTokenForConcurrency = getNousToken();
  const isCloudUnavailableForConcurrency = (rateLimitedProvidersGlobal.has('nous') || !nousTokenForConcurrency || !nousTokenForConcurrency.access_token) && 
                                           (rateLimitedProvidersGlobal.has('gemini') || !process.env.GOOGLE_API_KEY) && 
                                           (rateLimitedProvidersGlobal.has('openrouter') || rateLimitedProvidersGlobal.size >= 3);
  const isCpuTimeoutRiskForConcurrency = isCloudUnavailableForConcurrency && (batchToProcess.length > 10);
  const concurrencyToUse = isCpuTimeoutRiskForConcurrency ? 40 : 4;
  console.log(\`[Cola] Iniciando procesamiento con IA en paralelo de \${batchToProcess.length} artículos (concurrencia dinámica: \${concurrencyToUse})...\`);
  
  let completedCount = 0;
  const runningThreads: Record<string, any> = {};

  await runWithConcurrencyLimit(
    batchToProcess,
    async (queueItem) => {`;

// Reemplazar cabecera
if (content.includes(oldHeader)) {
  content = content.replace(oldHeader, newHeader);
  console.log('✅ Cabecera reemplazada con éxito.');
} else {
  console.warn('⚠️ No se encontró el fragmento de la cabecera de procesamiento de cola.');
}

// Definir la parte a buscar y reemplazar para el final
const oldFooter = `      } finally {
        delete runningThreads[mySlot];
        const currentIdx = completedCount;
        const progress = Math.round((currentIdx / batchToProcess.length) * 100);
        await updateVpsExecutionStatus(5, "Procesamiento con IA", \`Noticia \${currentIdx}/\${batchToProcess.length} finalizada.\`, progress, "", runningThreads);
      }
    },
    4
  );`;

const newFooter = `      } finally {
        delete runningThreads[mySlot];
        const currentIdx = completedCount;
        const progress = Math.round((currentIdx / batchToProcess.length) * 100);
        await updateVpsExecutionStatus(5, "Procesamiento con IA", \`Noticia \${currentIdx}/\${batchToProcess.length} finalizada.\`, progress, "", runningThreads);
      }
    },
    concurrencyToUse
  );`;

// Reemplazar pie
if (content.includes(oldFooter)) {
  content = content.replace(oldFooter, newFooter);
  console.log('✅ Pie reemplazado con éxito.');
} else {
  console.warn('⚠️ No se encontró el fragmento del pie de procesamiento de cola.');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Parchado de concurrencia dinámica finalizado.');
