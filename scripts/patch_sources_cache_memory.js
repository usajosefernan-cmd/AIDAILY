import fs from 'fs';

const filePath = '/home/ubuntu/workspace/AIDAILY/src/lib/sources.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Declarar variables globales de caché en memoria antes de fetchAllNews
const targetGlobal = `export async function fetchAllNews(): Promise<NewsItem[]> {`;
const replacementGlobal = `let globalCacheInMemory: any[] | null = null;
let writeMutexPromise = Promise.resolve();

export async function fetchAllNews(): Promise<NewsItem[]> {`;

if (!content.includes('let globalCacheInMemory: any[] | null = null;')) {
  content = content.replace(targetGlobal, replacementGlobal);
}

// 2. Cargar caché del disco a globalCacheInMemory en fetchAllNews
const targetLoad = `  let cachedItems: NewsItem[] = [];
  if (fs.existsSync(cachePath)) {
    try {
      const cacheContent = fs.readFileSync(cachePath, 'utf-8');
      const rawCached = JSON.parse(cacheContent);
      cachedItems = rawCached.map((item: any) => {`;

const replacementLoad = `  let cachedItems: NewsItem[] = [];
  if (fs.existsSync(cachePath)) {
    try {
      const cacheContent = fs.readFileSync(cachePath, 'utf-8');
      const rawCached = JSON.parse(cacheContent);
      globalCacheInMemory = rawCached; // Cargar en el búfer global de memoria
      cachedItems = rawCached.map((item: any) => {`;

if (content.includes(targetLoad)) {
  content = content.replace(targetLoad, replacementLoad);
}

// 3. Optimizar el bloque del guardado de caché en el worker loop
const targetSave = `        // 1. Guardar de forma incremental en el disco local de la VPS para evitar pérdidas
        try {
          const incrementalCachePath = path.resolve('src/data/cache-news.json');
          let localCacheList: any[] = [];
          if (fs.existsSync(incrementalCachePath)) {
            const currentCacheContent = fs.readFileSync(incrementalCachePath, 'utf-8');
            try {
              localCacheList = JSON.parse(currentCacheContent);
              if (!Array.isArray(localCacheList)) localCacheList = [];
            } catch (_) {}
          }
          // Evitar duplicados por URL en la caché incremental
          localCacheList = localCacheList.filter(item => item && item.url !== newsItem.url);
          localCacheList.unshift(newsItem); // Insertar al inicio (más reciente)
          // Ordenar por fecha descendente
          localCacheList.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
          
          fs.writeFileSync(incrementalCachePath, JSON.stringify(localCacheList, null, 2), 'utf-8');
          console.log(\`[Caché Incremental] Guardado con éxito en disco local. Total en caché: \${localCacheList.length}\`);
        } catch (diskErr: any) {
          console.error('[Caché Incremental] Error al guardar caché local incremental:', diskErr.message || diskErr);
        }`;

const replacementSave = `        // 1. Guardar de forma incremental en memoria y encolar escritura física a disco
        try {
          if (!globalCacheInMemory) {
            const incrementalCachePath = path.resolve('src/data/cache-news.json');
            if (fs.existsSync(incrementalCachePath)) {
              try {
                const currentCacheContent = fs.readFileSync(incrementalCachePath, 'utf-8');
                globalCacheInMemory = JSON.parse(currentCacheContent);
              } catch (_) {
                globalCacheInMemory = [];
              }
            } else {
              globalCacheInMemory = [];
            }
          }
          
          if (!Array.isArray(globalCacheInMemory)) {
            globalCacheInMemory = [];
          }

          // Actualizar el búfer en memoria de forma segura y síncrona
          globalCacheInMemory = globalCacheInMemory.filter((item: any) => item && item.url !== newsItem.url);
          globalCacheInMemory.unshift(newsItem);
          globalCacheInMemory.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

          const totalInCache = globalCacheInMemory.length;
          
          // Encolar escritura física secuencial usando mutex para evitar bloqueos y race conditions
          writeMutexPromise = writeMutexPromise.then(async () => {
            try {
              const incrementalCachePath = path.resolve('src/data/cache-news.json');
              fs.writeFileSync(incrementalCachePath, JSON.stringify(globalCacheInMemory, null, 2), 'utf-8');
            } catch (diskErr: any) {
              console.error('[Caché Incremental] Error de escritura física en disco:', diskErr.message || diskErr);
            }
          });

          console.log(\`[Caché Incremental] Guardado con éxito en memoria y encolado en disco. Total: \${totalInCache}\`);
        } catch (memErr: any) {
          console.error('[Caché Incremental] Error al gestionar la caché global en memoria:', memErr.message || memErr);
        }`;

if (content.includes(targetSave)) {
  content = content.replace(targetSave, replacementSave);
  console.log('✅ Sistema de caché incremental optimizado en memoria RAM con éxito.');
  fs.writeFileSync(filePath, content, 'utf8');
} else {
  console.warn('⚠️ No se encontró el bloque clásico de guardado incremental de caché.');
}
