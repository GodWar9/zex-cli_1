import { type ReactElement } from 'react';
import type { ConnectionStatus } from '../hooks/useVM';

interface StatusBarProps {
  connectionStatus: ConnectionStatus;
  stepCount: number;
}

export function StatusBar({ connectionStatus, stepCount }: StatusBarProps): ReactElement {
  const isConnected = connectionStatus === 'connected';

  return (
    <div style={{
      height: '40px',
      borderBottom: '1px solid var(--border-dim)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      justifyContent: 'space-between',
      background: 'rgba(0,0,0,0.2)',
      fontSize: '0.75rem',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      color: 'var(--fg-dim)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: isConnected ? 'var(--intent-blue)' : 'var(--error-red)',
            boxShadow: isConnected ? '0 0 8px var(--intent-blue)' : 'none'
          }} />
          <span style={{ color: isConnected ? 'var(--fg-base)' : 'var(--error-red)'}}>
            {connectionStatus}
          </span>
        </div>
        <span>Steps Simulated: <strong style={{ color: 'var(--fg-base)' }}>{stepCount}</strong></span>
      </div>
      <div>
        Cortex Simulator
      </div>
    </div>
  );
}
