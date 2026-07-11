import React, { useState, useEffect, useCallback } from 'react';
import DashboardPanel from './DashboardPanel';
import ArticlesPanel from './ArticlesPanel';
import SourcesPanel from './SourcesPanel';
import ConfigPanel from './ConfigPanel';

const dbUrlBase = 'https://pecemi-default-rtdb.firebaseio.com/aidaily';
const vpsUrlBase = 'https://pecemi-default-rtdb.firebaseio.com/vps';

async function calculateHash(text) {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const msgUint8 = new TextEncoder().encode(text);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex.substring(0, 16);
    } catch (e) {
      console.warn("subtle digest falló, usando fallback local", e);
    }
  }
  
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  
  let hash2 = 3099955371;
  for (let i = text.length - 1; i >= 0; i--) {
    hash2 ^= text.charCodeAt(i);
    hash2 = Math.imul(hash2, 16777619);
  }
  const hex2 = (hash2 >>> 0).toString(16).padStart(8, '0');
  return hex + hex2;
}

const token = 'pecemi_secure_gateway_token_2026_xyz';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Global Config and Data States
  const [currentConfig, setCurrentConfig] = useState({ feeds: {}, orientation: {}, workflow: {} });
  const [sourcesStatus, setSourcesStatus] = useState({});
  const [feedHashes, setFeedHashes] = useState({});
  const [buildStatus, setBuildStatus] = useState(null);
  const [allArticlesData, setAllArticlesData] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [vpsExecutionStatus, setVpsExecutionStatus] = useState({});

  // Live Logger State
  const [logs, setLogs] = useState([]);
  const [liveLogActive, setLiveLogActive] = useState(false);

  // Clock
  const [formattedTime, setFormattedTime] = useState('');

  const isReadOnly = false;

  // Intercept write operations (always approved since we use the hardcoded token)
  const ensureAdminAccess = useCallback((callbackIfSuccess) => {
    if (callbackIfSuccess) callbackIfSuccess();
    return true;
  }, []);



  // Clock tick
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        const monthsCompact = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
        const day = now.getDate();
        const month = monthsCompact[now.getMonth()];
        const time = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        setFormattedTime(`${day} ${month} • ${time}`.toUpperCase());
      } else {
        const detailed = now.toLocaleDateString('es-ES', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }) + ' • ' + now.toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        setFormattedTime(detailed.toUpperCase());
      }
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch configs, build metrics, and hashes (Public endpoints, don't require Token)
  const loadFirebaseConfig = useCallback(async () => {
    try {
      const res = await fetch(`${dbUrlBase}/config.json`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setCurrentConfig({
            feeds: data.feeds || {},
            orientation: data.orientation || {},
            workflow: data.workflow || {}
          });

          // Precalculate hashes
          const hashes = {};
          const promises = [];
          if (data.feeds) {
            Object.entries(data.feeds).forEach(([cat, list]) => {
              if (!Array.isArray(list)) return;
              list.forEach(feed => {
                promises.push(
                  calculateHash(feed.url).then(hash => {
                    hashes[feed.url] = hash;
                  })
                );
              });
            });
          }
          await Promise.all(promises);
          setFeedHashes(hashes);
        }
      }
    } catch (e) {
      console.error("Error al descargar configuración de Firebase:", e);
    }
  }, []);

  const loadSourcesStatus = useCallback(async () => {
    try {
      const res = await fetch(`${dbUrlBase}/sources_status.json`);
      if (res.ok) {
        const data = await res.json();
        setSourcesStatus(data || {});
      }
    } catch (e) {
      console.error("Error al descargar estado de fuentes:", e);
    }
  }, []);

  const loadBuildStatus = useCallback(async () => {
    try {
      const res = await fetch(`${dbUrlBase}/sources_status/build_status.json`);
      if (res.ok) {
        const data = await res.json();
        setBuildStatus(data);
      }
    } catch (e) {
      console.error("Error al descargar estado de compilación:", e);
    }
  }, []);

  const loadArticles = useCallback(async () => {
    setIsLoadingData(true);
    try {
      // Intentar leer de la API local de noticias (VPS)
      const res = await fetch('/pro/aidaily/api/articles.json?nocache=' + Date.now());
      if (res.ok) {
        const data = await res.json() || {};
        const parsed = Object.entries(data).map(([key, val]) => ({
          ...val,
          id: val.id || key
        })).sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
        setAllArticlesData(parsed);
        console.log(`[Admin] Cargados ${parsed.length} artículos históricos desde la API local.`);
      } else {
        // Fallback a Firebase RTDB (por si corre en otro puerto/entorno)
        const fbRes = await fetch(`${dbUrlBase}/articles.json`);
        if (fbRes.ok) {
          const data = await fbRes.json() || {};
          const parsed = Object.entries(data).map(([key, val]) => ({
            ...val,
            id: val.id || key
          })).sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
          setAllArticlesData(parsed);
          console.log(`[Admin] Fallback: cargados ${parsed.length} artículos desde Firebase.`);
        }
      }
    } catch (e) {
      console.error("Error al descargar artículos:", e);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  const loadVpsExecutionStatus = useCallback(async () => {
    try {
      const res = await fetch(`${dbUrlBase}/vps_execution_status.json`);
      if (res.ok) {
        const data = await res.json();
        setVpsExecutionStatus(data || {});
      }
    } catch (e) {
      console.error("Error al descargar estado de ejecución VPS:", e);
    }
  }, []);

  // Sync all general data initially
  useEffect(() => {
    loadFirebaseConfig();
    loadSourcesStatus();
    loadBuildStatus();
    loadArticles();
    loadVpsExecutionStatus();
  }, [loadFirebaseConfig, loadSourcesStatus, loadBuildStatus, loadArticles, loadVpsExecutionStatus]);

  // Periodic VPS execution status poll
  useEffect(() => {
    const interval = setInterval(loadVpsExecutionStatus, 6000); // Poll status every 6s
    return () => clearInterval(interval);
  }, [loadVpsExecutionStatus]);

  // Log handler helpers
  const pushLogLine = (message, type = 'info') => {
    const time = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [...prev, { time, message, type }]);
  };

  // Manage token updates (dummy function for prop compatibility)
  const handleUpdateToken = () => {};

  // VPS Live Log Reader via Bridge
  useEffect(() => {
    if (!liveLogActive || isReadOnly) return;

    let intervalId = null;
    let failedAttempts = 0;

    const pollLogs = async () => {
      const readLogsReqId = "log_" + Date.now();
      const reqUrl = `${vpsUrlBase}/bridge_requests/${readLogsReqId}.json`;
      const respUrl = `${vpsUrlBase}/bridge_responses/${readLogsReqId}.json`;

      try {
        await fetch(reqUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: "run_terminal_command",
            params: {
              command: "tail -n 20 /home/ubuntu/workspace/AIDAILY/logs/sync.log",
              cwd: "/home/ubuntu/workspace/AIDAILY"
            },
            security_token: token,
            timestamp: Date.now()
          })
        });

        let resolved = false;
        const startTime = Date.now();
        while (Date.now() - startTime < 4000) {
          const checkRes = await fetch(respUrl);
          if (checkRes.ok) {
            const respData = await checkRes.json();
            if (respData) {
              if (respData.success && respData.data && respData.data.stdout) {
                const lines = respData.data.stdout.split('\n');
                setLogs([]); // Reset log console screen
                lines.forEach(text => {
                  if (text.trim().length === 0) return;
                  let type = 'info';
                  if (text.includes('[IA] Nuevo') || text.includes('Iniciando') || text.includes('iniciada') || text.includes('finalizada') || text.includes('completada')) {
                    type = 'success';
                  } else if (text.includes('warning') || text.includes('[xmldom warning]') || text.includes('Advertencia') || text.includes('fallback')) {
                    type = 'warn';
                  } else if (text.includes('Error') || text.includes('ERROR') || text.includes('[xmldom error]') || text.includes('Fallo')) {
                    type = 'error';
                  }
                  setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }), message: text, type }]);
                });

                if (respData.data.stdout.includes('=== Sincronización IA Daily finalizada ===') ||
                    respData.data.stdout.includes('ERROR: Falló la sincronización')) {
                  pushLogLine('🏁 Proceso finalizado en la VPS.', 'info');
                  setLiveLogActive(false);
                }
                failedAttempts = 0;
              }

              await fetch(reqUrl, { method: 'DELETE' });
              await fetch(respUrl, { method: 'DELETE' });
              resolved = true;
              break;
            }
          }
          await new Promise(r => setTimeout(r, 600));
        }

        if (!resolved) {
          failedAttempts++;
        }
      } catch (err) {
        failedAttempts++;
      }

      if (failedAttempts > 5) {
        pushLogLine('⚠️ Demasiados fallos al leer los logs en vivo. Deteniendo monitorización.', 'warn');
        setLiveLogActive(false);
      }
    };

    pollLogs();
    intervalId = setInterval(pollLogs, 5000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [liveLogActive, isReadOnly, token]);

  // Command execution bridge trigger
  const runVpsTerminalCommand = async (commandLine, logStartMsg, timeoutMs = 25000, postExecutionCallback = async () => {}) => {
    if (isReadOnly) {
      alert('🔒 Estás en Modo Lectura. Por favor introduce la contraseña en Configuración.');
      return;
    }

    pushLogLine(logStartMsg || `🚀 Iniciando comando en la VPS: ${commandLine}...`, 'info');

    const reqId = "cmd_" + Date.now();
    const reqUrl = `${vpsUrlBase}/bridge_requests/${reqId}.json`;
    const respUrl = `${vpsUrlBase}/bridge_responses/${reqId}.json`;

    try {
      const response = await fetch(reqUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: "run_terminal_command",
          params: {
            command: commandLine,
            cwd: "/home/ubuntu/workspace/AIDAILY"
          },
          security_token: token,
          timestamp: Date.now()
        })
      });

      if (!response.ok) throw new Error(`HTTP status ${response.status}`);

      pushLogLine('📬 Petición enviada. Esperando acuse de recibo de la VPS...', 'info');

      let confirmed = false;
      const startTime = Date.now();

      while (Date.now() - startTime < timeoutMs) {
        const checkRes = await fetch(respUrl);
        if (checkRes.ok) {
          const respData = await checkRes.json();
          if (respData) {
            if (respData.success) {
              pushLogLine('✅ La VPS ha recibido y ejecutado el comando con éxito.', 'success');
              if (respData.data && respData.data.stdout) {
                pushLogLine(`[Salida VPS]: ${respData.data.stdout}`, 'info');
              }
              confirmed = true;
              await postExecutionCallback(respData);
            } else {
              pushLogLine(`❌ La VPS rechazó la petición: ${respData.error}`, 'error');
            }
            await fetch(reqUrl, { method: 'DELETE' });
            await fetch(respUrl, { method: 'DELETE' });
            break;
          }
        }
        await new Promise(r => setTimeout(r, 1000));
      }

      if (!confirmed) {
        pushLogLine('⏳ Tiempo de espera agotado en la respuesta del puente.', 'warn');
      }

    } catch (err) {
      pushLogLine(`❌ Falló la conexión del puente VPS: ${err.message}`, 'error');
    }
  };

  // Sync Cron VPS
  const triggerVpsSync = async () => {
    setLiveLogActive(true);
    await runVpsTerminalCommand(
      "nohup bash /home/ubuntu/workspace/AIDAILY/sync-aidaily.sh > /dev/null 2>&1 &",
      "🚀 Generando petición de sincronización horaria en segundo plano...",
      15000,
      async () => {
        pushLogLine('📡 Activado monitor de log en tiempo real.', 'info');
      }
    );
  };

  // Import Excel VPS
  const triggerExcelImport = async () => {
    await runVpsTerminalCommand(
      "node /home/ubuntu/workspace/AIDAILY/scripts/import-excel-sources.mjs",
      "🚀 Generando petición para importar fuentes RSS desde Excel...",
      35000,
      async () => {
        pushLogLine('🔄 Recargando configuración de feeds RSS...', 'info');
        await loadFirebaseConfig();
      }
    );
  };

  // AI tools for Article (individual / bulk)
  const triggerVpsArticleTool = async (cmdParams) => {
    setLiveLogActive(true);
    await runVpsTerminalCommand(
      `node /home/ubuntu/workspace/AIDAILY/scripts/ai-article-tool.mjs ${cmdParams}`,
      `🚀 Ejecutando comando de IA en la VPS: ai-article-tool.mjs ${cmdParams}`,
      15000,
      async () => {
        setTimeout(async () => {
          pushLogLine('🔄 Recargando base de datos de noticias...', 'info');
          await loadArticles();
        }, 6000);
      }
    );
  };

  // Load historical logs manual tail
  const loadLatestLogs = async () => {
    await runVpsTerminalCommand(
      "tail -n 300 /home/ubuntu/workspace/AIDAILY/logs/sync.log",
      "📡 Consultando últimas 300 líneas de logs detallados en la VPS...",
      12000,
      async (resp) => {
        if (resp.data && resp.data.stdout) {
          const lines = resp.data.stdout.split('\n');
          setLogs([]);
          lines.forEach(text => {
            if (text.trim().length === 0) return;
            let type = 'info';
            if (text.includes('[IA] Nuevo') || text.includes('Iniciando') || text.includes('iniciada') || text.includes('finalizada') || text.includes('completada')) {
              type = 'success';
            } else if (text.includes('warning') || text.includes('[xmldom warning]') || text.includes('Advertencia') || text.includes('fallback')) {
              type = 'warn';
            } else if (text.includes('Error') || text.includes('ERROR') || text.includes('[xmldom error]') || text.includes('Fallo')) {
              type = 'error';
            }
            setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }), message: text, type }]);
          });
        }
      }
    );
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  return (
    <>
      {/* A. Sticky Header */}
      <header>
        <div className="header-container">
          <div className="brand" onClick={() => setActiveTab('dashboard')} style={{ cursor: 'pointer' }}>
            <h1>IA DAILY</h1>
            <p>Panel de Control</p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Clock */}
            <div id="top-bar-date" className="desktop-only" style={{ fontSize: '0.7rem', fontFamily: 'monospace', fontWeight: '600', color: 'var(--text-muted)' }}>
              <span>{formattedTime}</span>
            </div>

            {/* Desktop Navigation */}
            <nav style={{ display: 'flex', gap: '8px', alignItems: 'center' }} className="desktop-only">
              <button 
                onClick={() => setActiveTab('dashboard')} 
                className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
              >
                📊 Dashboard
              </button>
              <button 
                onClick={() => setActiveTab('articles')} 
                className={`tab-btn ${activeTab === 'articles' ? 'active' : ''}`}
              >
                📰 Artículos
              </button>
              <button 
                onClick={() => setActiveTab('feeds')} 
                className={`tab-btn ${activeTab === 'feeds' ? 'active' : ''}`}
              >
                📡 Fuentes RSS
              </button>
              <button 
                onClick={() => setActiveTab('config_models')} 
                className={`tab-btn ${activeTab === 'config_models' ? 'active' : ''}`}
              >
                🤖 Modelos e IA
              </button>
              <button 
                onClick={() => setActiveTab('config_style')} 
                className={`tab-btn ${activeTab === 'config_style' ? 'active' : ''}`}
              >
                ✍️ Estilo y Orientación
              </button>
              <button 
                onClick={() => setActiveTab('config_scraper')} 
                className={`tab-btn ${activeTab === 'config_scraper' ? 'active' : ''}`}
              >
                ⚙️ Ajustes Scraper
              </button>
              <a 
                href="/pro/aidaily/index.html" 
                className="tab-btn" 
                style={{ 
                  background: 'rgba(239, 68, 68, 0.12)', 
                  borderColor: 'rgba(239, 68, 68, 0.25)', 
                  color: '#f87171', 
                  fontWeight: '600',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  marginLeft: '8px',
                  height: '32px',
                  boxSizing: 'border-box'
                }}
              >
                🚪 SALIR
              </a>
            </nav>

            {/* Mobile Hamburger Toggle */}
            <button 
              id="hamburger-btn" 
              className="hamburger-btn" 
              onClick={() => setIsMobileMenuOpen(true)}
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.4rem', cursor: 'pointer' }}
            >
              ☰
            </button>
          </div>
        </div>
      </header>



      {/* C. Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <>
          <div 
            id="drawer-overlay" 
            onClick={() => setIsMobileMenuOpen(false)}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, backdropFilter: 'blur(4px)' }}
          />
          <div 
            id="mobile-drawer" 
            className="drawer-animate"
            style={{ 
              position: 'fixed', 
              top: 0, 
              right: 0, 
              width: '280px', 
              height: '100%', 
              background: 'var(--bg-dark)', 
              borderLeft: '1px solid var(--border-color)', 
              zIndex: 1001, 
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxShadow: '-10px 0 30px rgba(0,0,0,0.5)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <span style={{ fontWeight: '700', fontFamily: 'var(--font-title)', fontSize: '0.9rem', color: '#fff', letterSpacing: '0.5px' }}>MENÚ NAVEGACIÓN</span>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
              <button 
                onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }} 
                className={`drawer-link ${activeTab === 'dashboard' ? 'active' : ''}`}
              >
                📊 Dashboard
              </button>
              <button 
                onClick={() => { setActiveTab('articles'); setIsMobileMenuOpen(false); }} 
                className={`drawer-link ${activeTab === 'articles' ? 'active' : ''}`}
              >
                📰 Artículos
              </button>
              <button 
                onClick={() => { setActiveTab('feeds'); setIsMobileMenuOpen(false); }} 
                className={`drawer-link ${activeTab === 'feeds' ? 'active' : ''}`}
              >
                📡 Fuentes RSS
              </button>
              <button 
                onClick={() => { setActiveTab('config_models'); setIsMobileMenuOpen(false); }} 
                className={`drawer-link ${activeTab === 'config_models' ? 'active' : ''}`}
              >
                🤖 Modelos e IA
              </button>
              <button 
                onClick={() => { setActiveTab('config_style'); setIsMobileMenuOpen(false); }} 
                className={`drawer-link ${activeTab === 'config_style' ? 'active' : ''}`}
              >
                ✍️ Estilo y Orientación
              </button>
              <button 
                onClick={() => { setActiveTab('config_scraper'); setIsMobileMenuOpen(false); }} 
                className={`drawer-link ${activeTab === 'config_scraper' ? 'active' : ''}`}
              >
                ⚙️ Ajustes Scraper
              </button>
              <a 
                href="/pro/aidaily/index.html" 
                className="drawer-link" 
                style={{ 
                  background: 'rgba(239, 68, 68, 0.15)', 
                  borderColor: 'rgba(239, 68, 68, 0.3)', 
                  color: '#f87171', 
                  marginTop: '12px', 
                  textAlign: 'center', 
                  fontWeight: '600',
                  textDecoration: 'none',
                  display: 'block',
                  padding: '10px',
                  borderRadius: '8px'
                }}
              >
                🚪 SALIR DE ADMIN
              </a>
            </div>


          </div>
        </>
      )}

      {/* D. Main Panels Container */}
      <main className="admin-container">
        
        {buildStatus && buildStatus.ok === false && (
          <div style={{
            background: 'linear-gradient(90deg, #7f1d1d, #b91c1c)',
            color: '#fef2f2',
            padding: '12px 16px',
            borderRadius: '12px',
            marginBottom: '20px',
            fontFamily: 'var(--font-body)',
            fontSize: '0.8rem',
            fontWeight: '600',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{ fontSize: '1rem' }}>⚠️</span>
            <span style={{ flex: 1, lineHeight: '1.4', textAlign: 'left' }}>
              <strong>MOTOR VPS:</strong> Sincronización inactiva por error: <code style={{ background: 'rgba(0,0,0,0.25)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.75rem' }}>{buildStatus.error || 'Error crítico (código 2)'}</code>. Las noticias podrían estar desactualizadas.
            </span>
          </div>
        )}
        
        {isLoadingData && (
          <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '0.8rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '12px', marginBottom: '20px' }}>
            🔄 Sincronizando datos con la nube de Firebase...
          </div>
        )}

        {activeTab === 'dashboard' && (
          <DashboardPanel 
            allArticlesData={allArticlesData}
            currentConfig={currentConfig}
            sourcesStatus={sourcesStatus}
            feedHashes={feedHashes}
            vpsExecutionStatus={vpsExecutionStatus}
          />
        )}

        {activeTab === 'articles' && (
          <ArticlesPanel 
            allArticlesData={allArticlesData}
            dbUrlBase={dbUrlBase}
            vpsUrlBase={vpsUrlBase}
            token={token}
            isReadOnly={isReadOnly}
            ensureAdminAccess={ensureAdminAccess}
            onRefreshArticles={loadArticles}
            triggerVpsArticleTool={triggerVpsArticleTool}
          />
        )}

        {activeTab === 'feeds' && (
          <SourcesPanel 
            currentConfig={currentConfig}
            dbUrlBase={dbUrlBase}
            token={token}
            isReadOnly={isReadOnly}
            ensureAdminAccess={ensureAdminAccess}
            onRefreshConfig={loadFirebaseConfig}
            sourcesStatus={sourcesStatus}
            feedHashes={feedHashes}
          />
        )}

        {activeTab === 'config_models' && (
          <ConfigPanel 
            section="models"
            currentConfig={currentConfig}
            dbUrlBase={dbUrlBase}
            vpsUrlBase={vpsUrlBase}
            token={token}
            isReadOnly={isReadOnly}
            ensureAdminAccess={ensureAdminAccess}
            onUpdateToken={handleUpdateToken}
            onRefreshConfig={loadFirebaseConfig}
            buildStatus={buildStatus}
            logs={logs}
            onClearLogs={handleClearLogs}
            onLoadLogs={loadLatestLogs}
            triggerVpsSync={triggerVpsSync}
            triggerExcelImport={triggerExcelImport}
          />
        )}

        {activeTab === 'config_style' && (
          <ConfigPanel 
            section="style"
            currentConfig={currentConfig}
            dbUrlBase={dbUrlBase}
            vpsUrlBase={vpsUrlBase}
            token={token}
            isReadOnly={isReadOnly}
            ensureAdminAccess={ensureAdminAccess}
            onUpdateToken={handleUpdateToken}
            onRefreshConfig={loadFirebaseConfig}
            buildStatus={buildStatus}
            logs={logs}
            onClearLogs={handleClearLogs}
            onLoadLogs={loadLatestLogs}
            triggerVpsSync={triggerVpsSync}
            triggerExcelImport={triggerExcelImport}
          />
        )}

        {activeTab === 'config_scraper' && (
          <ConfigPanel 
            section="scraper"
            currentConfig={currentConfig}
            dbUrlBase={dbUrlBase}
            vpsUrlBase={vpsUrlBase}
            token={token}
            isReadOnly={isReadOnly}
            ensureAdminAccess={ensureAdminAccess}
            onUpdateToken={handleUpdateToken}
            onRefreshConfig={loadFirebaseConfig}
            buildStatus={buildStatus}
            logs={logs}
            onClearLogs={handleClearLogs}
            onLoadLogs={loadLatestLogs}
            triggerVpsSync={triggerVpsSync}
            triggerExcelImport={triggerExcelImport}
          />
        )}
      </main>

      {/* Global CSS fixes for Responsive Nav and animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .5; }
        }
        @media (max-width: 768px) {
          .desktop-only {
            display: none !important;
          }
          .hamburger-btn {
            display: flex !important;
          }
        }
      `}</style>
    </>
  );
}
