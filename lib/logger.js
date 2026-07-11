import fs from 'fs';
import path from 'path';

/**
 * Logger estructurado para crons que genera logs diarios en logs/
 * y permite recopilar métricas agregadas de la ejecución actual.
 */
export class CronLogger {
  constructor(cronName) {
    this.cronName = cronName;
    this.projectRoot = path.resolve('.');
    this.logsDir = path.join(this.projectRoot, 'logs');
    this.metrics = {
      startTime: Date.now(),
      scraped: 0,
      discarded: 0,
      duplicates: 0,
      success: 0,
      failed: 0,
      details: []
    };
    
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  /**
   * Obtiene la ruta del archivo de log del día.
   */
  _getLogFilePath() {
    const todayStr = new Date().toISOString().split('T')[0];
    return path.join(this.logsDir, `${this.cronName}-${todayStr}.log`);
  }

  /**
   * Escribe una línea de log tanto a consola como al archivo diario.
   */
  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level}] ${message}`;
    
    // Imprimir por consola
    if (level === 'ERROR' || level === 'CRITICAL') {
      console.error(formattedMessage);
    } else if (level === 'WARNING') {
      console.warn(formattedMessage);
    } else {
      console.log(formattedMessage);
    }
    
    // Escribir a archivo
    try {
      fs.appendFileSync(this._getLogFilePath(), formattedMessage + '\n', 'utf-8');
    } catch (err) {
      console.error(`[Logger] No se pudo escribir en el archivo de log: ${err.message}`);
    }
  }

  warn(message) {
    this.log(message, 'WARNING');
  }

  error(message, err = null) {
    let msg = message;
    if (err) {
      msg += ` | Detalle: ${err.message || String(err)}`;
      if (err.stack) {
        msg += `\nStack trace:\n${err.stack}`;
      }
    }
    this.log(msg, 'ERROR');
  }

  // Métodos para recopilación de métricas
  addScraped(count = 1) { this.metrics.scraped += count; }
  addDiscarded(count = 1) { this.metrics.discarded += count; }
  addDuplicate(count = 1) { this.metrics.duplicates += count; }
  addSuccess(count = 1) { this.metrics.success += count; }
  addFailed(count = 1) { this.metrics.failed += count; }

  addDetail(type, title, source, statusDetails = '') {
    this.metrics.details.push({
      type, // 'new' | 'duplicate' | 'discarded' | 'failed'
      title,
      source,
      timestamp: new Date().toISOString(),
      statusDetails
    });
  }

  /**
   * Genera y escribe el reporte final consolidado de la ejecución.
   */
  printSummary() {
    const durationSec = Math.round((Date.now() - this.metrics.startTime) / 1000);
    const summaryLines = [
      `======================================================`,
      ` RESUMEN DE EJECUCIÓN: ${this.cronName.toUpperCase()}`,
      `======================================================`,
      `Fecha de ejecución : ${new Date().toISOString()}`,
      `Duración total      : ${durationSec} segundos`,
      `Artículos leídos    : ${this.metrics.scraped}`,
      `Artículos nuevos    : ${this.metrics.success}`,
      `Artículos duplicados: ${this.metrics.duplicates}`,
      `Artículos descartad.: ${this.metrics.discarded}`,
      `Artículos fallados  : ${this.metrics.failed}`,
      `------------------------------------------------------`
    ];

    // Detallar categorías si existen
    const categoriesAssigned = {};
    this.metrics.details.forEach(item => {
      if (item.type === 'new' && item.statusDetails) {
        const cat = item.statusDetails.split('/')[0] || item.statusDetails;
        categoriesAssigned[cat] = (categoriesAssigned[cat] || 0) + 1;
      }
    });

    if (Object.keys(categoriesAssigned).length > 0) {
      summaryLines.push(`Categorías asignadas:`);
      Object.entries(categoriesAssigned).forEach(([cat, count]) => {
        summaryLines.push(`  - ${cat}: ${count}`);
      });
      summaryLines.push(`------------------------------------------------------`);
    }

    summaryLines.forEach(line => this.log(line, 'SUMMARY'));
  }
}
