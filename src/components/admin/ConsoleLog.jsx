import React, { useEffect, useRef } from 'react';

export default function ConsoleLog({ logs, onClear }) {
  const consoleEndRef = useRef(null);

  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  return (
    <div style={{
      background: '#040409',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '8px',
      padding: '16px',
      fontFamily: 'Consolas, Monaco, monospace',
      fontSize: '0.75rem',
      lineHeight: '1.5',
      color: '#e5e7eb',
      marginTop: '16px'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        paddingBottom: '8px',
        marginBottom: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }}></span>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fbbf24' }}></span>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span>
          <span style={{ marginLeft: '6px', fontWeight: 'bold', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem' }}>Consola del Scraper (Log en Vivo)</span>
        </div>
        <button 
          onClick={onClear}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '4px',
            color: 'var(--text-muted, #9ca3af)',
            padding: '3px 8px',
            fontSize: '0.65rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontWeight: 600
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'rgba(239, 68, 68, 0.15)';
            e.target.style.color = '#ef4444';
            e.target.style.borderColor = 'rgba(239, 68, 68, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'rgba(255,255,255,0.05)';
            e.target.style.color = '#9ca3af';
            e.target.style.borderColor = 'rgba(255,255,255,0.1)';
          }}
        >
          🗑️ LIMPIAR CONSOLA
        </button>
      </div>
      
      <div style={{
        height: '240px',
        overflowY: 'auto',
        paddingRight: '6px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }}>
        {logs.length === 0 ? (
          <div style={{ color: 'rgba(255,255,255,0.2)', fontStyle: 'italic', padding: '8px 0' }}>
            Consola preparada. Inicia una acción o espera a la ejecución programada...
          </div>
        ) : (
          logs.map((log, index) => {
            let color = '#38bdf8'; // info (cyan-ish)
            if (log.type === 'error') color = '#f87171'; // error
            else if (log.type === 'warn') color = '#fbbf24'; // warning
            else if (log.type === 'success') color = '#34d399'; // success
            
            return (
              <div key={index} style={{ color, display: 'flex', gap: '8px', wordBreak: 'break-all' }}>
                <span style={{ color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>[{log.time}]</span>
                <span>{log.message}</span>
              </div>
            );
          })
        )}
        <div ref={consoleEndRef} />
      </div>
    </div>
  );
}
