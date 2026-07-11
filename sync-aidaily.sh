#!/usr/bin/env bash
# Sincronización horaria de IA Daily: descarga noticias, las procesa con IA y las sube a Firebase RTDB

FORCE_BUILD=false
BUILD_ONLY=false
for arg in "$@"; do
    if [ "$arg" = "--force" ]; then
        FORCE_BUILD=true
    elif [ "$arg" = "--build-only" ]; then
        BUILD_ONLY=true
    fi
done

set -euo pipefail

# Matar procesos hijos, limpiar lockfile y reportar/avisar fallos a Firebase y Hermes
handle_exit() {
    local exit_code=$?
    pkill -P $$ 2>/dev/null || true
    rm -f /var/tmp/aidaily-sync.lock
    if [ $exit_code -ne 0 ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Sincronización interrumpida abruptamente con código $exit_code."
        # Reportar fallo a Firebase
        curl -s -X PATCH -d "{\"build_status\": {\"ok\": false, \"error\": \"Error crítico en la VPS (código $exit_code). La sincronización automática ha fallado tras agotar los reintentos.\", \"updatedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}, \"security_token\": \"pecemi_secure_gateway_token_2026_xyz\"}" "https://pecemi-default-rtdb.firebaseio.com/aidaily/sources_status.json" > /dev/null 2>&1 || true
        
        # Enviar alerta instantánea a Hermes (Telegram) para notificar al usuario
        local alert_msg="⚠️ [ALERTA IA DAILY]: La sincronización en la VPS ha fallado tras agotar todos los intentos automáticos (código: $exit_code). El actualizador automático se ha detenido para proteger la integridad de la web. Revisa el panel de administración."
        node -e "
            const { exec } = require('child_process');
            const msg = \`$alert_msg\`;
            const escaped = msg.replace(/\"/g, '\\\\\"');
            exec('python3 /home/ubuntu/workspace/antigravity_db_handler.py insert antigravity_hermes assistant \"' + escaped + '\"');
            exec('python3 /home/ubuntu/workspace/sync_all_profiles.py');
        " >/dev/null 2>&1 || true
    fi
}
trap handle_exit EXIT

# Evitar ejecuciones simultáneas utilizando flock (lock)
LOCKFILE="/var/tmp/aidaily-sync.lock"
exec 9>>"$LOCKFILE"

MAX_AGE_MINUTES=60

if ! flock -n 9; then
    # No se pudo adquirir el bloqueo. Comprobemos si el proceso está colgado
    if [ -f "$LOCKFILE" ] && [ -s "$LOCKFILE" ]; then
        OTHER_PID=$(cat "$LOCKFILE" | head -n 1 | tr -d '\r\n ')
        if [ -n "$OTHER_PID" ]; then
            # Obtener antigüedad del archivo en minutos
            FILE_AGE_SECS=$(( $(date +%s) - $(stat -c %Y "$LOCKFILE") ))
            FILE_AGE_MINS=$(( FILE_AGE_SECS / 60 ))
            
            if [ $FILE_AGE_MINS -ge $MAX_AGE_MINUTES ]; then
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] ADVERTENCIA: Se detectó bloqueo antiguo de hace $FILE_AGE_MINS minutos. Matando proceso zombi anterior PID $OTHER_PID..."
                kill -9 "$OTHER_PID" 2>/dev/null || true
                sleep 2
                
                # Intentar adquirir el bloqueo una vez más
                if ! flock -n 9; then
                    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: No se pudo liberar el bloqueo incluso tras matar al PID $OTHER_PID. Abortando."
                    # Reportar fallo a Firebase
                    curl -s -X PATCH -d "{\"build_status\": {\"ok\": false, \"error\": \"VPS bloqueada: No se pudo liberar el lockfile de hace $FILE_AGE_MINS min.\", \"updatedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}, \"security_token\": \"pecemi_secure_gateway_token_2026_xyz\"}" "https://pecemi-default-rtdb.firebaseio.com/aidaily/sources_status.json" > /dev/null 2>&1 || true
                    exit 0
                fi
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] Bloqueo liberado con éxito. Iniciando nueva ejecución limpia..."
            else
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Otra instancia del scraper está corriendo activa (PID $OTHER_PID, iniciada hace $FILE_AGE_MINS min). Saliendo."
                exit 0
            fi
        else
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Otra instancia corre activa pero el lockfile está vacío. Saliendo."
            exit 0
        fi
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Otra instancia del scraper está en ejecución. Saliendo."
        exit 0
    fi
fi

# Guardar el PID actual en el lockfile de forma segura
echo $$ > "$LOCKFILE"

# Limpiar procesos zombis de Node huérfanos anteriores de forma segura y tolerante a fallos de pgrep/grep
ZOMBIES=$(pgrep -f "sync-firebase.mjs" | grep -v "$$" || true)
if [ -n "$ZOMBIES" ]; then
    echo "$ZOMBIES" | while read -r PID_TO_KILL; do
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ADVERTENCIA: Limpiando proceso zombi huérfano de Node (PID $PID_TO_KILL) para evitar colapsos."
        kill -9 "$PID_TO_KILL" 2>/dev/null || true
    done
fi

PROJECT_DIR="/home/ubuntu/workspace/AIDAILY"
LOG_FILE="$PROJECT_DIR/logs/sync.log"
export TSX_DISABLE_CACHE=1

mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# Ejecutar comandos con reintentos automáticos y backoff exponencial
run_with_retry() {
    local cmd="$1"
    local max_attempts=3
    local attempt=1
    local wait_secs=20
    
    while [ $attempt -le $max_attempts ]; do
        log "Ejecutando (Intento $attempt de $max_attempts): $cmd"
        if eval "$cmd"; then
            return 0
        fi
        log "ADVERTENCIA: Intento $attempt falló."
        if [ $attempt -lt $max_attempts ]; then
            log "Esperando $wait_secs segundos antes de reintentar..."
            sleep $wait_secs
            wait_secs=$(( wait_secs * 2 ))
        fi
        attempt=$(( attempt + 1 ))
    done
    log "ERROR: Comando falló de forma persistente tras $max_attempts intentos."
    return 1
}

update_vps_status() {
    local step=$1
    local stepName=$2
    local details=$3
    local progress=$4
    local error=${5:-""}
    
    # Escapar las comillas dobles para el JSON
    local escaped_details=$(echo "$details" | sed 's/"/\\"/g')
    local escaped_stepName=$(echo "$stepName" | sed 's/"/\\"/g')
    local escaped_error=$(echo "$error" | sed 's/"/\\"/g')
    
    local payload="{\"step\": $step, \"stepName\": \"$escaped_stepName\", \"details\": \"$escaped_details\", \"progress\": $progress, \"updatedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\", \"pid\": $$, \"error\": \"$escaped_error\"}"
    
    curl -s -X PUT -H "Content-Type: application/json" -d "$payload" "https://pecemi-default-rtdb.firebaseio.com/aidaily/vps_execution_status.json" > /dev/null 2>&1 || true
}

log "=== Sincronización IA Daily iniciada ==="
update_vps_status 1 "Inicialización" "Lanzando script de sincronización en segundo plano..." 2

rm -f "$PROJECT_DIR/.has_changes"

cd "$PROJECT_DIR"

if [ "$BUILD_ONLY" = "true" ]; then
    log "Modo --build-only activo. Saltando sync-firebase.mjs..."
    echo "true" > "$PROJECT_DIR/.has_changes"
    SYNC_OK=true
else
    log "Ejecutando news-sync.js..."
    chmod +x node_modules/.bin/* || true
    if run_with_retry "npm run news:sync 2>&1 | tee -a '$LOG_FILE'"; then
        log "Sincronización de noticias completada con éxito."
        update_vps_status 5 "Procesamiento con IA" "Sincronización de noticias e IA finalizada con éxito." 100

        # --- GENERAR ÍNDICE DE BÚSQUEDA ---
        log "Generando índice de búsqueda inteligente..."
        if node scripts/generate-search-index.cjs "$PROJECT_DIR/src/data/cache-news.json" "$PROJECT_DIR/src/data/search-index.json" 2>&1 | tee -a "$LOG_FILE"; then
            log "Índice de búsqueda generado con éxito."
        else
            log "WARNING: No se pudo generar el índice de búsqueda."
        fi
        # ----------------------------------
        SYNC_OK=true
    else
        log "WARNING: Falló la sincronización de noticias."
        SYNC_OK=false
    fi
fi

if [ "$SYNC_OK" = "true" ]; then
    # --- COMPROBACIÓN DE CAMBIOS O FUERZA ---
    HAS_CHANGES=false
    if [ -f "$PROJECT_DIR/.has_changes" ] && [ "$(cat "$PROJECT_DIR/.has_changes")" = "true" ]; then
        HAS_CHANGES=true
    fi

    if [ "$HAS_CHANGES" = "false" ] && [ "$FORCE_BUILD" = "false" ]; then
        log "=== SIN CAMBIOS: No hay nuevos artículos ni se ha forzado el build. Saltando compilación y deploy. ==="
        update_vps_status 9 "Completado" "Sincronización finalizada. Sin cambios detectados. Sistemas al día." 100
        exit 0
    fi
    # --------------------------------------

    log "Propagando caché, índice de búsqueda y código fuente a /opt/aidaily..."
    if cp src/data/cache-news.json /opt/aidaily/src/data/cache-news.json 2>&1 | tee -a "$LOG_FILE"; then
        log "Caché copiado a /opt/aidaily."
    else
        log "WARNING: No se pudo copiar el caché a /opt/aidaily"
    fi

    if [ -f src/data/search-index.json ]; then
        cp src/data/search-index.json /opt/aidaily/src/data/search-index.json || true
    fi
    if [ -f src/data/articles-light.json ]; then
        cp src/data/articles-light.json /opt/aidaily/src/data/articles-light.json || true
    fi

    log "Sincronizando src/ y public/ y astro.config.mjs con /opt/aidaily..."
    if rsync -art --delete src/ /opt/aidaily/src/ && rsync -art --delete public/ /opt/aidaily/public/ && cp astro.config.mjs /opt/aidaily/astro.config.mjs; then
        log "Sincronización de código fuente a /opt/aidaily completada."
    else
        log "WARNING: Falló la sincronización con rsync, limpiando y ejecutando copia manual limpia..."
        rm -rf /opt/aidaily/src /opt/aidaily/public
        mkdir -p /opt/aidaily/src /opt/aidaily/public
        cp -R src/* /opt/aidaily/src/ 2>&1 | tee -a "$LOG_FILE"
        cp -R public/* /opt/aidaily/public/ 2>&1 | tee -a "$LOG_FILE"
        cp astro.config.mjs /opt/aidaily/astro.config.mjs 2>&1 | tee -a "$LOG_FILE"
    fi

    log "Limpiando directorios de compilación y contingencia para evitar recursividades..."
    rm -rf /opt/aidaily/public/pro
    rm -rf /opt/aidaily/dist
    log "Compilando Astro en /opt/aidaily..."
    update_vps_status 6 "Compilación de Astro" "Generando el build estático de producción (npm run build)..." 20
    
    BUILD_OK=false
    if run_with_retry "(cd /opt/aidaily && BUILD_ONLY=true PUBLIC_BASE_PATH=/pro/aidaily npm run build) 2>&1 | tee -a '$LOG_FILE'"; then
        BUILD_OK=true
    else
        log "⚠️ ADVERTENCIA: Falló la compilación inicial de Astro. Iniciando protocolo de auto-reparación (Fase 1: Limpieza de caché)..."
        update_vps_status 6 "Auto-Reparación (Fase 1)" "Limpiando la caché de Astro y Vite para resolver conflictos transitorios..." 30
        rm -rf /opt/aidaily/.astro /opt/aidaily/node_modules/.vite /opt/aidaily/node_modules/.astro
        
        if run_with_retry "(cd /opt/aidaily && BUILD_ONLY=true PUBLIC_BASE_PATH=/pro/aidaily npm run build) 2>&1 | tee -a '$LOG_FILE'"; then
            log "✅ Auto-reparación exitosa. Astro compilado con éxito tras limpiar la caché."
            BUILD_OK=true
        else
            log "⚠️ ADVERTENCIA: La limpieza de caché no resolvió el fallo. Iniciando protocolo de auto-reparación (Fase 2: Reinstalación limpia de dependencias)..."
            update_vps_status 6 "Auto-Reparación (Fase 2)" "Reinstalando módulos npm de forma limpia en /opt/aidaily..." 50
            (cd /opt/aidaily && rm -rf node_modules package-lock.json && npm install)
            
            if run_with_retry "(cd /opt/aidaily && BUILD_ONLY=true PUBLIC_BASE_PATH=/pro/aidaily npm run build) 2>&1 | tee -a '$LOG_FILE'"; then
                log "✅ Auto-reparación exitosa. Astro compilado con éxito tras reinstalar dependencias."
                BUILD_OK=true
            else
                log "❌ Auto-reparación de compilación fallida. Iniciando protocolo de contingencia (Fase 3: Rollback automático al último backup funcional)..."
                update_vps_status 6 "Auto-Reparación (Fase 3)" "Restaurando la última compilación funcional desde backups..." 80
                
                # Buscar el backup más reciente en /opt/aidaily/backups/
                LATEST_BACKUP=$(ls -t /opt/aidaily/backups/*.tar.gz 2>/dev/null | head -n 1 || true)
                if [ -n "$LATEST_BACKUP" ] && [ -f "$LATEST_BACKUP" ]; then
                    log "Restaurando backup funcional: $LATEST_BACKUP..."
                    mkdir -p /opt/aidaily/dist
                    rm -rf /opt/aidaily/dist/*
                    if tar -xzf "$LATEST_BACKUP" -C /opt/aidaily/dist; then
                        log "✅ Rollback preventivo exitoso. Se ha restaurado la versión funcional anterior para evitar la caída del sitio público."
                        BUILD_OK=true
                    else
                        log "ERROR crítico: No se pudo descomprimir el backup."
                    fi
                else
                    log "ERROR crítico: No se encontraron backups funcionales en /opt/aidaily/backups/ para realizar rollback."
                fi
            fi
        fi
    fi

    if [ "$BUILD_OK" = "true" ]; then
        log "Astro recompilado en /opt/aidaily con éxito."
        update_vps_status 6 "Compilación de Astro" "Build de Astro finalizado con éxito." 100
        
        # Copiar el índice de búsqueda a dist/api/ para que esté disponible en Staging y pase el validador
        mkdir -p /opt/aidaily/dist/api
        cp /opt/aidaily/src/data/search-index.json /opt/aidaily/dist/api/search-index.json || true
        cp /opt/aidaily/src/data/articles-light.json /opt/aidaily/dist/api/articles-light.json || true

        # --- CONTROL DE INTEGRIDAD POST-BUILD (ANTIRROTURAS ESTRICTO DE SINTAXIS Y ASSETS) ---
        log "Iniciando control de integridad y validación de sintaxis en Staging..."
        update_vps_status 7 "Control de Integridad" "Comprobando sintaxis JS de cliente e integridad de assets en Staging..." 15
        
        # Ejecutar nuestro validador avanzado de sintaxis y archivos
        if ! (cd /opt/aidaily && node scripts/validate-staging-build.mjs "/opt/aidaily/dist" 2>&1 | tee -a "$LOG_FILE"); then
            log "❌ CONTROL DE INTEGRIDAD FALLIDO: Sintaxis JS rota o assets ausentes detectados en el build."
            update_vps_status 7 "Control de Integridad (Error)" "Abortando despliegue para evitar pantallas en blanco o errores JS en producción." 100 "Sintaxis o assets rotos"
            
            # Registrar el estado de error en Firebase RTDB
            curl -X PATCH -d "{\"build_status\": {\"ok\": false, \"error\": \"Error de sintaxis JS o assets ausentes en el build compilado. Despliegue cancelado preventivamente.\", \"updatedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}, \"security_token\": \"pecemi_secure_gateway_token_2026_xyz\"}" "https://pecemi-default-rtdb.firebaseio.com/aidaily/sources_status.json" > /dev/null 2>&1 || true
            exit 1
        else
            log "✅ Control de integridad y validación de sintaxis aprobados con éxito."
            update_vps_status 7 "Control de Integridad" "Control de integridad de assets y sintaxis aprobado. Todo correcto." 100
            curl -X PATCH -d "{\"build_status\": {\"ok\": true, \"error\": \"\", \"updatedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}, \"security_token\": \"pecemi_secure_gateway_token_2026_xyz\"}" "https://pecemi-default-rtdb.firebaseio.com/aidaily/sources_status.json" > /dev/null 2>&1 || true
        fi
        # --- FIN CONTROL DE INTEGRIDAD ---
        
        # --- GENERACIÓN DE BACKUP DE LA VERSIÓN ---
        log "Generando backup histórico de esta versión..."
        VERSION=$(node -e "try { console.log(require('/opt/aidaily/package.json').version); } catch(e) { console.log('1.0.0'); }")
        TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
        BACKUP_DIR="/opt/aidaily/backups"
        mkdir -p "$BACKUP_DIR"
        BACKUP_FILE="$BACKUP_DIR/build_v${VERSION}_${TIMESTAMP}.tar.gz"
        
        if tar -czf "$BACKUP_FILE" -C /opt/aidaily/dist .; then
            log "✅ Backup creado con éxito: $BACKUP_FILE"
            echo "v${VERSION} | ${TIMESTAMP} | build_v${VERSION}_${TIMESTAMP}.tar.gz" >> "$BACKUP_DIR/builds-log.txt"
        else
            log "WARNING: No se pudo crear el archivo de backup en $BACKUP_FILE"
        fi
        # ------------------------------------------
        
        log "Sincronizando el build compilado con el workspace de Firebase Hosting..."
        if mkdir -p /home/ubuntu/workspace/public/pro/aidaily && rm -rf /home/ubuntu/workspace/public/pro/aidaily/* && cp -r /opt/aidaily/dist/* /home/ubuntu/workspace/public/pro/aidaily/ 2>&1 | tee -a "$LOG_FILE"; then
            log "Build copiado a /home/ubuntu/workspace/public/pro/aidaily/ con éxito."
            
            # --- AUTO-REPARAR REDIRECCIÓN DE NGINX PARA AIDAILY ---
            log "Comprobando y configurando redirecciones de Nginx para /AIDAILY..."
            NGINX_CONF="/etc/nginx/sites-enabled/algotrading"
            if [ -f "$NGINX_CONF" ]; then
              if ! grep -q "location = /AIDAILY" "$NGINX_CONF"; then
                log "Configurando redirecciones de /AIDAILY a /pro/aidaily/ en Nginx..."
                sudo sed -i '/# IA Daily - Static site/i \    # Redireccion de AIDAILY en mayusculas\n    location = /AIDAILY {\n        return 301 $scheme://$http_host/pro/aidaily/;\n    }\n    location /AIDAILY/ {\n        return 301 $scheme://$http_host/pro/aidaily/;\n    }\n' "$NGINX_CONF"
                if sudo nginx -t; then
                  sudo systemctl reload nginx
                  log "✅ Nginx reconfigurado y reiniciado con éxito."
                else
                  log "⚠️ ADVERTENCIA: La sintaxis de Nginx falló tras insertar las reglas. Revirtiendo..."
                  sudo sed -i '/# Redireccion de AIDAILY/,+6d' "$NGINX_CONF"
                fi
              else
                log "✅ La redirección de Nginx para /AIDAILY ya está activa."
              fi
            fi
            # ----------------------------------------------------

            # Despliegue de Firebase Hosting omitido; la web se sirve 100% de forma directa y local desde el servidor web de la VPS de Oracle.
            log "⚠️ Despliegue en Firebase Hosting desactivado para utilizar el servidor directo de la VPS."
            update_vps_status 8 "Servidor Local VPS" "Compilación copiada al directorio del servidor local. Despliegue completado." 100
        else
            log "WARNING: No se pudo copiar el build al workspace de Firebase Hosting."
        fi
    else
        log "WARNING: Falló la compilación de Astro en /opt/aidaily"
        update_vps_status 6 "Compilación de Astro (Error)" "Falló la compilación de Astro en la VPS. Abortando deploy." 100 "Compilación Astro fallida"
    fi
    log "ERROR: Sincronización interrumpida por fallo del scraper."
    update_vps_status 5 "Procesamiento con IA (Error)" "Falló la sincronización de noticias (Node)." 100 "Falló npm run news:sync"
    exit 1
fi

log "=== Sincronización IA Daily finalizada ==="

# Comprobar si todavía quedan elementos en la cola para procesar de forma continua
echo "Comprobando si quedan noticias pendientes en la cola..."
PENDING_QUEUE=$(curl -s "https://pecemi-default-rtdb.firebaseio.com/aidaily/queue.json")
if [ -n "$PENDING_QUEUE" ] && [ "$PENDING_QUEUE" != "null" ] && [ "$PENDING_QUEUE" != "{}" ]; then
    log "🔥 ATENCIÓN: Aún quedan artículos pendientes en la cola. Relaunching in 2 minutes to keep processing..."
    update_vps_status 9 "Procesamiento Continuo Activo" "Cola con elementos pendientes. Relaunch programado en 2 min." 100
    # Lanzar la ejecución en segundo plano tras esperar 120s, limpiando el bloqueo anterior antes de iniciar
    (sleep 120 && rm -f /var/tmp/aidaily-sync.lock && /home/ubuntu/.hermes/scripts/aidaily_hermes_cron.sh --force) &
else
    update_vps_status 9 "Completado" "Ejecución finalizada con éxito. Cola vacía. Todos los sistemas en línea." 100
fi
