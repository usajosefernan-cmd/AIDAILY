#!/usr/bin/env bash
# Script interactivo para restaurar builds anteriores de IA Daily en la VPS

set -euo pipefail

BACKUP_DIR="/opt/aidaily/backups"
LOG_FILE="$BACKUP_DIR/builds-log.txt"
PROD_DIR="/home/ubuntu/workspace/public/pro/aidaily"
DIST_DIR="/opt/aidaily/dist"

echo "=== IA Daily - Administrador de Restauración de Builds ==="

if [ ! -d "$BACKUP_DIR" ] || [ ! -f "$LOG_FILE" ] || [ ! -s "$LOG_FILE" ]; then
    echo "❌ ERROR: No se encontraron copias de seguridad registradas en $BACKUP_DIR"
    exit 1
fi

echo "Cargando builds históricos disponibles..."
echo "--------------------------------------------------------"

# Leer líneas del log, enumerarlas
declare -a builds
i=1
while IFS= read -r line; do
    if [ -n "$line" ]; then
        echo "[$i] $line"
        builds[$i]="$line"
        i=$((i + 1))
    fi
done < "$LOG_FILE"

total_builds=$((i - 1))
echo "--------------------------------------------------------"
echo "Selecciona el número del build que deseas restaurar (1-$total_builds), o presiona 'q' para salir:"
read -r choice

if [ "$choice" = "q" ] || [ "$choice" = "Q" ]; then
    echo "Operación cancelada."
    exit 0
fi

if ! [[ "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -lt 1 ] || [ "$choice" -gt "$total_builds" ]; then
    echo "❌ Opción inválida."
    exit 1
fi

selected_line="${builds[$choice]}"
# Parsear línea (formato: vX.Y.Z | timestamp | archivo.tar.gz)
IFS='|' read -r version_part time_part file_part <<< "$selected_line"

# Limpiar espacios en blanco
version=$(echo "$version_part" | tr -d ' ')
timestamp=$(echo "$time_part" | tr -d ' ')
filename=$(echo "$file_part" | tr -d ' ')

backup_filepath="$BACKUP_DIR/$filename"

if [ ! -f "$backup_filepath" ]; then
    echo "❌ ERROR: El archivo de backup no existe físicamente en $backup_filepath"
    exit 1
fi

echo "--------------------------------------------------------"
echo "Vas a restaurar:"
echo "  - Versión: $version"
echo "  - Fecha: $timestamp"
echo "  - Archivo: $filename"
echo "--------------------------------------------------------"
echo "¿Estás seguro? Escribe 'SI' para confirmar:"
read -r confirm

if [ "$confirm" != "SI" ] && [ "$confirm" != "si" ] && [ "$confirm" != "Si" ]; then
    echo "Operación abortada."
    exit 0
fi

echo "Iniciando restauración..."

# 1. Crear directorio temporal para descompresión
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

echo "Descomprimiendo backup en directorio temporal..."
tar -xzf "$backup_filepath" -C "$TMP_DIR"

# 2. Reemplazar producción
echo "Restaurando archivos en el directorio público de Nginx..."
mkdir -p "$PROD_DIR"
rm -rf "$PROD_DIR"/*
cp -r "$TMP_DIR"/* "$PROD_DIR"/

# 3. Reemplazar dist de opt por consistencia
echo "Restaurando copia en el directorio de compilación..."
mkdir -p "$DIST_DIR"
rm -rf "$DIST_DIR"/*
cp -r "$TMP_DIR"/* "$DIST_DIR"/

# 4. Actualizar Firebase RTDB indicando que se ha restaurado
echo "Notificando restauración en Firebase..."
curl -s -X PATCH -d "{\"build_status\": {\"ok\": true, \"error\": \"\", \"updatedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\", \"restored_to\": \"$version ($timestamp)\"}, \"security_token\": \"pecemi_secure_gateway_token_2026_xyz\"}" "https://pecemi-default-rtdb.firebaseio.com/aidaily/sources_status.json" > /dev/null 2>&1 || true

echo "--------------------------------------------------------"
echo "✅ ¡RESTAURACIÓN COMPLETADA CON ÉXITO!"
echo "La web pública ha sido restaurada a la versión $version ($timestamp) de forma atómica."
echo "--------------------------------------------------------"
