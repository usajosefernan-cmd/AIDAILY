#!/usr/bin/env python3
"""
Audit rápido de modelos free en Hermes.
- Incluye modelos pequeños de OpenRouter.
- Quita el bloqueo de contexto solo durante el test: parchea model.context_length
  a 262144 en ~/.hermes/config.yaml, ejecuta, y RESTAURA el original al terminar.
- No consume apenas tokens: cada prueba es `hermes chat -q ping` con --quiet.
- Sobrescribe un único archivo JSON en la carpeta del cron.
"""
import subprocess, json, time, shutil, re
from datetime import datetime, timezone
from pathlib import Path

CRON_DIR = Path('/home/ubuntu/.hermes/cron')
OUT = CRON_DIR / 'free_models_audit.json'
BACKUP = CRON_DIR / 'free_models_audit.previous.json'
LOG = CRON_DIR / 'free_models_audit.log'
CONFIG = Path('/home/ubuntu/.hermes/config.yaml')
CONFIG_BAK = Path('/home/ubuntu/.hermes/config.yaml.bak-freemodels')

MODELS = [
    # (provider, model, nota)
    ('nous', 'stepfun/step-3.7-flash:free', 'free confirmed'),
    ('openrouter', 'meta-llama/llama-3.3-70b-instruct:free', ''),
    ('openrouter', 'google/gemma-4-31b-it:free', ''),
    ('openrouter', 'google/gemma-4-26b-a4b-it:free', ''),
    ('openrouter', 'nvidia/nemotron-3-ultra-550b-a55b:free', ''),
    ('openrouter', 'qwen/qwen3-coder:free', ''),
    ('openrouter', 'openai/gpt-oss-120b:free', ''),
    ('openrouter', 'tencent/hy3:free', ''),
    ('openrouter', 'cohere/north-mini-code:free', ''),
    ('openrouter', 'poolside/laguna-xs-2.1:free', ''),
    ('openrouter', 'nvidia/nemotron-3-nano-30b-a3b:free', ''),
    ('openrouter', 'nvidia/nemotron-nano-9b-v2:free', ''),
    # pequeños
    ('openrouter', 'meta-llama/llama-3.2-3b-instruct:free', 'small'),
    ('openrouter', 'liquid/lfm-2.5-1.2b-instruct:free', 'small'),
    ('openrouter', 'liquid/lfm-2.5-1.2b-thinking:free', 'small'),
    ('openrouter', 'cognitivecomputations/dolphin-mistral-24b-venice-edition:free', 'small'),
]

def patch_config():
    """Sube context_length a 262144 para evitar el bloqueo de arranque de Hermes."""
    text = CONFIG.read_text()
    if re.search(r'^\s*context_length:\s*\d+', text, re.M):
        # ya existe: lo elevamos temporalmente
        patched = re.sub(r'^\s*context_length:\s*\d+', '  context_length: 262144', text, count=1, flags=re.M)
    else:
        patched = text.replace('model:\n', 'model:\n  context_length: 262144\n', 1)
    CONFIG_BAK.write_text(text)  # backup del original
    CONFIG.write_text(patched)

def restore_config():
    if CONFIG_BAK.exists():
        CONFIG.write_text(CONFIG_BAK.read_text())
        CONFIG_BAK.unlink(missing_ok=True)

def probe(provider, model):
    start = time.time()
    cmd = ['hermes', 'chat', '-q', 'ping', '-m', model, '--provider', provider, '--quiet']
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        latency_ms = round((time.time() - start) * 1000, 1)
        out = proc.stdout.strip()
        err = proc.stderr.strip()
        ok = (proc.returncode == 0 and 'error' not in out.lower()
              and 'rate limit' not in out.lower() and '429' not in out
              and '404' not in out and 'context' not in out.lower())
        return {
            'provider': provider, 'model': model,
            'status_code': proc.returncode, 'latency_ms': latency_ms,
            'result': 'ok' if ok else 'error',
            'stdout': out[:300], 'stderr': err[:300],
        }
    except subprocess.TimeoutExpired:
        return {'provider': provider, 'model': model, 'status_code': None,
                'latency_ms': round((time.time() - start) * 1000, 1),
                'result': 'timeout', 'stdout': '', 'stderr': 'timeout 120s'}
    except Exception as e:
        return {'provider': provider, 'model': model, 'status_code': None,
                'latency_ms': round((time.time() - start) * 1000, 1),
                'result': 'exception', 'stdout': '', 'stderr': f'{type(e).__name__}: {e}'}

def main():
    if OUT.exists():
        shutil.copy2(OUT, BACKUP)
    results = []
    try:
        patch_config()
        for provider, model, note in MODELS:
            r = probe(provider, model)
            if note:
                r['note'] = note
            results.append(r)
            time.sleep(8)
    finally:
        restore_config()
    report = {
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'tested': len(results),
        'ok': sum(1 for r in results if r['result'] == 'ok'),
        'error': sum(1 for r in results if r['result'] == 'error'),
        'timeout': sum(1 for r in results if r['result'] == 'timeout'),
        'working': [f"{r['provider']}/{r['model']}" for r in results if r['result'] == 'ok'],
        'results': results,
    }
    OUT.write_text(json.dumps(report, indent=2, ensure_ascii=True))
    line = f"{report['timestamp']} tested={report['tested']} ok={report['ok']} working={','.join(report['working']) or 'none'}\n"
    with LOG.open('a', encoding='utf-8') as f:
        f.write(line)
    print(f"Free models audit {report['timestamp']}")
    print(f"Tested {report['tested']} | OK {report['ok']} | Working: {', '.join(report['working']) or 'none'}")
    print(f"Saved: {OUT}")

if __name__ == '__main__':
    main()
