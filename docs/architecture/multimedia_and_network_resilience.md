# Resiliencia de Red y Enriquecimiento Multimedia Premium en AIDAILY (Hermes)

Este documento detalla las soluciones de arquitectura aplicadas al motor de sincronización y al portal web de **AIDAILY** para blindar la ejecución del cron contra deadlocks de red en la VPS y permitir la publicación automatizada de artículos enriquecidos con multimedia, enlaces y datos clave.

---

## 1. Blindaje de Red y Prevención de Bloqueos en la VPS

Para garantizar que el cron automático de 20 minutos de Hermes se ejecute de forma 100% autónoma y no se bloquee ni genere alertas de `Warning: Detected unsettled top-level await` (que hacían que Node aborte por promesas huérfanas en el Event Loop), se ha implementado un sistema de red defensivo:

### A. Tiempos de Espera Estrictos (AbortControllers)
Todas las interacciones de base de datos con Firebase RTDB se realizan a través de helpers con timeouts controlados que abortan de forma nativa la llamada si el servidor no responde a tiempo:
* **`firebaseFetch` (15 segundos)**: Usado para transacciones rápidas (estado de ejecución, borrado de elementos procesados, actualizaciones de rotación de feeds).
* **`fetchWithTimeout` (60 segundos)**: Usado en `sync-firebase.mjs` para dar margen al parcheo JSON masivo de la base de datos acumulada (+1600 artículos) sin arriesgar bloqueos permanentes.

### B. Corrección de Concurrencia en Paralelo (`runWithConcurrencyLimit`)
Se ha sustituido la resolución mediante `.then()` por un pool estructurado con `.finally()`. Esto garantiza que los slots de ejecución en paralelo siempre se liberen (incluso ante rechazos o fallos de inferencia de la IA o scrapings corruptos de la red), liberando el Event Loop del proceso de forma limpia:

```typescript
// Implementación Resiliente de Concurrencia
async function runWithConcurrencyLimit<T, R>(items: T[], fn: (item: T) => Promise<R>, limit: number) {
  const results: Promise<R>[] = [];
  const executing: Promise<any>[] = [];
  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item));
    results.push(p);
    if (limit <= items.length) {
      const e: Promise<any> = p.finally(() => {
        const idx = executing.indexOf(e);
        if (idx !== -1) executing.splice(idx, 1);
      });
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(results.map(p => p.catch(() => undefined)));
}
```

---

## 2. Enriquecimiento Multimedia e Ingesta Inteligente de Video (YouTube y HTML5)

Para evitar imágenes genéricas o de fallback repetitivas, el scraper realiza una extracción de recursos multimedia del DOM original y los consolida antes de presentárselos a la IA.

### A. Ingesta Automática de Videos y Capturas de Miniatura
Cuando un artículo no contiene imágenes o se basa en un video embebido, el motor aplica lógica inteligente para resolver el contenido:
1. **Detección de YouTube (Iframes y Enlaces)**:
   * Si la página original contiene un iframe que apunte a `youtube.com/embed/` o un enlace de ancla a un video de YouTube, el motor extrae el ID de 11 caracteres del video mediante expresiones regulares:
     $$\text{getYouTubeVideoId(url)} \rightarrow \text{VIDEO\_ID}$$
   * **Inyección de Miniatura**: Genera de forma automática una imagen candidata de tipo `image` con la URL de miniatura de YouTube: `https://img.youtube.com/vi/VIDEO_ID/hqdefault.jpg`. Al colocarse como candidato de imagen con máxima prioridad, la heurística local o la IA la eligen como la portada principal de la noticia (`imageUrl`).
   * **Inyección de Video**: Registra un elemento de tipo `youtube` con la URL de reproducción embebida segura `https://www.youtube.com/embed/VIDEO_ID` para que sea visible en el reproductor integrado del artículo.
2. **Detección de HTML5 Video Nativo**:
   * Escanea las etiquetas `<video>` en el DOM original de la noticia.
   * Si la etiqueta cuenta con el atributo `poster="..."` (la imagen de miniatura del reproductor), la extrae y valida como una imagen apta para portada.
   * Si cuenta con fuentes de video `<source src="...">` o `src`, las registra como multimedia de tipo `video`.

### B. Filtro Heurístico Estricto (Anti-Fotos de Redactor y Cabeceras)
Para evitar que se capturen fotografías de perfil de los redactores o logotipos genéricos del portal original:
1. **Palabras de Exclusión Extendidas**: Se descartan de forma automática todas las imágenes cuyas URLs contengan términos como `logo`, `avatar`, `icon`, `banner`, `header`, `footer`, `placeholder`, `author`, `autor`, `profile`, `user`, `redactor`, `periodista`, `reportero`, `biografia`, `gravatar`.
2. **Filtro de Dimensiones Cuadradas/Pequeñas**: El motor analiza los patrones de tamaño en las URLs (ej: `150x150`, `size=80`). Cualquier imagen con un ancho o alto igual o inferior a **150px** se descarta automáticamente por ser un icono o una foto de miniatura de redactor.
3. **Conservación de Tipos de Video**: La función `filterMultimediaCandidates` fue corregida para que la heurística conserve y deje pasar los recursos multimedia de tipo `youtube`, `twitter` and `video`, evitando que sean eliminados antes de la evaluación de la IA.

### C. Soporte de Formatos en el Renderizador de Astro (`renderArticleBodyHtml`)
El renderizador dinámico de Astro en `index.astro` inyecta en el cuerpo de la lectura:
* **Vídeos de YouTube (`type === 'youtube'`)**: Se renderizan mediante iframes responsivos premium con aspect ratio 16:9, bordes curvados y sombras dinámicas.
* **Tweets de Twitter/X (`type === 'twitter'`)**: Se inyectan mediante blockquotes nativos y se sincroniza el script oficial de widgets de Twitter (`widgets.js`) para que se muestren de forma 100% interactiva.

---

## 3. Enlaces de Interés y Datos Clave (Infografías Interactivas)

Se han añadido dos nuevos campos estructurados al JSON de la IA y a la base de datos de noticias:

### A. Enlaces de Interés (`links`)
* **Propósito**: Proporcionar enlaces útiles, portales oficiales o referencias citadas sobre el tema de la noticia en español.
* **Diseño Premium**: Se renderizan en una tarjeta flotante con gradiente translúcido y bordes sutiles, con efectos hover en transición horizontal que mejoran la experiencia de interacción (micro-animaciones).

### B. Datos Clave (`interestingData`)
* **Propósito**: Extraer datos cuantificables de impacto (cifras, estadísticas, porcentajes) para mostrarlos de un solo vistazo.
* **Diseño Premium**: Se visualizan como una cuadrícula (grid) de infografía moderna. Cada dato tiene un valor de tamaño grande formateado con gradientes brillantes (de púrpura a índigo) y una etiqueta descriptiva en mayúsculas de aspecto premium.
