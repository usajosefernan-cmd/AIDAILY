import fs from 'fs';

const filePath = '/home/ubuntu/workspace/AIDAILY/src/lib/sources.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Reemplazar la definición de runWithConcurrencyLimit
const oldFunc = `async function runWithConcurrencyLimit<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  limit: number
): Promise<R[]> {
  const results: Promise<R>[] = [];
  const executing: Promise<any>[] = [];
  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item));
    results.push(p);
    if (limit <= items.length) {
      const e: Promise<any> = p.finally(() => {
        const idx = executing.indexOf(e);
        if (idx !== -1) executing.splice(idx, 1);
      });
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }
  // Capturar errores individuales para que un fallo en un elemento de la cola
  // no aborte ni deje sin resolver el resto de promesas paralelas
  return Promise.all(results.map(p => p.catch(() => undefined)) as any);
}`;

const newFunc = `async function runWithConcurrencyLimit<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  limit: number | (() => number)
): Promise<R[]> {
  const results: Promise<R>[] = [];
  const executing: Promise<any>[] = [];
  for (const item of items) {
    const currentLimit = typeof limit === 'function' ? limit() : limit;
    const p = Promise.resolve().then(() => fn(item));
    results.push(p);
    if (currentLimit <= items.length) {
      const e: Promise<any> = p.finally(() => {
        const idx = executing.indexOf(e);
        if (idx !== -1) executing.splice(idx, 1);
      });
      executing.push(e);
      if (executing.length >= currentLimit) {
        await Promise.race(executing);
      }
    }
  }
  // Capturar errores individuales para que un fallo en un elemento de la cola
  // no aborte ni deje sin resolver el resto de promesas paralelas
  return Promise.all(results.map(p => p.catch(() => undefined)) as any);
}`;

if (content.includes(oldFunc)) {
  content = content.replace(oldFunc, newFunc);
  console.log('✅ Función runWithConcurrencyLimit modificada para soportar límites dinámicos.');
} else {
  console.warn('⚠️ No se encontró la definición exacta de runWithConcurrencyLimit.');
}

// 2. Reemplazar la cabecera del procesamiento de la cola
const oldHeader = `  const batchToProcess = itemsToProcessFromQueue;
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

const newHeader = `  const batchToProcess = itemsToProcessFromQueue;
  console.log(\`[Cola] Iniciando procesamiento con IA en paralelo de \${batchToProcess.length} artículos (concurrencia dinámica adaptativa activa)...\`);
  
  let completedCount = 0;
  const runningThreads: Record<string, any> = {};

  await runWithConcurrencyLimit(
    batchToProcess,
    async (queueItem) => {`;

if (content.includes(oldHeader)) {
  content = content.replace(oldHeader, newHeader);
  console.log('✅ Cabecera de procesamiento de cola simplificada.');
} else {
  console.warn('⚠️ No se encontró la cabecera vieja de procesamiento de cola.');
}

// 3. Reemplazar el pie de la llamada a runWithConcurrencyLimit
const oldFooter = `      } finally {
        delete runningThreads[mySlot];
        const currentIdx = completedCount;
        const progress = Math.round((currentIdx / batchToProcess.length) * 100);
        await updateVpsExecutionStatus(5, "Procesamiento con IA", \`Noticia \${currentIdx}/\${batchToProcess.length} finalizada.\`, progress, "", runningThreads);
      }
    },
    concurrencyToUse
  );`;

const newFooter = `      } finally {
        delete runningThreads[mySlot];
        const currentIdx = completedCount;
        const progress = Math.round((currentIdx / batchToProcess.length) * 100);
        await updateVpsExecutionStatus(5, "Procesamiento con IA", \`Noticia \${currentIdx}/\${batchToProcess.length} finalizada.\`, progress, "", runningThreads);
      }
    },
    () => {
      const nousTokenForConcurrency = getNousToken();
      const isCloudUnavailableForConcurrency = (rateLimitedProvidersGlobal.has('nous') || !nousTokenForConcurrency || !nousTokenForConcurrency.access_token) && 
                                               (rateLimitedProvidersGlobal.has('gemini') || !process.env.GOOGLE_API_KEY) && 
                                               (rateLimitedProvidersGlobal.has('openrouter') || rateLimitedProvidersGlobal.size >= 3);
      const isCpuTimeoutRiskForConcurrency = isCloudUnavailableForConcurrency && ((batchToProcess.length - completedCount) > 10);
      return isCpuTimeoutRiskForConcurrency ? 40 : 4;
    }
  );`;

if (content.includes(oldFooter)) {
  content = content.replace(oldFooter, newFooter);
  console.log('✅ Callback de concurrencia dinámica integrado en el pie con éxito.');
} else {
  console.warn('⚠️ No se encontró el pie viejo de procesamiento de cola.');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Parchado de límite dinámico finalizado.');
