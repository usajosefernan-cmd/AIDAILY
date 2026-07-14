/**
 * Normaliza un texto para ser usado como slug en enrutamiento web.
 * Elimina acentos, pasa a minúsculas y cambia caracteres no alfanuméricos por guiones.
 * 
 * @param {string} title Título de la noticia.
 * @returns {string} Slug normalizado.
 */
export function normalizeSlug(title) {
  if (!title || typeof title !== 'string') return '';
  
  let slug = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .replace(/[^a-z0-9\s-]/g, "")    // quitar carácteres no alfanuméricos
    .trim()
    .replace(/\s+/g, "-")            // reemplazar espacios por guión
    .replace(/-+/g, "-")            // colapsar guiones múltiples
    .replace(/(^-|-$)+/g, "");       // limpiar guiones iniciales y finales

  if (slug.length > 100) {
    slug = slug.substring(0, 100).replace(/-+$/, '');
  }
  return slug;
}

/**
 * Genera un slug estable para un artículo. Si hay riesgo de colisión, se concatena un shortId.
 * 
 * @param {object} article Objeto artículo.
 * @param {boolean} forceShortId Si es true, siempre concatena el shortId.
 * @returns {string} Slug único y estable.
 */
export function makeStableSlug(article, forceShortId = false) {
  const norm = normalizeSlug(article.title) || 'noticia';
  if ((forceShortId || !article.slug) && article.id) {
    const shortId = article.id.substring(Math.max(0, article.id.length - 6));
    return `${norm}-${shortId}`;
  }
  return article.slug || norm;
}

/**
 * Procesa un listado de artículos resolviendo cualquier duplicación de slugs
 * usando los últimos 6 caracteres de su hash ID.
 * 
 * @param {Array<any>} articles Lista de artículos.
 * @returns {Array<any>} Artículos con slugs asignados y deduplicados.
 */
export function ensureUniqueSlugs(articles) {
  const usedSlugs = new Set();
  
  return articles.map(art => {
    let slug = art.slug || normalizeSlug(art.title);
    if (!slug) slug = 'noticia';
    
    // Si ya existe el slug en este lote, resolvemos colisión con shortId
    if (usedSlugs.has(slug)) {
      const shortId = art.id ? art.id.substring(Math.max(0, art.id.length - 6)) : Math.random().toString(36).substring(2, 8);
      slug = `${slug}-${shortId}`;
    }
    
    usedSlugs.add(slug);
    return {
      ...art,
      slug
    };
  });
}

/**
 * Devuelve la URL canónica/de destino de un artículo.
 * 
 * @param {any} article Artículo con campo slug.
 * @returns {string} URL absoluta/relativa.
 */
export function getArticleUrl(article) {
  const slug = article.slug || normalizeSlug(article.title) || article.id;
  return `/pro/aidaily/noticias/${slug}/`;
}
