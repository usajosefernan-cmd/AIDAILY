#!/usr/bin/env python3
"""
Obtiene el token de acceso de Nous Research directamente desde auth.json de Hermes.
Usado por sources.ts para autenticarse contra la Nous Inference API.
"""
import sys
import json
import os

AUTH_PATH = os.path.expanduser("~/.hermes/auth.json")

def main():
    try:
        if not os.path.exists(AUTH_PATH):
            print(json.dumps({"success": False, "error": f"auth.json not found at {AUTH_PATH}"}))
            sys.exit(0)

        with open(AUTH_PATH, "r") as f:
            data = json.load(f)

        nous = data.get("providers", {}).get("nous", {})
        access_token = nous.get("access_token", "")
        base_url = nous.get("inference_base_url", "https://inference-api.nousresearch.com/v1")

        if access_token:
            print(json.dumps({
                "success": True,
                "access_token": access_token,
                "base_url": base_url
            }))
        else:
            print(json.dumps({"success": False, "error": "No access_token in auth.json nous provider"}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    main()
