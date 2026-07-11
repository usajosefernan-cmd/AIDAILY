import React, { useState, useEffect } from 'react';
import ConsoleLog from './ConsoleLog';

export default function ConfigPanel({
  section = 'models', // 'models', 'style', 'scraper'
  currentConfig = {},
  dbUrlBase = '',
  vpsUrlBase = '',
  token = '',
  onRefreshConfig = async () => {},
  buildStatus = null,
  logs = [],
  onClearLogs = () => {},
  onLoadLogs = async () => {},
  triggerVpsSync = async () => {},
  triggerExcelImport = async () => {}
}) {
  const [activeSubTab, setActiveSubTab] = useState('server');
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isImportingExcel, setIsImportingExcel] = useState(false);
  const [isFetchingLogs, setIsFetchingLogs] = useState(false);

  // States for rotation candidates (editable)
  const [rotationCandidates, setRotationCandidates] = useState([]);
  const [newCandidateProvider, setNewCandidateProvider] = useState('nous');
  const [newCandidateModel, setNewCandidateModel] = useState('');
  const [jsonText, setJsonText] = useState('');

  // States for VPS execution history
  const [executionHistory, setExecutionHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const fetchExecutionHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch('https://pecemi-default-rtdb.firebaseio.com/aidaily/vps_execution_history.json');
      if (res.ok) {
        const data = await res.json();
        if (data) {
          const parsed = Object.entries(data).map(([key, val]) => ({
            id: key,
            ...val
          })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          setExecutionHistory(parsed.slice(0, 15));
        }
      }
    } catch (err) {
      console.error('Error fetching execution history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'server') {
      fetchExecutionHistory();
    }
  }, [activeSubTab]);

  // Form states
  const [scraperConfig, setScraperConfig] = useState({
    cutoffHours: 336,
    maxNewProcessings: 60,
    batchSize: 40,
    relevanceThreshold: 7,
    relevanceModel: 'meta-llama/llama-3.2-3b-instruct:free'
  });

  const [aiConfig, setAiConfig] = useState({
    tone: 'dynamic',
    model: 'openrouter/free',
    customTone: '',
    preferences: '',
    promptAdditions: ''
  });

  const [interestsConfig, setInterestsConfig] = useState({
    countries: 'España, Europa',
    topics: 'Actualidad política, Geopolítica, Fórmula 1, Deportistas españoles, IA',
    entities: 'Carlos Alcaraz, Fernando Alonso, Elon Musk, Kylian Mbappé',
    blockedKeywords: 'farándula, cotilleo, rumores, tarot, horóscopo'
  });

  const [workflowConfig, setWorkflowConfig] = useState({
    fetch_rss: { enabled: true, batch_size: 600 },
    pre_filter: { enabled: true, cutoff_hours: 24 },
    web_scraping: { enabled: true, max_length: 100000 },
    ia_analysis: {
      enabled: true,
      model: 'openai/gpt-oss-120b:free',
      relevance_threshold: 7,
      tone: 'premium',
      max_publications_per_run: 45,
      enable_needy_bypass: true
    },
    image_validation: { enabled: true },
    integrity_check: { enabled: true },
    firebase_deploy: { enabled: true }
  });

  const [categoryMap, setCategoryMap] = useState({
    deportes: ['futbol', 'futbol/laliga', 'futbol/femenino', 'futbol/champions', 'futbol/2', 'futbol/general', 'ciclismo', 'ciclismo/tour-de-francia', 'motor', 'motor/formula 1', 'motor/motogp', 'motor/general', 'baloncesto', 'tenis', 'golf', 'polideportivo'],
    tecnologia: ['ia', 'software', 'gadgets', 'inteligencia artificial', 'hardware', 'startups', 'ciberseguridad', 'videojuegos'],
    ciencia: ['espacio', 'salud', 'biologia', 'salud y medicina', 'biotecnologia', 'fisica', 'descubrimientos', 'astronomia'],
    medioambiente: ['clima', 'sostenibilidad', 'ecologia', 'energias renovables', 'biodiversidad', 'economia circular'],
    internacional: ['europa', 'america', 'asia', 'global', 'geopolitica'],
    nacional: ['politica', 'sociedad', 'justicia', 'economia nacional', 'comunidades', 'corrupcion'],
    economia: ['mercados', 'finanzas', 'empresas', 'macroeconomia', 'empleo', 'negocios'],
    opinion: ['editorial', 'columnas', 'analisis', 'debates'],
    cultura: ['cine', 'musica', 'literatura', 'arte', 'teatro', 'series'],
    estilo: ['bienestar', 'viajes', 'tendencias', 'moda', 'hogar'],
    sociedad: ['educacion', 'sanidad', 'derechos humanos', 'igualdad', 'redes sociales', 'meteorologia'],
    gastronomia: ['recetas', 'restaurantes', 'nutricion', 'vinos', 'cocina']
  });

  const [selectedCategoryTab, setSelectedCategoryTab] = useState('deportes');
  const [newSubcategoryInput, setNewSubcategoryInput] = useState('');

  // Estados para Temas Calientes Destacados en menú
  const [trendingTopics, setTrendingTopics] = useState([]);
  const [highlightedTopics, setHighlightedTopics] = useState([]);
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);

  const fetchTrendingAndHighlights = async () => {
    setIsLoadingTrends(true);
    try {
      // 1. Cargar temas calientes vivos
      const tRes = await fetch('https://pecemi-default-rtdb.firebaseio.com/aidaily/trending_topics.json');
      if (tRes.ok) {
        const raw = await tRes.json();
        if (raw && raw.topics) {
          setTrendingTopics(raw.topics);
        } else if (raw) {
          setTrendingTopics(Object.values(raw).filter(t => typeof t === 'object' && t.id));
        }
      }
      
      // 2. Cargar IDs destacados del menú
      const hRes = await fetch('https://pecemi-default-rtdb.firebaseio.com/aidaily/config/highlighted_topics.json');
      if (hRes.ok) {
        const rawIds = await hRes.json();
        if (Array.isArray(rawIds)) {
          setHighlightedTopics(rawIds);
        } else {
          setHighlightedTopics([]);
        }
      }
    } catch (err) {
      console.error('Error fetching trending and highlights:', err);
    } finally {
      setIsLoadingTrends(false);
    }
  };

  // Estados para añadir temas calientes manualmente
  const [newTrendTitle, setNewTrendTitle] = useState('');
  const [newTrendType, setNewTrendType] = useState('trend');
  const [newTrendKeywords, setNewTrendKeywords] = useState('');

  const handleAddTrend = () => {
    if (!newTrendTitle.trim()) return;
    const slug = newTrendTitle.toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
      .replace(/[^a-z0-9]+/g, '-') // Cambiar espacios y caracteres no alfa por guion
      .replace(/(^-|-$)+/g, ''); // Limpiar guiones iniciales/finales

    if (trendingTopics.some(t => t.id === slug)) {
      alert('Ya existe un tema con ese nombre o slug.');
      return;
    }

    const newTrendObj = {
      id: slug,
      title: newTrendTitle.trim(),
      type: newTrendType,
      keywords: newTrendKeywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean),
      popularity: 0.95, // Popularidad inicial alta por ser manual
      articleCount: 1, // Simular 1 artículo
      addedManually: true,
      updatedAt: new Date().toISOString()
    };

    setTrendingTopics(prev => [...prev, newTrendObj]);
    setNewTrendTitle('');
    setNewTrendKeywords('');
  };

  const handleRemoveTrend = (id) => {
    if (window.confirm('¿Seguro que deseas eliminar/desactivar este tema caliente de la web? Se borrará de la marquesina al guardar.')) {
      setTrendingTopics(prev => prev.filter(t => t.id !== id));
      setHighlightedTopics(prev => prev.filter(hid => hid !== id));
    }
  };

  useEffect(() => {
    fetchTrendingAndHighlights();
  }, [dbUrlBase]);

  // Sync state with parent props when config is fetched
  useEffect(() => {
    if (currentConfig.orientation) {
      const o = currentConfig.orientation;
      setScraperConfig({
        cutoffHours: o.cutoffHours ?? 336,
        maxNewProcessings: o.maxNewProcessings ?? 60,
        batchSize: o.batchSize ?? 40,
        relevanceThreshold: o.relevanceThreshold ?? 7,
        relevanceModel: o.relevanceModel ?? 'meta-llama/llama-3.2-3b-instruct:free'
      });

      setAiConfig({
        tone: o.tone ?? 'dynamic',
        model: o.model ?? 'openrouter/free',
        customTone: o.customTone ?? '',
        preferences: o.preferences ?? '',
        promptAdditions: o.promptAdditions ?? ''
      });

      if (o.interests) {
        setInterestsConfig({
          countries: o.interests.countries ?? '',
          topics: o.interests.topics ?? '',
          entities: o.interests.entities ?? '',
          blockedKeywords: o.interests.blockedKeywords ?? ''
        });
      }
    }

    if (currentConfig.workflow) {
      setWorkflowConfig(prev => ({
        ...prev,
        ...currentConfig.workflow
      }));

      const candidates = currentConfig.workflow.rotation_candidates || [
        { provider: 'nous', model: 'stepfun/step-3.7-flash:free' },
        { provider: 'gemini', model: 'gemini-2.5-flash' },
        { provider: 'nvidia', model: 'nvidia/llama-3.3-nemotron-super-49b-v1' },
        { provider: 'github', model: 'meta-llama/Llama-3.3-70B-Instruct' },
        { provider: 'mistral', model: 'mistral-small-latest' },
        { provider: 'cloudflare', model: '@cf/meta/llama-3.1-8b-instruct' },
        { provider: 'nous', model: 'tencent/hy3:free' },
        { provider: 'gemini', model: 'gemini-2.5-flash-preview' },
        { provider: 'nvidia', model: 'nvidia/llama-3.1-nemotron-70b-instruct' },
        { provider: 'github', model: 'gpt-4o-mini' },
        { provider: 'mistral', model: 'pixtral-12b-2409' },
        { provider: 'cloudflare', model: '@cf/qwen/qwen1.5-7b-chat' },
        { provider: 'gemini', model: 'gemini-2.0-flash' },
        { provider: 'nvidia', model: 'deepseek-ai/deepseek-r1' },
        { provider: 'github', model: 'mistralai/Mistral-Large-2411' },
        { provider: 'mistral', model: 'open-mistral-nemo' },
        { provider: 'cloudflare', model: '@cf/mistral/mistral-7b-instruct-v0.2' },
        { provider: 'gemini', model: 'gemini-1.5-flash' },
        { provider: 'github', model: 'cohere/Command-R-Plus' },
        { provider: 'huggingface', model: 'meta-llama/Llama-3.3-70B-Instruct' },
        { provider: 'huggingface', model: 'Qwen/Qwen2.5-72B-Instruct' },
        { provider: 'huggingface', model: 'meta-llama/Meta-Llama-3-8B-Instruct' },
        { provider: 'huggingface', model: 'mistralai/Mistral-Nemo-Instruct-2407' },
        { provider: 'huggingface', model: 'Qwen/Qwen2.5-Coder-32B-Instruct' }
      ];
      setRotationCandidates(candidates);
      setJsonText(JSON.stringify(candidates, null, 2));
    }

    if (currentConfig.category_map) {
      setCategoryMap(currentConfig.category_map);
    }
    if (currentConfig.highlighted_topics && Array.isArray(currentConfig.highlighted_topics)) {
      setHighlightedTopics(currentConfig.highlighted_topics);
    }
  }, [currentConfig]);

  const handleAddModel = () => {
    if (!newCandidateModel.trim()) return;
    const list = [...rotationCandidates, { provider: newCandidateProvider, model: newCandidateModel.trim() }];
    setRotationCandidates(list);
    setJsonText(JSON.stringify(list, null, 2));
    setNewCandidateModel('');
  };

  const handleRemoveModel = (index) => {
    const list = rotationCandidates.filter((_, idx) => idx !== index);
    setRotationCandidates(list);
    setJsonText(JSON.stringify(list, null, 2));
  };

  const handleMoveModelUp = (index) => {
    if (index === 0) return;
    const list = [...rotationCandidates];
    const temp = list[index];
    list[index] = list[index - 1];
    list[index - 1] = temp;
    setRotationCandidates(list);
    setJsonText(JSON.stringify(list, null, 2));
  };

  const handleMoveModelDown = (index) => {
    if (index === rotationCandidates.length - 1) return;
    const list = [...rotationCandidates];
    const temp = list[index];
    list[index] = list[index + 1];
    list[index + 1] = temp;
    setRotationCandidates(list);
    setJsonText(JSON.stringify(list, null, 2));
  };

  const handleApplyJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) {
        alert('❌ Error: El JSON debe ser un array de objetos.');
        return;
      }
      for (const item of parsed) {
        if (!item || typeof item !== 'object' || !item.provider || !item.model) {
          alert('❌ Error: Cada objeto del array debe tener campos obligatorios: "provider" y "model".');
          return;
        }
      }
      setRotationCandidates(parsed);
      alert('✅ JSON validado y mapeado a la tabla con éxito.');
    } catch (e) {
      alert(`❌ Error al parsear JSON: ${e.message}`);
    }
  };

  // Handle saving of all configurations
  const handleSaveConfig = async () => {
    setIsSaving(true);

    const updatedConfig = {
      orientation: {
        tone: aiConfig.tone,
        model: aiConfig.model,
        customTone: aiConfig.customTone,
        preferences: aiConfig.preferences,
        promptAdditions: aiConfig.promptAdditions,
        cutoffHours: parseInt(scraperConfig.cutoffHours) || 336,
        maxNewProcessings: parseInt(scraperConfig.maxNewProcessings) || 60,
        relevanceThreshold: parseInt(scraperConfig.relevanceThreshold) || 7,
        batchSize: parseInt(scraperConfig.batchSize) || 40,
        relevanceModel: scraperConfig.relevanceModel,
        interests: {
          countries: interestsConfig.countries,
          topics: interestsConfig.topics,
          entities: interestsConfig.entities,
          blockedKeywords: interestsConfig.blockedKeywords
        }
      },
      workflow: {
        rotation_candidates: rotationCandidates,
        fetch_rss: {
          enabled: workflowConfig.fetch_rss?.enabled ?? true,
          batch_size: parseInt(workflowConfig.fetch_rss?.batch_size) || 600
        },
        pre_filter: {
          enabled: workflowConfig.pre_filter?.enabled ?? true,
          cutoff_hours: parseInt(workflowConfig.pre_filter?.cutoff_hours) || 24
        },
        web_scraping: {
          enabled: workflowConfig.web_scraping?.enabled ?? true,
          max_length: parseInt(workflowConfig.web_scraping?.max_length) || 100000
        },
        ia_analysis: {
          enabled: workflowConfig.ia_analysis?.enabled ?? true,
          model: workflowConfig.ia_analysis?.model ?? 'openai/gpt-oss-120b:free',
          relevance_threshold: parseInt(workflowConfig.ia_analysis?.relevance_threshold) || 7,
          tone: workflowConfig.ia_analysis?.tone ?? 'premium',
          max_publications_per_run: parseInt(workflowConfig.ia_analysis?.max_publications_per_run) || 45,
          enable_needy_bypass: workflowConfig.ia_analysis?.enable_needy_bypass === true
        },
        image_validation: {
          enabled: workflowConfig.image_validation?.enabled ?? true
        },
        integrity_check: {
          enabled: true
        },
        firebase_deploy: {
          enabled: workflowConfig.firebase_deploy?.enabled ?? true
        }
      }
    };

    try {
      const response = await fetch(`${dbUrlBase}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          security_token: token || localStorage.getItem('aidaily_token'),
          config: {
            ...currentConfig,
            orientation: updatedConfig.orientation,
            workflow: updatedConfig.workflow,
            category_map: categoryMap,
            highlighted_topics: highlightedTopics
          }
        })
      });

      if (response.ok) {
        // También guardar la lista completa de temas calientes en /aidaily/trending_topics.json
        try {
          const trendingTopicsObj = {};
          trendingTopics.forEach(t => {
            if (t.id) {
              trendingTopicsObj[t.id] = t;
            }
          });
          trendingTopicsObj.updatedAt = new Date().toISOString();
          trendingTopicsObj.windowHours = 24;

          await fetch('https://pecemi-default-rtdb.firebaseio.com/aidaily/trending_topics.json', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(trendingTopicsObj)
          });
        } catch (tErr) {
          console.error('Error guardando temas calientes en Firebase:', tErr);
        }

        alert('✅ Configuración general y temas calientes guardados exitosamente.');
        await onRefreshConfig();
      } else {
        alert('❌ Error al guardar la configuración en Firebase.');
      }
    } catch (err) {
      alert(`❌ Error de conexión: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleVpsSync = async () => {
    setIsSyncing(true);
    await triggerVpsSync();
    setIsSyncing(false);
  };

  const handleExcelImport = async () => {
    setIsImportingExcel(true);
    await triggerExcelImport();
    setIsImportingExcel(false);
  };

  const handleFetchLogs = async () => {
    setIsFetchingLogs(true);
    await onLoadLogs();
    setIsFetchingLogs(false);
  };

  // Render Astro build status with premium metrics
  const renderBuildStatus = () => {
    if (!buildStatus) {
      return (
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          Cargando estado del build Astro...
        </div>
      );
    }

    const isOk = buildStatus.ok === true;
    const dateStr = buildStatus.updatedAt ? new Date(buildStatus.updatedAt).toLocaleString('es-ES') : 'Desconocido';
    const indicatorColor = isOk ? '#10b981' : '#ef4444';
    const statusTitle = isOk ? 'SISTEMA OPERATIVO Y ESTABLE' : 'FALLO EN COMPILACIÓN';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div className="status-indicator-dot" style={{ 
            width: '8px', 
            height: '8px', 
            borderRadius: '50%', 
            background: indicatorColor, 
            boxShadow: `0 0 6px ${indicatorColor}`,
            animation: isOk ? 'pulse 2s infinite' : 'none'
          }}></div>
          <div>
            <div style={{ fontWeight: '700', fontSize: '0.75rem', color: isOk ? '#34d399' : '#f87171', fontFamily: 'var(--font-title)' }}>
              {statusTitle}
            </div>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
              Último deploy verificado: {dateStr}
            </div>
          </div>
        </div>
        <div style={{ 
          fontSize: '0.65rem', 
          color: '#e5e7eb', 
          padding: '6px 10px', 
          background: 'rgba(255,255,255,0.02)', 
          borderRadius: '5px', 
          border: '1px solid var(--border-color)', 
          fontFamily: 'monospace',
          lineHeight: '1.25',
          wordBreak: 'break-word'
        }}>
          {isOk ? (
            <span>✅ Comprobaciones correctas: archivos HTML y bundles CSS validados con éxito.</span>
          ) : (
            <span style={{ color: '#f87171' }}>⚠️ FALLO: {buildStatus.error || 'Detalles ausentes'}. Despliegue atómico bloqueado. Versión pública protegida intacta.</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      
      {/* Título de la Sección Activa */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '8px' }}>
        <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '0.9rem', fontWeight: '800', color: 'var(--accent-cyan)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {section === 'models' && '🤖 INTELIGENCIA E INFERENCIA IA (RESILIENCIA Y ROTACIÓN)'}
          {section === 'style' && '✍️ REDACCIÓN, TONO Y ORIENTACIÓN DE CONTENIDO'}
          {section === 'scraper' && '⚙️ PARÁMETROS DEL SCRAPER Y SISTEMA VPS'}
        </h2>
      </div>

      {/* Conditional Section Rendering */}
      <div className="section-content">
        
        {/* ========================================================================= */}
        {/* SECCIÓN 1: MODELOS E INFERENCIA IA (section === 'models')                 */}
        {/* ========================================================================= */}
        {section === 'models' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {/* Modelo Principal */}
            <div className="card">
              <h3 className="card-title" style={{ fontSize: '0.75rem', marginBottom: '8px' }}>🤖 CONFIGURACIÓN DEL MODELO PRINCIPAL</h3>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Modelo Preferido (Redacción Premium)
                  <span style={{ color: 'var(--accent-cyan)', cursor: 'help' }} title="Modelo preferente de inferencia para traducción y redacción. Si falla, el motor rotará al pool inferior.">ℹ️</span>
                </label>
                <select
                  value={aiConfig.model}
                  onChange={(e) => setAiConfig(prev => ({ ...prev, model: e.target.value }))}
                  className="input-field"
                  style={{ background: '#0e0e1a', color: '#fff' }}
                >
                  <option value="">(Ninguno - Usar orden del pool de rotación)</option>
                  <option value="stepfun/step-3.7-flash:free">Step-3.7-Flash via Nous OAuth (Recomendado)</option>
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash via AI Studio</option>
                  <option value="nvidia/llama-3.3-nemotron-super-49b-v1">NVIDIA Llama 3.3 Nemotron (Free Integrate)</option>
                  <option value="meta-llama/Llama-3.3-70B-Instruct">Llama 3.3 70B Instruct (Free GitHub/OpenRouter)</option>
                  <option value="qwen/qwen-2.5-72b-instruct:free">Qwen 2.5 72B Instruct (Free OpenRouter)</option>
                  <option value="mistral-small-latest">Mistral Small (Developer Free Tier)</option>
                  <option value="openai/gpt-4o-mini">GPT-4o Mini (GitHub Models)</option>
                  <option value="deepseek-ai/deepseek-r1">DeepSeek R1 (NVIDIA/GitHub)</option>
                </select>
              </div>
            </div>

            {/* POOL DE MODELOS (ROTACIÓN Y FALLBACK) */}
            <div className="card">
              <h3 className="card-title" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>🔥 BALANCEADOR CRUZADO EN CASCADA MULTIPROVEEDOR</h3>
              <p style={{ margin: '0 0 12px 0', fontSize: '0.62rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                El motor en la VPS ejecuta una rotación cruzada alternando proveedores (Nous, Gemini, NVIDIA, GitHub, Mistral, Cloudflare, Hugging Face). Si un proveedor reporta Rate Limit (429), el motor lo incluye en lista negra y lo salta en esta ejecución para ahorrar tiempo de procesamiento.
              </p>

              {/* Formulario rápido para añadir */}
              <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '8px', borderRadius: '8px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: '120px' }}>
                  <label style={{ fontSize: '0.55rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Proveedor de API</label>
                  <select 
                    value={newCandidateProvider}
                    onChange={(e) => setNewCandidateProvider(e.target.value)}
                    className="input-field"
                    style={{ padding: '4px 8px', fontSize: '0.68rem', margin: 0 }}
                  >
                    <option value="nous">Nous Research (Stepfun/Tencent)</option>
                    <option value="gemini">Google Gemini (AI Studio)</option>
                    <option value="nvidia">NVIDIA Integrate</option>
                    <option value="github">GitHub Models</option>
                    <option value="mistral">Mistral Developer</option>
                    <option value="cloudflare">Cloudflare AI</option>
                    <option value="huggingface">Hugging Face Serverless</option>
                  </select>
                </div>
                <div style={{ flex: 2, minWidth: '180px' }}>
                  <label style={{ fontSize: '0.55rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Identificador del Modelo (API string)</label>
                  <input 
                    type="text"
                    value={newCandidateModel}
                    onChange={(e) => setNewCandidateModel(e.target.value)}
                    placeholder="ej: stepfun/step-3.7-flash:free o gemini-2.5-flash"
                    className="input-field"
                    style={{ padding: '4px 8px', fontSize: '0.68rem', margin: 0 }}
                  />
                </div>
                <button 
                  type="button" 
                  onClick={handleAddModel}
                  className="btn btn-secondary"
                  style={{ height: '32px', fontSize: '0.68rem', padding: '0 12px', marginTop: '14px' }}
                >
                  ➕ AÑADIR AL POOL
                </button>
              </div>

              {/* Tabla Visual */}
              <div style={{ overflowX: 'auto', marginBottom: '16px', maxHeight: '350px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.68rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '8px 10px', width: '40px' }}>Nivel</th>
                      <th style={{ padding: '8px 10px', width: '100px' }}>Proveedor</th>
                      <th style={{ padding: '8px 10px' }}>Modelo</th>
                      <th style={{ padding: '8px 10px', width: '120px', textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rotationCandidates.length === 0 ? (
                      <tr>
                        <td colSpan="4" style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No hay modelos en el pool de rotación. Se usará el fallback local offline.
                        </td>
                      </tr>
                    ) : (
                      rotationCandidates.map((cand, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 'bold', color: idx === 0 ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                            {idx === 0 ? '🏆 1' : idx + 1}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{ 
                              padding: '2px 6px', 
                              borderRadius: '4px', 
                              fontSize: '0.58rem', 
                              fontWeight: 'bold',
                              background: cand.provider === 'gemini' ? 'rgba(6,182,212,0.15)' : cand.provider === 'nous' ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.05)',
                              color: cand.provider === 'gemini' ? '#22d3ee' : cand.provider === 'nous' ? '#a78bfa' : '#fff'
                            }}>
                              {cand.provider.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: idx === 0 ? '#fff' : 'var(--text-muted)' }}>
                            {cand.model}
                          </td>
                          <td style={{ padding: '8px 10px', display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            <button 
                              type="button" 
                              onClick={() => handleMoveModelUp(idx)} 
                              disabled={idx === 0} 
                              style={{ padding: '2px 6px', background: 'none', border: 'none', color: idx === 0 ? 'transparent' : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.7rem' }}
                              title="Subir prioridad"
                            >
                              ▲
                            </button>
                            <button 
                              type="button" 
                              onClick={() => handleMoveModelDown(idx)} 
                              disabled={idx === rotationCandidates.length - 1} 
                              style={{ padding: '2px 6px', background: 'none', border: 'none', color: idx === rotationCandidates.length - 1 ? 'transparent' : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.7rem' }}
                              title="Bajar prioridad"
                            >
                              ▼
                            </button>
                            <button 
                              type="button" 
                              onClick={() => handleRemoveModel(idx)} 
                              style={{ padding: '2px 6px', background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}
                              title="Eliminar modelo"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Editor JSON Directo para Hermes */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', fontWeight: 'bold', marginBottom: '4px' }}>
                  📝 EDITOR DIRECTO JSON (PARA HERMES Y DEPURACIÓN RÁPIDA)
                </label>
                <textarea 
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  className="input-field"
                  style={{ minHeight: '120px', fontFamily: 'monospace', fontSize: '0.62rem', background: '#090911', borderColor: 'var(--border-color)', resize: 'vertical' }}
                  placeholder="[{ 'provider': 'nous', 'model': 'model-id' }]"
                />
                <button 
                  type="button"
                  onClick={handleApplyJson}
                  className="btn btn-secondary"
                  style={{ width: 'auto', padding: '4px 10px', fontSize: '0.62rem', marginTop: '6px' }}
                >
                  ⚙️ VALIDAR Y APLICAR CAMBIOS JSON
                </button>
              </div>
            </div>

            {/* Pre-Filtrado y Ollama local */}
            <div className="card">
              <h3 className="card-title" style={{ fontSize: '0.75rem', marginBottom: '8px' }}>💻 CAPA PRE-FILTRADO Y OLLAMA LOCAL (OFFLINE)</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Ollama Base URL
                    <span style={{ color: 'var(--accent-cyan)', cursor: 'help' }} title="Dirección de la API local de Ollama en la VPS (por defecto localhost:11434).">ℹ️</span>
                  </label>
                  <input 
                    type="text" 
                    value={workflowConfig.pre_filter?.ollama_base_url || 'http://localhost:11434'}
                    onChange={(e) => setWorkflowConfig(prev => ({
                      ...prev,
                      pre_filter: { ...prev.pre_filter, ollama_base_url: e.target.value }
                    }))}
                    className="input-field"
                  />
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Ollama Model (Filtro Rápido)
                    <span style={{ color: 'var(--accent-cyan)', cursor: 'help' }} title="Modelo ligero ejecutándose en la CPU local para el pre-filtrado binario (Ej: qwen2.5:1.5b).">ℹ️</span>
                  </label>
                  <input 
                    type="text" 
                    value={workflowConfig.pre_filter?.ollama_filter_model || 'qwen2.5:1.5b'}
                    onChange={(e) => setWorkflowConfig(prev => ({
                      ...prev,
                      pre_filter: { ...prev.pre_filter, ollama_filter_model: e.target.value }
                    }))}
                    className="input-field"
                  />
                </div>
              </div>
            </div>

            {/* Subcategorías Chips Editor */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#fff', textTransform: 'uppercase' }}>
                  Subcategorías y palabras clave en <span style={{ color: 'var(--accent-cyan)' }}>{selectedCategoryTab}</span>:
                </span>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                  {categoryMap[selectedCategoryTab]?.length || 0} etiquetas activas
                </span>
              </div>

              {/* Grid of Chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', minHeight: '80px', background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)' }}>
                {categoryMap[selectedCategoryTab]?.map((subName, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      padding: '3px 8px',
                      borderRadius: '16px',
                      fontSize: '0.64rem',
                      color: '#e5e7eb'
                    }}
                  >
                    <span>{subName}</span>
                    <button
                      onClick={() => {
                        const updatedList = categoryMap[selectedCategoryTab].filter(item => item !== subName);
                        setCategoryMap(prev => ({
                          ...prev,
                          [selectedCategoryTab]: updatedList
                        }));
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent-magenta)',
                        fontSize: '0.68rem',
                        cursor: 'pointer',
                        padding: '0 2px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold'
                      }}
                      title="Eliminar etiqueta"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {(!categoryMap[selectedCategoryTab] || categoryMap[selectedCategoryTab].length === 0) && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.64rem', fontStyle: 'italic', margin: 'auto' }}>
                    No hay etiquetas configuradas. El motor usará clasificación genérica.
                  </div>
                )}
              </div>

              {/* Add Subcategory Input */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <input
                  type="text"
                  placeholder="Nueva subcategoría o término clave (ej. golf, ia/salud, macroeconomia)..."
                  value={newSubcategoryInput}
                  onChange={(e) => setNewSubcategoryInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = newSubcategoryInput.trim().toLowerCase();
                      if (val && !categoryMap[selectedCategoryTab]?.includes(val)) {
                        setCategoryMap(prev => ({
                          ...prev,
                          [selectedCategoryTab]: [...(prev[selectedCategoryTab] || []), val]
                        }));
                        setNewSubcategoryInput('');
                      }
                    }
                  }}
                  className="input-field"
                  style={{ fontSize: '0.68rem', padding: '6px 10px', height: 'auto', background: '#0e0e1a', color: '#fff' }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const val = newSubcategoryInput.trim().toLowerCase();
                    if (val && !categoryMap[selectedCategoryTab]?.includes(val)) {
                      setCategoryMap(prev => ({
                        ...prev,
                        [selectedCategoryTab]: [...(prev[selectedCategoryTab] || []), val]
                      }));
                      setNewSubcategoryInput('');
                    }
                  }}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.68rem', padding: '0 12px', height: 'auto', whiteSpace: 'nowrap' }}
                >
                  ➕ Agregar
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', background: 'rgba(6,182,212,0.04)', border: '1px solid rgba(6,182,212,0.1)', padding: '10px 12px', borderRadius: '8px', gap: '8px', alignItems: 'center' }}>
              <div style={{ fontSize: '1rem' }}>💡</div>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                <strong>Truco de Clasificación:</strong> Si quieres estructurar rutas multinivel para el enrutamiento (como `futbol/laliga` o `motor/formula 1`), escríbelas separadas por barra `/`. La IA y el motor del scraper las interpretarán de forma jerárquica automáticamente, garantizando enlaces relacionados perfectos.
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECCIÓN 2: REDACCIÓN, TONO Y ORIENTACIÓN DE CONTENIDO (section === 'style') */}
        {/* ========================================================================= */}
        {section === 'style' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="card">
              <h3 className="card-title" style={{ fontSize: '0.75rem', marginBottom: '8px' }}>✍️ TONALIDAD Y REDACCIÓN EDITORIAL (IA)</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                <div className="form-group">
                  <label>Tono Editorial Principal</label>
                  <select 
                    value={aiConfig.tone} 
                    onChange={(e) => setAiConfig(prev => ({ ...prev, tone: e.target.value }))}
                    className="input-field"
                    style={{ background: '#0e0e1a', color: '#fff' }}
                  >
                    <option value="dynamic">⚡ Dinámico y Tecnológico (Estilo Hacker)</option>
                    <option value="formal">👔 Formal e Institucional (Corporativo)</option>
                    <option value="premium">💎 Periodístico Premium (Tipo New York Times)</option>
                    <option value="custom">⚙️ Tono Personalizado (Especificar abajo)</option>
                  </select>
                </div>

                {aiConfig.tone === 'custom' && (
                  <div className="form-group">
                    <label>Especificar Tono Personalizado</label>
                    <input 
                      type="text" 
                      value={aiConfig.customTone} 
                      onChange={(e) => setAiConfig(prev => ({ ...prev, customTone: e.target.value }))}
                      className="input-field"
                      placeholder="Ej. Sarcástico, humorístico, académico..."
                    />
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Preferencias de Redacción y Estilo (Directivas directas)</label>
                <textarea 
                  value={aiConfig.preferences} 
                  onChange={(e) => setAiConfig(prev => ({ ...prev, preferences: e.target.value }))}
                  className="input-field"
                  placeholder="Ej. Evitar adjetivos vacíos, usar siempre voz activa, redactar para un público de habla hispana general..."
                  style={{ minHeight: '80px', fontFamily: 'var(--font-body)', fontSize: '0.7rem', background: '#090911', resize: 'vertical' }}
                />
              </div>

              <div className="form-group">
                <label>Prompt Additions (Instrucciones que se añaden al Prompt del Sistema)</label>
                <textarea 
                  value={aiConfig.promptAdditions} 
                  onChange={(e) => setAiConfig(prev => ({ ...prev, promptAdditions: e.target.value }))}
                  className="input-field"
                  placeholder="Ej. Al final de cada nota, añade un pequeño dato curioso sobre el tema en una sección llamada '¿Sabías qué?'..."
                  style={{ minHeight: '80px', fontFamily: 'monospace', fontSize: '0.62rem', background: '#090911', resize: 'vertical' }}
                />
              </div>
            </div>

            <div className="card">
              <h3 className="card-title" style={{ fontSize: '0.75rem', marginBottom: '8px' }}>🎯 INTERESES DE COBERTURA Y FILTROS</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                <div className="form-group">
                  <label>Países Prioritarios</label>
                  <input 
                    type="text" 
                    value={interestsConfig.countries} 
                    onChange={(e) => setInterestsConfig(prev => ({ ...prev, countries: e.target.value }))}
                    className="input-field"
                    placeholder="Ej. España, México, Colombia..."
                  />
                </div>
                <div className="form-group">
                  <label>Temas de Interés Principal</label>
                  <input 
                    type="text" 
                    value={interestsConfig.topics} 
                    onChange={(e) => setInterestsConfig(prev => ({ ...prev, topics: e.target.value }))}
                    className="input-field"
                    placeholder="Ej. Fórmula 1, Inteligencia Artificial, Criptomonedas..."
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Personas o Entidades Clave (Priorizar en la Marquesina)</label>
                <input 
                  type="text" 
                  value={interestsConfig.entities} 
                  onChange={(e) => setInterestsConfig(prev => ({ ...prev, entities: e.target.value }))}
                  className="input-field"
                  placeholder="Ej. Fernando Alonso, Elon Musk, OpenAI..."
                />
              </div>

              <div className="form-group">
                <label>Palabras Clave Bloqueadas (Evitar descargar o redactar noticias que las contengan)</label>
                <input 
                  type="text" 
                  value={interestsConfig.blockedKeywords} 
                  onChange={(e) => setInterestsConfig(prev => ({ ...prev, blockedKeywords: e.target.value }))}
                  className="input-field"
                  placeholder="Ej. cotilleos, farandula, tarot, rumores, horóscopo..."
                />
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECCIÓN 3: PARÁMETROS DEL SCRAPER Y SISTEMA VPS (section === 'scraper')   */}
        {/* ========================================================================= */}
        {section === 'scraper' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="card">
              <h3 className="card-title" style={{ fontSize: '0.75rem', marginBottom: '8px' }}>⚙️ UMBRALES Y LIMITACIONES DE SCRAPING</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div className="form-group">
                  <label>Corte Histórico de Noticias (Horas)</label>
                  <input 
                    type="number" 
                    value={scraperConfig.cutoffHours} 
                    onChange={(e) => setScraperConfig(prev => ({ ...prev, cutoffHours: parseInt(e.target.value) || 0 }))}
                    className="input-field"
                  />
                </div>
                <div className="form-group">
                  <label>Procesamientos Máximos (por ejecución)</label>
                  <input 
                    type="number" 
                    value={scraperConfig.maxNewProcessings} 
                    onChange={(e) => setScraperConfig(prev => ({ ...prev, maxNewProcessings: parseInt(e.target.value) || 0 }))}
                    className="input-field"
                  />
                </div>
                <div className="form-group">
                  <label>Tamaño Lote RSS (a descargar)</label>
                  <input 
                    type="number" 
                    value={scraperConfig.batchSize} 
                    onChange={(e) => setScraperConfig(prev => ({ ...prev, batchSize: parseInt(e.target.value) || 0 }))}
                    className="input-field"
                  />
                </div>
                <div className="form-group">
                  <label>Umbral Semántico Mínimo (1-10)</label>
                  <input 
                    type="number" 
                    value={scraperConfig.relevanceThreshold} 
                    onChange={(e) => setScraperConfig(prev => ({ ...prev, relevanceThreshold: parseInt(e.target.value) || 0 }))}
                    className="input-field"
                    min="1"
                    max="10"
                  />
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="card-title" style={{ fontSize: '0.75rem', marginBottom: '8px' }}>🤖 FLUJO DE TRABAJO (WORKFLOW SECTIONS)</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <label className="checkbox-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.7rem' }}>
                  <input 
                    type="checkbox"
                    checked={workflowConfig.fetch_rss?.enabled ?? true}
                    onChange={(e) => setWorkflowConfig(prev => ({
                      ...prev,
                      fetch_rss: { ...prev.fetch_rss, enabled: e.target.checked }
                    }))}
                  />
                  <span>Descargar feeds RSS</span>
                </label>

                <label className="checkbox-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.7rem' }}>
                  <input 
                    type="checkbox"
                    checked={workflowConfig.pre_filter?.enabled ?? true}
                    onChange={(e) => setWorkflowConfig(prev => ({
                      ...prev,
                      pre_filter: { ...prev.pre_filter, enabled: e.target.checked }
                    }))}
                  />
                  <span>Pre-filtrado de relevancia</span>
                </label>

                <label className="checkbox-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.7rem' }}>
                  <input 
                    type="checkbox"
                    checked={workflowConfig.web_scraping?.enabled ?? true}
                    onChange={(e) => setWorkflowConfig(prev => ({
                      ...prev,
                      web_scraping: { ...prev.web_scraping, enabled: e.target.checked }
                    }))}
                  />
                  <span>Scraping de DOM completo</span>
                </label>

                <label className="checkbox-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.7rem' }}>
                  <input 
                    type="checkbox"
                    checked={workflowConfig.ia_analysis?.enabled ?? true}
                    onChange={(e) => setWorkflowConfig(prev => ({
                      ...prev,
                      ia_analysis: { ...prev.ia_analysis, enabled: e.target.checked }
                    }))}
                  />
                  <span>Redacción con IA</span>
                </label>

                <label className="checkbox-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.7rem' }}>
                  <input 
                    type="checkbox"
                    checked={workflowConfig.image_validation?.enabled ?? true}
                    onChange={(e) => setWorkflowConfig(prev => ({
                      ...prev,
                      image_validation: { ...prev.image_validation, enabled: e.target.checked }
                    }))}
                  />
                  <span>Validar imágenes de noticias</span>
                </label>

                <label className="checkbox-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.7rem' }}>
                  <input 
                    type="checkbox"
                    checked={workflowConfig.firebase_deploy?.enabled ?? true}
                    onChange={(e) => setWorkflowConfig(prev => ({
                      ...prev,
                      firebase_deploy: { ...prev.firebase_deploy, enabled: e.target.checked }
                    }))}
                  />
                  <span>Subir y desplegar a Firebase</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 6: HIGHLIGHTED TOPICS & TRENDS MANAGEMENT */}
        {activeSubTab === 'highlighted' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
              <h3 className="card-title" style={{ fontSize: '0.75rem', borderBottom: 'none', margin: 0, paddingBottom: 0 }}>
                🔥 GESTOR DE TEMAS EN VIVO Y TENDENCIAS
              </h3>
              <button
                type="button"
                onClick={fetchTrendingAndHighlights}
                disabled={isLoadingTrends}
                style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', fontSize: '0.65rem', cursor: 'pointer', fontWeight: 'bold' }}
              >
                {isLoadingTrends ? 'Cargando...' : '🔄 Recargar Temas'}
              </button>
            </div>
            
            <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: '1.4', marginBottom: '16px' }}>
              Administra la marquesina y los filtros de "En Vivo". Puedes crear temas calientes manualmente al vuelo, destacarlos en rojo en la cabecera o eliminarlos si han dejado de ser relevantes.
            </p>

            {/* FORMULARIO DE CREACIÓN MANUAL */}
            <div style={{ background: 'rgba(6, 182, 212, 0.03)', border: '1px solid rgba(6, 182, 212, 0.12)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.72rem', color: 'var(--accent-cyan)', display: 'flex', alignState: 'center', gap: '6px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                ➕ Crear Tema Caliente al Vuelo (Manual)
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.58rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '700' }}>Título del Tema</label>
                  <input 
                    type="text" 
                    placeholder="Ej. Minutas del FOMC, Wimbledon 2026..." 
                    value={newTrendTitle}
                    onChange={(e) => setNewTrendTitle(e.target.value)}
                    className="input-field"
                    style={{ fontSize: '0.68rem', padding: '6px 10px', height: 'auto', background: '#0e0e1a', color: '#fff', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.58rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '700' }}>Tipo</label>
                  <select
                    value={newTrendType}
                    onChange={(e) => setNewTrendType(e.target.value)}
                    className="input-field"
                    style={{ fontSize: '0.68rem', padding: '5px 8px', height: 'auto', background: '#0e0e1a', color: '#fff', width: '100%' }}
                  >
                    <option value="trend">📈 Tendencia (Trend)</option>
                    <option value="breaking">🔥 Última Hora (Breaking)</option>
                    <option value="event">🏆 Evento Especial</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.58rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '700' }}>Keywords (Buscador / Filtro de Notas)</label>
                  <input 
                    type="text" 
                    placeholder="Keywords separadas por comas (ej. fomc, fed, tasas)..." 
                    value={newTrendKeywords}
                    onChange={(e) => setNewTrendKeywords(e.target.value)}
                    className="input-field"
                    style={{ fontSize: '0.68rem', padding: '6px 10px', height: 'auto', background: '#0e0e1a', color: '#fff', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handleAddTrend}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.68rem', padding: '6px 14px', height: 'auto', background: 'rgba(6, 182, 212, 0.15)', borderColor: 'rgba(6, 182, 212, 0.3)', color: '#22d3ee', fontWeight: '700' }}
                >
                  ➕ AGREGAR AL VUELO
                </button>
              </div>
            </div>

            {/* LISTADO DE TEMAS */}
            {isLoadingTrends ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                Cargando temas calientes dinámicos...
              </div>
            ) : trendingTopics.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-color)', borderRadius: '8px', fontSize: '0.7rem' }}>
                No hay temas calientes activos. Crea uno manualmente arriba.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {trendingTopics.map(topic => {
                  const isHighlighted = highlightedTopics.includes(topic.id);
                  const typeIcon = topic.type === 'event' ? '🏆' : (topic.type === 'breaking' ? '🔥' : '📈');
                  return (
                    <div 
                      key={topic.id} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        padding: '10px 12px', 
                        background: isHighlighted ? 'rgba(239,68,68,0.03)' : 'rgba(255,255,255,0.01)', 
                        border: `1px solid ${isHighlighted ? 'rgba(239,68,68,0.3)' : 'var(--border-color)'}`,
                        borderRadius: '8px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1rem' }}>{typeIcon}</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: isHighlighted ? '#f87171' : '#fff' }}>
                              {topic.title}
                            </span>
                            {topic.addedManually && (
                              <span style={{ fontSize: '0.55rem', background: 'rgba(6,182,212,0.15)', color: '#22d3ee', padding: '1px 4px', borderRadius: '3px', fontWeight: '700' }}>MANUAL</span>
                            )}
                          </span>
                          <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>
                            {topic.articleCount || 1} artículos • Pop: {Math.round((topic.popularity || 0) * 100)}% • Keywords: {Array.isArray(topic.keywords) ? topic.keywords.join(', ') : (topic.keywords || topic.id)}
                          </span>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <label 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px', 
                            fontSize: '0.68rem', 
                            fontWeight: '700', 
                            color: isHighlighted ? '#f87171' : 'var(--text-muted)',
                            cursor: 'pointer',
                            userSelect: 'none'
                          }}
                        >
                          <input 
                            type="checkbox"
                            checked={isHighlighted}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setHighlightedTopics(prev => [...prev, topic.id]);
                              } else {
                                setHighlightedTopics(prev => prev.filter(id => id !== topic.id));
                              }
                            }}
                            style={{ cursor: 'pointer' }}
                          />
                          {isHighlighted ? '🔴 DESTACADO' : 'Destacar'}
                        </label>

                        <button
                          type="button"
                          onClick={() => handleRemoveTrend(topic.id)}
                          style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', fontSize: '0.62rem', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s', fontWeight: '600' }}
                          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                          title="Eliminar tema caliente de Firebase"
                        >
                          🗑️ BORRAR
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            <div style={{ display: 'flex', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)', padding: '10px 12px', borderRadius: '8px', gap: '8px', alignItems: 'center', marginTop: '12px' }}>
              <div style={{ fontSize: '1rem' }}>🚨</div>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                <strong>Nota Editorial:</strong> Los temas destacados en el menú superior aparecerán destacados en color rojo brillante con un punto parpadeante. Recuerda presionar el botón <strong>💾 GUARDAR CAMBIOS</strong> al pie para aplicar las modificaciones.
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Save Button (fijo al final de config) */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
        <button 
          onClick={handleSaveConfig}
          disabled={isSaving}
          className="btn btn-primary"
          style={{ width: 'auto', padding: '6px 16px', fontSize: '0.75rem' }}
        >
          {isSaving ? '💾 Guardando...' : '💾 Guardar Cambios'}
        </button>
      </div>

    </div>
  );
}
