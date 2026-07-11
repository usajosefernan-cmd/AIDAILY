# Arquitectura de Sincronización y Motor de AIDAILY (Hermes)

Este documento detalla el funcionamiento del motor de scraping, procesamiento con Inteligencia Artificial, compilación estática y despliegue continuo de **AIDAILY** controlado de forma nativa desde el Scheduler de Hermes.

---

## 1. Mapa Mental de la Arquitectura (Flujo General)

El siguiente diagrama muestra los componentes que interactúan en la VPS y la secuencia de datos desde la captura de fuentes hasta la publicación final en Firebase Hosting.

```mermaid
graph TD
    %% Estilos de los nodos
    classDef cron fill:#1e293b,stroke:#3b82f6,stroke-width:2px,color:#f8fafc;
    classDef script fill:#0f172a,stroke:#10b981,stroke-width:2px,color:#f8fafc;
    classDef build fill:#311042,stroke:#d946ef,stroke-width:2px,color:#f8fafc;
    classDef store fill:#1c1917,stroke:#f59e0b,stroke-width:2px,color:#f8fafc;
    classDef check fill:#14532d,stroke:#22c55e,stroke-width:2px,color:#f8fafc;

    %% Nodos
    HERMES_CRON["⏰ Hermes Scheduler<br/>(Job: AIDAILY sync real)"]:::cron
    PY_BRIDGE["🐚 aidaily_hermes_cron.sh<br/>(Wrapper de Entrada)"]:::script
    SH_SCRIPT["🐚 sync-aidaily.sh<br/>(Orquestador Principal)"]:::script
    NODE_SYNC["🤖 sync-firebase.mjs (Scraper + IA)"]:::script
    
    subgraph "Procesamiento y Base de Datos"
        DB_RSS["🌐 Directorio Fuentes RSS"]:::store
        FIREBASE_RTDB[("🔥 Firebase RTDB (articles.json)")]:::store
        CACHE_LOCAL["📁 Cache local (cache-news.json)"]:::store
        OPENROUTER_IA["🧠 OpenRouter IA (Redacción)"]:::store
    end

    subgraph "Entorno de Compilación"
        OPT_DIR["📂 /opt/aidaily/ (Entorno Aislado)"]:::build
        ASTRO_BUILD["🚀 Astro compiler (npm run build)"]:::build
        DIST_DIR["📦 /dist/ (Archivos Estáticos)"]:::build
    end

    subgraph "Seguridad y Despliegue"
        INTEGRITY_CHECK["🛡️ Control de Integridad (Anti-Roturas)"]:::check
        FIREBASE_HOSTING[("🌐 Firebase Hosting (Producción)")]:::store
    end

    %% Relaciones
    HERMES_CRON -->|Ejecuta cada 20 min| PY_BRIDGE
    PY_BRIDGE -->|Lanza en segundo plano| SH_SCRIPT
    
    SH_SCRIPT -->|1. Invoca| NODE_SYNC
    NODE_SYNC -->|Lee fuentes| DB_RSS
    NODE_SYNC -->|Deduplica y evalúa| OPENROUTER_IA
    NODE_SYNC -->|Persiste artículos| FIREBASE_RTDB
    NODE_SYNC -->|Escribe| CACHE_LOCAL
    
    SH_SCRIPT -->|2. Propaga código y caché| OPT_DIR
    OPT_DIR -->|3. Recompila| ASTRO_BUILD
    ASTRO_BUILD -->|Genera| DIST_DIR
    
    SH_SCRIPT -->|4. Valida| INTEGRITY_CHECK
    DIST_DIR -->|Pasa tests de peso de archivos| INTEGRITY_CHECK
    
    INTEGRITY_CHECK -->|5. Si pasa, publica| FIREBASE_HOSTING
```

---

## 2. Diagrama de Secuencia del Proceso

El flujo exacto que se ejecuta de forma cronometrada para garantizar actualizaciones rápidas, deduplicación e integridad visual:

