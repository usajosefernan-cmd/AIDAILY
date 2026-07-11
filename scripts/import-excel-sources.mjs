#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const excelPath = fs.existsSync('./directorio_fuentes.xlsx') ? './directorio_fuentes.xlsx' : '/home/ubuntu/workspace/AIDAILY/directorio_fuentes.xlsx';
const jsonOutputPath = './src/data/feeds_from_excel.json';
const dbUrl = 'https://pecemi-default-rtdb.firebaseio.com/aidaily/config/feeds.json';

// Cargar variables de entorno del .env
try {
  const envPath = path.resolve('.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split(/\r?\n/).forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value.trim();
      }
    });
  }
} catch (e) {}

// Mapeo tolerante y robusto de las categorías generales del Excel a claves internas limpias
function mapExcelCategoryToInternal(rawCat) {
  if (!rawCat) return 'tecnologia';
  const clean = String(rawCat).toLowerCase().trim();
  
  if (clean.includes('internacional') || clean.includes('geopolitica') || clean.includes('geopolitica')) {
    return 'internacional';
  }
  if (clean.includes('nacional') || clean.includes('politica') || clean.includes('politica')) {
    return 'nacional';
  }
  if (clean.includes('economia') || clean.includes('economia') || clean.includes('finanzas')) {
    return 'economia';
  }
  if (clean.includes('tecnologia') || clean.includes('tecnologia') || clean.includes('digital') || clean.includes('tech') || clean.includes('era')) {
    return 'tecnologia';
  }
  if (clean.includes('ciencia') || clean.includes('salud')) {
    return 'ciencia';
  }
  if (clean.includes('medio') || clean.includes('ambiente') || clean.includes('clima')) {
    return 'medioambiente';
  }
  if (clean.includes('cultura') || clean.includes('entretenimiento')) {
    return 'cultura';
  }
  if (clean.includes('estilo')) {
    return 'estilo';
  }
  if (clean.includes('sociedad')) {
    return 'sociedad';
  }
  if (clean.includes('gastronomia') || clean.includes('gastronomia')) {
    return 'gastronomia';
  }
  if (clean.includes('deporte') || clean.includes('deportes')) {
    return 'deportes';
  }
  
  return 'tecnologia'; // Fallback por defecto
}

async function main() {
  console.log(`[Import Excel] Leyendo Excel en: ${excelPath}...`);
  if (!fs.existsSync(excelPath)) {
    console.error(`[Error] No se encontró el archivo Excel en ${excelPath}`);
    process.exit(1);
  }

  try {
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    console.log(`[Import Excel] Encontradas ${data.length} filas en la hoja "${sheetName}". Procesando...`);

    const feedsByCategory = {};
    let count = 0;

    data.forEach((row, idx) => {
      // Mapear nombres de columnas de forma insensible a acentos y mayúsculas
      let nombre = '';
      let url = '';
      let rawCategory = '';
      let rawSubcategory = 'General';
      let rawPriority = 2.0;

      Object.keys(row).forEach(key => {
        const normKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const val = String(row[key] || '').trim();

        if (normKey.includes('nombre de la fuente') || normKey === 'nombre' || normKey === 'medio') {
          nombre = val;
        } else if (normKey.includes('handle') || normKey.includes('enlace') || normKey.includes('api target') || normKey === 'url' || normKey === 'feed') {
          url = val;
        } else if (normKey.includes('categoria general') || normKey === 'categoria') {
          rawCategory = val;
        } else if (normKey.includes('subcategoria independiente') || normKey === 'subcategoria') {
          rawSubcategory = val;
        } else if (normKey.includes('prioridad')) {
          rawPriority = parseFloat(row[key]) || 2.0;
        }
      });

      if (!nombre || !url || !url.startsWith('http')) {
        return;
      }

      // Normalizar categoría general
      const internalCat = mapExcelCategoryToInternal(rawCategory);

      const feedConfig = {
        name: nombre,
        url: url,
        category: 'news', // Interno del scraper
        tags: [rawSubcategory], // Guardamos la subcategoría en tags[0]
        priority: rawPriority
      };

      if (!feedsByCategory[internalCat]) {
        feedsByCategory[internalCat] = [];
      }

      feedsByCategory[internalCat].push(feedConfig);
      count++;
    });

    console.log(`[Import Excel] Procesados ${count} feeds válidos coordinadamente.`);

    // 1. Guardar localmente
    const outDir = path.dirname(jsonOutputPath);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    fs.writeFileSync(jsonOutputPath, JSON.stringify(feedsByCategory, null, 2), 'utf8');
    console.log(`[Import Excel] Guardado JSON localmente en: ${jsonOutputPath}`);

    // 2. Subir a Firebase Realtime Database con token de seguridad
    console.log(`[Import Excel] Subiendo feeds a Firebase RTDB...`);
    const dbPatchUrl = 'https://pecemi-default-rtdb.firebaseio.com/aidaily.json';
    const payload = {
      security_token: 'pecemi_secure_gateway_token_2026_xyz',
      'config/feeds': feedsByCategory
    };
    
    const response = await fetch(dbPatchUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log(`[SUCCESS] Sincronización exitosa con Firebase. Las ${count} fuentes del Excel ya están coordinadas.`);
    } else {
      const errText = await response.text();
      console.error(`[Error] Falló la subida a Firebase: ${response.status} - ${errText}`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`[Error] Error crítico importando Excel:`, err);
    process.exit(1);
  }
}

main();
