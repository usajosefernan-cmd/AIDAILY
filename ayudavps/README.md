# Dossier de Integración: Hermes VPS, Heartbeats y Gestión Inteligente de IAs

Este documento contiene la especificación de arquitectura y el manual operativo sobre cómo el agente **Antigravity** (o cualquier otro agente de IA autónomo) se integra y da soporte al motor de sincronización de noticias y contenidos de **Hermes** en la VPS. Asimismo, se detalla la estrategia de gestión, filtrado y rotación de modelos de IA (gratuitas vs. pago) para este y otros proyectos.

---

## 1. Servidor VPS: Especificaciones y Acceso Seguro

El motor de Hermes y el frontend de IA Daily se alojan y ejecutan de forma persistente en un servidor virtual privado (VPS) en la nube de Oracle Cloud.

### A. Datos del Servidor
* **Proveedor**: Oracle Cloud Infrastructure (OCI) - Always Free Tier.
* **Dirección IP Pública**: `143.47.35.167`
* **Usuario de acceso**: `ubuntu`
* **Sistema Operativo**: Ubuntu Server LTS.

### B. Llave SSH y Método de Acceso
El acceso a la VPS está protegido por la clave privada SSH (`id_rsa_oracle.key`), la cual se encuentra guardada de forma segura dentro de la propia carpeta `ayudavps/` de este proyecto.
1. **Acceso directo desde terminal (en la raíz del proyecto)**:
   ```bash
   ssh -i ayudavps/id_rsa_oracle.key ubuntu@143.47.35.167
   ```
2. **Acceso mediante Alias SSH (Config de Windows)**:
   Si tienes configurada la clave en tu carpeta de usuario local (`C:\Users\yo\.ssh\id_rsa_oracle.key` o similar), puedes conectarte escribiendo:
   ```bash
   ssh oracle-free
   ```

### C. Directorios Clave en la VPS
Una vez conectado al servidor, los paths de trabajo más importantes son:
- **/home/ubuntu/workspace/AIDAILY**: Contiene el código fuente del scraper, los scripts de clasificación/redacción (`scripts/sync-firebase.mjs`) y la configuración `.env` con las API keys principales de producción.
- **/opt/aidaily**: Es el entorno aislado donde se realiza la compilación limpia de Astro (`npm run build`) en cada sincronización.
- **/home/ubuntu/workspace/public/pro/aidaily**: Directorio final donde se guardan los archivos compilados estáticos (HTML, JS, CSS) de producción. Este directorio es servido directamente por **Nginx** de forma local en la VPS.

---

## 2. El Corazón de Hermes: Cron Heartbeat y Acciones en la VPS

El scraper y motor de ingesta de Hermes funciona mediante un cronjob automatizado en la VPS que actúa como el **Heartbeat** del sistema.

### A. Frecuencia del Cron
- El cron de producción corre estrictamente **cada 20 minutos** (minutos `:00`, `:20` y `:40` de cada hora).
- La ejecución está orquestada de forma centralizada mediante el scheduler de Hermes ejecutando el script `/home/ubuntu/.hermes/scripts/aidaily_hermes_cron.sh`.

### B. El Cerrojo (Lockfile) y Prevención de Concurrencias
- Para evitar que ejecuciones consecutivas del cron se solapen (ahogando la CPU e hilos del servidor), el script `sync-aidaily.sh` adquiere un lockfile en `/var/tmp/aidaily-sync.lock`.
- Si el scraper se cuelga (por ejemplo, esperando una respuesta de una API externa sin timeout), el lockfile permanece bloqueado. Las siguientes ejecuciones del cron detectarán el bloqueo y saldrán de inmediato para proteger el sistema:
  `ERROR: Otra instancia del scraper está corriendo activa. Saliendo.`
- El script de sincronización implementa un control de salida (`trap`) para eliminar el archivo de bloqueo de forma incondicional al terminar (`rm -f /var/tmp/aidaily-sync.lock`).

---

## 3. Cómo Antigravity y otros Agentes dan Soporte a Hermes

Cuando ocurren fallos o cuellos de botella en la VPS, un agente de IA como **Antigravity** actúa de forma remota para restablecer la estabilidad.

### A. Diagnóstico y Liberación de Bloqueos
1. **Detección de locks persistentes**: El agente lee los logs de ejecución (`/home/ubuntu/workspace/AIDAILY/logs/sync.log`) y detecta si el scraper lleva colgado horas debido al lockfile.
2. **Eliminación de procesos zombis**: El agente identifica los PIDs de los procesos hijos colgados (`sync-firebase.mjs`, `node`, `esbuild`) mediante comandos como `pstree -p <PID>` y ejecuta una terminación segura (`kill -9 <PID>`).
3. **Remoción física del lock**: El agente borra `/var/tmp/aidaily-sync.lock` en la VPS para reactivar la ingesta automática del cron.

