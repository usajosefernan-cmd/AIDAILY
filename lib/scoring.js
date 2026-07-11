/**
 * Calcula heurísticamente el score de relevancia y urgencia de un artículo
 * y proporciona un motivo estructurado.
 * 
 * @param {object} item Objeto del artículo.
 * @param {object} activeOrientation Orientación activa del panel (intereses, etc.).
 * @returns {object} { relevanceScore, urgencyScore, scoreReason }
 */
export function computeHeuristicScores(item, activeOrientation = null) {
  const title = (item.title || '').toLowerCase();
  const summary = (item.summary || '').toLowerCase();
  const text = `${title} ${summary}`;
  const feedPriority = typeof item.priority === 'number' ? item.priority : 2.0;

  // --- 1. RELEVANCE SCORE (1 a 10) ---
  let relevance = 5.0; // Base neutral

  // Ajuste por prioridad de la fuente RSS
  relevance += (feedPriority - 2.0) * 1.5; // Si priority es 3.0 sumamos 1.5, si es 1.0 restamos 1.5

  // Coincidencia con intereses específicos
  if (activeOrientation?.interests) {
    const ints = activeOrientation.interests;
    
    // Países prioritarios
    if (ints.countries) {
      const countries = ints.countries.split(',').map(c => c.trim().toLowerCase()).filter(c => c.length > 1);
      if (countries.some(c => text.includes(c))) {
        relevance += 1.5;
      }
    }
    
    // Temas prioritarios
    if (ints.topics) {
      const topics = ints.topics.split(',').map(t => t.trim().toLowerCase()).filter(t => t.length > 2);
      if (topics.some(t => text.includes(t))) {
        relevance += 1.5;
      }
    }
    
    // Entidades clave
    if (ints.entities) {
      const entities = ints.entities.split(',').map(e => e.trim().toLowerCase()).filter(e => e.length > 2);
      if (entities.some(e => text.includes(e))) {
        relevance += 2.0;
      }
    }
  }

  // Acotar relevancia entre 1 y 10
  relevance = Math.max(1, Math.min(10, Math.round(relevance)));

  // --- 2. URGENCY SCORE (1 a 10) ---
  let urgency = 1.0; // Base no urgente

  // Palabras clave de urgencia de alta prioridad
  const criticalUrgencyWords = ['última hora', 'breaking', 'urgente', 'al minuto', 'exclusiva', 'live', 'developing', 'confirmed'];
  const mediumUrgencyWords = ['launch', 'release', 'lawsuit', 'ban', 'regulation', 'acquisition', 'funding', 'outage', 'security breach', 'demanda', 'caída', 'alerta'];

  let criticalMatches = 0;
  criticalUrgencyWords.forEach(w => {
    if (title.includes(w)) criticalMatches++;
  });

  let mediumMatches = 0;
  mediumUrgencyWords.forEach(w => {
    if (title.includes(w) || summary.includes(w)) mediumMatches++;
  });

  if (criticalMatches > 0) {
    urgency += 6.0;
  } else if (mediumMatches > 0) {
    urgency += 3.0;
  }

  // Antigüedad (si es menor de 3 horas, sumamos 2 puntos de urgencia)
  const ageHours = (Date.now() - new Date(item.publishedAt || Date.now()).getTime()) / (60 * 60 * 1000);
  if (ageHours > 0 && ageHours <= 3) {
    urgency += 2.0;
  } else if (ageHours > 24) {
    urgency -= 1.0; // Penalización por noticia vieja
  }

  urgency = Math.max(1, Math.min(10, Math.round(urgency)));

  // --- 3. MOTIVO DEL SCORE ---
  let reason = 'Análisis de actualidad estándar.';
  if (criticalMatches > 0) {
    reason = 'Identificada como noticia de última hora o cobertura en directo (Breaking News).';
  } else if (relevance >= 8) {
    reason = 'Alta coincidencia con las preferencias e intereses semánticos de la audiencia.';
  } else if (urgency >= 6) {
    reason = 'Contiene palabras clave asociadas a lanzamientos, demandas o caídas de servicios recientes.';
  } else if (relevance <= 4) {
    reason = 'Baja prioridad temática o fuente de información secundaria.';
  }

  return {
    relevanceScore: relevance,
    urgencyScore: urgency,
    scoreReason: reason
  };
}
