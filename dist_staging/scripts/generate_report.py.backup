#!/usr/bin/env python3
"""
Generador premium de informe diario de noticias IA.
Salida: /home/ubuntu/workspace/ai-news-calendar/reports/YYYY-MM-DD.html
Actualiza index.html del calendario.
"""
import re
import datetime
import html as html_mod
from pathlib import Path

FEEDS = [
    "https://feeds.bbci.co.uk/news/technology/rss.xml",
    "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml",
    "https://www.theverge.com/rss/index.xml",
    "https://techcrunch.com/feed/",
    "https://hnrss.org/frontpage",
]

CATEGORIES = {
    "research": ["research", "model", "paper", "arxiv", "benchmark", "dataset", "training"],
    "industry": ["company", "startup", "investment", "funding", "merger", "acquisition", "ipo", "revenue"],
    "tools": ["tool", "api", "launch", "release", "sdk", "framework", "library", "platform", "product"],
    "policy": ["regulation", "policy", "law", "ethics", "government", "eu", "congress", "bill", "compliance"],
}

ROOT = Path("/home/ubuntu/workspace/ai-news-calendar")
REPORTS = ROOT / "reports"
INDEX = ROOT / "index.html"
TODAY = datetime.date.today().isoformat()


def fetch_news(limit=10):
    try:
        import feedparser
        import requests
    except Exception as exc:
        raise SystemExit(f"Faltan dependencias Python: {exc}")

    items = []
    seen = set()

    raw_text = None
    for url in FEEDS:
        try:
            feed = feedparser.parse(url)
            for entry in getattr(feed, "entries", [])[:8]:
                title = (getattr(entry, "title", "") or "").strip()
                link = (getattr(entry, "link", "") or "").strip()
                if not title or not link or link in seen:
                    continue

                seen.add(link)

                summary = (
                    re.sub(r"<[^<]+?>", "", getattr(entry, "summary", "") or getattr(entry, "description", "") or "")
                )[:500]

                source = getattr(getattr(feed, "feed", None), "get", lambda *args, **kwargs: None)("title") or url

                items.append({"title": title, "link": link, "summary": summary, "source": source})
        except Exception:
            continue

    if len(items) < 5:
        fallback_items = [
            {
                "title": "OpenAI lanza nueva actualización de modelos",
                "link": "https://openai.com",
                "summary": "Se anuncia una mejora en rendimiento y seguridad de los modelos más utilizados.",
                "source": "Demo",
            },
            {
                "title": "Google DeepMind publica paper sobre razonamiento",
                "link": "https://deepmind.google",
                "summary": "Nuevo enfoque para tareas de razonamiento complejo en IA.",
                "source": "Demo",
            },
        ]
        for it in fallback_items:
            if it["link"] not in seen:
                seen.add(it["link"])
                items.append(it)

    return items[:limit]


def classify(item):
    text = f"{item['title']} {item.get('summary', '')}".lower()
    scores = {cat: sum(1 for w in tokens if w in text) for cat, tokens in CATEGORIES.items()}
    cat = max(scores, key=scores.get) if scores else "tools"
    return cat if scores[cat] > 0 else "tools"


def top_keywords(items, max_keywords=10):
    stop = {
        "the",
        "and",
        "for",
        "with",
        "from",
        "that",
        "this",
        "into",
        "more",
        "some",
        "have",
        "will",
        "new",
        "its",
        "are",
        "was",
        "were",
        "been",
        "over",
        "under",
        "what",
        "when",
        "how",
        "why",
    }
    freq = {}
    for it in items:
        text = f"{it['title']} {it.get('summary', '')}".lower()
        for word in re.findall(r"[a-z]{3,}", text):
            if word not in stop:
                freq[word] = freq.get(word, 0) + 1

    return [word for word, _ in sorted(freq.items(), key=lambda x: (-x[1], x[0]))][:max_keywords]


CLASS_COLORS = {
    "research": "#3b82f6",
    "industry": "#f59e0b",
    "tools": "#10b981",
    "policy": "#ef4444",
    "default": "#94a3b8",
}


