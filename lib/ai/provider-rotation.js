import fs from 'fs';
import path from 'path';

const PROVIDERS_CONFIG_PATH = path.resolve('config/ai-providers.json');
const cooldowns = new Map(); // Map of modelName -> cooldownExpirationTimestamp

/**
 * Carga la configuración de proveedores de IA.
 */
function loadProvidersConfig() {
  try {
    if (fs.existsSync(PROVIDERS_CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(PROVIDERS_CONFIG_PATH, 'utf-8'));
    }
  } catch (err) {
    console.error('[Rotation] Error leyendo config de proveedores:', err.message);
  }
  return { providers: [] };
}

/**
 * Obtiene una lista de modelos ordenados y candidatos aptos para una tarea específica.
 * @param {string} task Nombre de la tarea (ej. 'writing', 'qa', 'classification').
 * @param {string} tier Tier requerido ('smart' o 'cheap').
 * @returns {Array<object>} Lista de modelos candidatos.
 */
export function getCandidateModels(task, tier = 'smart') {
  const config = loadProvidersConfig();
  const candidates = [];

  for (const provider of config.providers) {
    for (const model of provider.models) {
      if (model.tier === tier && model.allowedTasks.includes(task)) {
        // Verificar si el modelo está en cooldown
        const now = Date.now();
        const cooldownExpiration = cooldowns.get(model.name) || 0;
        
        if (now > cooldownExpiration) {
          candidates.push({
            provider: provider.name,
            model: model.name,
            tier: model.tier
          });
        }
      }
    }
  }

  // Devolver candidatos (la rotación la hace el llamador seleccionando de la lista)
  return candidates;
}

/**
 * Pone un modelo en cooldown (por rate limit o timeout).
 * @param {string} modelName Nombre del modelo a cooldownear.
 */
export function setModelCooldown(modelName) {
  const config = loadProvidersConfig();
  const duration = config.cooldown_duration_ms || 300000; // 5 minutos por defecto
  cooldowns.set(modelName, Date.now() + duration);
  console.warn(`[Rotation] Modelo ${modelName} puesto en cooldown por ${duration / 1000}s.`);
}

/**
 * Registra la ejecución de una tarea y su métrica asociada.
 * Guarda un log ligero del coste e inferencia.
 */
export function logExecution(metrics) {
  const logDir = path.resolve('logs/ai');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logFile = path.join(logDir, 'execution-history.log');
  const logEntry = JSON.stringify({
    timestamp: new Date().toISOString(),
    ...metrics
  }) + '\n';

  fs.appendFileSync(logFile, logEntry, 'utf-8');
}
