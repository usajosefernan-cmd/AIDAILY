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

## 4. Antigravity & Hermes Roles
- Antigravity construye AIDAILY.
- Hermes automatiza partes de AIDAILY.
- Controlar Hermes es una función extra de Antigravity, no su única misión.
- La web debe funcionar aunque Hermes esté apagado.
- La automatización debe mejorar la web, no sustituir su arquitectura.

## 5. Reglas Globales de Desarrollo y Operación
1. No desarrollar usando VPS.
2. No depender de scripts remotos para construir la app.
3. No usar `scripts/run-vps-command.ts` salvo para cron, deploy o automatización real.
4. Si el bridge/VPS tarda más de 30 segundos, detener y reportar: `BLOCKED: command bridge no responde`.
5. No decir “esperando herramientas” como progreso.
6. No marcar tareas como completadas sin comando ejecutado y resultado.
7. No hacer deploy si local falla.
8. No hacer deploy si build falla.
9. No hacer producción si staging falla.
10. No ocultar errores con CSS.
11. No tocar Nginx en cada deploy recurrentemente.
12. No meter logs, dist, backups, cachés ni datos generados en Git.
13. No publicar noticias sin slug.
14. No publicar artículos sin QA.
15. No usar modelos IA baratos para redactar artículos completos.
16. No mezclar portada, artículo y lectura infinita en una misma vista confusa.
17. Cada noticia debe tener página independiente.
18. La web debe funcionar sin Hermes.
19. Hermes debe ser modular y controlable.
20. Si falta acceso a VPS/Firebase, seguir trabajando localmente.
21. PROHIBIDO subir archivos de configuración local (.env), credenciales de bases de datos, tokens de API o cualquier dato sensible a GitHub. Validar siempre con 'git status' y asegurar su exclusión.
