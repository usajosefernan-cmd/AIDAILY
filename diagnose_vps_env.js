const fs = require('fs');
const dotenv = require('dotenv');

const envPath = '/home/ubuntu/workspace/AIDAILY/.env';
let env = {};
if (fs.existsSync(envPath)) {
  const result = dotenv.config({ path: envPath });
  if (result.parsed) {
    env = result.parsed;
  }
} else {
  console.log('No existe el archivo .env en ' + envPath);
  env = process.env;
}

const keys = Object.keys(env).filter(k => 
  k.includes('KEY') || k.includes('TOKEN') || k.includes('API') || k.includes('SECRET')
);

console.log('--- DIAGNÓSTICO DE VARIABLES DE ENTORNO DE IA ---');
keys.forEach(k => {
  const val = env[k];
  if (val) {
    console.log(`${k}: DEFINIDA (Largo: ${val.length}, Inicio: ${val.slice(0, 8)}...)`);
  } else {
    console.log(`${k}: VACÍA`);
  }
});
