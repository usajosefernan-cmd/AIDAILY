import re

config_path = '/home/ubuntu/.hermes/config.yaml'

print("Leyendo config.yaml para eliminar duplicados...")
with open(config_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Definir el nuevo bloque custom_providers (solo con cerebras y ollama-local)
new_providers_block = """custom_providers:
  - name: cerebras
    base_url: https://api.cerebras.ai/v1
    key_env: CEREBRAS_API_KEY
    models:
      - llama3.1-8b
      - llama3.1-70b
      - llama-3.3-70b
  - name: ollama-local
    base_url: http://localhost:11434/v1
    api_key: no-key-required"""

# Reemplazar la sección custom_providers de forma precisa
idx = content.find("custom_providers:")
if idx != -1:
    end_idx = content.find("# ── Fallback Model", idx)
    if end_idx != -1:
        content = content[:idx] + new_providers_block + "\n\n" + content[end_idx:]
        print("✓ custom_providers limpio de duplicados (groq y huggingface removidos).")
    else:
        # Fallback si no está el marcador
        content = re.sub(r'custom_providers:.*?(?=\n\n|\n# ── Fallback Model)', new_providers_block, content, flags=re.DOTALL)
        print("✓ custom_providers reemplazado usando regex.")
else:
    print("❌ No se encontró la sección custom_providers:")

# 2. Asegurar que el default model sea el de 72B de huggingface nativo
# La clave principal del bot nativo suele ser "huggingface" o "hugging_face".
# La captura del selector de Telegram muestra "Hugging Face (7)" como la nativa.
# En models.py vimos que la key en _PROVIDER_MODELS es "huggingface".
# Por tanto, provider: huggingface es correcto.
content = re.sub(
    r'model:\s+default:\s*Qwen/Qwen2\.5-7B-Instruct\s+provider:\s*huggingface',
    'model:\n  default: Qwen/Qwen2.5-72B-Instruct\n  provider: huggingface',
    content
)
content = re.sub(
    r'model:\s+default:\s*Qwen/Qwen3\.5-72B-Instruct\s+provider:\s*huggingface',
    'model:\n  default: Qwen/Qwen2.5-72B-Instruct\n  provider: huggingface',
    content
)
print("✓ default model forzado a Qwen2.5-72B-Instruct en config.yaml.")

with open(config_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("✓ config.yaml guardado con éxito.")
