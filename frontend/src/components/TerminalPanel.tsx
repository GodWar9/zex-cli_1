import { type ReactElement, useRef, useEffect } from 'react';

interface TerminalPanelProps {
  output: string[];
}

export function TerminalPanel({ output }: TerminalPanelProps): ReactElement {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output]);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: '16px',
      backgroundColor: '#0a0a0c', // Pure dark for terminal vibe
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h2 style={{ margin: 0, fontSize: '0.875rem', color: 'var(--fg-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Terminal Out
        </h2>
        {output.length > 0 && <span style={{ fontSize: '10px', color: '#10b981', letterSpacing: '0.05em' }}>● LIVE</span>}
      </div>
      
      <div ref={terminalRef} style={{
        flex: 1,
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#10b981', // terminal green
        overflowY: 'auto',
        border: '1px solid #1a1a1a',
        borderRadius: '6px',
        padding: '12px',
        backgroundColor: '#000',
        boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)',
        lineHeight: '1.6'
      }}>
        {output.length === 0 ? (
            <span style={{ color: '#4a5568' }}>Awaiting execution output...</span>
        ) : (
            output.map((line, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px' }}>
                  <span style={{ color: '#4a5568', userSelect: 'none' }}>&gt;</span>
                  <span>{line}</span>
                </div>
            ))
        )}
      </div>
    </div>
  );
}
