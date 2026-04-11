import { useState } from 'react';
import { useScheduler } from '../hooks/useScheduler';
import { StatusBar } from '../components/StatusBar';
import { MetricsPanel } from '../components/MetricsPanel';
import { ProcessList } from '../components/ProcessList';
import { NarrationPanel } from '../components/NarrationPanel';
import { TerminalPanel } from '../components/TerminalPanel';

export function SchedulerPage() {
  const [terminalOpen, setTerminalOpen] = useState<boolean>(true); // Terminal important for Scheduler actions
  const { 
    currentEvent, narrationTokens, terminalOutput, 
    connectionStatus, playbackSpeed, setPlaybackSpeed, 
    sendStart, sendPause, sendResume, sendReset
  } = useScheduler();

  const handleStartHeuristic = () => sendStart('heuristic');
  const handleStartPPO = () => sendStart('ppo');

  const tick = currentEvent?.tick;
  const metrics = currentEvent?.metrics;
  const processes = currentEvent?.processes || [];

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      backgroundColor: 'var(--bg-base)',
      color: 'var(--fg-base)',
    }}>
      {/* ── Status bar ── */}
      <StatusBar connectionStatus={connectionStatus} stepCount={tick || 0} />

      {/* ── Main Top Section ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        minHeight: 0,
        position: 'relative',
      }}>
        {/* ── Left 50% (Metrics & Processes) ── */}
        <div style={{
          width: '50%',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          position: 'relative',
        }}>
          {/* Speed Controls sitting cleanly on top */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px 0 16px' }}>
            <span style={{ fontSize: '12px', color: 'var(--fg-dim)', fontWeight: 'bold' }}>SPEED (TPS)</span>
            <input 
              type="range" 
              min="0.5" 
              max="10" 
              step="0.5"
              value={playbackSpeed} 
              onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--intent-blue)' }}
            />
            <span style={{ fontSize: '11px', color: 'var(--fg-dim)', minWidth: '40px', textAlign: 'right' }}>
              {playbackSpeed} tps
            </span>
          </div>

          <MetricsPanel metrics={metrics} tick={tick} />
          <ProcessList processes={processes} />

          {/* Glowing right-edge divider */}
          <div style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: 1,
            background: 'linear-gradient(180deg, transparent 0%, var(--border-hi) 20%, var(--border-hi) 80%, transparent 100%)',
            boxShadow: '0 0 16px rgba(14,165,233,0.18), 2px 0 8px rgba(14,165,233,0.06)',
            zIndex: 2,
          }} />
        </div>

        {/* ── Right 50% (Narration) ── */}
        <div style={{
          width: '50%',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflowY: 'auto',
          position: 'relative'
        }}>
          <NarrationPanel narrationTokens={narrationTokens} />
          
          <button 
            onClick={() => setTerminalOpen(!terminalOpen)}
            style={{
              position: 'absolute',
              bottom: '16px',
              right: '24px',
              backgroundColor: terminalOpen ? 'var(--error-red)' : 'var(--intent-blue)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              transition: 'background-color 0.2s',
              zIndex: 10
            }}
          >
            {terminalOpen ? '▼ Hide Agent Log' : '▲ Show Agent Log'}
          </button>
        </div>
      </div>

      {/* ── Bottom Section (Terminal & Actions) ── */}
      {terminalOpen && (
        <div style={{
            height: '220px',
            display: 'flex',
            flexDirection: 'row',
            borderTop: '1px solid var(--border-dim)',
            animation: 'slide-up 0.3s ease-out'
        }}>
            <div style={{ flex: 1, minWidth: 0, height: '100%' }}>
              <TerminalPanel output={terminalOutput} />
            </div>
            
            {/* Action Buttons */}
            <div style={{ width: '220px', display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', borderLeft: '1px solid var(--border-dim)', justifyContent: 'center' }}>
              <button onClick={handleStartHeuristic} disabled={connectionStatus !== 'connected'} style={btnStyle('var(--intent-blue)', connectionStatus === 'connected')}>Start: Heuristic</button>
              <button onClick={handleStartPPO} disabled={connectionStatus !== 'connected'} style={btnStyle('#c084fc', connectionStatus === 'connected')}>Start: PPO</button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={sendPause} style={{...btnStyle('transparent'), border: '1px solid var(--border-dim)', flex: 1}}>Pause</button>
                <button onClick={sendResume} style={{...btnStyle('transparent'), border: '1px solid var(--border-dim)', flex: 1}}>Play</button>
              </div>
              <button onClick={sendReset} style={{...btnStyle('transparent'), border: '1px solid #ef4444', color: '#ef4444'}}>Hard Reset</button>
            </div>
        </div>
      )}
      <style>
        {`
          @keyframes slide-up {
            from { height: 0px; opacity: 0; }
            to { height: 220px; opacity: 1; }
          }
        `}
      </style>
    </div>
  );
}

function btnStyle(bg: string, enabled=true): any {
  return {
    height: '38px',
    backgroundColor: enabled ? bg : 'var(--border-dim)',
    color: enabled ? (bg === 'transparent' ? 'var(--fg-dim)' : 'white') : '#888',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '4px',
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontSize: '11px',
    textTransform: 'uppercase'
  }
}
