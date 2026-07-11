import crypto from 'crypto';

export function cleanTokens(text = '') {
  const stopwords = new Set([
    'para', 'como', 'sino', 'pero', 'este', 'esta', 'estos', 'estas', 'todo', 'toda', 'todos', 'todas',
    'unos', 'unas', 'sobre', 'entre', 'desde', 'hasta', 'hacia', 'para', 'pero', 'porque', 'cuando',
    'donde', 'quien', 'cual', 'cuyo', 'cuya', 'cuyos', 'cuyas', 'contra', 'durante', 'frente', 'hacia',
    'hasta', 'sobre', 'tienen', 'donde', 'noticias', 'noticia', 'articulo', 'articulos', 'prensa',
    'diario', 'mundo', 'pais', 'espana', 'madrid', 'barcelona', 'nuevo', 'nueva', 'nuevos', 'nuevas'
  ]);
  const words = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
    .replace(/[^\w\s]/g, ' ') // Eliminar puntuación
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopwords.has(w));
  return new Set(words);
}

export function getNumbers(text = '') {
  const matches = text.match(/\d+/g);
  return matches ? new Set(matches) : new Set();
}

export function getTrigrams(str = '') {
  const s = str.toLowerCase().replace(/[^\w]/g, '');
  const trigrams = new Set();
  for (let i = 0; i < s.length - 2; i++) {
    trigrams.add(s.substring(i, i + 3));
  }
  return trigrams;
}

export function getOrComputeTokens(item) {
  if (typeof item === 'string') return cleanTokens(item);
  if (!item._tokens || !(item._tokens instanceof Set)) {
    item._tokens = cleanTokens(item.title);
  }
  return item._tokens;
}

export function getOrComputeTrigrams(item) {
  if (typeof item === 'string') return getTrigrams(item);
  if (!item._trigrams || !(item._trigrams instanceof Set)) {
    item._trigrams = getTrigrams(item.title);
  }
  return item._trigrams;
}

export function getOrComputeNumbers(item) {
  if (typeof item === 'string') return getNumbers(item);
  if (!item._numbers || !(item._numbers instanceof Set)) {
    item._numbers = getNumbers((item.title || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  }
  return item._numbers;
}

export function calculateJaccardSimilarity(item1, item2) {
  const tokens1 = getOrComputeTokens(item1);
  const tokens2 = getOrComputeTokens(item2);
  if (tokens1.size === 0 || tokens2.size === 0) return 0;
  
  let intersection = 0;
  tokens1.forEach(token => {
    if (tokens2.has(token)) {
      intersection++;
    }
  });
  const union = tokens1.size + tokens2.size - intersection;
  return intersection / union;
}

export function isCrossLingualDuplicate(item1, item2) {
  const title1 = typeof item1 === 'string' ? item1 : item1.title;
  const title2 = typeof item2 === 'string' ? item2 : item2.title;

  // 1. Extraer números significativos (2 o más dígitos, excluyendo años comunes)
  const nums1 = getOrComputeNumbers(item1);
  const nums2 = getOrComputeNumbers(item2);

  let sharedNumber = false;
  let sharedNumVal = "";
  nums1.forEach(n => {
    if (n.length >= 2 && n !== '2026' && n !== '2025' && nums2.has(n)) {
      sharedNumber = true;
      sharedNumVal = n;
    }
  });

  // 2. Extraer palabras clave y buscar raíces comunes o palabras idénticas
  const tokens1 = getOrComputeTokens(item1);
  const tokens2 = getOrComputeTokens(item2);

  // Diccionario básico inglés -> español para palabras de noticias comunes
  const translationDict = {
    'tutor': 'tutor',
    'court': 'corte',
    'jail': 'carcel',
    'jailed': 'carcel',
    'prison': 'prision',
    'arrested': 'detenido',
    'death': 'muerte',
    'died': 'fallece',
    'dies': 'fallece',
    'dead': 'muerto',
    'accident': 'accidente',
    'crash': 'choque',
    'robbery': 'robo',
    'stolen': 'robado',
    'police': 'policia',
    'investigation': 'investigacion',
    'warning': 'alerta',
    'alert': 'alerta',
    'heatwave': 'calor',
    'weather': 'tiempo',
    'climate': 'clima',
    'nvidia': 'nvidia',
    'apple': 'apple',
    'google': 'google',
    'microsoft': 'microsoft',
    'openai': 'openai',
    'copilot': 'copilot',
    'gemini': 'gemini',
    'chatgpt': 'chatgpt',
    'meta': 'meta',
    'llama': 'llama',
    'trump': 'trump',
    'biden': 'biden',
    'putin': 'putin',
    'ukraine': 'ucrania',
    'russia': 'rusia',
    'china': 'china',
    'taiwan': 'taiwan',
    'spain': 'espana',
    'madrid': 'madrid',
    'barcelona': 'barcelona'
  };

  let sharedKeywords = 0;
  tokens1.forEach(tok => {
    const translated = translationDict[tok] || tok;
    tokens2.forEach(tok2 => {
      const translated2 = translationDict[tok2] || tok2;
      if (translated === translated2 || tok === tok2) {
        sharedKeywords++;
      }
    });
  });

  // Si comparten un número relevante y al menos 3 palabras clave significativas
  if (sharedNumber && sharedKeywords >= 3) {
    return true;
  }

  // Si comparten al menos 3 palabras clave significativas
  if (sharedKeywords >= 3) {
    return true;
  }

  // Jaccard de trigramas de caracteres
  const trigrams1 = getOrComputeTrigrams(item1);
  const trigrams2 = getOrComputeTrigrams(item2);
  
  if (trigrams1.size > 0 && trigrams2.size > 0) {
    let intersect = 0;
    trigrams1.forEach(tg => {
      if (trigrams2.has(tg)) intersect++;
    });
    const union = trigrams1.size + trigrams2.size - intersect;
    const charJaccard = intersect / union;
    
    if (charJaccard > 0.22) {
      return true;
    }
  }

  return false;
}

/**
 * Normaliza y calcula similitudes para verificar si un artículo ya existe en una lista.
 */
export function findDuplicateInList(candidate, existingList, threshold = 0.25) {
  for (const item of existingList) {
    // 1. Coincidencia por URL normalizada
    if (sanitizeUrlForHash(candidate.url) === sanitizeUrlForHash(item.url)) {
      return { duplicate: true, type: 'url', matchedItem: item };
    }
    // 2. Coincidencia por título exacto o normalizado
    if (normalizeTitle(candidate.title) === normalizeTitle(item.title)) {
      return { duplicate: true, type: 'title_exact', matchedItem: item };
    }
    // 3. Similitud Jaccard
    const similarity = calculateJaccardSimilarity(candidate, item);
    if (similarity > threshold) {
      return { duplicate: true, type: 'jaccard', similarity, matchedItem: item };
    }
    // 4. Similitud Cross-Lingual o Trigramas
    if (isCrossLingualDuplicate(candidate, item)) {
      return { duplicate: true, type: 'cross_lingual', matchedItem: item };
    }
  }
  return { duplicate: false };
}

export function sanitizeUrlForHash(url = '') {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    let clean = parsed.toString().toLowerCase().trim();
    if (clean.endsWith('/')) {
      clean = clean.substring(0, clean.length - 1);
    }
    return clean;
  } catch {
    return url.toLowerCase().trim();
  }
}

export function normalizeTitle(title = '') {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