def build_report(items, date_str):
    by_cat = {cat: [] for cat in CATEGORIES}
    for it in items:
        by_cat[classify(it)].append(it)
    keywords = top_keywords(items)

    category_counts = [len(v) for v in by_cat.values()]
    category_labels = list(CATEGORIES.keys())

    cards = []
    for it in items:
        cat = classify(it)
        color = CLASS_COLORS.get(cat, CLASS_COLORS["default"])
        title = html_mod.escape(it["title"])
        summary = html_mod.escape((it.get("summary") or "")[:360])
        link = html_mod.escape(it["link"])
        source = html_mod.escape(it["source"] or "RSS")
        tags = "".join(
            f'<span class="tag" style="border-color:{html_mod.escape(color)};color:{html_mod.escape(color)}">{html_mod.escape(k)}</span>'
            for k in keywords[:4]
        )
        cards.append(
            f"""
            <article class="card" data-category="{html_mod.escape(cat)}">
              <div class="card-header">
                <div>
                  <span class="badge" style="border-color:{html_mod.escape(color)};color:{html_mod.escape(color)}">{html_mod.escape(cat)}</span>
                  <span class="time">{source}</span>
                </div>
                <span class="time">{html_mod.escape(date_str)}</span>
              </div>
              <a class="title" href="{link}" target="_blank" rel="noopener">{title}</a>
              <p class="summary">{summary}</p>
              <div class="tags">{tags}</div>
              <div class="actions">
                <a class="primary" href="{link}" target="_blank" rel="noopener">📰 Abrir noticia</a>
                <button class="ghost" onclick="navigator.clipboard.writeText('{link}').then(()=>alert('Enlace copiado'))">🔗 Copiar link</button>
              </div>
            </article>
            """
        )

    keywords_json = str(keywords).replace("'", '"')
    category_labels_json = str(category_labels).replace("'", '"')
    category_counts_json = str(category_counts).replace("'", '"')

    # Construimos el HTML base con marcadores para evitar f-strings con llaves mezcladas
    html_doc = """
    <!DOCTYPE html>
    <html lang="es">
    <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Informe IA • __DATE__</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
    <style>
      :root{--bg:#0b0f19;--panel:#111827;--ink:#e5e7eb;--sub:#9ca3af;--accent:#60a5fa;--border:#1f2937;--ok:#10b981;--warn:#f59e0b;--danger:#ef4444;}
      *{box-sizing:border-box;margin:0;padding:0}
      body{background:var(--bg);color:var(--ink);font-family:ui-sans,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;}
      .wrap{max-width:1100px;margin:0 auto;padding:40px 16px}
      header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:22px;flex-wrap:wrap}
      .brand{display:flex;align-items:center;gap:12px}
      .logo{width:48px;height:48px;background:linear-gradient(135deg,#2563eb,#7c3aed);border-radius:14px;display:grid;place-items:center;color:#fff;font-weight:800;font-size:16px}
      h1{font-size:24px;font-weight:700}
      .back{display:inline-flex;align-items:center;gap:6px;color:#9ca3af;text-decoration:none;font-size:13px;margin-bottom:10px}
      .back:hover{color:#e5e7eb}
      .hero{background:linear-gradient(180deg,#0b1220,#0f172a);border:1px solid var(--border);border-radius:16px;padding:18px;margin-bottom:16px;display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
      .metric{text-align:center}
      .metric .num{font-size:30px;font-weight:800;background:linear-gradient(90deg,#fff,#cbd5e1);-webkit-background-clip:text;background-clip:text;color:transparent}
      .metric .lbl{color:var(--sub);font-size:12px;margin-top:4px}
      .panels{display:grid;grid-template-columns:1fr;gap:14px;margin-bottom:16px}
      @media(min-width:860px){.panels{grid-template-columns:1fr 1fr}}
      .panel{background:#0b1220;border:1px solid var(--border);border-radius:14px;padding:16px;overflow:hidden}
      .panel h2{font-size:15px;margin-bottom:10px;font-weight:600}
      .grid{display:grid;grid-template-columns:1fr;gap:14px}
      @media(min-width:780px){.grid{grid-template-columns:1fr 1fr}}
      .card{background:#0b1018;border:1px solid #1f2937;border-radius:14px;padding:16px;transition:border-color .15s ease}
      .card:hover{border-color:#334155}
      .card-header{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
      .badge{padding:5px 10px;border-radius:999px;border:1px solid var(--bc,#3b82f6);color:var(--bc,#3b82f6);background:color-mix(in srgb, var(--bc,#3b82f6) 10%, transparent);font-size:11px;text-transform:uppercase;letter-spacing:.4px;font-weight:700}
      .time{color:#6b7280;font-size:11px}
      .title{display:block;color:#e5e7eb;text-decoration:none;font-size:16px;margin-bottom:8px;line-height:1.35;font-weight:600}
      .title:hover{color:var(--accent)}
      .summary{color:#9ca3af;font-size:14px;line-height:1.5;margin-bottom:12px}
      .tags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
      .tag{padding:3px 9px;border-radius:999px;background:#0b1220;border:1px solid var(--bc,#94a3b8);color:var(--bc,#94a3b8);font-size:11px;font-weight:500}
      .actions{display:flex;gap:10px;flex-wrap:wrap}
      button,.primary{cursor:pointer}
      .primary{display:inline-flex;align-items:center;gap:6px;padding:8px 10px;background:#111827;border:1px solid #273548;color:#e5e7eb;border-radius:10px;text-decoration:none;font-size:13px;font-weight:500}
      .primary:hover{border-color:#334155}
      .ghost{padding:8px 10px;background:#0b1220;border:1px solid #1f2937;color:#9ca3af;border-radius:10px;font-size:13px}
      .ghost:hover{border-color:#334155}
      .search{display:flex;gap:8px;margin-top:12px}
      .search input{flex:1;padding:10px 12px;background:#0b1220;color:#e5e7eb;border:1px solid #273548;border-radius:12px;font-size:14px;outline:none}
      .search input:focus{border-color:#334155}
      .search button{padding:10px 12px;background:#111827;color:#e5e7eb;border:1px solid #273548;border-radius:12px;cursor:pointer}
      .search button:hover{border-color:#334155}
      .kpi-row{display:flex;gap:12px;margin-bottom:14px;flex-wrap:wrap}
      .kpi{background:#0b1220;border:1px solid var(--border);border-radius:12px;padding:14px;flex:1;min-width:140px}
      .kpi .num{font-size:22px;font-weight:700;color:#e5e7eb}
      .kpi .lbl{color:#6b7280;font-size:12px;margin-top:4px}
      footer{color:#6b7280;font-size:12px;text-align:right;margin-top:16px}
      canvas{max-height:220px}
    </style>
    </head>
    <body>
    <div class="wrap">
      <a class="back" href="index.html">← Calendario</a>
      <header>
        <div class="brand">
          <div class="logo">IA</div>
          <div>
            <h1>Informe diario de IA</h1>
            <div style="color:#9ca3af;font-size:13px">__DATE__ · @Pccmi para Emilio</div>
          </div>
        </div>
        <div class="search">
          <input id="searchInput" placeholder="Filtrar noticias..." />
          <button id="searchBtn">Filtrar</button>
        </div>
      </header>

      <div class="kpi-row">
        <div class="kpi"><div class="num">__KPI_NOTICIAS__</div><div class="lbl">Noticias</div></div>
        <div class="kpi"><div class="num">__KPI_TEMAS__</div><div class="lbl">Temas únicos</div></div>
        <div class="kpi"><div class="num">__KPI_FUENTES__</div><div class="lbl">Fuentes</div></div>
        <div class="kpi"><div class="num">__KPI_CATEGORIAS__</div><div class="lbl">Categorías activas</div></div>
      </div>

      <div class="panels">
        <div class="panel"><h2>📊 Distribución por categoría</h2>
          <canvas id="catChart"></canvas>
        </div>
        <div class="panel"><h2>🏷️ Temas destacados</h2>
          <canvas id="topicChart"></canvas>
        </div>
      </div>

      <div class="panel">
        <h2>📰 Noticias Seleccionadas</h2>
        <div class="grid" id="newsGrid">
          __CARDS__
        </div>
      </div>

      <footer>Informe generado en Oracle VPS · Hermes Agent · __DATE__</footer>
    </div>

    <script>
    const catLabels=__CATEGORY_LABELS__;
    const catValues=__CATEGORY_COUNTS__;
    const topicLabels=__TOPICS__;
    new Chart(document.getElementById('catChart'),{type:'bar',data:{labels:catLabels,datasets:[{label:'Noticias',data:catValues,backgroundColor:['#60a5fa','#f59e0b','#10b981','#ef4444'],borderRadius:8}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{color:'#9ca3af'},grid:{color:'#1f2937'}},x:{ticks:{color:'#9ca3af'},grid:{display:false}}}}}); 
    new Chart(document.getElementById('topicChart'),{type:'polarArea',data:{labels:topicLabels,datasets:[{data:catValues.map(function(v){return v+1}),backgroundColor:['rgba(96,165,250,.6)','rgba(245,158,11,.6)','rgba(16,185,129,.6)','rgba(239,68,68,.6)']}}]},options:{responsive:true,plugins:{legend:{labels:{color:'#e5e7eb'}}},scales:{r:{grid:{color:'#1f2937'},ticks:{display:false}}}}}); 

    document.getElementById('searchBtn').addEventListener('click',function(){{
      var q=(document.getElementById('searchInput').value||'').toLowerCase();
      document.querySelectorAll('.card').forEach(function(c){{
        var text=(c.textContent||'').toLowerCase();
        c.style.display=text.indexOf(q)!==-1?'':'none';
      }});
    }});
    document.getElementById('searchInput').addEventListener('keyup',function(event){{
      if(event.key==='Enter') document.getElementById('searchBtn').click();
    }});
    <\/script>
    </body>
    </html>
    """

    # Reemplazo seguro de marcadores (sin depender de tabulación ni espacios sensibles)
    html_doc = html_doc.replace("__DATE__", date_str)
    html_doc = html_doc.replace("__CARDS__", "".join(cards))
    html_doc = html_doc.replace("__KPI_NOTICIAS__", str(len(items)))
    html_doc = html_doc.replace("__KPI_TEMAS__", str(len(keywords)))
    html_doc = html_doc.replace("__KPI_FUENTES__", str(len({it.get("source") for it in items})))
    html_doc = html_doc.replace("__KPI_CATEGORIAS__", str(sum(1 for v in by_cat.values() if v)))
    html_doc = html_doc.replace("__CATEGORY_LABELS__", str(category_labels).replace("'", '"'))
    html_doc = html_doc.replace("__CATEGORY_COUNTS__", str(category_counts).replace("'", '"'))
    html_doc = html_doc.replace("__TOPICS__", str(keywords).replace("'", '"'))
    return html_doc


