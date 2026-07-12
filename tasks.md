# 📋 Cerebro Externo: Swarm Tasks - Estabilizacion-Arquitectura-AIDAILY

## 🚀 Hitos del Proyecto
- [x] **Hito 1: Esquema de base de datos unificado y migración de artículos**
- [x] **Hito 2: Pipeline de ingesta e inteligencia editorial Hermes en 5 fases**
- [x] **Hito 3: Ingesta de visitas en Firebase RTDB y cálculo de tendencias de hot topics**
- [x] **Hito 4: Buscador con índices de búsqueda segmentados y paginados**
- [x] **Hito 5: Portada editorial NYT/El País y páginas estáticas de noticias por slug**
- [ ] **Hito 6: Saneamiento de Git, pipeline de compilación unificado y validador de producción**

## 🛠️ Grafo de Tareas (DAG)

### Backlog
- [ ] TAREA-006: Sanear archivos basura de Git, corregir .gitignore y configurar npm run sync unificado en package.json | Depende de: TAREA-002, TAREA-005 | Asignado a: Antigravity | Estado: backlog
- [ ] TAREA-007: Desarrollar scripts/verify-production.js para testeo en vivo tras el despliegue automático | Depende de: TAREA-006 | Asignado a: Antigravity | Estado: backlog

### En Progreso

### Completadas
- [x] TAREA-INIT: Cuestionario de diseño y setup del DAG | Depende de: Ninguna | Asignado a: Antigravity | Estado: completed
- [x] TAREA-001: Definir modelo de datos consolidado de artículos y scripts de migración SQLite | Depende de: Ninguna | Asignado a: Antigravity | Estado: completed
- [x] TAREA-002: Reestructurar scripts/news-sync.js y src/lib/sources.ts para pipeline Hermes de 5 fases | Depende de: TAREA-001 | Asignado a: Hermes | Estado: completed
- [x] TAREA-003: Configurar tracking en caliente de visitas a Firebase RTDB y cron de tendencias hot topics | Depende de: TAREA-001 | Asignado a: Antigravity | Estado: completed
- [x] TAREA-004: Generar índices de búsqueda segmentados y refactorizar el buscador global en cliente con filtros | Depende de: TAREA-001 | Asignado a: Antigravity | Estado: completed
- [x] TAREA-005: Rediseñar la portada tipo NYT/El País y las páginas estáticas de noticias/[slug] con cuerpo enriquecido | Depende de: TAREA-001, TAREA-004 | Asignado a: Antigravity | Estado: completed
