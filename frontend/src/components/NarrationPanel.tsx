import { useEffect, useRef } from 'react';
import type { NarrationToken } from '../types';

interface NarrationPanelProps {
  narrationTokens: NarrationToken[];
}

export function NarrationPanel({ narrationTokens }: NarrationPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [narrationTokens]);

  const getTagColor = (tag: string) => {
    switch (tag) {
      case 'intent': return '#38bdf8'; // light blue
      case 'warning': return '#facc15'; // yellow
      case 'error': return '#ef4444'; // red
      case 'step': return '#34d399'; // green
      default: return '#9ca3af'; // gray
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '0.875rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
          AI Narration Log
        </h2>
        <div style={{ fontSize: '0.75rem', color: 'var(--fg-dim)' }}>
          {narrationTokens.length} Events Detected
        </div>
      </div>
      
      <div 
        ref={containerRef}
        style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '8px' }}
      >
        {narrationTokens.length === 0 ? (
          <div style={{ color: 'var(--fg-dim)', fontStyle: 'italic', fontSize: '0.875rem', opacity: 0.5, textAlign: 'center', marginTop: '20px' }}>
            Awaiting simulation data...
          </div>
        ) : (
          narrationTokens.map((t, idx) => (
            <div 
              key={t.id} 
              style={{
                display: 'flex',
                flexDirection: 'column',
                background: 'rgba(255, 255, 255, 0.04)',
                borderTop: '1px solid rgba(255,255,255,0.05)',
                borderRight: '1px solid rgba(255,255,255,0.05)',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                borderLeft: `4px solid ${getTagColor(t.tag)}`,
                borderRadius: '4px',
                padding: '12px 14px',
                animation: 'fade-in 0.3s ease-out'
              }}
            >
              <div style={{ 
                fontSize: '0.65rem', 
                fontWeight: 'bold', 
                textTransform: 'uppercase', 
                color: getTagColor(t.tag),
                marginBottom: '6px',
                letterSpacing: '0.05em'
              }}>
                [ {t.tag} / STEP {idx + 1} ]
              </div>
              <div style={{ 
                fontSize: '0.875rem', 
                color: '#e2e8f0', 
                lineHeight: '1.6' 
              }}>
                {t.text}
              </div>
            </div>
          ))
        )}
      </div>
      <style>
        {`
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(5px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>
    </div>
  );
}