### B. Ciclos de Validación Estricta
- Antes de propagar cualquier build compilado por Astro al servidor público local de Nginx en `/home/ubuntu/workspace/public/pro/aidaily`, el agente ejecuta un test de integridad post-build:
  - Comprueba la existencia y tamaño mínimo de `index.html` (>= 2KB) y `admin.html` (>= 1KB).
  - Valida la sintaxis JavaScript inyectada en las páginas mediante un analizador AST (`validate-staging-build.mjs`) para prevenir pantallas en blanco en producción.

---

## 4. Estrategia de IAs Gratuitas: El Dilema de los Modelos `:free`

En proyectos con volumen de llamadas frecuentes, el uso de modelos gratuitos de OpenRouter (sufijo `:free`) presenta importantes desafíos arquitectónicos.

### A. Limitaciones y Riesgos en Producción
* **Límites de Tasa (Rate-Limits 429)**: Las cuotas de modelos gratuitos en OpenRouter son compartidas globalmente por IP y usuario. Ante ráfagas de scraping, OpenRouter devuelve instantáneamente errores `429 Too Many Requests`.
* **Respuestas Incompletas y Truncadas**: Muchos modelos `:free` limitan de forma agresiva los tokens de salida, cortando la redacción a mitad de un párrafo.
* **Textos Residuales y Basura de Scraping**: Modelos pequeños gratuitos suelen fallar al seguir las instrucciones del prompt, devolviendo pies de foto genéricos ("Pie de foto en español") o enlaces mal formateados ("Leer .").

### B. Cuándo usar Modelos Gratuitas (Relevancia y Filtros)
Los modelos `:free` (como `llama-3.2-3b-instruct:free` o `gemma-2-9b-it:free`) son ideales **únicamente para la fase de Filtro Semántico**. Esta fase evalúa de forma rápida e individual si una noticia supera un umbral de relevancia semántica (1-10) antes de ser escrapeada a fondo. Si el modelo falla por rate-limit en esta fase corta, se puede omitir o usar un clasificador heurístico rápido sin arriesgar la calidad del texto final.

---

## 5. Tabla de Rotación y Fallbacks de Calidad Premium

Para el portal de noticias públicas de **IA Daily**, se ha rediseñado la redacción principal estableciendo un pool de rotación secuencial compuesto **exclusivamente por modelos de pago estables e inteligentes** (sin fallbacks `:free`).

### A. Tabla de Modelos de Redacción Principal (`QUALITY_MODELS`)

| Prioridad | Identificador de Modelo | Proveedor / API | Ventajas y Rol en IA Daily | Coste Estimado |
| :---: | :--- | :--- | :--- | :--- |
| **1** | `google/gemini-2.5-flash` | OpenRouter | Máxima velocidad, excelente redacción y bajísimo coste. | Extremadamente Bajo |
| **2** | `meta-llama/llama-3.3-70b-instruct` | OpenRouter | Razonamiento de alto nivel, ideal para estructurar puntos clave. | Bajo |
| **3** | `deepseek/deepseek-chat` | OpenRouter | Alta coherencia conceptual y fluidez nativa en español. | Extremadamente Bajo |
| **4** | `anthropic/claude-3.5-sonnet` | OpenRouter | Calidad de redacción editorial premium (estilo Gizmodo/NYT). | Medio-Alto |
| **5** | `google/gemini-2.5-pro` | OpenRouter | Razonamiento complejo de contingencia si fallan los anteriores. | Medio |

### B. Sistema de Contingencia Final (Ollama Local)
Si OpenRouter se queda sin saldo o hay una caída general de red, el sistema activa de forma secuencial la inferencia local en la VPS:
1. **Ollama Local**: Intenta procesar el texto secuencialmente usando modelos locales (`llama3.2:latest`, `qwen2.5`, `gemma2`) instalados directamente en la CPU de la VPS.
2. **Cerrojo Secuencial de Ollama**: Para no asfixiar la CPU del servidor, la inferencia local se hace con un cerrojo exclusivo que procesa los artículos uno a uno (secuencialmente) con un timeout estricto de 60 segundos.
3. **Smart Fallbacks**: Si la inferencia local también fallara, el código base inyecta una ficha de contingencia pre-estructurada con el titular en español, enlaces a la fuente original y pies de foto consistentes extraídos del RSS, garantizando que el diseño nunca se rompa.

---

## 6. Investigación Completa de Modelos Gratuitos (Free Models Use)

El catálogo completo de proveedores evaluados, límites de API detallados, cuotas diarias y la configuración de modelos en producción está disponible en la guía de la subcarpeta:
*   [free_models_use.md](file:///c:/Users/yo/Pictures/Descargaspc/0a/hermes/AIDAILY/ayudavps/freemodelsuse/free_models_use.md)

