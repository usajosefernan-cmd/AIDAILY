import os

env_paths = [
    '/home/ubuntu/.hermes/.env',
    '/home/ubuntu/workspace/AIDAILY/.env'
]

new_token = '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'
cerebras_key = 'csk-nppv4ctnyrvm2mtwjvd9mne8y52x6jw2m3hhr5xwey898kxe'

for path in env_paths:
    if os.path.exists(path):
        print(f"Modificando archivo .env: {path}...")
        with open(path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        new_lines = []
        hf_token_updated = False
        hf_base_url_updated = False
        cerebras_key_updated = False
        
        for line in lines:
            # Procesar HF_TOKEN
            if line.strip().startswith('HF_TOKEN='):
                new_lines.append(f"HF_TOKEN={new_token}\n")
                hf_token_updated = True
                print("  ✓ HF_TOKEN actualizado.")
            # Procesar HF_BASE_URL (para asegurar que apunte a la moderna)
            elif line.strip().startswith('HF_BASE_URL='):
                new_lines.append("HF_BASE_URL=https://router.huggingface.co/v1\n")
                hf_base_url_updated = True
                print("  ✓ HF_BASE_URL actualizado a /v1.")
            # Procesar CEREBRAS_API_KEY
            elif line.strip().startswith('CEREBRAS_API_KEY='):
                new_lines.append(f"CEREBRAS_API_KEY={cerebras_key}\n")
                cerebras_key_updated = True
                print("  ✓ CEREBRAS_API_KEY actualizado.")
            else:
                new_lines.append(line)
        
        # Si no existían al final, las añadimos
        if not hf_token_updated:
            new_lines.append(f"\nHF_TOKEN={new_token}\n")
            print("  ✓ HF_TOKEN añadido al final.")
        if not hf_base_url_updated:
            new_lines.append("HF_BASE_URL=https://router.huggingface.co/v1\n")
            print("  ✓ HF_BASE_URL añadido al final.")
        if not cerebras_key_updated:
            new_lines.append(f"CEREBRAS_API_KEY={cerebras_key}\n")
            print("  ✓ CEREBRAS_API_KEY añadido al final.")
            
        with open(path, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
        print(f"✓ Guardado con éxito: {path}")
    else:
        print(f"No encontrado: {path}")
