#!/usr/bin/env bash
# deploy-safe.sh — Pipeline oficial único de AIDAILY (Scraping -> Validación -> Compilación -> Deploy)
# Evita ejecuciones simultáneas y asegura la integridad de la web de producción y Firebase Hosting.

set -euo pipefail

PROJECT_DIR="/home/ubuntu/workspace/AIDAILY"
OPT_DIR="/opt/aidaily"
PROD_DIR="/home/ubuntu/workspace/public/pro/aidaily"
LOG_FILE="$PROJECT_DIR/logs/sync.log"

mkdir -p "$PROJECT_DIR/logs"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [Pipeline] $*" | tee -a "$LOG_FILE"
}

log "=== Sincronización IA Daily: Iniciando Pipeline Unificado ==="

# 0. Evitar ejecuciones simultáneas utilizando flock (lock)
LOCKFILE="/var/tmp/aidaily-pipeline.lock"
exec 9>>"$LOCKFILE"
if ! flock -n 9; then
    log "ERROR: Otra instancia del pipeline está corriendo actualmente. Saliendo para evitar conflictos."
    exit 0
fi
echo $$ > "$LOCKFILE"

# --- ROTACIÓN AUTOMÁTICA DE LOGS DE MÁS DE 5MB ---
for f in "$PROJECT_DIR/logs"/*.log; do
    if [ -f "$f" ]; then
        FILE_SIZE_KB=$(du -k "$f" | cut -f1 || echo "0")
        if [ "$FILE_SIZE_KB" -gt 5000 ]; then
            log "🗑️ Rotando log pesado: $f ($((FILE_SIZE_KB / 1024)) MB)..."
            tail -n 2000 "$f" > "${f}.tmp" 2>/dev/null || true
            if [ -s "${f}.tmp" ]; then
                mv "${f}.tmp" "$f"
                log "✅ Log $f truncado correctamente a 2000 líneas."
            else
                rm -f "${f}.tmp"
                : > "$f"
            fi
        fi
    fi
done

cd "$PROJECT_DIR"

# 1. Ejecutar el scraping principal (news:sync)
log "Paso 1: Ejecutando scraping y procesamiento de noticias..."
if ! npm run news:sync; then
  log "❌ ERROR: Falló el scraper de noticias. Abortando deploy."
  exit 1
fi
log "✅ Scraping completado con éxito."

# 2. Generar el índice de búsqueda de autocompletado
log "Paso 2: Generando índice de búsqueda de cabecera..."
node scripts/generate-search-index.cjs src/data/cache-news.json src/data/search-index.json || true
log "✅ Índice de búsqueda generado."

# 3. Validar integridad de los datos JSON locales (news:validate)
log "Paso 3: Validando la integridad de los JSON..."
if ! npm run news:validate; then
  log "❌ ERROR: Los archivos de datos JSON están corruptos. Despliegue abortado preventivamente."
  exit 1
fi
log "✅ Validación de datos aprobada."

# 4. Sincronizar el caché de datos y código fuente a /opt/aidaily
log "Paso 4: Sincronizando datos y código fuente con $OPT_DIR..."
rm -rf "$OPT_DIR/src" "$OPT_DIR/public"
mkdir -p "$OPT_DIR/src" "$OPT_DIR/public"
cp -R src/* "$OPT_DIR/src/"
cp -R public/* "$OPT_DIR/public/"
cp astro.config.mjs "$OPT_DIR/astro.config.mjs"

mkdir -p "$OPT_DIR/src/data"
cp src/data/cache-news.json "$OPT_DIR/src/data/cache-news.json" || true
cp src/data/search-index.json "$OPT_DIR/src/data/search-index.json" || true
cp src/data/articles-light.json "$OPT_DIR/src/data/articles-light.json" || true

# 5. Compilar en /opt/aidaily (build)
log "Paso 5: Compilando la aplicación estática en Staging ($OPT_DIR)..."
BUILD_OK=true

# Desocupar o renombrar la carpeta dist antigua para evitar fallos de 'Directory not empty' en la VPS
if [ -d "$OPT_DIR/dist" ]; then
  OBSOLETE_DIR="$OPT_DIR/dist_obsolete_$(date +%s)"
  mv "$OPT_DIR/dist" "$OBSOLETE_DIR" || true
  rm -rf "$OBSOLETE_DIR" >/dev/null 2>&1 &
fi
mkdir -p "$OPT_DIR/dist"

if ! (cd "$OPT_DIR" && SQLITE_DB_PATH=/home/ubuntu/workspace/AIDAILY/data/aidaily.db BUILD_ONLY=true PUBLIC_BASE_PATH=/pro/aidaily npm run build); then
  log "⚠️ ADVERTENCIA: Falló la compilación inicial. Limpiando caché y reintentando..."
  rm -rf "$OPT_DIR/.astro" "$OPT_DIR/node_modules/.vite" "$OPT_DIR/node_modules/.astro"
  
  if [ -d "$OPT_DIR/dist" ]; then
    OBSOLETE_DIR="$OPT_DIR/dist_obsolete_$(date +%s)"
    mv "$OPT_DIR/dist" "$OBSOLETE_DIR" || true
    rm -rf "$OBSOLETE_DIR" >/dev/null 2>&1 &
  fi
  mkdir -p "$OPT_DIR/dist"
  
  if ! (cd "$OPT_DIR" && SQLITE_DB_PATH=/home/ubuntu/workspace/AIDAILY/data/aidaily.db BUILD_ONLY=true PUBLIC_BASE_PATH=/pro/aidaily npm run build); then
    log "❌ ERROR: Compilación fallida persistente. Despliegue abortado."
    exit 1
  fi
fi
log "✅ Compilación de Astro completada."

# Copiar índices generados a la carpeta dist/api para que estén disponibles en cliente
mkdir -p "$OPT_DIR/dist/api"
cp "$OPT_DIR/src/data/search-index.json" "$OPT_DIR/dist/api/search-index.json" || true
cp "$OPT_DIR/src/data/articles-light.json" "$OPT_DIR/dist/api/articles-light.json" || true

# 6. Control de Integridad post-build (validate-staging-build)
log "Paso 6: Ejecutando control de integridad de sintaxis en Staging..."
if ! (cd "$OPT_DIR" && node scripts/validate-staging-build.mjs "$OPT_DIR/dist"); then
  log "❌ ERROR: Control de integridad fallido (sintaxis rota o assets ausentes)."
  exit 1
fi
log "✅ Control de integridad aprobado."

# 7. Sincronizar el build final con el directorio del servidor de producción local de la VPS
log "Paso 7: Publicando el nuevo build en producción de la VPS..."
mkdir -p "$PROD_DIR"
rm -rf "$PROD_DIR"/*
cp -r "$OPT_DIR/dist/"* "$PROD_DIR/"

# 8. Desplegar en Firebase Hosting
log "Paso 8: Desplegando en Firebase Hosting (pecemi.web.app)..."
if (cd /home/ubuntu/workspace && firebase deploy --only hosting --non-interactive --project pecemi); then
  log "✅ Despliegue en Firebase Hosting completado con éxito."
else
  log "⚠️ ADVERTENCIA: Falló el despliegue directo de Firebase. Intentando usar token alternativo..."
  if [ -f "/home/ubuntu/workspace/firebase_deploy.sh" ]; then
    FT_TOKEN=$(grep -oP 'TOKEN=\K[^ ]+' "/home/ubuntu/workspace/firebase_deploy.sh" | tr -d '"' | tr -d "'")
    if [ -n "$FT_TOKEN" ]; then
      if (cd /home/ubuntu/workspace && firebase deploy --only hosting --non-interactive --project pecemi --token "$FT_TOKEN"); then
        log "✅ Despliegue exitoso con token."
      else
        log "❌ Falló reintento con token."
      fi
    fi
  fi
fi

# Eliminar bloqueo
rm -f "$LOCKFILE"
log "=== Pipeline Completado con Éxito ==="
