# AIDAILY — Arquitectura del Proyecto (Project Architecture)

Este documento describe la estructura base y la relación entre la aplicación web (Astro) y el motor de automatización (Hermes).

## Estructura del Código

```
/src
  /components     # Componentes de UI de Astro (NewsCard, RelatedArticles, etc.)
  /layouts        # Layout base común para las páginas
  /pages          # Enrutamiento de Astro (index.astro, noticias/[slug].astro)
  /lib            # Código de utilidad para el frontend
  /styles         # CSS Vanilla y temas de color

/lib              # Librerías comunes y algoritmos compartidos (Node/Browser)
  /ai             # Rotación de proveedores e integraciones con LLMs
  /agents         # Agentes especializados del pipeline editorial
  slug.js         # Normalización y estabilidad de slugs
  dedupe.js       # Algoritmo Jaccard de deduplicación
  scoring.js      # Puntuación de urgencia y tendencias

/scripts          # Scripts de automatización y crons ejecutables en Node.js
  news-sync.js              # Sincronización e ingesta de feeds
  hot-topics-cron.js        # Cálculo de tendencias y decay cada 2 horas
  ensure-article-slugs.js   # Saneamiento de slugs en SQLite y JSON
  build-related-articles.js # Cálculo estático de artículos relacionados
  generate-search-index.cjs # Generación de índices de buscador segmentado
  validate-news-data.js     # QA e integridad de datos antes del build
```

## Independencia del Frontend
- **Desacoplamiento total**: La web de Astro debe funcionar perfectamente de forma estática aunque Hermes (el pipeline de IA) esté apagado o no tenga acceso a la VPS.
- **Acceso a datos**: La aplicación web consume los datos almacenados localmente en SQLite (`data/aidaily.db`) y cachés estáticas pregeneradas (`src/data/cache-news.json` y `public/api/search/`), asegurando máxima velocidad y tolerancia a fallos de red.
