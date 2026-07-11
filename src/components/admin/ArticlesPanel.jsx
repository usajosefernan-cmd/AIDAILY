import React, { useState, useMemo } from 'react';

export default function ArticlesPanel({ 
  allArticlesData = [], 
  dbUrlBase = '', 
  vpsUrlBase = '', 
  token = '', 
  isReadOnly = true,
  ensureAdminAccess = () => {},
  onRefreshArticles = async () => {},
  triggerVpsArticleTool = async () => {} 
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [articlesPage, setArticlesPage] = useState(1);
  const articlesPerPage = 20;

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [editingArticle, setEditingArticle] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // IA status on editor
  const [editorLoading, setEditorLoading] = useState(false);

  // Filters
  const filteredArticles = useMemo(() => {
    return allArticlesData.filter(art => {
      if (categoryFilter !== 'all' && art.category !== categoryFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase().trim();
        const matchTitle = art.title && art.title.toLowerCase().includes(query);
        const matchSummary = (art.summary || art.aiSummary || '').toLowerCase().includes(query);
        const matchSource = art.source && art.source.toLowerCase().includes(query);
        return matchTitle || matchSummary || matchSource;
      }
      return true;
    });
  }, [allArticlesData, searchQuery, categoryFilter]);

  // Pagination
  const totalArticles = filteredArticles.length;
  const totalPages = Math.ceil(totalArticles / articlesPerPage) || 1;
  const currentPage = Math.min(Math.max(1, articlesPage), totalPages);
  const startIdx = (currentPage - 1) * articlesPerPage;
  const endIdx = Math.min(startIdx + articlesPerPage, totalArticles);

  const pageBatch = useMemo(() => {
    return filteredArticles.slice(startIdx, endIdx);
  }, [filteredArticles, startIdx, endIdx]);

  // Toggle selection
  const toggleSelectAll = (checked) => {
    const next = new Set(selectedIds);
    pageBatch.forEach(art => {
      if (checked) {
        next.add(art.id);
      } else {
        next.delete(art.id);
      }
    });
    setSelectedIds(next);
  };

  const toggleSelectOne = (id, checked) => {
    const next = new Set(selectedIds);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    setSelectedIds(next);
  };

  const isAllPageSelected = pageBatch.length > 0 && pageBatch.every(art => selectedIds.has(art.id));

  // Toggle expansion
  const toggleExpand = (id) => {
    const next = new Set(expandedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedIds(next);
  };

  // Run bulk actions
  const handleBulkAction = async (actionType) => {
    if (selectedIds.size === 0) {
      alert('Por favor, selecciona al menos un artículo.');
      return;
    }

    ensureAdminAccess(async () => {
      const ids = Array.from(selectedIds).join(',');

      if (actionType === 'classify') {
        await triggerVpsArticleTool(`--action classify --ids ${ids}`);
      } else if (actionType === 'repair') {
        await triggerVpsArticleTool(`--action repair --ids ${ids}`);
      } else if (actionType === 'delete') {
        if (confirm(`¿Estás seguro de que deseas eliminar permanentemente los ${selectedIds.size} artículos seleccionados?`)) {
          const articlesPatch = {};
          selectedIds.forEach(id => {
            articlesPatch[id] = null;
          });

          const payload = {
            security_token: token || localStorage.getItem('aidaily_token'),
            articles: articlesPatch
          };

          try {
            const res = await fetch(`${dbUrlBase}.json`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });

            if (res.ok) {
              alert('✅ Eliminación en lote completada.');
              setSelectedIds(new Set());
              await onRefreshArticles();
            } else {
              alert('❌ Falló al eliminar artículos en lote.');
            }
          } catch (err) {
            alert(`❌ Error: ${err.message}`);
          }
        }
      }
    });
  };

  // Individual Actions
  const handleDeleteIndividual = async (art) => {
    ensureAdminAccess(async () => {
      if (confirm(`¿Estás seguro de que deseas eliminar permanentemente el artículo "${art.title}"?`)) {
        const payload = {
          security_token: token || localStorage.getItem('aidaily_token'),
          articles: {
            [art.id]: null
          }
        };

        try {
          const res = await fetch(`${dbUrlBase}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (res.ok) {
            await onRefreshArticles();
          } else {
            alert('❌ Falló la eliminación del artículo.');
          }
        } catch (err) {
          alert(`❌ Error: ${err.message}`);
        }
      }
    });
  };

  const handleEditClick = (art) => {
    setEditingArticle({
      ...art,
      hashtagsText: Array.isArray(art.hashtags) ? art.hashtags.join(', ') : '',
      summaryText: art.aiSummary || art.summary || '',
      fullText: art.fullArticle || ''
    });
  };

  // Editor IA Help
  const handleEditorIaHelp = async (type) => {
    ensureAdminAccess(async () => {
      if (!editingArticle) return;
      setEditorLoading(true);
      
      const actionParam = type === 'classify' ? 'classify' : 'repair';
      await triggerVpsArticleTool(`--action ${actionParam} --ids ${editingArticle.id}`);
      
      const waitTime = type === 'classify' ? 8000 : 13000;
      setTimeout(async () => {
        try {
          const res = await fetch(`${dbUrlBase}/articles/${editingArticle.id}.json`);
          if (res.ok) {
            const art = await res.json();
            if (art) {
              setEditingArticle(prev => ({
                ...prev,
                title: art.title || prev.title,
                category: art.category || prev.category,
                subcategory: art.subcategory || prev.subcategory,
                hashtagsText: Array.isArray(art.hashtags) ? art.hashtags.join(', ') : prev.hashtagsText,
                summaryText: art.aiSummary || art.summary || prev.summaryText,
                fullText: art.fullArticle || prev.fullText
              }));
              alert('🔄 Campos actualizados con el resultado de la inferencia IA.');
            }
          }
        } catch (e) {
          console.error("Error al recargar artículo tras ayuda de IA:", e);
        } finally {
          setEditorLoading(false);
        }
      }, waitTime);
    });
  };

  const handleSaveArticle = async () => {
    if (!editingArticle.title.trim()) {
      alert('Por favor, rellena el título.');
      return;
    }

    ensureAdminAccess(async () => {
      setIsSaving(true);

      const hashtags = editingArticle.hashtagsText.split(',')
        .map(h => h.trim())
        .filter(h => h.length > 0);

      const cleanTags = [editingArticle.category, ...hashtags.map(h => h.replace('#', '').toLowerCase())];
      const original = allArticlesData.find(a => a.id === editingArticle.id) || {};

      const updated = {
        ...original,
        title: editingArticle.title.trim(),
        category: editingArticle.category,
        subcategory: editingArticle.subcategory.trim(),
        hashtags,
        tags: cleanTags,
        summary: editingArticle.summaryText.trim(),
        aiSummary: editingArticle.summaryText.trim(),
        fullArticle: editingArticle.fullText.trim(),
        scrapedAt: new Date().toISOString()
      };
      
      delete updated.isFallback;

      const payload = {
        security_token: token || localStorage.getItem('aidaily_token'),
        articles: {
          [editingArticle.id]: updated
        }
      };

      try {
        const response = await fetch(`${dbUrlBase}.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          setEditingArticle(null);
          await onRefreshArticles();
        } else {
          alert('❌ Error al guardar el artículo.');
        }
      } catch (err) {
        alert(`❌ Error de red: ${err.message}`);
      } finally {
        setIsSaving(false);
      }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* A. Sticky Tool Bar */}
      <div 
        className={`articles-toolbar ${isReadOnly ? 'read-only-active' : ''}`}
        style={{ 
          position: 'sticky', 
          top: isReadOnly ? '106px' : '64px', 
          zIndex: 90, 
          background: 'rgba(5, 5, 10, 0.95)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid var(--border-color)',
          padding: '8px 12px',
          margin: '0 0 12px 0',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          borderRadius: '8px',
          transition: 'top 0.3s ease'
        }}
      >
        {/* Left Side: Filter and Search */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', flex: 1 }}>
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setArticlesPage(1); }}
            placeholder="Buscar..."
            className="input-field"
            style={{ maxWidth: '180px', flex: 1 }}
          />
          <select 
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setArticlesPage(1); }}
            className="input-field"
            style={{ width: '130px', background: '#090912', color: '#fff' }}
          >
            <option value="all">Todas</option>
            <option value="tecnologia">Tecnología</option>
            <option value="ciencia">Ciencia</option>
            <option value="economia">Economía</option>
            <option value="internacional">Internacional</option>
            <option value="nacional">Nacional</option>
            <option value="medioambiente">Medio Ambiente</option>
            <option value="sociedad">Sociedad</option>
            <option value="cultura">Cultura</option>
            <option value="estilo">Estilo</option>
            <option value="deportes">Deportes</option>
            <option value="opinion">Opinión</option>
            <option value="gastronomia">Gastronomía</option>
          </select>

          {/* Selection count */}
          {selectedIds.size > 0 && (
            <span style={{ fontSize: '0.68rem', color: 'var(--accent-cyan)', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ display: 'inline-block', width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent-cyan)' }}></span>
              {selectedIds.size} sel.
            </span>
          )}
        </div>

        {/* Right Side: Bulk Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button 
            onClick={() => handleBulkAction('classify')}
            disabled={selectedIds.size === 0}
            className="btn btn-secondary"
            style={{ width: 'auto' }}
          >
            🧠 Clasificar {isReadOnly && '🔒'}
          </button>
          <button 
            onClick={() => handleBulkAction('repair')}
            disabled={selectedIds.size === 0}
            className="btn btn-secondary"
            style={{ width: 'auto' }}
          >
            ✏️ Reparar {isReadOnly && '🔒'}
          </button>
          <button 
            onClick={() => handleBulkAction('delete')}
            disabled={selectedIds.size === 0}
            className="btn btn-danger"
            style={{ width: 'auto' }}
          >
            🗑️ Eliminar {isReadOnly && '🔒'}
          </button>
        </div>
      </div>

      {/* B. Articles Table (Desktop only) */}
      <div className="card mobile-hide" style={{ padding: '12px', overflowX: 'auto' }}>
        <table className="compact-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '8px', width: '30px', textAlign: 'center' }}>
                <input 
                  type="checkbox" 
                  checked={isAllPageSelected}
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th style={{ padding: '8px', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Título</th>
              <th style={{ padding: '8px', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', width: '110px' }}>Fuente</th>
              <th style={{ padding: '8px', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', width: '120px' }}>Categoría</th>
              <th style={{ padding: '8px', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', width: '90px', textAlign: 'center' }}>Estado</th>
              <th style={{ padding: '8px', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', width: '80px', textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pageBatch.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  No se encontraron artículos.
                </td>
              </tr>
            ) : (
              pageBatch.map(art => {
                const isSelected = selectedIds.has(art.id);
                const isExpanded = expandedIds.has(art.id);
                const sub = art.subcategory ? ` • ${art.subcategory.toUpperCase()}` : '';
                const hashtagsText = Array.isArray(art.hashtags) ? art.hashtags.join(', ') : 'Ninguno';
                const summaryText = art.aiSummary || art.summary || 'Sin resumen disponible.';
                
                const isFallback = (art.whyMatters === 'Esta noticia representa un desarrollo relevante en su sector.') || 
                                   (Array.isArray(art.keyPoints) && art.keyPoints.length === 1 && art.keyPoints[0] === art.title) ||
                                   art.isFallback;

                const statusBadge = isFallback 
                  ? <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', padding: '2px 4px', borderRadius: '3px', fontSize: '0.62rem', fontWeight: '700' }}>⚠️ FALLBACK</span>
                  : <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '2px 4px', borderRadius: '3px', fontSize: '0.62rem', fontWeight: '700' }}>✨ PREMIUM</span>;

                return (
                  <React.Fragment key={art.id}>
                    <tr 
                      onClick={() => toggleExpand(art.id)}
                      style={{ 
                        borderBottom: '1px solid rgba(255,255,255,0.02)', 
                        background: isExpanded ? 'rgba(255,255,255,0.01)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                      className="hover-row"
                    >
                      <td style={{ padding: '8px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={(e) => toggleSelectOne(art.id, e.target.checked)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td style={{ padding: '8px', fontSize: '0.78rem', fontWeight: '600', color: '#fff', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {art.title}
                      </td>
                      <td style={{ padding: '8px', fontSize: '0.72rem', color: '#e5e7eb' }}>
                        {art.source}
                      </td>
                      <td style={{ padding: '8px' }}>
                        <span className="feed-category-badge" style={{ fontSize: '0.6rem' }}>{(art.category || 'general').toUpperCase()}</span>
                        {sub && <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginLeft: '4px' }}>{sub}</span>}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        {statusBadge}
                      </td>
                      <td style={{ padding: '8px' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                          <button 
                            onClick={() => handleEditClick(art)}
                            className="mobile-action-btn" 
                            title={isReadOnly ? "Ver Detalles" : "Editar"}
                          >
                            ✏️
                          </button>
                          <button 
                            onClick={() => handleDeleteIndividual(art)}
                            className="mobile-action-btn"
                            style={{ color: '#f87171', background: 'rgba(239,68,68,0.04)' }}
                            title="Eliminar"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ background: 'rgba(255,255,255,0.015)', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <td></td>
                        <td colSpan={5} style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ fontSize: '0.75rem', color: '#d1d5db', lineHeight: '1.3' }}>
                              <strong style={{ color: '#fff' }}>Resumen de IA:</strong> {summaryText}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                              <span>📅 <strong>Fecha:</strong> {art.publishedAt ? new Date(art.publishedAt).toLocaleString('es-ES') : 'Desconocida'}</span>
                              <span>🔗 <strong>Origen:</strong> <a href={art.link || art.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>Ver Noticia Original</a></span>
                              <span>🏷️ <strong>Hashtags:</strong> {hashtagsText}</span>
                            </div>
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

      {/* Mobile Articles list (Mobile only) */}
      <div className="mobile-articles-list desktop-hide">
        {pageBatch.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            No se encontraron artículos.
          </div>
        ) : (
          pageBatch.map(art => {
            const isSelected = selectedIds.has(art.id);
            const isExpanded = expandedIds.has(art.id);
            const sub = art.subcategory ? ` • ${art.subcategory.toUpperCase()}` : '';
            const summaryText = art.aiSummary || art.summary || 'Sin resumen disponible.';
            
            const isFallback = (art.whyMatters === 'Esta noticia representa un desarrollo relevante en su sector.') || 
                               (Array.isArray(art.keyPoints) && art.keyPoints.length === 1 && art.keyPoints[0] === art.title) ||
                               art.isFallback;

            return (
              <div 
                key={art.id}
                onClick={() => toggleExpand(art.id)}
                style={{ 
                  background: isExpanded ? 'rgba(255,255,255,0.015)' : 'rgba(255,255,255,0.005)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '8px', 
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <div onClick={(e) => e.stopPropagation()} style={{ paddingTop: '2px' }}>
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={(e) => toggleSelectOne(art.id, e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h5 className="mobile-article-title">{art.title}</h5>
                    <div className="mobile-article-meta">
                      <span style={{ color: isFallback ? '#f87171' : '#34d399', fontWeight: 'bold' }}>{isFallback ? '⚠️ FALLBACK' : '✨ PREMIUM'}</span>
                      <span>•</span>
                      <span>{art.source}</span>
                      <span>•</span>
                      <span style={{ color: 'var(--accent-purple)' }}>{(art.category || 'general').toUpperCase()}{sub}</span>
                    </div>
                  </div>
                  <div className="mobile-article-actions" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => handleEditClick(art)} className="mobile-action-btn">✏️</button>
                    <button onClick={() => handleDeleteIndividual(art)} className="mobile-action-btn" style={{ color: '#f87171', background: 'rgba(239,68,68,0.04)' }}>🗑️</button>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '0.7rem', color: '#d1d5db', lineHeight: '1.25', textAlign: 'left' }}>
                      <strong>Resumen IA:</strong> {summaryText}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.58rem', color: 'var(--text-muted)' }}>
                      <span>📅 {art.publishedAt ? new Date(art.publishedAt).toLocaleDateString('es-ES') : 'Desconocida'}</span>
                      <a href={art.link || art.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>Origen 🔗</a>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* C. Pagination Controls */}
      {totalArticles > articlesPerPage && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Mostrando <span>{startIdx + 1}-{endIdx} de {totalArticles}</span> artículos
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setArticlesPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="tab-btn"
              style={{ cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
            >
              ◀ Anterior
            </button>
            <button 
              onClick={() => setArticlesPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="tab-btn"
              style={{ cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
            >
              Siguiente ▶
            </button>
          </div>
        </div>
      )}

      {/* D. Full Edit Modal Component */}
      {editingArticle && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(4, 4, 8, 0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '24px'
        }}>
          <div className="card" style={{
            width: '100%',
            maxWidth: '750px',
            maxHeight: '90vh',
            overflowY: 'auto',
            background: 'var(--bg-card)',
            border: '1px solid rgba(255,255,255,0.12)',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '1.2rem', fontFamily: 'var(--font-title)', fontWeight: '700', color: '#fff' }}>
                {isReadOnly ? '👁️ Detalles del Artículo' : `✏️ Editar Artículo (ID: ${editingArticle.id.slice(0, 8)}...)`}
              </h3>
              <button 
                onClick={() => setEditingArticle(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Quick AI tools (disabled in read-only) */}
            {!isReadOnly && (
              <div style={{ display: 'flex', gap: '10px', background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.2)', padding: '12px', borderRadius: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ayudas de IA VPS:</span>
                <button 
                  onClick={() => handleEditorIaHelp('classify')}
                  disabled={editorLoading}
                  className="btn btn-secondary"
                  style={{ width: 'auto', padding: '6px 12px', fontSize: '0.72rem', background: 'rgba(255,255,255,0.03)' }}
                >
                  🧠 Autoclasificar IA
                </button>
                <button 
                  onClick={() => handleEditorIaHelp('repair')}
                  disabled={editorLoading}
                  className="btn btn-secondary"
                  style={{ width: 'auto', padding: '6px 12px', fontSize: '0.72rem', background: 'rgba(255,255,255,0.03)' }}
                >
                  ✨ Reescribir Premium IA
                </button>
                {editorLoading && <span style={{ fontSize: '0.72rem', color: '#c084fc', animation: 'pulse 1.5s infinite' }}>⏳ Procesando inferencia en VPS...</span>}
              </div>
            )}

            {/* Form Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              <div className="form-group">
                <label>Título del Artículo</label>
                <input 
                  type="text" 
                  value={editingArticle.title} 
                  disabled={isReadOnly}
                  onChange={(e) => setEditingArticle(prev => ({ ...prev, title: e.target.value }))}
                  className="input-field"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Categoría</label>
                  <select 
                    value={editingArticle.category} 
                    disabled={isReadOnly}
                    onChange={(e) => setEditingArticle(prev => ({ ...prev, category: e.target.value }))}
                    className="input-field"
                    style={{ background: '#090912', color: '#fff' }}
                  >
                    <option value="tecnologia">Tecnología</option>
                    <option value="ciencia">Ciencia</option>
                    <option value="economia">Economía</option>
                    <option value="internacional">Internacional</option>
                    <option value="nacional">Nacional</option>
                    <option value="medioambiente">Medio Ambiente</option>
                    <option value="sociedad">Sociedad</option>
                    <option value="cultura">Cultura</option>
                    <option value="estilo">Estilo</option>
                    <option value="deportes">Deportes</option>
                    <option value="opinion">Opinión</option>
                    <option value="gastronomia">Gastronomía</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Subcategoría</label>
                  <input 
                    type="text" 
                    value={editingArticle.subcategory} 
                    disabled={isReadOnly}
                    onChange={(e) => setEditingArticle(prev => ({ ...prev, subcategory: e.target.value }))}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Hashtags (separados por comas)</label>
                <input 
                  type="text" 
                  value={editingArticle.hashtagsText} 
                  disabled={isReadOnly}
                  onChange={(e) => setEditingArticle(prev => ({ ...prev, hashtagsText: e.target.value }))}
                  placeholder="ej: inteligencia artificial, openai"
                  className="input-field"
                />
              </div>

              <div className="form-group">
                <label>Resumen Ejecutivo de IA</label>
                <textarea 
                  value={editingArticle.summaryText} 
                  disabled={isReadOnly}
                  onChange={(e) => setEditingArticle(prev => ({ ...prev, summaryText: e.target.value }))}
                  className="input-field"
                  style={{ minHeight: '100px', resize: 'vertical' }}
                />
              </div>

              <div className="form-group">
                <label>Cuerpo Completo del Artículo</label>
                <textarea 
                  value={editingArticle.fullText} 
                  disabled={isReadOnly}
                  onChange={(e) => setEditingArticle(prev => ({ ...prev, fullText: e.target.value }))}
                  className="input-field"
                  style={{ minHeight: '160px', resize: 'vertical' }}
                />
              </div>

            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '4px' }}>
              <button 
                onClick={() => setEditingArticle(null)}
                className="btn btn-secondary"
                style={{ width: 'auto', padding: '10px 20px' }}
              >
                {isReadOnly ? 'Cerrar' : 'Cancelar'}
              </button>
              {!isReadOnly && (
                <button 
                  onClick={handleSaveArticle}
                  className="btn btn-primary"
                  style={{ width: 'auto', padding: '10px 24px' }}
                  disabled={isSaving || editorLoading}
                >
                  {isSaving ? '💾 Guardando...' : '💾 Guardar Cambios'}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
