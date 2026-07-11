import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const OPT_DIST = '/opt/aidaily/dist';
const PROD_DIR = '/home/ubuntu/workspace/public/pro/aidaily';
const FIREBASE_DIR = '/home/ubuntu/workspace';

function log(msg) {
  console.log(`[Deploy VPS Node] ${msg}`);
}

async function run() {
  try {
    log('Iniciando paso de copia física Staging -> Producción...');
    
    if (!fs.existsSync(OPT_DIST)) {
      throw new Error(`No existe el directorio de Staging: ${OPT_DIST}`);
    }
    
    // Asegurar directorio de producción
    fs.mkdirSync(PROD_DIR, { recursive: true });
    
    // Limpiar producción anterior de forma segura
    log(`Limpiando directorio destino: ${PROD_DIR}...`);
    const files = fs.readdirSync(PROD_DIR);
    for (const file of files) {
      const fullPath = path.join(PROD_DIR, file);
      fs.rmSync(fullPath, { recursive: true, force: true });
    }
    
    // Copiar atómicamente de Staging a Producción
    log(`Copiando archivos de ${OPT_DIST} a ${PROD_DIR}...`);
    fs.cpSync(OPT_DIST, PROD_DIR, { recursive: true });
    log('✅ Copia completada con éxito.');
    
    // Validar físicamente que index.html en producción exista y sea el nuevo
    const prodIndex = path.join(PROD_DIR, 'index.html');
    if (!fs.existsSync(prodIndex)) {
      throw new Error('Error: index.html no existe en el directorio de producción después de la copia.');
    }
    const stats = fs.statSync(prodIndex);
    log(`index.html copiado mide ${stats.size} bytes. Timestamp: ${stats.mtime.toISOString()}`);
    
    // Desplegar en Firebase Hosting
    log('Iniciando deploy en Firebase Hosting (pecemi)...');
    const fbCommand = 'firebase deploy --only hosting --non-interactive --project pecemi';
    log(`Ejecutando: ${fbCommand}`);
    const fbOutput = execSync(fbCommand, { cwd: FIREBASE_DIR, encoding: 'utf-8' });
    console.log(fbOutput);
    log('✅ Deploy en Firebase Hosting completado con éxito.');
    
    // Verificación final local
    log('Ejecutando verificación local post-deploy...');
    const verifyCommand = 'node scripts/verify-production.js';
    const verifyOutput = execSync(verifyCommand, { cwd: '/home/ubuntu/workspace/AIDAILY', encoding: 'utf-8' });
    console.log(verifyOutput);
    log('✅ Verificación completada con éxito.');
    
  } catch (err) {
    console.error('\n❌ ERROR CRÍTICO EN DEPLOY VPS:');
    console.error(err.message);
    if (err.stdout) {
      console.error('STDOUT del comando fallido:');
      console.error(err.stdout);
    }
    if (err.stderr) {
      console.error('STDERR del comando fallido:');
      console.error(err.stderr);
    }
    process.exit(1);
  }
}

run();
