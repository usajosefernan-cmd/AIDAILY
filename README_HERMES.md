# 🧠 README de Arquitectura para Hermes Agent (AIDAILY)

Este documento es una guía oficial y de memoria persistente para **Hermes Agent** y cualquier IA encargada del desarrollo y mantenimiento de **AIDAILY** en la VPS o en el entorno local.

---

## 1. REGLAS DE ORO DE AIDAILY (Lectura Obligatoria para la IA)

> [!CRITICAL]
> **Preservación Absoluta del Historial:**
> * **NUNCA** limites, borres ni purgues artículos del historial publicado bajo ningún concepto.
> * La web compila y preserva todas las noticias (+1600 artículos) de forma ilimitada.
> * El parámetro temporal **Rango Histórico / Antigüedad Máxima** en la configuración del scraper solo define el límite para capturar **nuevas noticias** de los feeds RSS.
> * La función `getDatesToBuild()` en Astro lee todas las fechas del historial de forma dinámica desde `cache-news.json` y compila páginas estáticas para cada una de ellas de forma ilimitada.

> [!IMPORTANT]
> **Frecuencia del Cron de Sincronización:**
> * El cron que ejecuta la sincronización en la VPS corre automáticamente **CADA 20 MINUTOS** (a los minutos :00, :20 y :40 de cada hora).
> * No configures esperas ni bloqueos prolongados que superen este intervalo sin liberar adecuadamente el lockfile `/var/tmp/aidaily-sync.lock`.

> [!WARNING]
> **Tratamiento Multimedia Defensivo (Sin Almacenamiento Local):**
> * Las imágenes, vídeos o tweets **NUNCA deben descargarse físicamente** al disco de la VPS para evitar el consumo de almacenamiento y ancho de banda.
> * Todo el contenido multimedia debe referenciarse mediante enlaces directos a sus URLs originales o códigos de inserción (embeds).

---

## 2. Mapa de Archivos y Componentes del Sistema

El motor de AIDAILY interactúa mediante los siguientes scripts clave:

