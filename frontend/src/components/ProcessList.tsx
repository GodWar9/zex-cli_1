import { type ReactElement } from 'react';
import type { ProcessInfo } from '../types';

interface ProcessListProps {
  processes: ProcessInfo[];
}

export function ProcessList({ processes }: ProcessListProps): ReactElement {
  
  const getStateColor = (state: string) => {
    switch (state) {
      case 'running': return '#10b981'; // Green
      case 'waiting': return '#facc15'; // Yellow
      case 'ready':   return '#60a5fa'; // Blue
      case 'done':    return '#475569'; // Slate
      default:        return '#9ca3af';
    }
  };

  return (
    <div style={{
      height: '65%', // Takes bottom 65% of left pane
      borderTop: '1px solid var(--border-dim)',
      display: 'flex',
      flexDirection: 'column',
      padding: '16px',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '0.875rem', color: 'var(--fg-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Process Queue
        </h2>
        <span style={{ fontSize: '11px', color: 'var(--fg-dim)' }}>{processes.length} Active Threads</span>
      </div>
      
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        paddingRight: '8px'
      }}>
        {processes.length === 0 ? (
          <div style={{ color: 'var(--fg-dim)', fontSize: '0.875rem', fontStyle: 'italic', textAlign: 'center', marginTop: '20px' }}>
            Scheduler idle.
          </div>
        ) : (
          processes.map((p) => (
            <div key={p.pid} style={{
              background: 'rgba(255,255,255,0.03)',
              borderLeft: `3px solid ${getStateColor(p.state)}`,
              borderRadius: '4px',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              opacity: p.state === 'done' ? 0.5 : 1
            }}>
              {/* PID Block */}
              <div style={{ 
                width: '40px', 
                height: '40px', 
                background: 'rgba(0,0,0,0.3)', 
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: getStateColor(p.state),
                fontWeight: 'bold',
                fontFamily: 'monospace'
              }}>
                P{p.pid}
              </div>
              
              {/* Info Column */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#f1f5f9' }}>{p.name}</span>
                  <span style={{ 
                    fontSize: '10px', 
                    padding: '2px 6px', 
                    borderRadius: '12px', 
                    background: `${getStateColor(p.state)}20`,
                    color: getStateColor(p.state),
                    textTransform: 'uppercase',
                    fontWeight: 'bold'
                  }}>
                    {p.state}
                  </span>
                </div>
                
                {/* Stats Row */}
                <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'var(--fg-dim)', fontFamily: 'monospace' }}>
                  <span>PRI: <strong style={{ color: '#e2e8f0' }}>{p.priority}</strong></span>
                  <span>BURST: <strong style={{ color: '#e2e8f0' }}>{p.remaining_burst}</strong></span>
                  <span>NET: <strong style={{ color: '#e2e8f0' }}>{p.network_demand}</strong></span>
                  {p.io_wait > 0 && <span style={{ color: '#facc15' }}>IO: {p.io_wait}</span>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
