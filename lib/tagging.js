/**
 * Categorías y tags mínimos solicitados por el editor.
 */
export const MIN_REQUIRED_TAGS = [
  'IA', 'OpenAI', 'Google', 'Anthropic', 'Meta', 'Nvidia', 'Apple', 'Microsoft',
  'Startups', 'Regulación', 'Finanzas', 'Cripto', 'Ciencia', 'Productividad',
  'Herramientas', 'Seguridad', 'España', 'Europa', 'Global', 'Breaking News', 'Tema Caliente'
];

/**
 * Diccionario de mapeo de palabras clave para deducción heurística local de tags secundarios.
 */
const TAG_KEYWORDS = {
  'IA': ['ia', 'ai', 'inteligencia artificial', 'llm', 'deep learning', 'redes neuronales', 'deepseek', 'prompt', 'transformer'],
  'OpenAI': ['openai', 'chatgpt', 'gpt-4', 'gpt-3', 'sam altman', 'sora', 'dall-e'],
  'Google': ['google', 'gemini', 'alphabet', 'sundar pichai', 'deepmind', 'waymo'],
  'Anthropic': ['anthropic', 'claude', 'opus', 'sonnet'],
  'Meta': ['meta', 'llama', 'zuckerberg', 'instagram', 'facebook', 'whatsapp', 'threads'],
  'Nvidia': ['nvidia', 'gpu', 'blackwell', 'h100', 'jensen huang', 'rtx'],
  'Apple': ['apple', 'iphone', 'ipad', 'macbook', 'tim cook', 'ios', 'safari', 'macos'],
  'Microsoft': ['microsoft', 'windows', 'azure', 'satya nadella', 'copilot', 'xbox'],
  'Startups': ['startup', 'startups', 'ronda de', 'funding', 'inversión', 'unicornio', 'yc', 'y combinator'],
  'Regulación': ['regulacion', 'ley', 'normativa', 'demanda', 'tribunal', 'antimonopolio', 'prohibicion', 'multa', 'parlamento', 'gobierno'],
  'Finanzas': ['finanzas', 'economia', 'bolsa', 'acciones', 'nasdaq', 'mercados', 'inflacion', 'dolares', 'euros', 'pib'],
  'Cripto': ['cripto', 'crypto', 'bitcoin', 'ethereum', 'blockchain', 'solana', 'nft', 'token', 'binance', 'coinbase'],
  'Ciencia': ['ciencia', 'cientifico', 'espacio', 'nasa', 'biologia', 'fisica', 'medicina', 'salud', 'descubrimiento', 'vacuna'],
  'Productividad': ['productividad', 'automatizacion', 'eficiencia', 'ahorrar tiempo', 'organizar', 'flujo de trabajo'],
  'Herramientas': ['herramienta', 'herramientas', 'app', 'aplicacion', 'software', 'plataforma', 'servicio web'],
  'Seguridad': ['seguridad', 'ciberseguridad', 'hack', 'vulnerabilidad', 'phishing', 'ransomware', 'filtracion', 'ataque'],
  'España': ['españa', 'espana', 'madrid', 'barcelona', 'valencia', 'sanchez', 'moncloa', 'nacional'],
  'Europa': ['europa', 'union europea', 'ue', 'bruselas', 'francia', 'alemania', 'italia', 'reino unido'],
  'Global': ['global', 'internacional', 'onu', 'eeuu', 'china', 'rusia', 'mundo', 'guerra', 'conflictos'],
  'Breaking News': ['breaking', 'urgente', 'ultima hora', 'en vivo', 'directo', 'al minuto', 'exclusiva', 'confirmed'],
  'Tema Caliente': ['tendencia', 'caliente', 'hot topic', 'viral', 'polemica', 'furor', 'revoluciona', 'arrasa']
};

/**
 * Analiza heurísticamente el título y resumen para asignar tags secundarios de la lista mínima.
 * 
 * @param {string} title Título de la noticia.
 * @param {string} summary Resumen de la noticia.
 * @param {string[]} existingTags Tags que ya vienen definidos (por la IA o el scraper).
 * @returns {string[]} Lista consolidada de tags normalizados pertenecientes a la lista mínima.
 */
export function extractRequiredTags(title = '', summary = '', existingTags = []) {
  const text = `${title} ${summary}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const detected = new Set();

  // 1. Añadir tags existentes si coinciden con los requeridos (normalizando case)
  if (Array.isArray(existingTags)) {
    existingTags.forEach(tag => {
      const match = MIN_REQUIRED_TAGS.find(req => req.toLowerCase() === tag.toLowerCase());
      if (match) {
        detected.add(match);
      }
    });
  }

  // 2. Escaneo heurístico por palabras clave
  Object.entries(TAG_KEYWORDS).forEach(([tag, keywords]) => {
    for (const kw of keywords) {
      const cleanKw = kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      // Buscar coincidencia como palabra completa o subcadena significativa
      const regex = new RegExp(`\\b${cleanKw}\\b`, 'i');
      if (regex.test(text)) {
        detected.add(tag);
        break;
      }
    }
  });

  // Si no se detectó nada, asignar un fallback coherente
  if (detected.size === 0) {
    detected.add('Global');
  }

  return Array.from(detected);
}

/**
 * Genera el fragmento del prompt para instruir a la IA a usar estas categorías.
 */
export function getPromptTaggingInstructions() {
  return `Asigna tags secundarios del siguiente listado oficial (selecciona entre 2 y 4 tags muy precisos):
[${MIN_REQUIRED_TAGS.join(', ')}].`;
}
