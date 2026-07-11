#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

/**
 * Script de validación de sintaxis e integridad para los archivos de datos JSON de AIDAILY.
 * Previene que fallos de guardado o JSON corruptos rompan el build de Astro.
 */

const filesToValidate = [
  { name: 'news.json', path: 'data/news.json', required: false },
  { name: 'cache-news.json', path: 'src/data/cache-news.json', required: false },
  { name: 'hot-topics.json', path: 'data/hot-topics.json', required: false },
  { name: 'breaking-news.json', path: 'data/breaking-news.json', required: false }
];

const REQUIRED_FIELDS = ['id', 'title', 'url', 'publishedAt', 'category'];

function log(msg) {
  console.log(`[Validator] ${msg}`);
}

function logError(msg) {
  console.error(`[Validator] [ERROR] ${msg}`);
}

function validateFile(fileConfig) {
  const resolvedPath = path.resolve(fileConfig.path);
  
  if (!fs.existsSync(resolvedPath)) {
    if (fileConfig.required) {
      logError(`Archivo obligatorio no encontrado: ${fileConfig.path}`);
      return false;
    }
    log(`Archivo opcional omitido (no existe aún): ${fileConfig.path}`);
    return true;
  }

  try {
    const rawContent = fs.readFileSync(resolvedPath, 'utf-8');
    if (!rawContent.trim()) {
      logError(`El archivo está vacío: ${fileConfig.path}`);
      return false;
    }

    const data = JSON.parse(rawContent);
    
    // Si no es un array, no es válido para nuestro flujo de artículos
    if (!Array.isArray(data)) {
      logError(`El contenido de ${fileConfig.path} no es un array.`);
      return false;
    }

    log(`Validando ${data.length} artículos en ${fileConfig.path}...`);

    for (let i = 0; i < data.length; i++) {
      const art = data[i];
      
      // Comprobar campos obligatorios
      for (const field of REQUIRED_FIELDS) {
        if (!art[field]) {
          logError(`Artículo en índice ${i} en ${fileConfig.path} no contiene el campo requerido: "${field}".`);
          return false;
        }
      }

      // Validar formato de fecha básica
      const parsedDate = new Date(art.publishedAt);
      if (isNaN(parsedDate.getTime())) {
        logError(`Artículo "${art.title}" (ID: ${art.id}) tiene una fecha inválida: "${art.publishedAt}".`);
        return false;
      }
    }

    log(`✅ ${fileConfig.name} es sintácticamente válido y estructurado.`);
    return true;

  } catch (err) {
    logError(`Fallo de parseo JSON en ${fileConfig.path}: ${err.message}`);
    return false;
  }
}

function run() {
  log("Iniciando validación de integridad de datos...");
  let allOk = true;
  
  let validatedAtLeastOne = false;

  for (const fileConfig of filesToValidate) {
    const ok = validateFile(fileConfig);
    if (!ok) {
      allOk = false;
    }
    if (fs.existsSync(path.resolve(fileConfig.path))) {
      validatedAtLeastOne = true;
    }
  }

  if (!validatedAtLeastOne) {
    log("Advertencia: No se encontró ningún archivo de datos para validar. Continuando...");
  }

  if (allOk) {
    log("✅ Todos los archivos de datos aprobados con éxito.");
    process.exit(0);
  } else {
    logError("❌ Fallo en la integridad o sintaxis de los datos. Abortando.");
    process.exit(1);
  }
}

run();
