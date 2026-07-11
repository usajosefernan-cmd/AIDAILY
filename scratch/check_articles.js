async function run() {
  const url = 'https://pecemi-default-rtdb.firebaseio.com/aidaily/config.json';
  console.log('Descargando config de Firebase...');
  const res = await fetch(url);
  const data = await res.json();
  console.log('Configuración actual de Firebase:', JSON.stringify(data, null, 2));
}

run().catch(console.error);
