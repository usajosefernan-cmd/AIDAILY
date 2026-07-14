#!/usr/bin/env bash
# deploy-safe.sh — Script de compilación y despliegue seguro para AIDAILY
# Verifica la integridad de los datos, realiza backups automáticos y rollback preventivo.

set -euo pipefail

PROJECT_DIR="/home/ubuntu/workspace/AIDAILY"
OPT_DIR="/opt/aidaily"
PROD_DIR="/home/ubuntu/workspace/public/pro/aidaily"
BACKUP_DIR="$OPT_DIR/backups"

# Cambiar al directorio del proyecto para la ejecución de comandos npm
cd "$PROJECT_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [Deploy] $*"
}

log "=== Iniciando Despliegue Seguro ==="

# 1. Validar integridad de los datos JSON locales
log "Paso 1: Validando la integridad de los JSON..."
if ! npm run news:validate; then
  log "❌ ERROR: Los archivos de datos JSON están corruptos o incompletos. Despliegue abortado preventivamente para evitar fallos de producción."
  exit 1
fi
log "✅ Validación de datos aprobada."

# 2. Sincronizar el caché de datos del workspace a /opt/aidaily
log "Paso 2: Sincronizando datos y código fuente con $OPT_DIR..."

log "Generando índices de búsqueda en el workspace..."
node scripts/generate-search-index.cjs src/data/cache-news.json src/data/search-index.json || true

