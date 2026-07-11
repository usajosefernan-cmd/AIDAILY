import sqlite3
import os

paths = [
    '/home/ubuntu/.hermes/state.db',
    '/home/ubuntu/.hermes/profiles/implementer/state.db',
    '/home/ubuntu/.hermes/profiles/default/state.db'
]

for p in paths:
    if os.path.exists(p):
        print(f"=== DB: {p} ===")
        conn = sqlite3.connect(p)
        c = conn.cursor()
        c.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [r[0] for r in c.fetchall()]
        print("Tables:", tables)
        for t in tables:
            try:
                c.execute(f"SELECT COUNT(*) FROM {t}")
                count = c.fetchone()[0]
                print(f"  Table: {t} ({count} rows)")
                # Ver si hay alguna columna de configuración, provider o model
                c.execute(f"PRAGMA table_info({t})")
                cols = [col[1] for col in c.fetchall()]
                print(f"    Cols: {cols}")
                if 'provider' in cols or 'model' in cols or 'key' in cols or 'name' in cols:
                    # Mostrar las primeras 5 filas
                    c.execute(f"SELECT * FROM {t} LIMIT 5")
                    print(f"    Sample: {c.fetchall()}")
            except Exception as e:
                print(f"  Error reading {t}: {e}")
        conn.close()
    else:
        print(f"Not found: {p}")
