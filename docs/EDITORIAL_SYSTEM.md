# AIDAILY — Sistema Editorial IA (Editorial System)

Este documento detalla las directrices del pipeline editorial inteligente operado por Hermes en apoyo a Antigravity.

## Criterio Editorial de Contenidos

### Temas de Prioridad Alta
- **IA Generativa y Modelos**: Lanzamientos, benchmarks y análisis de OpenAI, Anthropic, Google DeepMind, Meta AI, Nvidia, Apple Intelligence, etc.
- **Tecnología e Infraestructura**: Chips (GPUs, ASICs), cloud computing, robótica humanoide, agentes autónomos e impacto laboral de la IA.
- **Soberanía y Regulación**: Regulaciones de IA (EU AI Act, etc.), ciberseguridad, financiamientos de startups de IA y adquisiciones tecnológicas relevantes.

### Temas de Prioridad Media
- **Tecnología General**: Big Tech, software libre, herramientas de productividad digital, privacidad de datos y fintech.

### Temas Descartados (Baja Prioridad)
- Deportes convencionales, entretenimiento general sin implicancia de IA, noticias virales sin fuentes verificadas y clickbait sin rigor científico.

## Regla de Balance de Portada (70/30)
- **70% Temas Calientes (Hot Topics)**: Noticias de última hora, lanzamientos inmediatos, regulaciones urgentes y eventos en pleno desarrollo.
- **30% Análisis y Evergreen**: Guías de herramientas de IA, análisis a fondo, tutoriales y explicaciones de contexto tecnológico.

## Política de Modelos de Redacción y QA
- **Prohibido**: Publicar artículos completos redactados con modelos de IA de bajo coste (por ejemplo, Llama 3.2 3B o Gemma 2 2B en tareas complejas). Los modelos baratos solo pueden emplearse en clasificación, tagging o deduplicación rápida.
- **Obligatorio (Redacción)**: Todo artículo principal debe ser redactado utilizando un modelo inteligente (por ejemplo, Claude 3.5 Sonnet, GPT-4o, Gemini 1.5 Pro).
- **Obligatorio (QA cruzado)**: El agente de redacción (Writer Agent) y el agente de control de calidad (QA Agent) deben usar modelos o proveedores distintos para evitar la autovalidación de sesgos.
