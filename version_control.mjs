import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_FILES = [
  'src/pages/index.astro',
  'src/pages/[date].astro',
  'src/styles/premium.css'
];

const BACKUP_DIR = path.join(__dirname, 'backups');

function ensureDirectoryExistence(filePath) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}

function backup(version) {
  if (!version) {
    console.error('Error: Debes especificar una versión (ej. --backup v2.0)');
    process.exit(1);
  }

  const destDir = path.join(BACKUP_DIR, version);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  console.log(`\nIniciando copia de seguridad para la versión: ${version}...`);
  let successCount = 0;

  for (const file of TARGET_FILES) {
    const srcPath = path.join(__dirname, file);
    const destPath = path.join(destDir, path.basename(file));

    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`[OK] Copiado: ${file} -> backups/${version}/${path.basename(file)}`);
      successCount++;
    } else {
      console.warn(`[WARN] Archivo origen no encontrado: ${file}`);
    }
  }

  console.log(`Copia de seguridad completada. ${successCount} archivos copiados.\n`);
}

function restore(version) {
  if (!version) {
    console.error('Error: Debes especificar una versión a restaurar (ej. --restore v2.0)');
    process.exit(1);
  }

  const srcDir = path.join(BACKUP_DIR, version);
  if (!fs.existsSync(srcDir)) {
    console.error(`Error: La versión de backup '${version}' no existe en backups/.`);
    process.exit(1);
  }

  console.log(`\nIniciando restauración de la versión: ${version}...`);
  let successCount = 0;

  for (const file of TARGET_FILES) {
    const srcPath = path.join(srcDir, path.basename(file));
    const destPath = path.join(__dirname, file);

    if (fs.existsSync(srcPath)) {
      ensureDirectoryExistence(destPath);
      fs.copyFileSync(srcPath, destPath);
      console.log(`[OK] Restaurado: backups/${version}/${path.basename(file)} -> ${file}`);
      successCount++;
    } else {
      console.warn(`[WARN] Archivo de backup no encontrado: backups/${version}/${path.basename(file)}`);
    }
  }

  console.log(`Restauración completada. ${successCount} archivos restaurados.\n`);
}

function list() {
  if (!fs.existsSync(BACKUP_DIR)) {
    console.log('No se ha encontrado ninguna copia de seguridad en backups/.');
    return;
  }

  const backups = fs.readdirSync(BACKUP_DIR).filter(file => {
    return fs.statSync(path.join(BACKUP_DIR, file)).isDirectory();
  });

  if (backups.length === 0) {
    console.log('No hay versiones respaldadas en backups/.');
    return;
  }

  console.log('\nVersiones de backup disponibles:');
  for (const backup of backups) {
    const dirPath = path.join(BACKUP_DIR, backup);
    const files = fs.readdirSync(dirPath);
    console.log(`- ${backup} (${files.join(', ')})`);
  }
  console.log('');
}

const args = process.argv.slice(2);
const command = args[0];
const value = args[1];

if (command === '--backup') {
  backup(value);
} else if (command === '--restore') {
  restore(value);
} else if (command === '--list') {
  list();
} else {
  console.log(`
Uso de version_control.mjs:
  node version_control.mjs --backup <version>   Crea un backup de los archivos fuente críticos.
  node version_control.mjs --restore <version>  Restaura los archivos fuente a partir de un backup.
  node version_control.mjs --list               Muestra los backups disponibles.
`);
}
