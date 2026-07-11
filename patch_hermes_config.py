import re

config_path = '/home/ubuntu/.hermes/config.yaml'

print("Leyendo config.yaml de Hermes...")
with open(config_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Modificar el modelo por defecto en la cabecera
old_model_block = """model:
  default: Qwen/Qwen3.5-72B-Instruct
  provider: huggingface"""

new_model_block = """model:
  default: Qwen/Qwen2.5-72B-Instruct
  provider: huggingface"""

if old_model_block in content:
    content = content.replace(old_model_block, new_model_block)
    print("✓ Modelo por defecto actualizado en la cabecera.")
else:
    # Usar regex si hay espacios o diferencias menores
    content = re.sub(
        r'model:\s+default:\s*Qwen/Qwen3\.5-72B-Instruct\s+provider:\s*huggingface',
        'model:\n  default: Qwen/Qwen2.5-72B-Instruct\n  provider: huggingface',
        content
    )
    print("✓ Aplicado reemplazo con regex para modelo por defecto.")

# 2. Modificar el bloque custom_providers
old_providers_block = """custom_providers:
  - name: groq
    base_url: https://api.groq.com/openai/v1
    key_env: GROQ_API_KEY
  - name: cerebras
    base_url: https://api.cerebras.ai/v1
    key_env: CEREBRAS_API_KEY
  - name: huggingface
    base_url: https://api-inference.huggingface.co/v1
    key_env: HF_TOKEN
  - name: ollama-local
    base_url: http://localhost:11434/v1
    api_key: no-key-required"""

new_providers_block = """custom_providers:
  - name: groq
    base_url: https://api.groq.com/openai/v1
    key_env: GROQ_API_KEY
    models:
      - llama-3.3-70b-versatile
      - llama-3.1-8b-instant
      - qwen/qwen3-32b
  - name: cerebras
    base_url: https://api.cerebras.ai/v1
    key_env: CEREBRAS_API_KEY
    models:
      - llama3.1-8b
      - llama3.1-70b
      - llama-3.3-70b
  - name: huggingface
    base_url: https://router.huggingface.co/v1
    key_env: HF_TOKEN
    models:
      - Qwen/Qwen2.5-72B-Instruct
      - meta-llama/Llama-3.3-70B-Instruct
      - meta-llama/Llama-3.2-3B-Instruct
  - name: ollama-local
    base_url: http://localhost:11434/v1
    api_key: no-key-required"""

if old_providers_block in content:
    content = content.replace(old_providers_block, new_providers_block)
    print("✓ Bloque custom_providers actualizado con éxito.")
else:
    # Si hay pequeñas diferencias, hacer un reemplazo de regex o forzar la actualización de la sección
    # Primero buscamos la posición de custom_providers: y la reemplazamos de forma precisa
    idx = content.find("custom_providers:")
    if idx != -1:
        # Encontrar dónde termina la sección (hasta el siguiente comentario o clave principal # ── Fallback Model)
        end_idx = content.find("# ── Fallback Model", idx)
        if end_idx != -1:
            content = content[:idx] + new_providers_block + "\n\n" + content[end_idx:]
            print("✓ Sección custom_providers reemplazada quirúrgicamente por rangos.")
        else:
            print("❌ No se encontró el marcador de fin de la sección.")
    else:
        print("❌ No se encontró la sección custom_providers:")

# Escribir de nuevo el archivo
with open(config_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("✓ Archivo config.yaml guardado con éxito.")
