# Antigravity & Hermes Operating Rules

## 1. Local-First Development
- Todo el desarrollo, edición de archivos y compilación inicial debe realizarse **100% local** en el directorio del repositorio `c:\Users\yo\Desktop\WORKSPACE\AIDAILY`.
- No usar `scripts/run-vps-command.ts` ni bridges de red con la VPS a menos que se solicite explícitamente y se valide previamente que el bridge está activo.
- Confiar en Syncthing/Synctrazor para la propagación automática de cambios locales a la VPS.

## 2. Flujo de Trabajo y Entornos
- Prohibido tocar o desplegar en Producción si antes fallan las pruebas en Local o Staging.
- Flujo obligatorio:
  1. `npm run dev` -> Probar en `http://localhost:4321/pro/aidaily/`
  2. `npm run verify:local` -> Verificar integridad local
  3. `npm run build:safe` -> Compilar Astro de forma segura
  4. `npm run preview` -> Probar build en `http://localhost:4322/pro/aidaily/`
  5. `npm run deploy:staging` -> Desplegar en canal preview
  6. `npm run verify:staging` -> Validar staging
  7. `npm run deploy:prod` -> Desplegar en vivo
  8. `npm run verify:production` -> Validar producción final en vivo

## 3. Comportamiento en Terminal y Tareas
- Si un comando bridge o de red tarda más de 30 segundos, cancelarlo de inmediato con `manage_task kill` y reportar: `BLOCKED: command bridge no responde`.
- No reportar esperas o expiraciones de timers como progreso.
- Toda tarea en `tasks.md` debe ser real, ejecutable y con resultados verificables en el repositorio local. No simular subagentes.
