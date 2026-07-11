# Workflow de Routing Multi-Proveedor para AIDAILY

Este documento describe el sistema de routing óptimo implementado en `src/lib/sources.ts` para alternar entre proveedores de IA durante el procesamiento de noticias del cron AIDAILY.

---

## 1. Arquitectura del Router

El router ejecuta **3 niveles de proveedor** en orden degradado inteligente, con penalización automática por fallos recientes y round-robin interno en cada pool.

```
Intento de noticia
       │
       ▼
[ Nivel 1 : OPENROUTER ]  ← Pool de modelos free, round-robin, 20s timeout
       │
       ▼  (si falla)
[ Nivel 2 : NOUS ]        ← stepfun/step-3.7-flash:free, 120s timeout
       │
       ▼  (si falla)
[ Nivel 3 : OLLAMA ]      ← Pool local (gemma2, llama3.2), round-robin, 45s timeout
       │
       ▼  (si falla)
[ Fallback estático ]     ← Resumen hardcodeado, sin IA
```

### 1.1 Regla de Preferencia del Usuario

Si el modelo preferido en `orientation.model` pertenece a Nous/StepFun (`stepfun/*` o `nousresearch/*`):
- **Nous => Nivel 1**
- **OpenRouter => Nivel 2**
- **Ollama => Nivel 3**

En cualquier otro caso:
- **OpenRouter => Nivel 1**
- **Nous => Nivel 2**
- **Ollama => Nivel 3**

### 1.2 Modelo Preferido Actual

El modelo preferido configurado en Firebase es **`openai/gpt-oss-20b:free`**, seleccionado mediante benchmark de calidad de redacción en español (latencia 2.6s, cifras precisas, español impecable).

---

## 2. Mecanismos de Resiliencia

| Mecanismo | Descripción |
|-----------|-------------|
| **Penalización por fallos** | `modelFailures` (Map global) guarda timestamp del último fallo. `FAILURE_PENALTY_MS` evita reintentar el mismo modelo en X minutos. |
| **Backoff entre proveedores** | `delayBetweenProviders = 3000ms` entre cambio de nivel. |
| **Backoff entre modelos** | OpenRouter: `5000ms`. Ollama: `2000ms`. |
| **Timeouts dinámicos** | OpenRouter: 20s. Nous: 120s. Ollama: 45s. |
| **Token dinámico Nous** | Usa `get_nous_token.py` para renovar OAuth antes de cada intento. |
| **Retry automático** | `fetchWithRetry` con 2-3 reintentos y backoff exponencial. |

---

## 3. Configuración de Variables de Entorno

Variables en el `.env` de AIDAILY que controlan el comportamiento del router:

```bash
# Modelo preferido principal (configurado en Firebase RTDB config/orientation/model)
# Actual: openai/gpt-oss-20b:free

# Ollama: solo los 2 modelos instalados en la VPS
OLLAMA_TEXT_MODELS=llama3.2,gemma2

# Ollama: modelo principal para redacción (fallback final)
OLLAMA_TEXT_MODEL=gemma2

# Ollama: modelo ligero para pre-filtrado binario de spam
OLLAMA_FILTER_MODEL=llama3.2

# Ollama: tokens máximos de salida para generación local
OLLAMA_TEXT_MAX_TOKENS=2000

# Ollama: caracteres máximos del prompt enviado a modelos locales
OLLAMA_TEXT_CONTEXT_CHARS=4000
```

### 3.1 Modelos OpenRouter Free (Pool interno)

```typescript
const whitelist = [
  'openrouter/free',
  'liquid/lfm-2.5-1.2b-instruct:free',
  'google/gemma-4-26b-a4b-it:free',
  'google/gemma-4-31b-it:free',
  'openai/gpt-oss-20b:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  // ... más modelos en getAIModelsList()
];
```

### 3.2 Benchmark de Modelos Free (Junio 2026)

| Modelo | Latencia | Calidad ES | Observación |
|--------|----------|-----------|-------------|
| **openai/gpt-oss-20b:free** | 2.6s | ⭐⭐⭐⭐⭐ | **Preferido**. Español perfecto, cifras correctas |
| nvidia/nemotron-3-nano-30b-a3b:free | 1.4s | ⭐⭐⭐⭐⭐ | Excelente alternativa rápida |
| google/gemma-4-26b-a4b-it:free | 2.8s | ⭐⭐⭐⭐ | Buena prosa, algo verboso |
| google/gemma-4-31b-it:free | 5.9s | ⭐⭐⭐⭐ | Buena calidad pero lento |
| liquid/lfm-2.5-1.2b-instruct:free | 1.1s | ⭐⭐ | Rápido pero alucina cifras |
| nvidia/nemotron-3-super-120b-a12b:free | 2.5s | ⭐ | Responde en inglés |
| openai/gpt-oss-120b:free | 0.6s | 💀 | Content null siempre |

---

## 4. Parámetros por Proveedor

| Proveedor | Timeout | Max Tokens | Contexto | Temperatura |
|-----------|---------|------------|----------|-------------|
| **OpenRouter** | 35s | 4000 | 6000 chars | 0.5 |
| **Nous** | 120s | 4000 | 6000 chars | 0.5 |
| **Ollama** | 45s | `OLLAMA_TEXT_MAX_TOKENS` | `OLLAMA_TEXT_CONTEXT_CHARS` | 0.3 |

---

## 5. Flujo de Ejecución por Artículo

1. `evaluateCandidateWithLocalOllama` filtra spam irrelevante con **llama3.2** en ~2s.
2. `generateAIContent` ejecuta el router:
   - Si el modelo preferido es local/ollama, saltar OpenRouter e ir directo a Ollama.
   - Si el modelo preferido es Nous, Nous primero, OpenRouter segundo.
   - Si el modelo preferido es cualquier otro, OpenRouter primero, Nous segundo, Ollama tercero.
3. Cada éxito/fail se registra en `modelFailures`.
4. Logs detallados por proveedor/modelo en `logs/sync.log`.

---

## 6. Monitoreo

Revisar `logs/sync.log` para trazas como:

```
[OpenRouter] Intentando generar contenido con modelo: openai/gpt-oss-20b:free
[OpenRouter] ¡Éxito procesando con openai/gpt-oss-20b:free!
[Nous Research] Saltando Nous por penalización reciente
[Texto local] Consultando a gemma2 en Ollama local...
[Texto local] ¡Éxito procesando con Ollama local!
```

---

## 7. Modelos Ollama Locales Instalados

Solo 2 modelos optimizados para la VPS ARM64 (24 GB RAM):

| Modelo | Parámetros | RAM | Velocidad | Rol |
|--------|-----------|-----|-----------|-----|
| **gemma2** | 9.2B | ~5.5 GB | 6-10 t/s | Redacción de noticias (calidad literaria en español) |
| **llama3.2** | 3.2B | ~2.0 GB | 15-25 t/s | Pre-filtrado binario rápido de spam |
