#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cachePath = path.resolve(__dirname, '../src/data/cache-news.json');
const firebaseDbUrl = 'https://pecemi-default-rtdb.firebaseio.com/aidaily/articles.json';

async function downloadCache() {
  console.log('=== Iniciando Descarga de Caché desde Firebase RTDB ===');
  console.log(`URL origen: ${firebaseDbUrl}`);
  console.log(`Destino local: ${cachePath}`);

  try {
    const res = await fetch(firebaseDbUrl);
    if (!res.ok) {
      throw new Error(`Error en la petición HTTP: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    if (!data) {
      console.warn('¡Atención!: La base de datos de Firebase RTDB parece estar vacía o no retornó datos.');
      return;
    }

    // Convertir objeto de artículos a un array y normalizar id
    const articlesArray = Object.entries(data).map(([key, val]) => {
      return {
        ...val,
        id: val.id || key
      };
    });

    // Ordenar los artículos por fecha de publicación descendente (los más recientes primero)
    const sortedArticles = articlesArray.sort((a, b) => {
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });

    // Asegurar que el directorio de destino existe
    const dir = path.dirname(cachePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Escribir archivo de caché formateado
    fs.writeFileSync(cachePath, JSON.stringify(sortedArticles, null, 2), 'utf-8');

    console.log(`[OK] Descargados y ordenados ${sortedArticles.length} artículos.`);
    if (sortedArticles.length > 0) {
      console.log(`Artículo más reciente: "${sortedArticles[0].title}" (${sortedArticles[0].publishedAt})`);
    }
    console.log('=== Proceso finalizado con éxito ===');
  } catch (error) {
    console.error('ERROR crítico al descargar la caché de noticias:', error);
    process.exit(1);
  }
}

downloadCache();
