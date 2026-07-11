# IA Daily (AIDAILY) - Portal de Noticias Autónomo 🚀

IA Daily es un sistema integral y autónomo diseñado para agrupar, procesar y publicar noticias sobre Inteligencia Artificial procedentes de múltiples fuentes RSS de todo el mundo, ofreciendo un panel público ultrarrápido y un frontend administrativo avanzado.

## Arquitectura del Proyecto

El sistema se compone de tres partes principales que trabajan en perfecta sintonía:

1. **Frontend / Interfaz Pública (Astro + Vanilla JS/CSS)**
   - Un sitio web estático pre-renderizado (SSG) que carga de forma instantánea.
   - Interfaz y diseño premium con temática oscura (Dark Mode), inspirado en The New York Times, con columnas de análisis, "quick reels", modo teatro (lightbox) y barras de tendencias dinámicas (Tags de 24h, 7d, 30d).
   - Servido directamente desde la VPS en producción a través de Nginx.

2. **Backend de Sincronización (Node.js + Hermes Cron)**
   - Un sistema de Scraping en la nube programado. 
   - Deduplica y filtra artículos que superan un umbral de relevancia evaluado inicialmente por IA rápidas (Llama/Gemma).
   - Realiza la re-redacción completa, abstracción de puntos clave y traducción al español empleando Modelos de Lenguaje Avanzados (LLMs) vía OpenRouter o fallback a Nous/Tencent.

3. **Panel de Administración Inteligente (`admin.html`)**
   - Una aplicación "cascarón" (client-side) en la ruta `/admin` protegida por autenticación.
   - Permite visualizar estadísticas en tiempo real del scraper, el estado del lockfile en la VPS, re-lanzar sincronizaciones a demanda, ajustar el tono periodístico de la IA y monitorizar posibles fallos de despliegue.

## Entorno de Producción y Sincronización 🌐

El despliegue de la plataforma no se delega a servicios externos como Vercel o Netlify, sino que **todo reside y se compila de forma local y automatizada en la VPS de Oracle**. 

- **URL PÚBLICA**: [https://143-47-35-167.sslip.io/pro/aidaily/](https://143-47-35-167.sslip.io/pro/aidaily/)
- **El flujo de despliegue**:
  1. El cron `aidaily_hermes_cron.sh` invoca `sync-aidaily.sh` en el entorno `/opt/aidaily`.
  2. Descarga la cola desde Firebase RTDB, aplica IA, y genera los archivos JSON cacheados localmente.
  3. Ejecuta `npm run build` aislando el directorio `dist`.
  4. Un script de control de calidad (`validate-staging-build.mjs`) comprueba errores de sintaxis en `dist/index.html`.
  5. Si todo es correcto, mueve `dist` a `/home/ubuntu/workspace/public/pro/aidaily` para que Nginx sirva el nuevo frontend al público.

## Rutas y Archivos Importantes

- **Raíz del Proyecto**: `/home/ubuntu/workspace/AIDAILY` (en VPS) y local en Hermes.
- **Configuración SSH de despliegue**: Almacenada internamente por Hermes (usando la clave ssh privada segura para conectar con el servidor `143.47.35.167`).
- **Archivo de IA y Modelos**: `/ayudavps/freemodelsuse/free_models_use.md` (Documentación estricta de proveedores y LLMs gratuitos preferidos para esquivar los paywalls de OpenRouter).
- **Fallback Visuales (Variables de estado)**: Los scripts inline de `index.astro` operan bajo ámbito restringido utilizando sintaxis limpia de ES6 (`var` o top-level if) para sortear colisiones en el empaquetado de Astro.

---

## ⚡ Sincronización en Caliente y Desarrollo (IMPORTANTE)

> [!IMPORTANT]
> **No es necesario conectarse por SSH de forma manual para subir cambios de código:**
> * El entorno de trabajo de esta carpeta local (`C:\Users\yo\Pictures\Descargaspc\0a\hermes\AIDAILY`) está sincronizado mediante **Robocopy** con la carpeta de desarrollo del escritorio:
>   `C:\Users\yo\Desktop\WORKSPACE\AIDAILY`
> * Esta última carpeta está mapeada y sincronizada en caliente con la VPS de Oracle (`/WORKSPACE/AIDAILY` en el servidor) a través de **Syncthing / Syntrazor**.
> * Cualquier cambio, corrección de bugs o edición de archivos que realices en el código local de este proyecto **se propagará de forma instantánea y automática a la VPS**, donde los crons e ingestores automatizados compilarán y aplicarán las correcciones en caliente inmediatamente.
