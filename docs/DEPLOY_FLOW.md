# AIDAILY — Flujo de Despliegue (Deploy Flow)

Este documento describe el flujo de despliegue seguro establecido para AIDAILY en sus diferentes entornos.

## Entornos de Ejecución
1. **Local (Development)**: Servidor Astro local ejecutándose en `http://localhost:4321/pro/aidaily/`.
2. **Staging (Preview)**: Canal temporal de Firebase Hosting para verificación previa.
3. **Production (Live)**: Sitio web final en producción, servido en `https://pecemi.web.app/pro/aidaily/`.

## Pipeline de Despliegue Seguro (Single Pipeline)
El despliegue se realiza exclusivamente a través de los scripts integrados en `package.json`:

```bash
# 1. Compilar y optimizar en local de forma segura
npm run build:safe

# 2. Desplegar en Staging
npm run deploy:staging

# 3. Verificar Staging
npm run verify:staging

# 4. Desplegar en Producción
npm run deploy:prod

# 5. Verificar Producción en vivo
npm run verify:production
```

## Hosting Real Usado
- **Plataforma**: Firebase Hosting.
- **Configuración de base path**: `/pro/aidaily` (definido a través de `PUBLIC_BASE_PATH` en el `.env`).
- **Directorio de salida de compilación**: `dist/` (generado automáticamente por Astro).