* **[sources.ts](file:///src/lib/sources.ts)**:
  * Motor principal del scraper, cargador de feeds, deduplicador léxico (coeficiente Jaccard) y filtro de relevancia semántica (`llama3.2` local).
  * Implementa el router de 3 niveles de IA (Nous, OpenRouter y Ollama local).
  * Estructura los campos premium enriquecidos: multimedia con `alt`/`caption` traducidos al español, enlaces de interés (`links`) e infografía de datos clave (`interestingData`).
  * Utiliza `firebaseFetch()` con timeout estricto de 15s para evitar cuelgues del Event Loop.
* **[sync-firebase.mjs](file:///scripts/sync-firebase.mjs)**:
  * Script CLI de entrada de Node.js en la VPS. Lanza la ejecución de `sources.ts`, actualiza la base de datos de Firebase RTDB mediante parches masivos con `fetchWithTimeout()` (timeout 60s) y escribe la caché local `src/data/cache-news.json`.
* **[sync-aidaily.sh](file:///sync-aidaily.sh)**:
  * Script Bash principal orquestador y autocurable.
  * Copia el código al entorno aislado `/opt/aidaily/` para no interferir con el espacio de trabajo activo de la VPS.
  * Ejecuta la compilación estática de Astro (`npm run build`).
  * **Mecanismo Anti-Roturas**: Valida que `index.html` > 2KB, `admin.html` > 50KB, y la presencia de clases CSS críticas antes de desplegar a producción mediante Firebase Hosting.

---

## 3. Router de IA y Parámetros Activos

El motor utiliza un router dinámico de 3 niveles para procesar el lote balanceado (Round-Robin) de noticias aprobadas en la cola:

| Nivel | Proveedor | Modelo Preferido | Timeout | Propósito |
| :--- | :--- | :--- | :--- | :--- |
| **1** | Nous Inference API | `stepfun/step-3.7-flash:free` | 120s | Redacción principal en español |
| **2** | OpenRouter Free | `openai/gpt-oss-20b:free` | 75s | Fallback secundario de redacción |
| **3** | Ollama Local | `gemma2` / `llama3.2` | 40s | Fallback local sin internet |
| **Filtro** | Ollama Local | `qwen2.5:1.5b` / `llama3.2` (YES/NO) | 8s | Pre-filtro de relevancia rápido |

> [!NOTE]
> **Integración del Test de Modelos de Hermes (Walter):**
> * El script `sources.ts` comprueba dinámicamente el informe de auditoría diario generado por el cron de Hermes en `/home/ubuntu/workspace/projects/freemodels/informe_modelos_free_YYYY-MM-DD.md`.
> * Cualquier modelo que no tenga el estado `🟢 OK` (como `🔴 RATE_LIMITED` o fallidos) es excluido automáticamente en tiempo real tanto en la whitelist de scraping rápido (`getAIModelsList()`) como en la lista de rotación de redacción (`rotationCandidates`), evitando llamadas infructuosas y acelerando la compilación.

---

## 4. Diseño del Portal y Rendering de Componentes

La web pública (`index.astro`) y las páginas de fechas (`[date].astro`) consumen el JSON de artículos y renderizan componentes premium:
* **Vídeos de YouTube**: Renderizados en iframes responsivos en 16:9.
* **Tweets de Twitter/X**: Renderizados mediante blockquotes dinámicos integrados con el widget oficial.
* **Enlaces de Interés**: Tarjeta translúcida flotante con micro-animaciones hover.
* **Datos Clave**: Grid de infografía moderna con valores de gran tamaño y gradientes visuales curados.

---

## 5. Orquestación, Encolado y Round-Robin en Producción

### A. Hermes Scheduler (Trigger de Producción)
El scraper se orquesta en producción única y exclusivamente mediante **Hermes Scheduler** ejecutando la tarea `AIDAILY sync real 📰` a través del script `/home/ubuntu/.hermes/scripts/aidaily_hermes_cron.sh` cada 20 minutos.
* **Prevención de Solapamiento**: El script comprueba con `pgrep` si hay una ejecución de `sync-firebase.mjs` activa y aborta con tick OK en Hermes si coincide con una ejecución larga para no pisar el canal.
* **Limpieza de Locks Huérfanos**: Auto-elimina el lockfile `/var/tmp/aidaily-sync.lock` si el proceso que lo creó ya no está vivo en el sistema.

### B. Prevención de Timeouts y setsid (Ejecuciones Manuales)
El bridge de ejecución de la VPS impone un **timeout estricto de 30 segundos** a los comandos interactivos.
* **Gotcha**: Si se lanza el scraper en un terminal interactivo o de forma directa en background (`nohup script.sh &`), el shell finaliza abruptamente tras 30s matando a todo el grupo de procesos.
* **Mitigación**: Para forzar ejecuciones manuales de fondo que duren todo el tiempo que necesiten (ej. 10-15 minutos), debe usarse **`setsid`** para crear una nueva sesión de proceso desacoplada:
  ```bash
  rm -f /var/tmp/aidaily-sync.lock && setsid bash /home/ubuntu/workspace/AIDAILY/sync-aidaily.sh > /dev/null 2>&1 &
  ```

### C. Fase A: Encolado Inteligente (0 tokens)
El rastreador procesa los feeds, deduplica por Jaccard y pre-filtra por relevancia binaria con Ollama local. Los aprobados se encolan directamente en el nodo `/aidaily/queue.json` de Firebase RTDB sin usar tokens de IA principal.

### D. Fase B: Procesamiento de Cola por Round-Robin Proporcional
Para procesar la cola de forma equitativa y con variedad, se limita el lote a 100 artículos aplicando:
* **Capping Proporcional**: Se asignan límites dinámicos en base a las categorías activas:
  * `maxArticlesPerCategory = Math.max(15, Math.ceil(maxExecutionBatch / numActiveCats))`
  * `maxArticlesPerSource = Math.max(8, Math.ceil(maxExecutionBatch / 8))`
* **Round-Robin**: Recorre de forma rotativa las categorías e intercala las fuentes para evitar el monopolio de un solo feed en el lote.
* **Límite de Inferencia de 10 min**: Si el procesamiento con IA secuencial supera los 10 minutos, el script detiene la ingesta de la cola y procede inmediatamente a compilar y desplegar, garantizando que el cron nunca se quede atascado ni cause encolamientos infinitos.

