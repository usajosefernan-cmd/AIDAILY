import React, { useState, useMemo } from 'react';

export default function SourcesPanel({ 
  currentConfig = {}, 
  dbUrlBase = '', 
  token = '', 
  isReadOnly = true,
  ensureAdminAccess = () => {},
  onRefreshConfig = async () => {},
  sourcesStatus = {}, 
  feedHashes = {} 
}) {
  const [sourcesSearch, setSourcesSearch] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('all');
  const [sourcesPage, setSourcesPage] = useState(1);
  const sourcesPerPage = 12;

  // Add/Edit modal state
  const [editingFeed, setEditingFeed] = useState(null);
  const [isSavingFeed, setIsSavingFeed] = useState(false);

  // Flatten feeds with category and index information
  const flattenedFeeds = useMemo(() => {
    const entries = [];
    if (!currentConfig.feeds) return entries;

    Object.entries(currentConfig.feeds).forEach(([cat, list]) => {
      if (!Array.isArray(list)) return;
      list.forEach((feed, idx) => {
        entries.push({
          ...feed,
          category: cat,
          index: idx
        });
      });
    });

    return entries;
  }, [currentConfig]);

  // Filter feeds
  const filteredFeeds = useMemo(() => {
    return flattenedFeeds.filter(feed => {
      if (activeCategoryFilter !== 'all' && feed.category !== activeCategoryFilter) return false;
      if (sourcesSearch) {
        const query = sourcesSearch.toLowerCase().trim();
        const matchName = feed.name && feed.name.toLowerCase().includes(query);
        const matchUrl = feed.url && feed.url.toLowerCase().includes(query);
        const matchTags = Array.isArray(feed.tags) && feed.tags.some(t => t.toLowerCase().includes(query));
        return matchName || matchUrl || matchTags;
      }
      return true;
    });
  }, [flattenedFeeds, sourcesSearch, activeCategoryFilter]);

  // Pagination
  const totalFeeds = filteredFeeds.length;
  const totalPages = Math.ceil(totalFeeds / sourcesPerPage) || 1;
  const currentPage = Math.min(Math.max(1, sourcesPage), totalPages);
  const startIdx = (currentPage - 1) * sourcesPerPage;
  const endIdx = Math.min(startIdx + sourcesPerPage, totalFeeds);

  const pageBatch = useMemo(() => {
    return filteredFeeds.slice(startIdx, endIdx);
  }, [filteredFeeds, startIdx, endIdx]);

  // Save Config function to update Firebase node config/feeds
  const updateFeedsOnFirebase = async (nextFeeds) => {
    if (!token) {
      alert('❌ Debes proporcionar un token de seguridad válido para realizar cambios.');
      return false;
    }

    try {
      const response = await fetch(`${dbUrlBase}/config/feeds.json?auth=${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextFeeds)
      });

      if (response.ok) {
        await onRefreshConfig();
        return true;
      } else {
        // Fallback using root patch if direct auth node is restricted
        const fallbackRes = await fetch(`${dbUrlBase}.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            security_token: token,
            config: {
              ...currentConfig,
              feeds: nextFeeds
            }
          })
        });
        if (fallbackRes.ok) {
          await onRefreshConfig();
          return true;
        }
      }
      alert('❌ Error al guardar los feeds en Firebase.');
      return false;
    } catch (err) {
      alert(`❌ Error al conectar: ${err.message}`);
      return false;
    }
  };

  // Add / Edit Feed handler
  const handleOpenAddFeed = () => {
    ensureAdminAccess(() => {
      setEditingFeed({
        isNew: true,
        name: '',
        url: '',
        category: 'tecnologia',
        tagsText: ''
      });
    });
  };

  const handleOpenEditFeed = (feed) => {
    ensureAdminAccess(() => {
      setEditingFeed({
        isNew: false,
        originalCategory: feed.category,
        originalIndex: feed.index,
        name: feed.name,
        url: feed.url,
        category: feed.category,
        tagsText: Array.isArray(feed.tags) ? feed.tags.join(', ') : ''
      });
    });
  };

  const handleSaveFeed = async () => {
    if (!editingFeed.name.trim() || !editingFeed.url.trim()) {
      alert('Por favor, completa el nombre y la URL de la fuente RSS.');
      return;
    }

    ensureAdminAccess(async () => {
      setIsSavingFeed(true);

      const tags = editingFeed.tagsText.split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const nextFeeds = { ...currentConfig.feeds };

      const newFeedItem = {
        name: editingFeed.name.trim(),
        url: editingFeed.url.trim(),
        category: 'news', // Default internal value
        tags
      };

      if (editingFeed.isNew) {
        // Add new
        const targetCat = editingFeed.category;
        if (!nextFeeds[targetCat]) nextFeeds[targetCat] = [];
        nextFeeds[targetCat].push(newFeedItem);
      } else {
        // Edit existing
        const origCat = editingFeed.originalCategory;
        const targetCat = editingFeed.category;
        const idx = editingFeed.originalIndex;

        if (origCat !== targetCat) {
          // Moved categories
          nextFeeds[origCat].splice(idx, 1);
          if (!nextFeeds[targetCat]) nextFeeds[targetCat] = [];
          nextFeeds[targetCat].push(newFeedItem);
        } else {
          nextFeeds[targetCat][idx] = newFeedItem;
        }
      }

      const success = await updateFeedsOnFirebase(nextFeeds);
      if (success) {
        setEditingFeed(null);
      }
      setIsSavingFeed(false);
    });
  };

  // Delete Feed
  const handleDeleteFeed = async (feed) => {
    ensureAdminAccess(async () => {
      if (confirm(`¿Estás seguro de que deseas eliminar permanentemente la fuente "${feed.name}"?`)) {
        const nextFeeds = { ...currentConfig.feeds };
        nextFeeds[feed.category].splice(feed.index, 1);
        
        // Clean empty arrays
        if (nextFeeds[feed.category].length === 0) {
          delete nextFeeds[feed.category];
        }

        await updateFeedsOnFirebase(nextFeeds);
      }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Search and category filters */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        background: 'rgba(255,255,255,0.01)',
        border: '1px solid var(--border-color)',
        padding: '16px 20px',
        borderRadius: '16px'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', flex: 1, minWidth: '280px' }}>
          <input 
            type="text" 
            value={sourcesSearch}
            onChange={(e) => { setSourcesSearch(e.target.value); setSourcesPage(1); }}
            placeholder="Buscar fuentes RSS..." 
            className="input-field" 
            style={{ maxWidth: '280px', flex: 1 }}
          />
          <select 
            value={activeCategoryFilter}
            onChange={(e) => { setActiveCategoryFilter(e.target.value); setSourcesPage(1); }}
            className="input-field" 
            style={{ width: '150px', background: '#090912', color: '#fff' }}
          >
            <option value="all">Todas las Categorías</option>
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

        <button 
          onClick={handleOpenAddFeed}
          className="btn btn-primary"
          style={{ width: 'auto', padding: '10px 20px', fontSize: '0.85rem' }}
        >
          ➕ AÑADIR FUENTE RSS {isReadOnly && '🔒'}
        </button>
      </div>

      {/* Sources list card */}
      <div className="card" style={{ padding: '20px', overflowX: 'auto' }}>
        <table className="compact-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '12px 8px', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Nombre</th>
              <th style={{ padding: '12px 8px', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>URL RSS</th>
              <th style={{ padding: '12px 8px', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', width: '160px' }}>Categoría</th>
              <th style={{ padding: '12px 8px', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', width: '140px' }}>Último Scrapeo</th>
              <th style={{ padding: '12px 8px', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', width: '100px' }}>Estado</th>
              <th style={{ padding: '12px 8px', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', width: '90px', textAlign: 'center' }}>Noticias</th>
              <th style={{ padding: '12px 8px', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', width: '90px', textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pageBatch.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No se encontraron fuentes de feeds.
                </td>
              </tr>
            ) : (
              pageBatch.map(feed => {
                const subcategory = Array.isArray(feed.tags) ? feed.tags[0] : 'General';
                const hash = feedHashes[feed.url] || '';
                const statusData = sourcesStatus[hash] || {};
                
                let lastRunText = 'Nunca';
                if (statusData.lastRunTime) {
                  const runDate = new Date(statusData.lastRunTime);
                  lastRunText = runDate.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                }
                
                let statusBadge = <span style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', padding: '3px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '600' }}>DESCONOCIDO</span>;
                if (statusData.status === 'success') {
                  statusBadge = <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '3px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '600' }}>✅ ÉXITO</span>;
                } else if (statusData.status === 'error') {
                  const tooltip = statusData.errorMessage || 'Error desconocido';
                  statusBadge = <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '3px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '600' }} title={tooltip}>❌ ERROR</span>;
                }

                const count = statusData.articlesScrapedCount || 0;

                return (
                  <tr key={feed.url} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }} className="hover-row">
                    <td style={{ padding: '12px 8px', fontSize: '0.82rem', fontWeight: '600', color: '#fff' }} data-label="Nombre" className="td-title">
                      {feed.name}
                    </td>
                    <td style={{ padding: '12px 8px', fontSize: '0.75rem', color: 'var(--accent-cyan)' }} data-label="URL RSS">
                      <a href={feed.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }} className="break-url">
                        {feed.url}
                      </a>
                    </td>
                    <td style={{ padding: '12px 8px' }} data-label="Categoría">
                      <span className="feed-category-badge" style={{ fontSize: '0.65rem' }}>{feed.category.toUpperCase()}</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: '6px' }}>{subcategory.toUpperCase()}</span>
                    </td>
                    <td style={{ padding: '12px 8px', fontSize: '0.78rem', color: 'var(--text-muted)' }} data-label="Último Scrapeo">
                      📅 {lastRunText}
                    </td>
                    <td style={{ padding: '12px 8px' }} data-label="Estado">
                      {statusBadge}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', fontFamily: 'monospace', fontWeight: '700', color: 'var(--accent-purple)', fontSize: '0.85rem' }} data-label="Noticias">
                      {count}
                    </td>
                    <td style={{ padding: '12px 8px' }} data-label="Acciones" className="td-actions">
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                        <button 
                          onClick={() => handleOpenEditFeed(feed)}
                          className="action-icon-btn" 
                          title="Editar"
                          style={{ padding: '4px 8px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}
                        >
                          ✏️
                        </button>
                        <button 
                          onClick={() => handleDeleteFeed(feed)}
                          className="action-icon-btn delete" 
                          title="Eliminar"
                          style={{ padding: '4px 8px', fontSize: '0.8rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px', color: '#f87171', cursor: 'pointer' }}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {totalFeeds > sourcesPerPage && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Mostrando <span>{startIdx + 1}-{endIdx} de {totalFeeds}</span> fuentes
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setSourcesPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="tab-btn"
              style={{ cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
            >
              ◀ Anterior
            </button>
            <button 
              onClick={() => setSourcesPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="tab-btn"
              style={{ cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
            >
              Siguiente ▶
            </button>
          </div>
        </div>
      )}

      {/* D. Add / Edit Modal */}
      {editingFeed && (
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
            maxWidth: '520px',
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
                {editingFeed.isNew ? '➕ Añadir Nueva Fuente RSS' : `✏️ Editar Fuente: ${editingFeed.name}`}
              </h3>
              <button 
                onClick={() => setEditingFeed(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Form Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              <div className="form-group">
                <label>Nombre de la Fuente</label>
                <input 
                  type="text" 
                  value={editingFeed.name}
                  onChange={(e) => setEditingFeed(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="ej: Xataka Tecnologia"
                  className="input-field"
                />
              </div>

              <div className="form-group">
                <label>URL del Feed RSS</label>
                <input 
                  type="url" 
                  value={editingFeed.url}
                  onChange={(e) => setEditingFeed(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="ej: https://www.xataka.com/feed"
                  className="input-field"
                />
              </div>

              <div className="form-group">
                <label>Categoría</label>
                <select 
                  value={editingFeed.category}
                  onChange={(e) => setEditingFeed(prev => ({ ...prev, category: e.target.value }))}
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
                <label>Etiquetas / Subcategoría (separadas por comas)</label>
                <input 
                  type="text" 
                  value={editingFeed.tagsText}
                  onChange={(e) => setEditingFeed(prev => ({ ...prev, tagsText: e.target.value }))}
                  placeholder="ej: moviles, gadgets, apple (la primera etiqueta define la subcategoría)"
                  className="input-field"
                />
              </div>

            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '4px' }}>
              <button 
                onClick={() => setEditingFeed(null)}
                className="btn btn-secondary"
                style={{ width: 'auto', padding: '10px 20px' }}
                disabled={isSavingFeed}
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveFeed}
                className="btn btn-primary"
                style={{ width: 'auto', padding: '10px 24px' }}
                disabled={isSavingFeed}
              >
                {isSavingFeed ? '💾 Guardando...' : '💾 Guardar Fuente'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
