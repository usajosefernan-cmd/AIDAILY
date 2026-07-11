import React, { useState, useMemo, useEffect } from 'react';

export default function DashboardPanel({ allArticlesData = [], currentConfig = {}, sourcesStatus = {}, feedHashes = {}, vpsExecutionStatus = {} }) {
  const [healthSearch, setHealthSearch] = useState('');
  const [healthStatusFilter, setHealthStatusFilter] = useState('all');
  const [healthPage, setHealthPage] = useState(1);
  
  const lastUpdate = sourcesStatus?.build_status?.updatedAt ? new Date(sourcesStatus.build_status.updatedAt).getTime() : 0;
  const diffMinutes = lastUpdate ? Math.round((Date.now() - lastUpdate) / 60000) : 0;
  const isHeartbeatFailed = lastUpdate && diffMinutes > 40;
  const buildStatusOk = sourcesStatus?.build_status?.ok !== false && !isHeartbeatFailed;
  const healthPerPage = 12;

  // Track expanded feeds
  const [expandedFeedUrls, setExpandedFeedUrls] = useState(new Set());
  const [isHealing, setIsHealing] = useState(false);

  // States for live Queue monitoring
  const [queueData, setQueueData] = useState({});
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [isClearingQueue, setIsClearingQueue] = useState(false);

  const fetchQueue = async () => {
    setLoadingQueue(true);
    try {
      const res = await fetch('/api/queue.json');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const map = {};
          data.forEach(item => {
            map[item.id] = item;
          });
          setQueueData(map);
        } else {
          setQueueData(data && typeof data === 'object' ? data : {});
        }
      } else {
        const fbRes = await fetch('https://pecemi-default-rtdb.firebaseio.com/aidaily/queue.json');
        if (fbRes.ok) {
          const fbData = await fbRes.json();
          setQueueData(fbData && typeof fbData === 'object' ? fbData : {});
        }
      }
    } catch (e) {
      try {
        const fbRes = await fetch('https://pecemi-default-rtdb.firebaseio.com/aidaily/queue.json');
        if (fbRes.ok) {
          const fbData = await fbRes.json();
          setQueueData(fbData && typeof fbData === 'object' ? fbData : {});
        }
      } catch (err) {
        console.error('Error fetching queue:', err);
      }
    } finally {
      setLoadingQueue(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 15000); // Auto-refresh every 15s
    return () => clearInterval(interval);
  }, []);

  const handleClearQueue = async () => {
    if (!window.confirm('⚠️ ¿Estás seguro de que deseas vaciar la cola de espera de la IA? Esto eliminará todos los artículos pendientes de procesar de SQLite en la VPS.')) {
      return;
    }
    setIsClearingQueue(true);
    try {
      const reqId = "clear_queue_" + Date.now();
      await fetch(`https://pecemi-default-rtdb.firebaseio.com/vps/bridge_requests/${reqId}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: "run_terminal_command",
          params: {
            command: "sqlite3 /home/ubuntu/workspace/AIDAILY/data/aidaily.db \"UPDATE articles SET status = 'descartada' WHERE status = 'pendiente_ia'\" && node /home/ubuntu/workspace/AIDAILY/scripts/news-sync.js --build-only",
            cwd: "/home/ubuntu/workspace/AIDAILY"
          },
          security_token: 'pecemi_secure_gateway_token_2026_xyz',
          timestamp: Date.now()
        })
      });

      await fetch('https://pecemi-default-rtdb.firebaseio.com/aidaily/queue.json', {
        method: 'DELETE'
      });

      setQueueData({});
      alert('🗑️ Cola de procesamiento vaciada con éxito en la VPS.');
    } catch (e) {
      alert('Error de conexión: ' + e.message);
    } finally {
      setIsClearingQueue(false);
    }
  };

  const handleRemoveQueueItem = async (hashId) => {
    if (!window.confirm('¿Seguro que deseas descartar esta noticia de la cola de espera de la IA?')) {
      return;
    }
    try {
      const reqId = "remove_queue_item_" + Date.now();
      await fetch(`https://pecemi-default-rtdb.firebaseio.com/vps/bridge_requests/${reqId}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: "run_terminal_command",
          params: {
            command: `sqlite3 /home/ubuntu/workspace/AIDAILY/data/aidaily.db "UPDATE articles SET status = 'descartada' WHERE id = '${hashId}'" && node /home/ubuntu/workspace/AIDAILY/scripts/news-sync.js --build-only`,
            cwd: "/home/ubuntu/workspace/AIDAILY"
          },
          security_token: 'pecemi_secure_gateway_token_2026_xyz',
          timestamp: Date.now()
        })
      });

      await fetch(`https://pecemi-default-rtdb.firebaseio.com/aidaily/queue/${hashId}.json`, {
        method: 'DELETE'
      });

      setQueueData(prev => {
        const next = { ...prev };
        delete next[hashId];
        return next;
      });
    } catch (e) {
      alert('Error de conexión: ' + e.message);
    }
  };


  const handleForceAutoheal = async () => {
    if (!window.confirm('¿Estás seguro de que quieres forzar la autocuración de la VPS? Esto matará cualquier proceso de sincronización antiguo que esté bloqueado, borrará el lockfile y lanzará una nueva sincronización limpia en segundo plano.')) {
      return;
    }

    setIsHealing(true);
    try {
      // 1. Limpiar estado de compilación y progreso en Firebase
      await Promise.all([
        fetch('https://pecemi-default-rtdb.firebaseio.com/aidaily/sources_status.json', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            build_status: { ok: true, error: '', updatedAt: new Date().toISOString() },
            security_token: 'pecemi_secure_gateway_token_2026_xyz'
          })
        }),
        fetch('https://pecemi-default-rtdb.firebaseio.com/aidaily/vps_execution_status.json', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            step: 1,
            stepName: 'Autocurando VPS...',
            details: 'Orden de autocuración enviada. Limpiando bloqueos y relanzando sincronización...',
            progress: 5,
            updatedAt: new Date().toISOString(),
            error: ''
          })
         })
      ]);

      // 2. Enviar orden al bridge de Firebase para ejecutar en la VPS
      const reqId = "force_heal_" + Date.now();
      await fetch(`https://pecemi-default-rtdb.firebaseio.com/vps/bridge_requests/${reqId}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: "run_terminal_command",
          params: {
            command: "rm -f /var/tmp/aidaily-sync.lock && pkill -f sync-firebase.mjs || true && nohup bash /home/ubuntu/workspace/AIDAILY/sync-aidaily.sh --force >/dev/null 2>&1 &",
            cwd: "/home/ubuntu/workspace/AIDAILY"
          },
          security_token: 'pecemi_secure_gateway_token_2026_xyz',
          timestamp: Date.now()
        })
      });

      alert('✅ Orden de autocuración enviada con éxito. La VPS ha liberado el bloqueo y está reiniciando la sincronización en segundo plano.');
    } catch (err) {
      alert(`❌ Error al enviar orden de autocuración: ${err.message}`);
    } finally {
      setIsHealing(false);
    }
  };

  const toggleFeedExpand = (url) => {
    const next = new Set(expandedFeedUrls);
    if (next.has(url)) {
      next.delete(url);
    } else {
      next.add(url);
    }
    setExpandedFeedUrls(next);
  };

  // 1. Analytical calculations
  const metrics = useMemo(() => {
    const total = allArticlesData.length;
    let premiumCount = 0;
    let multimediaCount = 0;
    const categoryCounts = {};

    allArticlesData.forEach(art => {
      const isFallback = (art.whyMatters === 'Esta noticia representa un desarrollo relevante en su sector.') || 
                         (Array.isArray(art.keyPoints) && art.keyPoints.length === 1 && art.keyPoints[0] === art.title) ||
                         art.isFallback;
      if (!isFallback) {
        premiumCount++;
      }

      const hasImg = art.imageUrl && !art.imageUrl.includes('placeholder') && !art.imageUrl.includes('category-fallback');
      const hasGallery = Array.isArray(art.multimedia) && art.multimedia.length > 0;
      if (hasImg || hasGallery) {
        multimediaCount++;
      }

      const cat = art.category || 'general';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    // Count feeds
    let totalFeeds = 0;
    let activeCategories = 0;
    if (currentConfig.feeds) {
      activeCategories = Object.keys(currentConfig.feeds).length;
      Object.values(currentConfig.feeds).forEach(list => {
        if (Array.isArray(list)) totalFeeds += list.length;
      });
    }

    const premiumPercent = total > 0 ? Math.round((premiumCount / total) * 100) : 0;
    const multimediaPercent = total > 0 ? Math.round((multimediaCount / total) * 100) : 0;

    return {
      total,
      premiumCount,
      premiumPercent,
      multimediaCount,
      multimediaPercent,
      totalFeeds,
      activeCategories,
      categoryCounts
    };
  }, [allArticlesData, currentConfig]);

  // 2. Health Feeds processing
  const healthFeedsData = useMemo(() => {
    const entries = [];
    if (!currentConfig.feeds) return entries;

    Object.entries(currentConfig.feeds).forEach(([cat, list]) => {
      if (!Array.isArray(list)) return;
      list.forEach(feed => {
        const hash = feedHashes[feed.url] || '';
        const statusData = sourcesStatus[hash] || {};
        
        let status = 'pending';
        if (statusData.status === 'success') {
          status = 'success';
        } else if (statusData.status === 'error') {
          status = 'error';
        }

        entries.push({
          name: feed.name,
          url: feed.url,
          category: cat,
          subcategory: Array.isArray(feed.tags) ? feed.tags[0] : 'General',
          lastRunTime: statusData.lastRunTime || null,
          status,
          errorMessage: statusData.errorMessage || '',
          count: statusData.articlesScrapedCount || 0
        });
      });
    });

    // Sort: errors first, then success ordered by news count
    return entries.sort((a, b) => {
      if (a.status === 'error' && b.status !== 'error') return -1;
      if (a.status !== 'error' && b.status === 'error') return 1;
      return b.count - a.count;
    });
  }, [currentConfig, sourcesStatus, feedHashes]);

  // Filter and paginated feeds
  const filteredHealthFeeds = useMemo(() => {
    return healthFeedsData.filter(f => {
      if (healthStatusFilter !== 'all' && f.status !== healthStatusFilter) return false;
      if (healthSearch) {
        const search = healthSearch.toLowerCase();
        return f.name.toLowerCase().includes(search) || 
               f.url.toLowerCase().includes(search) || 
               f.category.toLowerCase().includes(search);
      }
      return true;
    });
  }, [healthFeedsData, healthSearch, healthStatusFilter]);

  // Pagination bounds
  const totalHealth = filteredHealthFeeds.length;
  const totalPages = Math.ceil(totalHealth / healthPerPage) || 1;
  const currentPage = Math.min(Math.max(1, healthPage), totalPages);
  const startIdx = (currentPage - 1) * healthPerPage;
  const endIdx = Math.min(startIdx + healthPerPage, totalHealth);
  
  const pageBatch = useMemo(() => {
    return filteredHealthFeeds.slice(startIdx, endIdx);
  }, [filteredHealthFeeds, startIdx, endIdx]);

  // Health summary stats
  const healthStats = useMemo(() => {
    let online = 0;
    let error = 0;
    let pending = 0;
    healthFeedsData.forEach(f => {
      if (f.status === 'success') online++;
      else if (f.status === 'error') error++;
      else pending++;
    });
    return { total: healthFeedsData.length, online, error, pending };
  }, [healthFeedsData]);

  // Category chart renderer
  const categoryChartItems = useMemo(() => {
    const sortedCats = Object.entries(metrics.categoryCounts).sort((a, b) => b[1] - a[1]);
    const maxVal = sortedCats[0] ? sortedCats[0][1] : 1;

    return sortedCats.map(([cat, val]) => {
      const percent = Math.round((val / maxVal) * 100);
      const totalPercentOfAll = metrics.total > 0 ? Math.round((val / metrics.total) * 100) : 0;
      
      let barColor = 'var(--accent-purple)';
      if (cat === 'tecnologia') barColor = 'var(--accent-cyan)';
      else if (cat === 'ciencia') barColor = 'var(--accent-purple)';
      else if (cat === 'medioambiente') barColor = '#10b981';
      else if (cat === 'deportes') barColor = 'var(--accent-magenta)';
      else if (cat === 'opinion') barColor = '#f59e0b';

      return (
        <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifycontent: 'space-between', justifyContent: 'space-between', fontSize: '0.76rem', fontWeight: '600' }}>
            <span style={{ textTransform: 'uppercase', color: '#fff' }}>{cat}</span>
            <span style={{ color: 'var(--text-muted)' }}>{val} artículos ({totalPercentOfAll}%)</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${percent}%`, height: '100%', background: barColor, borderRadius: '4px', transition: 'width 0.8s ease' }}></div>
          </div>
        </div>
      );
    });
  }, [metrics]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 1. Metric Cards Grid */}
      <div className="metrics-grid">
        
        <div className="metric-card" style={{ borderLeft: '3px solid var(--accent-cyan)' }}>
          <div className="metric-card-icon">📰</div>
          <div className="metric-card-content">
            <span className="metric-card-value">{metrics.total}</span>
            <span className="metric-card-label">Noticias</span>
          </div>
        </div>

        <div className="metric-card" style={{ borderLeft: '3px solid var(--accent-purple)' }}>
          <div className="metric-card-icon">✨</div>
          <div className="metric-card-content">
            <span className="metric-card-value">{metrics.premiumPercent}%</span>
            <span className="metric-card-label">Premium</span>
          </div>
        </div>

        <div className="metric-card" style={{ borderLeft: '3px solid var(--accent-magenta)' }}>
          <div className="metric-card-icon">🖼️</div>
          <div className="metric-card-content">
            <span className="metric-card-value">{metrics.multimediaPercent}%</span>
            <span className="metric-card-label">Multimedia</span>
          </div>
        </div>

        <div className="metric-card" style={{ borderLeft: '3px solid #10b981' }}>
          <div className="metric-card-icon">📡</div>
          <div className="metric-card-content">
            <span className="metric-card-value">{metrics.totalFeeds}</span>
            <span className="metric-card-label">Fuentes</span>
          </div>
        </div>

        <div className="metric-card" style={{ borderLeft: '3px solid #f59e0b', background: Object.keys(queueData).length > 0 ? 'rgba(245,158,11,0.02)' : 'transparent' }}>
          <div className="metric-card-icon" style={{ animation: Object.keys(queueData).length > 0 ? 'pulse-orange 2s infinite' : 'none' }}>🕒</div>
          <div className="metric-card-content">
            <span className="metric-card-value" style={{ color: Object.keys(queueData).length > 0 ? '#fbbf24' : '#fff' }}>{Object.keys(queueData).length}</span>
            <span className="metric-card-label">En Cola (IA)</span>
          </div>
        </div>

      </div>

      {/* Live VPS Process Monitor Banner/Card */}
      {(() => {
        const isVpsRunning = vpsExecutionStatus && vpsExecutionStatus.updatedAt && (Date.now() - new Date(vpsExecutionStatus.updatedAt).getTime()) < 180000;
        const currentStep = vpsExecutionStatus?.step || 0;
        const motorSteps = [
          { num: 1, name: "Inicialización", desc: "Arranque y carga del directorio de fuentes." },
          { num: 2, name: "Rastreo de Feeds", desc: "Lectura y parseo XML/HTML de los 524 feeds RSS." },
          { num: 3, name: "Deduplicación & Filtros", desc: "Descarte de duplicados y patrones de avatares." },
          { num: 4, name: "Relevancia Semántica", desc: "Filtro rápido de interés con Ollama local (Gemma)." },
          { num: 5, name: "Redacción IA Principal", desc: "Scraping de texto largo y redacción con Nous/OpenRouter." },
          { num: 6, name: "Compilación & Deploy", desc: "Astro build local en VPS y actualización de la paginación." }
        ];

        return (
          <div className="card" style={{ 
            padding: '24px', 
            borderLeft: isVpsRunning ? '3px solid var(--accent-magenta)' : '3px solid var(--border-color)',
            background: isVpsRunning ? 'linear-gradient(135deg, rgba(236,72,153,0.02) 0%, rgba(99,102,241,0.01) 100%)' : 'rgba(255,255,255,0.01)',
            boxShadow: isVpsRunning ? '0 8px 32px rgba(236,72,153,0.05)' : 'none'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ 
                  fontSize: '1.4rem', 
                  animation: isVpsRunning ? 'pulse 1.5s infinite' : 'none',
                  display: 'inline-block'
                }}>
                  {isVpsRunning ? '⚡' : '💤'}
                </span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontFamily: 'var(--font-title)', fontWeight: '800', color: '#fff', letterSpacing: '0.5px' }}>
                    MONITOREO DE ACTIVIDAD DEL MOTOR (VPS)
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {isVpsRunning ? `Proceso activo en la VPS (PID: ${vpsExecutionStatus?.pid || 'N/A'})` : 'El motor de sincronización está en reposo (ejecución automática cada 20 min).'}
                  </p>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ 
                  display: 'inline-block', 
                  width: '8px', 
                  height: '8px', 
                  borderRadius: '50%', 
                  background: isVpsRunning ? 'var(--accent-magenta)' : 'var(--text-muted)',
                  boxShadow: isVpsRunning ? '0 0 10px var(--accent-magenta)' : 'none',
                  animation: isVpsRunning ? 'pulse 2s infinite' : 'none'
                }}></span>
                <span style={{ fontSize: '0.68rem', fontWeight: '700', color: isVpsRunning ? '#fff' : 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {isVpsRunning ? 'EJECUTANDO ACTUALIZACIÓN EN VIVO' : 'EN REPOSO'}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            {isVpsRunning && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '0.72rem', fontWeight: '600' }}>
                  <span style={{ color: 'var(--accent-cyan)' }}>Paso {vpsExecutionStatus?.step || 1}: {vpsExecutionStatus?.stepName || 'Ejecutando'}</span>
                  <span style={{ color: '#fff' }}>{vpsExecutionStatus?.progress || 0}% completado</span>
                </div>
                <div style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '5px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.02)' }}>
                  <div style={{ 
                    width: `${vpsExecutionStatus?.progress || 0}%`, 
                    height: '100%', 
                    background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-magenta))', 
                    borderRadius: '5px',
                    transition: 'width 0.5s ease-out'
                  }}></div>
                </div>
                {vpsExecutionStatus?.details && (
                  <div style={{ 
                    marginTop: '10px', 
                    background: 'rgba(0,0,0,0.25)', 
                    border: '1px solid rgba(255,255,255,0.03)', 
                    padding: '10px 12px', 
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                    fontSize: '0.7rem',
                    color: '#e2e8f0',
                    lineHeight: '1.4',
                    wordBreak: 'break-all',
                    marginBottom: '12px'
                  }}>
                    <span style={{ color: 'var(--accent-magenta)' }}>&gt; </span>{vpsExecutionStatus.details}
                  </div>
                )}

                {/* VISUALIZACIÓN DETALLADA DE HILOS CONCURRENTES (IA & SCRAPING EN VIVO) */}
                {vpsExecutionStatus?.activeThreads && Object.keys(vpsExecutionStatus.activeThreads).length > 0 && (
                  <div style={{ 
                    marginTop: '12px', 
                    background: 'rgba(0, 0, 0, 0.2)', 
                    border: '1px solid rgba(255,255,255,0.04)', 
                    borderRadius: '10px', 
                    padding: '12px',
                    boxShadow: 'inset 0 0 10px rgba(0,0,0,0.3)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <span className="live-pulse" style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-cyan)', boxShadow: '0 0 6px var(--accent-cyan)', animation: 'pulse-cyan 1.5s infinite' }}></span>
                      <h4 style={{ margin: 0, fontSize: '0.72rem', color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>
                        🤖 Monitoreo de Agentes Concurrentes en Directo (IA)
                      </h4>
                    </div>

                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
                      gap: '8px',
                      maxHeight: '320px',
                      overflowY: 'auto',
                      paddingRight: '4px'
                    }}>
                      {(() => {
                        const threads = vpsExecutionStatus?.activeThreads || {};
                        const threadKeys = Object.keys(threads)
                          .filter(key => key.startsWith('thread_'))
                          .sort((a, b) => {
                            const numA = parseInt(a.replace('thread_', ''), 10) || 0;
                            const numB = parseInt(b.replace('thread_', ''), 10) || 0;
                            return numA - numB;
                          });
                        
                        // Si no hay hilos activos pero la VPS está corriendo, mostrar los 4 básicos libres
                        const keysToRender = threadKeys.length > 0 
                          ? threadKeys 
                          : ['thread_0', 'thread_1', 'thread_2', 'thread_3'];

                        return keysToRender.map((threadKey) => {
                          const thread = threads[threadKey];
                          if (!thread) {
                            return (
                              <div key={threadKey} style={{ 
                                background: 'rgba(255,255,255,0.01)', 
                                border: '1px solid rgba(255,255,255,0.02)', 
                                padding: '8px 10px', 
                                borderRadius: '8px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                minHeight: '52px',
                                opacity: 0.4
                              }}>
                                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>[Slot {threadKey.replace('thread_', '')} Libre]</span>
                              </div>
                            );
                          }

                          // Resolver color del badge de proveedor
                          let provColor = '#fff';
                          let provBg = 'rgba(255,255,255,0.08)';
                          const lowerProv = (thread.provider || '').toLowerCase();
                          if (lowerProv.includes('nous')) {
                            provColor = 'var(--accent-magenta)';
                            provBg = 'rgba(236, 72, 153, 0.12)';
                          } else if (lowerProv.includes('gemini') || lowerProv.includes('google')) {
                            provColor = 'var(--accent-cyan)';
                            provBg = 'rgba(6, 182, 212, 0.12)';
                          } else if (lowerProv.includes('hugging')) {
                            provColor = '#38bdf8';
                            provBg = 'rgba(56, 189, 248, 0.12)';
                          } else if (lowerProv.includes('openrouter')) {
                            provColor = '#34d399';
                            provBg = 'rgba(52, 211, 153, 0.12)';
                          } else if (lowerProv.includes('nvidia')) {
                            provColor = '#10b981';
                            provBg = 'rgba(16, 185, 129, 0.12)';
                          } else if (lowerProv.includes('github')) {
                            provColor = '#a855f7';
                            provBg = 'rgba(168, 85, 247, 0.12)';
                          } else if (lowerProv.includes('mistral')) {
                            provColor = '#f97316';
                            provBg = 'rgba(249, 115, 22, 0.12)';
                          } else if (lowerProv.includes('cloudflare')) {
                            provColor = '#eab308';
                            provBg = 'rgba(234, 179, 8, 0.12)';
                          } else if (lowerProv.includes('ollama') || lowerProv.includes('local')) {
                            provColor = '#ef4444';
                            provBg = 'rgba(239, 68, 68, 0.12)';
                          }

                          return (
                            <div key={threadKey} style={{ 
                              background: 'rgba(255,255,255,0.02)', 
                              border: '1px solid rgba(255,255,255,0.04)', 
                              padding: '8px 10px', 
                              borderRadius: '8px', 
                              display: 'flex', 
                              flexDirection: 'column', 
                              gap: '4px',
                              transition: 'all 0.3s',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                <span style={{ 
                                  background: 'rgba(255,255,255,0.04)', 
                                  padding: '1px 4px', 
                                  borderRadius: '3px', 
                                  fontSize: '0.55rem', 
                                  color: 'var(--text-muted)',
                                  fontFamily: 'monospace'
                                }}>
                                  Hilo {threadKey.replace('thread_', '')}
                                </span>
                                <span style={{ 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  gap: '3px',
                                  background: provBg, 
                                  color: provColor, 
                                  padding: '1px 5px', 
                                  borderRadius: '4px', 
                                  fontSize: '0.56rem', 
                                  fontWeight: '700',
                                  fontFamily: 'monospace'
                                }}>
                                  {thread.provider}
                                </span>
                              </div>

                              <div style={{ fontSize: '0.66rem', fontWeight: '600', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={thread.title}>
                                {thread.title}
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.58rem', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '4px', marginTop: '2px' }}>
                                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  <span className="live-pulse" style={{ display: 'inline-block', width: '4px', height: '4px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 4px #10b981', animation: 'pulse 1s infinite' }}></span>
                                  {thread.agent}
                                </span>
                                <span style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.54rem' }} title={thread.model}>
                                  {(thread.model || '').split('/').pop() || thread.model}
                                </span>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Flow steps explainer */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
              gap: '12px', 
              marginTop: '16px',
              borderTop: '1px solid rgba(255,255,255,0.04)',
              paddingTop: '16px'
            }}>
              {motorSteps.map((step) => {
                const isCompleted = currentStep > step.num || (!isVpsRunning && currentStep === 0);
                const isCurrent = isVpsRunning && currentStep === step.num;
                
                let statusIcon = '⚪';
                let borderStyle = '1px solid rgba(255,255,255,0.03)';
                let titleColor = 'var(--text-muted)';
                
                if (isCompleted) {
                  statusIcon = '✅';
                  borderStyle = '1px solid rgba(16,185,129,0.15)';
                  titleColor = '#10b981';
                } else if (isCurrent) {
                  statusIcon = '⚡';
                  borderStyle = '1px solid rgba(236,72,153,0.3)';
                  titleColor = 'var(--accent-magenta)';
                }

                return (
                  <div key={step.num} style={{ 
                    background: isCurrent ? 'rgba(236,72,153,0.02)' : 'rgba(255,255,255,0.01)', 
                    border: borderStyle,
                    padding: '10px 12px',
                    borderRadius: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    opacity: (!isVpsRunning && step.num > 1) ? 0.7 : 1,
                    transition: 'all 0.3s'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', fontWeight: '700', color: titleColor }}>
                      <span>Paso {step.num}: {step.name}</span>
                      <span style={{ fontSize: '0.8rem', animation: isCurrent ? 'pulse 1.2s infinite' : 'none' }}>{statusIcon}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.62rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                      {step.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* 2. Arquitectura de Integridad y Configuración en Tiempo Real */}
      <div className="card" style={{ padding: '24px', borderLeft: '3px solid var(--accent-cyan)' }}>
        <h3 className="card-title" style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}>⚙️ ESTADO DEL MOTOR Y AUTOCURACIÓN</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          
          {/* Configuración Activa */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '12px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--accent-cyan)', fontWeight: '700', textTransform: 'uppercase' }}>Configuración Activa</h4>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Salud del Build (Hosting)</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ 
                  display: 'inline-block', 
                  width: '8px', 
                  height: '8px', 
                  borderRadius: '50%', 
                  background: buildStatusOk ? '#10b981' : '#ef4444',
                  boxShadow: buildStatusOk ? '0 0 8px #10b981' : '0 0 8px #ef4444',
                  animation: isHeartbeatFailed ? 'pulse-red 1.5s infinite' : 'none'
                }}></span>
                <span style={{ fontWeight: '700', color: '#fff', fontSize: '0.75rem' }}>
                  {isHeartbeatFailed ? 'SIN RESPUESTA' : (sourcesStatus?.build_status?.ok !== false ? 'ESTABLE' : 'FALLO')}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Modelo de IA Primario</span>
                <span style={{ fontWeight: '600', color: '#fff', fontFamily: 'monospace', fontSize: '0.72rem' }}>
                  {currentConfig?.workflow_config?.ia_analysis?.model || 'meta-llama/llama-3.3-70b-instruct:free'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Rango Histórico de RSS</span>
              <span style={{ fontWeight: '600', color: '#fff' }}>
                {currentConfig?.scraper_config?.historic_range_hours || 24} horas
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Frecuencia VPS Cron</span>
              <span style={{ fontWeight: '600', color: '#fff' }}>Cada 20 minutos (:00, :20, :40)</span>
            </div>

            {isHeartbeatFailed && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '8px', borderRadius: '8px', marginTop: '4px' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: '700', color: '#ef4444', textTransform: 'uppercase' }}>⚠️ Servidor Detenido:</div>
                <div style={{ fontSize: '0.7rem', color: '#f87171', marginTop: '2px', lineHeight: '1.2' }}>
                  La VPS lleva {diffMinutes} minutos sin enviar reporte de vida (el cron corre cada 20 min). Comprueba que el servidor no se haya quedado congelado o que el servicio cron esté activo.
                </div>
              </div>
            )}

            {!isHeartbeatFailed && sourcesStatus?.build_status?.ok === false && sourcesStatus?.build_status?.error && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '8px', borderRadius: '8px', marginTop: '4px' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: '700', color: '#ef4444', textTransform: 'uppercase' }}>Error Detectado en VPS:</div>
                <div style={{ fontSize: '0.7rem', color: '#f87171', fontFamily: 'monospace', marginTop: '2px', wordBreak: 'break-all' }}>
                  {sourcesStatus.build_status.error}
                </div>
              </div>
            )}

            {/* Botón de Autocuración Activa */}
            <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '12px' }}>
              <button
                onClick={handleForceAutoheal}
                disabled={isHealing}
                className="btn btn-secondary"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  background: 'rgba(239, 68, 68, 0.15)',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
              >
                {isHealing ? '⏳ Enviando orden...' : '🔥 FORZAR AUTOCURACIÓN VPS'}
              </button>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.58rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: '1.2' }}>
                Libera bloqueos antiguos, mata procesos zombi y reinicia el scraper.
              </p>
            </div>
          </div>

          {/* Sistema de Autocuración y Resiliencia */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: 'var(--accent-purple)', fontWeight: '700', textTransform: 'uppercase' }}>Mecanismos de Resiliencia</h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}>🖼️ Portadas</div>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.64rem', color: 'var(--text-muted)', lineHeight: '1.25' }}>
                  Pool de 6-8 imágenes de Unsplash premium por categoría rotadas dinámicamente por hash de título para evitar repeticiones.
                </p>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}>🔗 Smart Links</div>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.64rem', color: 'var(--text-muted)', lineHeight: '1.25' }}>
                  Inyección autónoma de enlaces de interés contextuales (Wikipedia/Google News/Sitio oficial) si falla la inferencia de IA.
                </p>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}>📊 Cifras Clave</div>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.64rem', color: 'var(--text-muted)', lineHeight: '1.25' }}>
                  Estadísticas y valores en español generados de contingencia para evitar fichas vacías al caer en fallback.
                </p>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}>🔒 VPS Lock & Tests</div>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.64rem', color: 'var(--text-muted)', lineHeight: '1.25' }}>
                  Trap incondicional para liberar el bloqueo del lockfile. Test post-build de peso de bundles index/admin/CSS.
                </p>
              </div>
            </div>

            {/* Aclaración del Flujo de Copias de Despliegue */}
            <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--accent-cyan)', marginBottom: '6px', textTransform: 'uppercase' }}>
                📂 Flujo de Directorios e Integridad (VPS)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.64rem', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.01)', padding: '4px 8px', borderRadius: '6px' }}>
                  <strong>1. Origen (Edición)</strong>
                  <span style={{ fontFamily: 'monospace', color: '#fff' }}>/home/ubuntu/workspace/AIDAILY</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.01)', padding: '4px 8px', borderRadius: '6px' }}>
                  <strong>2. Compilación (Aislada)</strong>
                  <span style={{ fontFamily: 'monospace', color: '#fff' }}>/opt/aidaily</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.01)', padding: '4px 8px', borderRadius: '6px' }}>
                  <strong>3. Despliegue (Hosting)</strong>
                  <span style={{ fontFamily: 'monospace', color: '#fff' }}>.../workspace/public/pro/aidaily</span>
                </div>
              </div>
              <p style={{ margin: '8px 0 0 0', fontSize: '0.6rem', color: 'var(--text-muted)', lineHeight: '1.3', fontStyle: 'italic' }}>
                ⚠️ <strong>Nota:</strong> Las páginas o el admin se rompen si se mezclan compilaciones manuales sin limpiar el destino. El motor limpia de forma automática la carpeta de despliegue antes de copiar el build para evitar interferencias de hash de Vite.
              </p>
            </div>

          </div>

          {/* Pipeline Multi-Agente y Fallbacks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '12px' }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: 'var(--accent-magenta)', fontWeight: '700', textTransform: 'uppercase' }}>🤖 Agentes & Fallbacks Activos</h4>
            
            {/* Listado de Agentes del Pipeline */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pipeline de Agentes:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.02)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.64rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>🛡️ Filtro Heurístico Local</span>
                  <span style={{ color: '#10b981', fontWeight: '600' }}>Activo</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.02)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.64rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>🤖 Ollama Pre-Filter (Local)</span>
                  <span style={{ color: '#10b981', fontWeight: '600' }}>Activo (qwen2.5)</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.02)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.64rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>🧠 Redactor Principal (Cloud)</span>
                  <span style={{ color: 'var(--accent-cyan)', fontWeight: '600' }}>Llama 3.3 70B</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.02)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.64rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>🖼️ Resiliencia & Portadas</span>
                  <span style={{ color: 'var(--accent-purple)', fontWeight: '600' }}>Activo</span>
                </div>
              </div>
            </div>

            {/* Pool de Fallbacks de IA */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pool de Modelos (Rotación y Fallback):</div>
              <div style={{ fontSize: '0.64rem', fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '180px', overflowY: 'auto' }}>
                {(() => {
                  const list = currentConfig?.workflow?.rotation_candidates || [
                    { provider: 'nous', model: 'stepfun/step-3.7-flash:free' },
                    { provider: 'gemini', model: 'gemini-2.5-flash' },
                    { provider: 'nvidia', model: 'nvidia/llama-3.3-nemotron-super-49b-v1' },
                    { provider: 'github', model: 'meta-llama/Llama-3.3-70B-Instruct' },
                    { provider: 'mistral', model: 'mistral-small-latest' },
                    { provider: 'cloudflare', model: '@cf/meta/llama-3.1-8b-instruct' }
                  ];
                  return list.map((cand, idx) => {
                    const isFirst = idx === 0;
                    return (
                      <div key={idx} style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        color: isFirst ? '#fff' : 'var(--text-muted)', 
                        background: isFirst ? 'rgba(16,185,129,0.08)' : 'transparent', 
                        border: isFirst ? '1px solid rgba(16,185,129,0.15)' : 'none', 
                        padding: '3px 6px', 
                        borderRadius: '4px' 
                      }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                          {idx + 1}. <span style={{ color: cand.provider === 'gemini' ? '#22d3ee' : cand.provider === 'nous' ? '#a78bfa' : 'var(--text-muted)' }}>[{cand.provider}]</span> {cand.model}
                        </span>
                        <span style={{ fontWeight: 'bold', color: isFirst ? '#10b981' : 'var(--text-muted)', fontSize: '0.55rem' }}>
                          {isFirst ? '[PRINCIPAL]' : '[RESPALDO]'}
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>

          {/* Cola de Procesamiento IA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '12px' }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: '#fbbf24', fontWeight: '700', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🕒 Cola de Espera (IA)</span>
              {loadingQueue && <span style={{ fontSize: '0.65rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>cargando...</span>}
            </h4>

            {/* Listado de artículos en cola */}
            <div style={{ flex: 1, maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }} className="custom-scrollbar">
              {Object.keys(queueData).length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textAlign: 'center', padding: '30px 10px', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '150px' }}>
                  <span style={{ fontSize: '1.5rem' }}>✨</span>
                  <span>La cola está vacía.<br/>El motor de IA está libre o esperando feeds.</span>
                </div>
              ) : (
                Object.entries(queueData).slice(0, 20).map(([hashId, item]) => (
                  <div key={hashId} style={{ 
                    background: 'rgba(255,255,255,0.02)', 
                    border: '1px solid rgba(255,255,255,0.03)', 
                    padding: '8px 10px', 
                    borderRadius: '8px', 
                    fontSize: '0.66rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px'
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '700', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.title}>
                        {item.title}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px', color: 'var(--text-muted)', fontSize: '0.58rem' }}>
                        <span style={{ maxWidth: '75%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📡 {item.source || 'Fuente'}</span>
                        <span>{item.publishedAt ? new Date(item.publishedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveQueueItem(hashId)}
                      style={{
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.18)',
                        color: '#f87171',
                        borderRadius: '50%',
                        width: '22px',
                        height: '22px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '0.72rem',
                        transition: 'all 0.2s',
                        padding: 0,
                        flexShrink: 0
                      }}
                      title="Descartar noticia de la cola"
                      onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; e.currentTarget.style.color = '#fff'; }}
                      onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'; e.currentTarget.style.color = '#f87171'; }}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
              {Object.keys(queueData).length > 20 && (
                <div style={{ textAlign: 'center', fontSize: '0.6rem', color: 'var(--text-muted)', padding: '4px 0', borderTop: '1px dashed rgba(255,255,255,0.03)' }}>
                  ... y {Object.keys(queueData).length - 20} artículos más en cola
                </div>
              )}
            </div>

            {/* Acciones de la Cola */}
            {Object.keys(queueData).length > 0 && (
              <div style={{ marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '10px' }}>
                <button
                  onClick={handleClearQueue}
                  disabled={isClearingQueue}
                  className="btn btn-secondary"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '0.72rem',
                    fontWeight: '700',
                    background: 'rgba(245, 158, 11, 0.15)',
                    borderColor: 'rgba(245, 158, 11, 0.3)',
                    color: '#fbbf24',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.2s'
                  }}
                >
                  {isClearingQueue ? '⏳ Vaciando cola...' : '🗑️ VACIAS COLA DE ESPERA'}
                </button>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.58rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: '1.2' }}>
                  Eliminará todos los artículos pendientes de la cola de Firebase.
                </p>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* 3. Category Distribution */}
      <div className="card" style={{ padding: '24px' }}>
        <h3 className="card-title" style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}>📊 DISTRIBUCIÓN DE NOTICIAS POR CATEGORÍA</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {categoryChartItems.length > 0 ? categoryChartItems : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '16px' }}>
              Cargando distribución...
            </div>
          )}
        </div>
      </div>

      {/* 3. Feeds RSS Health Status */}
      <div className="card" style={{ padding: '24px' }}>
        <h3 className="card-title" style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}>⚠️ SALUD DE FEEDS RSS EN VIVO</h3>
        
        {/* Internal health metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: '10px', borderRadius: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Total Feeds</div>
            <div style={{ fontSize: '1.3rem', fontFamily: 'var(--font-title)', fontWeight: '800', color: '#fff' }}>{healthStats.total}</div>
          </div>
          <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)', padding: '10px', borderRadius: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: '700', textTransform: 'uppercase' }}>Online</div>
            <div style={{ fontSize: '1.3rem', fontFamily: 'var(--font-title)', fontWeight: '800', color: '#34d399' }}>{healthStats.online}</div>
          </div>
          <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', padding: '10px', borderRadius: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.65rem', color: '#ef4444', fontWeight: '700', textTransform: 'uppercase' }}>Con Error</div>
            <div style={{ fontSize: '1.3rem', fontFamily: 'var(--font-title)', fontWeight: '800', color: '#f87171' }}>{healthStats.error}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', padding: '10px', borderRadius: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Pendientes</div>
            <div style={{ fontSize: '1.3rem', fontFamily: 'var(--font-title)', fontWeight: '800', color: '#e5e7eb' }}>{healthStats.pending}</div>
          </div>
        </div>

        {/* Filter controls */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <input 
            type="text" 
            value={healthSearch}
            onChange={(e) => { setHealthSearch(e.target.value); setHealthPage(1); }}
            placeholder="Buscar por nombre de fuente o URL..." 
            className="input-field" 
            style={{ flex: 1, minWidth: '200px' }}
          />
          <select 
            value={healthStatusFilter}
            onChange={(e) => { setHealthStatusFilter(e.target.value); setHealthPage(1); }}
            className="input-field" 
            style={{ maxWidth: '180px', background: '#090912', color: '#fff' }}
          >
            <option value="all">Todos los Estados</option>
            <option value="success">Online (Éxito)</option>
            <option value="error">Con Error</option>
            <option value="pending">Pendientes de Scrapeo</option>
          </select>
        </div>

        {/* Table wrapper (desktop only) */}
        <div className="feeds-table-wrapper mobile-hide" style={{ overflowX: 'auto', width: '100%' }}>
          <table className="compact-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '12px 8px', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Fuente</th>
                <th style={{ padding: '12px 8px', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Categoría / Subcategoría</th>
                <th style={{ padding: '12px 8px', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Último Scrapeo</th>
                <th style={{ padding: '12px 8px', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Estado</th>
                <th style={{ padding: '12px 8px', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Noticias</th>
              </tr>
            </thead>
            <tbody>
              {pageBatch.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No se encontraron fuentes de salud con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                pageBatch.map((feed) => {
                  const isExpanded = expandedFeedUrls.has(feed.url);
                  const lastRunText = feed.lastRunTime 
                    ? new Date(feed.lastRunTime).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) 
                    : 'Nunca';

                  let statusBadge = (
                    <span style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '600' }}>
                      ⏳ PENDIENTE
                    </span>
                  );
                  if (feed.status === 'success') {
                    statusBadge = (
                      <span style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '600' }}>
                        ✅ ONLINE
                      </span>
                    );
                  } else if (feed.status === 'error') {
                    statusBadge = (
                      <span 
                        style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '600', cursor: 'help' }}
                        title={feed.errorMessage}
                      >
                        ❌ ERROR
                      </span>
                    );
                  }

                  return (
                    <React.Fragment key={feed.url}>
                      <tr 
                        onClick={() => toggleFeedExpand(feed.url)}
                        style={{ 
                          borderBottom: '1px solid rgba(255,255,255,0.03)', 
                          cursor: 'pointer',
                          background: isExpanded ? 'rgba(255,255,255,0.01)' : 'transparent',
                          transition: 'background 0.2s'
                        }}
                        className="hover-row"
                      >
                        <td style={{ padding: '12px 8px', fontWeight: '600', fontSize: '0.82rem', color: '#fff' }} data-label="Fuente">
                          {feed.name}
                        </td>
                        <td style={{ padding: '12px 8px' }} data-label="Categoría">
                          <span className="feed-category-badge" style={{ fontSize: '0.65rem' }}>{feed.category.toUpperCase()}</span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: '6px' }}>{feed.subcategory.toUpperCase()}</span>
                        </td>
                        <td style={{ padding: '12px 8px', fontSize: '0.78rem', color: 'var(--text-muted)' }} data-label="Último Scrapeo">
                          📅 {lastRunText}
                        </td>
                        <td style={{ padding: '12px 8px' }} data-label="Estado">
                          {statusBadge}
                        </td>
                        <td style={{ padding: '12px 8px', fontFamily: 'monospace', fontWeight: '700', textAlign: 'center', color: 'var(--accent-purple)', fontSize: '0.9rem' }} data-label="Noticias">
                          📰 {feed.count}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <td colSpan={5} style={{ padding: '12px 16px' }} data-label="Detalle técnico">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                              <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--accent-cyan)', wordBreak: 'break-all' }}>
                                <strong>URL RSS:</strong> <a href={feed.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }} className="break-url">{feed.url}</a>
                              </div>
                              {feed.status === 'error' && feed.errorMessage && (
                                <div style={{ color: '#f87171', fontFamily: 'monospace', fontSize: '0.72rem', padding: '6px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.15)', wordBreak: 'break-all' }}>
                                  <strong>Detalle de Error:</strong> {feed.errorMessage}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile alternative list (mobile only) */}
        <div className="mobile-articles-list desktop-hide">
          {pageBatch.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              No se encontraron fuentes.
            </div>
          ) : (
            pageBatch.map((feed) => {
              const isExpanded = expandedFeedUrls.has(feed.url);
              const lastRunText = feed.lastRunTime 
                ? new Date(feed.lastRunTime).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) 
                : 'Nunca';
              
              let statusDotColor = 'var(--text-muted)';
              if (feed.status === 'success') statusDotColor = '#34d399';
              else if (feed.status === 'error') statusDotColor = '#f87171';

              return (
                <div 
                  key={feed.url}
                  onClick={() => toggleFeedExpand(feed.url)}
                  style={{ 
                    background: 'rgba(255,255,255,0.01)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '8px', 
                    padding: '8px 10px',
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '4px',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: statusDotColor }}></span>
                      <span style={{ fontWeight: '600', fontSize: '0.72rem', color: '#fff' }}>{feed.name}</span>
                    </div>
                    <span style={{ fontSize: '0.68rem', fontFamily: 'monospace', fontWeight: '700', color: 'var(--accent-purple)' }}>📰 {feed.count}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.58rem', color: 'var(--text-muted)' }}>
                    <span>{feed.category.toUpperCase()} • {feed.subcategory.toUpperCase()}</span>
                    <span>Scrape: {lastRunText}</span>
                  </div>
                  {isExpanded && (
                    <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.58rem', color: 'var(--accent-cyan)', wordBreak: 'break-all' }}>
                        <strong>URL:</strong> {feed.url}
                      </div>
                      {feed.status === 'error' && feed.errorMessage && (
                        <div style={{ color: '#f87171', fontFamily: 'monospace', fontSize: '0.58rem', padding: '4px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.12)', wordBreak: 'break-all' }}>
                          <strong>Error:</strong> {feed.errorMessage}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Pagination controls */}
        {totalHealth > healthPerPage && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Mostrando fuentes <span>{startIdx + 1}-{endIdx} de {totalHealth}</span>
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => setHealthPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="tab-btn"
                style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '4px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
              >
                ◀ Anterior
              </button>
              <button 
                onClick={() => setHealthPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="tab-btn"
                style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '4px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
              >
                Siguiente ▶
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
