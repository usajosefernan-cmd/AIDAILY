import fs from 'fs';
import path from 'path';

/**
 * Escribe un objeto o string en un archivo de forma atómica.
 * 1. Escribe en un archivo temporal (.tmp).
 * 2. Si existe el destino anterior, lo copia a backups como salvaguarda.
 * 3. Renombra el temporal al destino final.
 * 
 * @param {string} filePath Ruta absoluta o relativa al archivo destino.
 * @param {any} data Datos a escribir (objeto JSON o string).
 * @param {boolean} createBackup Si es true, mantiene un backup de la versión anterior en backups/.
 */
export function writeJsonAtomic(filePath, data, createBackup = true) {
  const resolvedPath = path.resolve(filePath);
  const dir = path.dirname(resolvedPath);
  const ext = path.extname(resolvedPath);
  const base = path.basename(resolvedPath, ext);
  
  // Asegurar que el directorio de salida existe
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  const tempPath = path.join(dir, `${base}.tmp${ext}`);
  const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  
  // Validar que los datos sean JSON válido si no es un string
  if (typeof data !== 'string') {
    try {
      JSON.parse(content);
    } catch (err) {
      throw new Error(`Los datos proporcionados no se pudieron serializar a un JSON válido: ${err.message}`);
    }
  }

  // 1. Escritura en archivo temporal
  fs.writeFileSync(tempPath, content, 'utf-8');

  // 2. Crear backup si el archivo original ya existía
  if (createBackup && fs.existsSync(resolvedPath)) {
    try {
      // Buscar la carpeta backups en el raíz o dentro de data/backups
      const projectRoot = path.resolve('.');
      const backupDir = path.join(projectRoot, 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `${base}_backup_${timestamp}${ext}`);
      
      fs.copyFileSync(resolvedPath, backupPath);
      
      // Limpiar backups antiguos para no saturar el disco (mantener los 5 más recientes)
      const files = fs.readdirSync(backupDir)
        .filter(f => f.startsWith(`${base}_backup_`) && f.endsWith(ext))
        .map(f => ({ name: f, time: fs.statSync(path.join(backupDir, f)).mtime.getTime() }))
        .sort((a, b) => b.time - a.time);
        
      if (files.length > 5) {
        files.slice(5).forEach(f => {
          fs.unlinkSync(path.join(backupDir, f.name));
        });
      }
    } catch (backupErr) {
      console.warn(`[Atomic Write] Advertencia: No se pudo crear el backup de seguridad de ${base}:`, backupErr.message);
    }
  }

  // 3. Reemplazo atómico (rename es atómico a nivel de SO)
  fs.renameSync(tempPath, resolvedPath);
}