```mermaid
sequenceDiagram
    autonumber
    actor Hermes as ⏰ Hermes Scheduler
    participant Puente as 🐚 aidaily_hermes_cron.sh
    participant Sh as 🐚 sync-aidaily.sh
    participant Node as 🤖 sync-firebase.mjs
    participant IA as 🧠 Nous / OpenRouter / Ollama
    participant RTDB as 🔥 Firebase Realtime DB
    participant Astro as 🚀 Astro Compiler (/opt)
    participant Hosting as 🌐 Firebase Hosting

    Hermes->>Puente: Lanza tarea (Job ID: 439897a8b879)
    activate Puente
    Puente->>Sh: Invoca orquestador de bash
    activate Sh
    Sh->>RTDB: Actualiza estado en vivo a "Inicialización"
    
    Sh->>Node: Ejecuta motor de scraping
    activate Node
    Node->>RTDB: Lee feeds RSS activos y configuración
    Node->>Node: Descarga XMLs de los Feeds
    Node->>Node: Filtra por antigüedad (Rango Histórico) y deduplica contra SHA-256
    
    loop Para cada noticia nueva
        Node->>IA: Pre-filtro binario rápido (Local qwen2.5:1.5b, 8s timeout)
        Note over Node,IA: Si el pre-filtro aprueba el titular continúa
        Node->>IA: Redacción con IA Principal (Nous / OpenRouter / Local fallback)
    end
    
    Node->>RTDB: Escribe nuevos artículos procesados y fusionados con histórico
    Node->>Node: Actualiza caché local (cache-news.json)
    deactivate Node
    Sh->>RTDB: Actualiza estado a "Compilación de Astro"
    
    Sh->>Astro: Sincroniza caché y compila con rsync
    activate Astro
    Astro->>Astro: Astro compiles: npm run build
    Astro->>Sh: Genera de forma segura directorio /dist
    deactivate Astro

    Note over Sh: 🛡️ Inicia Control de Integridad (Anti-Roturas)
    Sh->>Sh: Comprueba peso de index.html (>2KB) y admin.html (>1KB)
    Sh->>Sh: Comprueba existencia de style.*.css y peso (>1KB)
    
    alt Si falla el control de integridad
        Sh->>RTDB: Reporta error en base de datos
        Sh-->>Puente: Retorna código de error (1)
        Puente-->>Hermes: Reporta fallo de ejecución (último status: error)
    else Si el control es exitoso
        Sh->>RTDB: Registra estado del build correcto
        Sh->>Hosting: Despliega build estático (firebase deploy)
        Sh->>RTDB: Actualiza estado a "Completado"
        Sh-->>Puente: Retorna código de éxito (0)
        Puente-->>Hermes: Reporta ejecución correcta (último status: ok)
    end
    deactivate Sh
    deactivate Puente
```

---

## 3. Desglose de Fases y Mecanismos de Seguridad

### A. Control de Ejecución y Concurrencia (Hermes Scheduler + Wrapper)
Para evitar que ejecuciones lentas de la IA se acumulen, consuman recursos descontroladamente o agoten las APIs, el pipeline se ejecuta mediante el planificador interno **Hermes Scheduler** (job `439897a8b879` `AIDAILY sync real 📰`) cada 20 minutos en el perfil principal. Este planificador ejecuta el script wrapper `/home/ubuntu/.hermes/scripts/aidaily_hermes_cron.sh`, el cual redirige las salidas de logs y gestiona el código de retorno. Adicionalmente, el script principal `sync-aidaily.sh` mantiene el uso interno de `flock -n /var/tmp/aidaily-sync.lock` y el sistema de autocuración automática (antigüedad > 12 min) para evitar deadlocks.

### B. El Mecanismo Anti-Roturas (Control de Integridad)
Es una de las partes críticas implementadas en el script `sync-hourly.sh`. Dado que la web usa Astro y compila componentes estáticos al vuelo usando datos de Firebase y estilos CSS de vanilla, cualquier cambio inesperado en los feeds o un error de parseo podría generar una página en blanco. 
Para mitigar esto, antes del despliegue se comprueba:
1. **Existencia física y tamaño mínimo** de los archivos estructurantes (`index.html` y `admin.html`).
2. **Presencia de selectores CSS específicos** en el stylesheet compilado de Tailwind/Vanilla (`.portal-news-grid` y `.news-card`). Si por algún motivo el compilador omite estas clases de estilo, el script cancela el despliegue a producción y conserva la versión funcional previa.

### C. Aislamiento del Entorno (`/opt/aidaily`)
La compilación final no se hace en el espacio de trabajo activo de la VPS (donde se editan los archivos y se hacen las pruebas) para evitar mezclar compilaciones temporales. En su lugar, el script clona la configuración y utiliza `rsync` hacia `/opt/aidaily/` donde ejecuta la compilación de forma completamente aislada.

---

## 4. Router Multi-Proveedor de IA

El sistema implementa un router de 3 niveles que alterna entre proveedores de IA de forma automática. Ver documentación detallada en [model_routing_workflow.md](file:///c:/Users/yo/Pictures/Descargaspc/0a/hermes/AIDAILY/docs/architecture/model_routing_workflow.md).

| Nivel | Proveedor | Modelo Preferido | Timeout |
|-------|-----------|------------------|---------|
| 1 | **OpenRouter Free** | `openai/gpt-oss-20b:free` | 20s |
| 2 | **Nous Research** | `stepfun/step-3.7-flash:free` | 120s |
| 3 | **Ollama Local** | Pool: `llama3.2`, `gemma2` | 45s |
| Pre-filtro | **Ollama Local** | `llama3.2` (binario YES/NO) | 8s |

### Variables de Entorno Actuales

```bash
OLLAMA_TEXT_MODELS=llama3.2,gemma2
OLLAMA_TEXT_MODEL=gemma2
OLLAMA_FILTER_MODEL=llama3.2
OLLAMA_TEXT_MAX_TOKENS=2000
OLLAMA_TEXT_CONTEXT_CHARS=4000
```