# Copia manual de código fuente a /opt/aidaily (primero limpiar y copiar código)
rm -rf "$OPT_DIR/src" "$OPT_DIR/public"
mkdir -p "$OPT_DIR/src" "$OPT_DIR/public"
cp -R src/* "$OPT_DIR/src/"
cp -R public/* "$OPT_DIR/public/"
cp astro.config.mjs "$OPT_DIR/astro.config.mjs"

# Copiar los JSONs de datos después de haber copiado la carpeta src
mkdir -p "$OPT_DIR/src/data"
cp src/data/cache-news.json "$OPT_DIR/src/data/cache-news.json" || true
cp src/data/search-index.json "$OPT_DIR/src/data/search-index.json" || true
cp src/data/articles-light.json "$OPT_DIR/src/data/articles-light.json" || true

if [ -f data/hot-topics.json ]; then
  cp data/hot-topics.json "$OPT_DIR/src/data/hot-topics.json" || true
fi
if [ -f data/breaking-news.json ]; then
  cp data/breaking-news.json "$OPT_DIR/src/data/breaking-news.json" || true
fi

# 3. Realizar un backup temporal del build anterior
log "Paso 3: Creando backup temporal de la versión anterior..."
mkdir -p "$BACKUP_DIR"
LATEST_BACKUP="$BACKUP_DIR/deploy_rollback_temp.tar.gz"
if [ -d "$OPT_DIR/dist" ]; then
  tar -czf "$LATEST_BACKUP" -C "$OPT_DIR/dist" . || true
fi

# 4. Compilar en /opt/aidaily
log "Paso 4: Compilando la aplicación en $OPT_DIR..."
BUILD_OK=true
(cd "$OPT_DIR" && BUILD_ONLY=true PUBLIC_BASE_PATH=/pro/aidaily npm run build) || BUILD_OK=false

if [ "$BUILD_OK" = "false" ]; then
  log "⚠️ ADVERTENCIA: Falló la compilación inicial de Astro. Iniciando limpieza de caché y re-compilación..."
  rm -rf "$OPT_DIR/.astro" "$OPT_DIR/node_modules/.vite" "$OPT_DIR/node_modules/.astro"
  
  (cd "$OPT_DIR" && BUILD_ONLY=true PUBLIC_BASE_PATH=/pro/aidaily npm run build) || {
    log "❌ ERROR: Compilación fallida de forma persistente. Iniciando protocolo de rollback..."
    if [ -f "$LATEST_BACKUP" ]; then
      mkdir -p "$OPT_DIR/dist"
      rm -rf "$OPT_DIR/dist/*"
      tar -xzf "$LATEST_BACKUP" -C "$OPT_DIR/dist"
      log "✅ Rollback preventivo completado. Se restauró el build funcional anterior en $OPT_DIR/dist."
    else
      log "❌ ERROR crítico: No se encontró un backup temporal para realizar rollback."
    fi
    exit 1
  }
fi
log "✅ Compilación completada con éxito."

# Copiar índices generados a la carpeta dist/api para el buscador
mkdir -p "$OPT_DIR/dist/api"
cp "$OPT_DIR/src/data/search-index.json" "$OPT_DIR/dist/api/search-index.json" || true
cp "$OPT_DIR/src/data/articles-light.json" "$OPT_DIR/dist/api/articles-light.json" || true


# 5. Control de Integridad post-build
log "Paso 5: Ejecutando control de integridad de sintaxis en Staging..."
if ! (cd "$OPT_DIR" && node scripts/validate-staging-build.mjs "$OPT_DIR/dist"); then
  log "❌ ERROR: Control de integridad fallido (sintaxis rota o archivos de assets faltantes). Ejecutando rollback..."
  if [ -f "$LATEST_BACKUP" ]; then
    mkdir -p "$OPT_DIR/dist"
    rm -rf "$OPT_DIR/dist/*"
    tar -xzf "$LATEST_BACKUP" -C "$OPT_DIR/dist"
    log "✅ Rollback completado."
  fi
  exit 1
fi
log "✅ Control de integridad aprobado."

# 6. Generar backup histórico permanente
log "Paso 6: Guardando backup histórico permanente de esta versión..."
VERSION=$(node -e "try { console.log(require('$OPT_DIR/package.json').version); } catch(e) { console.log('1.0.0'); }")
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
HISTORIC_BACKUP="$BACKUP_DIR/build_v${VERSION}_${TIMESTAMP}.tar.gz"
tar -czf "$HISTORIC_BACKUP" -C "$OPT_DIR/dist" .
echo "v${VERSION} | ${TIMESTAMP} | build_v${VERSION}_${TIMESTAMP}.tar.gz" >> "$BACKUP_DIR/builds-log.txt"

# 7. Sincronizar el build final con el directorio del servidor de producción local
log "Paso 7: Publicando el nuevo build en producción..."
mkdir -p "$PROD_DIR"
rm -rf "$PROD_DIR/*"
cp -r "$OPT_DIR/dist/"* "$PROD_DIR/"

# 8. Auto-reparar la redirección estética de la URL en Nginx (si no está ya configurada)
log "Paso 8: Comprobando y configurando redirecciones de Nginx..."
NGINX_CONF="/etc/nginx/sites-enabled/algotrading"
if [ -f "$NGINX_CONF" ]; then
  if ! grep -q "location = /AIDAILY" "$NGINX_CONF"; then
    log "Configurando redirecciones de /AIDAILY a /pro/aidaily/ en Nginx..."
    # Insertar el bloque de redirección antes de la línea '# IA Daily - Static site'
    sudo sed -i '/# IA Daily - Static site/i \    # Redireccion de AIDAILY en mayusculas\n    location = /AIDAILY {\n        return 301 $scheme://$http_host/pro/aidaily/;\n    }\n    location /AIDAILY/ {\n        return 301 $scheme://$http_host/pro/aidaily/;\n    }\n' "$NGINX_CONF"
    
    # Comprobar sintaxis y reiniciar Nginx
    if sudo nginx -t; then
      sudo systemctl reload nginx
      log "✅ Nginx reconfigurado y reiniciado con éxito."
    else
      log "⚠️ ADVERTENCIA: La sintaxis de Nginx falló tras insertar las reglas. Revirtiendo cambios..."
      sudo sed -i '/# Redireccion de AIDAILY/,+6d' "$NGINX_CONF"
    fi
  else
    log "✅ La redirección de Nginx para /AIDAILY ya está activa."
  fi
else
  log "⚠️ ADVERTENCIA: No se encontró el archivo de Nginx en $NGINX_CONF. Saltando paso de redirección."
fi

log "=== Despliegue Finalizado con Éxito en Producción ==="
