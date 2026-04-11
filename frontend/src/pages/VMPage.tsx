import { useState } from 'react';
import { useVM } from '../hooks/useVM';
import { StatusBar } from '../components/StatusBar';
import { CodePanel } from '../components/CodePanel';
import { StateVisualiser } from '../components/StateVisualiser';
import { NarrationPanel } from '../components/NarrationPanel';
import { TerminalPanel } from '../components/TerminalPanel';

export function VMPage() {
  const [code, setCode] = useState<string>('count = 5\nwhile count > 0:\n    print("Counting down: " + str(count))\n    count -= 1\nprint("Blastoff!")');
  const [terminalOpen, setTerminalOpen] = useState<boolean>(false);
  const { 
    steps, narrationTokens, terminalOutput, 
    connectionStatus, playbackSpeed, setPlaybackSpeed, 
    sendSimulate, sendReset 
  } = useVM();

  const handleSimulate = () => {
    sendSimulate(code);
    // Auto-open terminal if simulating so they easily see output
    setTerminalOpen(true);
  };

  const handleReset = () => {
    sendReset();
  };

  const currentStep = steps[steps.length - 1];
  const variables = currentStep?.variables || {};
  const currentLine = currentStep?.line_number;

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
      <StatusBar connectionStatus={connectionStatus} stepCount={steps.length} />

      {/* ── Main Top Section ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        minHeight: 0,
        position: 'relative',
      }}>
        {/* ── Left 50% (Editor & Variables) ── */}
        <div style={{
          width: '50%',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          position: 'relative',
        }}>
          {/* We inject speed controls here cleanly */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px 0 16px' }}>
            <span style={{ fontSize: '12px', color: 'var(--fg-dim)', fontWeight: 'bold' }}>SPEED</span>
            <input 
              type="range" 
              min="10" 
              max="2000" 
              step="50"
              // Invert slider visual logic (left faster delay, right slower delay => left fast, right slow)
              // Wait, standard UI: right = fast. So delay should be small on right.
               // min = 10ms, max = 2000ms. Inverse map.
              value={2010 - playbackSpeed} 
              onChange={(e) => setPlaybackSpeed(2010 - parseInt(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--intent-blue)' }}
            />
            <span style={{ fontSize: '11px', color: 'var(--fg-dim)', minWidth: '60px', textAlign: 'right' }}>
              {playbackSpeed}ms/step
            </span>
          </div>

          <CodePanel 
            code={code} 
            onChange={setCode} 
            onRun={handleSimulate} 
            status={connectionStatus} 
            currentLine={currentLine} 
          />
          <StateVisualiser variables={variables} />

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
          
          {/* Toggle Terminal Button sitting bottom-right of narration safely */}
          <div style={{
              position: 'absolute',
              bottom: '16px',
              right: '24px',
              zIndex: 10
          }}>
            <button 
              onClick={() => setTerminalOpen(!terminalOpen)}
              style={{
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
                whiteSpace: 'nowrap'
              }}
            >
              {terminalOpen ? '▼ Hide Console View' : '▲ Show Console Output'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Bottom Section (Terminal Output) - conditionally rendered ── */}
      {terminalOpen && (
        <div style={{
            height: '250px',
            display: 'flex',
            flexDirection: 'row',
            borderTop: '1px solid var(--border-dim)',
            animation: 'slide-up 0.3s ease-out'
        }}>
            <div style={{ flex: 1, minWidth: 0, height: '100%' }}>
              <TerminalPanel output={terminalOutput} />
            </div>
            {/* Quick Clear Controls */}
            <div style={{ width: '150px', display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', borderLeft: '1px solid var(--border-dim)', justifyContent: 'center' }}>
              <button 
                  onClick={handleReset}
                  style={{ height: '48px', backgroundColor: 'transparent', color: 'var(--fg-dim)', border: '1px solid var(--border-dim)', borderRadius: '4px', cursor: 'pointer', transition: 'background-color 0.2s', outline: 'none' }}>
                  Reset State
              </button>
            </div>
        </div>
      )}
      <style>
        {`
          @keyframes slide-up {
            from { height: 0px; opacity: 0; }
            to { height: 250px; opacity: 1; }
          }
        `}
      </style>
    </div>
  );
}
