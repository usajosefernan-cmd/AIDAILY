import sys
import json

def main():
    try:
        import pandas as pd
    except ImportError:
        print(json.dumps({"success": False, "error": "pandas no está instalado en el entorno de Python"}))
        return

    try:
        # Intentar cargar el archivo Excel
        # La ruta en la VPS es /home/ubuntu/workspace/directorio_ultra_expandido_400_fuentes.xlsx
        # La ruta local es c:\Users\yo\Pictures\Descargaspc\0a\hermes\directorio_ultra_expandido_400_fuentes.xlsx
        excel_path = "/home/ubuntu/workspace/AIDAILY/directorio_fuentes.xlsx"
        df = pd.read_excel(excel_path)
        
        # Obtener columnas e información general
        columns = df.columns.tolist()
        head_data = df.head(15).to_dict(orient='records')
        shape = df.shape
        
        # Agrupar fuentes por subcategoría o categoría si existen esas columnas
        summary = {
            "success": True,
            "shape": shape,
            "columns": columns,
            "head": head_data
        }
        print(json.dumps(summary, indent=2, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    main()
