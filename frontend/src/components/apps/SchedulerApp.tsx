import { useState } from 'react';
import { useScheduler } from '../../hooks/useScheduler';
import { MetricsPanel } from '../MetricsPanel';
import { ProcessList } from '../ProcessList';
import { NarrationPanel } from '../NarrationPanel';
import { TerminalPanel } from '../TerminalPanel';

export function SchedulerApp() {
  const [terminalOpen, setTerminalOpen] = useState<boolean>(true);
  const {
    currentEvent, narrationTokens, terminalOutput,
    connectionStatus, playbackSpeed, setPlaybackSpeed,
    sendStart, sendPause, sendResume, sendReset
  } = useScheduler();

  const tick = currentEvent?.tick;
  const metrics = currentEvent?.metrics;
  const processes = currentEvent?.processes || [];

  return (
    <div style={{
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      background: '#0a0a0f',
      color: '#e0e0e0',
    }}>
      {/* Status strip */}
      <div style={{
        height: 30,
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        justifyContent: 'space-between',
        background: 'rgba(0,0,0,0.3)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        fontSize: 11,
        color: 'rgba(255,255,255,0.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: connectionStatus === 'connected' ? '#30d158' : '#ff453a',
            boxShadow: connectionStatus === 'connected' ? '0 0 6px #30d158' : 'none',
          }} />
          <span>{connectionStatus}</span>
          <span>Tick: <strong style={{ color: '#e0e0e0' }}>{tick ?? 0}</strong></span>
        </div>
        <span style={{ letterSpacing: '0.05em' }}>CORTEX SCHEDULER</span>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Left: Metrics + Processes */}
        <div style={{ width: '50%', display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Speed control */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
            <span style={{ fontWeight: 600 }}>TPS</span>
            <input
              type="range"
              min="0.5" max="10" step="0.5"
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: '#bf5af2' }}
            />
            <span style={{ minWidth: 40, textAlign: 'right' }}>{playbackSpeed}</span>
          </div>
          <MetricsPanel metrics={metrics} tick={tick} />
          <ProcessList processes={processes} />
        </div>

        {/* Right: Narration */}
        <div style={{ width: '50%', display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
          <NarrationPanel narrationTokens={narrationTokens} />
          <div style={{ position: 'absolute', bottom: 12, right: 16, zIndex: 10 }}>
            <button
              onClick={() => setTerminalOpen(!terminalOpen)}
              style={{
                background: terminalOpen ? '#ff453a' : '#bf5af2',
                color: 'white', border: 'none', borderRadius: 8,
                padding: '8px 16px', fontSize: 11, fontWeight: 600,
                cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              }}
            >
              {terminalOpen ? '▼ Hide Log' : '▲ Agent Log'}
            </button>
          </div>
        </div>
      </div>

      {/* Terminal */}
      {terminalOpen && (
        <div style={{
          height: 170,
          display: 'flex',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ flex: 1 }}>
            <TerminalPanel output={terminalOutput} />
          </div>
          <div style={{
            width: 180, display: 'flex', flexDirection: 'column', gap: 6,
            padding: 12, borderLeft: '1px solid rgba(255,255,255,0.06)',
            justifyContent: 'center',
          }}>
            <button onClick={() => sendStart('heuristic')} disabled={connectionStatus !== 'connected'} style={btnStyle('#0a84ff', connectionStatus === 'connected')}>Heuristic</button>
            <button onClick={() => sendStart('ppo')} disabled={connectionStatus !== 'connected'} style={btnStyle('#bf5af2', connectionStatus === 'connected')}>PPO Agent</button>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={sendPause} style={{ ...btnStyle('transparent'), border: '1px solid rgba(255,255,255,0.1)', flex: 1 }}>⏸</button>
              <button onClick={sendResume} style={{ ...btnStyle('transparent'), border: '1px solid rgba(255,255,255,0.1)', flex: 1 }}>▶</button>
            </div>
            <button onClick={sendReset} style={{ ...btnStyle('transparent'), border: '1px solid #ff453a', color: '#ff453a' }}>Reset</button>
          </div>
        </div>
      )}
    </div>
  );
}

function btnStyle(bg: string, enabled = true): React.CSSProperties {
  return {
    height: 32,
    backgroundColor: enabled ? bg : 'rgba(255,255,255,0.05)',
    color: enabled ? (bg === 'transparent' ? 'rgba(255,255,255,0.5)' : 'white') : '#555',
    fontWeight: 600,
    border: 'none',
    borderRadius: 6,
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.03em',
  };
}
