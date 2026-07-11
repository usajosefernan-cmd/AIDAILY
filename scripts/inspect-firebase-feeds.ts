async function inspect() {
  try {
    const res = await fetch('https://pecemi-default-rtdb.firebaseio.com/aidaily/config/feeds.json');
    if (res.ok) {
      const data: any = await res.json();
      if (data && typeof data === 'object') {
        let count = 0;
        const categories = Object.keys(data);
        categories.forEach(cat => {
          if (Array.isArray(data[cat])) {
            count += data[cat].length;
          }
        });
        console.log(`[Firebase Feeds] Encontrados ${count} feeds en ${categories.length} categorías.`);
        console.log(`Categorías en Firebase:`, categories);
        // Mostrar algunos de ejemplo
        categories.slice(0, 3).forEach(cat => {
          console.log(`Ejemplo de feeds en ${cat} (primeros 2):`, data[cat].slice(0, 2));
        });
      } else {
        console.log(`[Firebase Feeds] El nodo es vacío o inválido.`);
      }
    } else {
      console.log(`[Firebase Feeds] Error HTTP: ${res.status}`);
    }
  } catch (err: any) {
    console.error(`[Error]`, err.message || err);
  }
}

inspect();
