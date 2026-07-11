import crypto from 'crypto';

function normalizeCategoryAndSubcategory(rawCategory, rawSubcategory) {
  const CATEGORY_MAP = {
    internacional: ['europa', 'america', 'asia', 'global', 'geopolitica'],
    nacional: ['politica', 'sociedad', 'justicia', 'economia nacional', 'comunidades', 'corrupcion'],
    economia: ['mercados', 'finanzas', 'empresas', 'macroeconomia', 'empleo', 'negocios'],
    opinion: ['editorial', 'columnas', 'analisis', 'debates'],
    tecnologia: ['ia', 'software', 'gadgets', 'inteligencia artificial', 'hardware', 'startups', 'ciberseguridad', 'videojuegos'],
    ciencia: ['espacio', 'salud', 'biologia', 'salud y medicina', 'biotecnologia', 'fisica', 'descubrimientos', 'astronomia'],
    medioambiente: ['clima', 'sostenibilidad', 'ecologia', 'energias renovables', 'biodiversidad', 'economia circular'],
    cultura: ['cine', 'musica', 'literatura', 'arte', 'teatro', 'series'],
    deportes: ['futbol/1', 'futbol/2', 'futbol', 'baloncesto', 'motor', 'tenis', 'ciclismo', 'polideportivo'],
    estilo: ['bienestar', 'viajes', 'tendencias', 'moda', 'hogar'],
    sociedad: ['educacion', 'sanidad', 'derechos humanos', 'igualdad', 'redes sociales', 'meteorologia'],
    gastronomia: ['recetas', 'restaurantes', 'nutricion', 'vinos', 'cocina']
  };

  let cat = String(rawCategory || 'tecnologia').toLowerCase().trim();
  cat = cat.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  if (cat === 'medio ambiente') cat = 'medioambiente';
  if (cat === 'tecnologia' || cat === 'it' || cat === 'tech') cat = 'tecnologia';
  if (cat === 'opinion' || cat === 'editorial') cat = 'opinion';
  
  if (!CATEGORY_MAP[cat]) {
    cat = 'tecnologia';
  }

  let sub = String(rawSubcategory || 'General').trim();
  let subNorm = sub.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (subNorm.includes('/')) {
    if (subNorm.startsWith(cat + '/')) {
      subNorm = subNorm.substring(cat.length + 1);
    }
    return { category: cat, subcategory: subNorm };
  }

  // Normalizar términos específicos a sus rutas correspondientes
  if (cat === 'deportes') {
    if (subNorm.includes('futbol') || subNorm.includes('fútbol') || subNorm.includes('liga')) {
      if (subNorm.includes('segunda') || subNorm.includes('ascenso') || subNorm.includes('2')) {
        return { category: 'deportes', subcategory: 'futbol/2' };
      }
      if (subNorm.includes('femenino') || subNorm.includes('femenina')) {
        return { category: 'deportes', subcategory: 'futbol/femenino' };
      }
      return { category: 'deportes', subcategory: 'futbol/laliga' };
    }
    if (subNorm.includes('ciclismo')) return { category: 'deportes', subcategory: 'ciclismo' };
    if (subNorm.includes('motor') || subNorm.includes('f1') || subNorm.includes('formula') || subNorm.includes('gp') || subNorm.includes('moto')) {
      if (subNorm.includes('motogp') || subNorm.includes('moto gp') || subNorm.includes('moto')) return { category: 'deportes', subcategory: 'motor/motogp' };
      return { category: 'deportes', subcategory: 'motor/formula 1' };
    }
  }

  if (cat === 'internacional') {
    if (subNorm.includes('europa') || subNorm.includes('ue') || subNorm.includes('europeo')) return { category: 'internacional', subcategory: 'europa' };
    if (subNorm.includes('america') || subNorm.includes('eeuu') || subNorm.includes('us') || subNorm.includes('latam')) return { category: 'internacional', subcategory: 'america' };
    if (subNorm.includes('asia') || subNorm.includes('china') || subNorm.includes('japon')) return { category: 'internacional', subcategory: 'asia' };
  }

  if (cat === 'tecnologia') {
    if (subNorm.includes('ia') || subNorm.includes('inteligencia') || subNorm.includes('artificial') || subNorm.includes('llm') || subNorm.includes('gpt')) return { category: 'tecnologia', subcategory: 'ia' };
    if (subNorm.includes('software') || subNorm.includes('code') || subNorm.includes('program') || subNorm.includes('dev')) return { category: 'tecnologia', subcategory: 'software' };
    if (subNorm.includes('gadget') || subNorm.includes('movil') || subNorm.includes('hardware') || subNorm.includes('iphone')) return { category: 'tecnologia', subcategory: 'gadgets' };
  }

  if (cat === 'ciencia') {
    if (subNorm.includes('espacio') || subNorm.includes('astronomia') || subNorm.includes('nasa') || subNorm.includes('cohete')) return { category: 'ciencia', subcategory: 'espacio' };
    if (subNorm.includes('salud') || subNorm.includes('medicina') || subNorm.includes('virus') || subNorm.includes('cancer')) return { category: 'ciencia', subcategory: 'salud' };
    if (subNorm.includes('biolo') || subNorm.includes('gen') || subNorm.includes('vida') || subNorm.includes('dna')) return { category: 'ciencia', subcategory: 'biologia' };
  }

  const allowed = CATEGORY_MAP[cat] || [];
  let found = allowed.find(a => subNorm.includes(a) || a.includes(subNorm));
  
  if (!found) {
    found = allowed[0] || 'general';
  }

  if (!found.includes('/')) {
    found = found.charAt(0).toUpperCase() + found.slice(1);
  }
  
  return { category: cat, subcategory: found };
}

async function run() {
  console.log('[Retroactive] Descargando artículos de Firebase...');
  const res = await fetch('https://pecemi-default-rtdb.firebaseio.com/aidaily/articles.json');
  if (!res.ok) {
    console.error('No se pudo acceder a Firebase');
    return;
  }
  
  const articles = await res.json();
  if (!articles || typeof articles !== 'object') {
    console.error('No hay artículos válidos');
    return;
  }
  
  console.log(`[Retroactive] Descargados ${Object.keys(articles).length} artículos. Normalizando...`);
  
  const updatedArticles = {};
  
  Object.entries(articles).forEach(([id, art]) => {
    const norm = normalizeCategoryAndSubcategory(art.category, art.subcategory);
    
    updatedArticles[id] = {
      ...art,
      category: norm.category,
      subcategory: norm.subcategory,
      // Actualizar tags para que el primer tag coincida con la categoría
      tags: [norm.category, ...(art.tags ? art.tags.slice(1) : [])]
    };
  });
  
  console.log('[Retroactive] Subiendo artículos normalizados a Firebase...');
  const patchRes = await fetch('https://pecemi-default-rtdb.firebaseio.com/aidaily/articles.json', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updatedArticles)
  });
  
  if (patchRes.ok) {
    console.log('[SUCCESS] Artículos actualizados retroactivamente con éxito en Firebase.');
  } else {
    console.error('Error subiendo artículos normalizados:', await patchRes.text());
  }
}

run();
