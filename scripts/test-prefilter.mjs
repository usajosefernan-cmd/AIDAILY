import fs from 'fs';
import path from 'path';

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
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value.trim();
      }
    });
  }
} catch (e) {}

import { processCandidatesInParallel } from '../src/lib/sources.js';

async function runPrefilterTest() {
  console.log('=== Iniciando Prueba de Pre-filtrado Ollama Local ===');
  
  const mockCandidates = [
    {
      title: "Google presenta un nuevo modelo de lenguaje de 1.5B optimizado para CPU",
      summary: "La división de IA de Google ha anunciado hoy una familia de modelos optimizados para chips locales que procesan texto a velocidades increíbles.",
      url: "https://example.com/google-light-model",
      feedCategory: "tecnologia",
      feedSubcategory: "ia"
    },
    {
      title: "Kim Kardashian lanza una nueva línea de ropa interior ecológica",
      summary: "La famosa empresaria y estrella de reality shows ha revelado su última colección de prendas sostenibles fabricadas con algodón orgánico.",
      url: "https://example.com/kim-k-sustainable-wear",
      feedCategory: "sociedad",
      feedSubcategory: "redes sociales"
    },
    {
      title: "Nuevas revelaciones sobre el caso de corrupción en el Ayuntamiento de la capital",
      summary: "Se filtran conversaciones telefónicas que implican a varios concejales en la adjudicación de contratos públicos de limpieza.",
      url: "https://example.com/corruption-capital-city",
      feedCategory: "nacional",
      feedSubcategory: "corrupcion"
    },
    {
      title: "Científicos descubren un nuevo exoplaneta habitable con telescopio James Webb",
      summary: "El telescopio de la NASA detecta atmósfera densa en un planeta a 40 años luz que podría albergar agua en estado líquido.",
      url: "https://example.com/exoplanet-jw-nasa",
      feedCategory: "ciencia",
      feedSubcategory: "espacio"
    },
    {
      title: "Ofertas increíbles de Black Friday: Compra el último iPhone con 40% de descuento",
      summary: "Descubre las mejores rebajas en tecnología y electrónica de consumo antes de que se agoten los stocks oficiales.",
      url: "https://example.com/black-friday-iphone-deals",
      feedCategory: "tecnologia",
      feedSubcategory: "software"
    }
  ];

  const cachedMap = new Map();
  const recentPublishedArticles = [];
  const needyCategories = [];
  const needySubcategories = []; // Ninguna subcategoría necesitada para forzar evaluación heurística + Ollama
  
  const result = await processCandidatesInParallel(
    mockCandidates,
    cachedMap,
    recentPublishedArticles,
    needyCategories,
    needySubcategories,
    { enableRelevanceFilter: true }, // Forzar filtro de relevancia
    5.0, // minRelevanceScore
    5 // concurrencyLimit
  );

  console.log('\n=== Candidatos Aprobados Finales ===');
  result.forEach(item => {
    console.log(`- [APROBADO] "${item.title}" (${item.feedCategory}/${item.feedSubcategory})`);
  });
  console.log(`Total Aprobados: ${result.length} de ${mockCandidates.length}`);
}

runPrefilterTest().catch(console.error);
