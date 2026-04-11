import { type ReactElement } from 'react';

interface StateVisualiserProps {
  variables: Record<string, any>;
}

export function StateVisualiser({ variables }: StateVisualiserProps): ReactElement {
  const entries = Object.entries(variables);

  return (
    <div style={{
      height: '35%',
      borderTop: '1px solid var(--border-dim)',
      display: 'flex',
      flexDirection: 'column',
      padding: '16px',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '0.875rem', color: 'var(--fg-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Execution State (Variables)
        </h2>
        <span style={{ fontSize: '11px', color: 'var(--fg-dim)' }}>Updates every step</span>
      </div>
      
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}>
        {entries.length === 0 ? (
          <div style={{ color: 'var(--fg-dim)', fontSize: '0.875rem', fontStyle: 'italic', textAlign: 'center', marginTop: '20px' }}>
            No variables tracked yet.
          </div>
        ) : (
          entries.map(([key, val]) => {
            const isStr = typeof val === 'string';
            const isArr = Array.isArray(val);
            const displayVal = isArr ? `[${val.join(', ')}]` : isStr ? `"${val}"` : String(val);
            
            return (
              <div key={key} style={{
                background: 'rgba(255,255,255,0.03)',
                borderLeft: '2px solid var(--accent)',
                borderRadius: '0 4px 4px 0',
                padding: '8px 12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px'
              }}>
                <span style={{ color: 'var(--fg-dim)', fontSize: '0.875rem', fontFamily: 'monospace', minWidth: '100px' }}>
                  {key}
                </span>
                <span style={{ 
                  color: isStr ? '#10b981' : isArr ? '#f59e0b' : 'var(--accent)', 
                  fontSize: '0.9rem', 
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textAlign: 'right'
                }}>
                  {displayVal}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