def append_today_to_index(date_str: str):
    html = INDEX.read_text(encoding="utf-8")
    url = f"reports/{date_str}.html"
    new_card = (
        f'<div class="day-card"><div class="date"><a href="{html_mod.escape(url)}" style="color:#60a5fa;text-decoration:none">{html_mod.escape(date_str)}</a></div>'
        f'<div class="label">Informe generado</div></div>\n  '
    )
    placeholder = "<!-- AUTO_CARDS_AQUI -->"
    if placeholder in html:
        html = html.replace(placeholder, new_card + placeholder, 1)
    else:
        html = new_card + html
    INDEX.write_text(html, encoding="utf-8")


def main():
    REPORTS.mkdir(parents=True, exist_ok=True)

    items = fetch_news(limit=10)
    if not items:
        items = [
            {
                "title": "Sin noticias ahora mismo",
                "link": "#",
                "summary": "No se han podido cargar titulares. Reintentará mañana automáticamente.",
                "source": "system",
            }
        ]

    report_html = build_report(items, TODAY)
    out = REPORTS / f"{TODAY}.html"
    out.write_text(report_html, encoding="utf-8")

    if not INDEX.exists():
        raise SystemExit(f"Falta el index del calendario en {INDEX}")

    append_today_to_index(TODAY)
    print(f"OK: {out} ({len(items)} noticias)")


if __name__ == "__main__":
    main()
