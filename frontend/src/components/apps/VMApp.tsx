import { useState } from 'react';
import { useVM } from '../../hooks/useVM';
import { CodePanel } from '../CodePanel';
import { StateVisualiser } from '../StateVisualiser';
import { NarrationPanel } from '../NarrationPanel';
import { TerminalPanel } from '../TerminalPanel';

export function VMApp() {
  const [code, setCode] = useState<string>('count = 5\nwhile count > 0:\n    print("Counting down: " + str(count))\n    count -= 1\nprint("Blastoff!")');
  const [terminalOpen, setTerminalOpen] = useState<boolean>(false);
  const {
    steps, narrationTokens, terminalOutput,
    connectionStatus, playbackSpeed, setPlaybackSpeed,
    sendSimulate, sendReset
  } = useVM();

  const handleSimulate = () => {
    sendSimulate(code);
    setTerminalOpen(true);
  };

  const currentStep = steps[steps.length - 1];
  const variables = currentStep?.variables || {};
  const currentLine = currentStep?.line_number;

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
          <span>Steps: <strong style={{ color: '#e0e0e0' }}>{steps.length}</strong></span>
        </div>
        <span style={{ letterSpacing: '0.05em' }}>CORTEX VM</span>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Left: Editor + Variables */}
        <div style={{ width: '50%', display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Speed control */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
            <span style={{ fontWeight: 600 }}>SPEED</span>
            <input
              type="range"
              min="10" max="2000" step="50"
              value={2010 - playbackSpeed}
              onChange={(e) => setPlaybackSpeed(2010 - parseInt(e.target.value))}
              style={{ flex: 1, accentColor: '#0a84ff' }}
            />
            <span style={{ minWidth: 55, textAlign: 'right' }}>{playbackSpeed}ms</span>
          </div>
          <CodePanel code={code} onChange={setCode} onRun={handleSimulate} status={connectionStatus} currentLine={currentLine} />
          <StateVisualiser variables={variables} />
        </div>

        {/* Right: Narration */}
        <div style={{ width: '50%', display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
          <NarrationPanel narrationTokens={narrationTokens} />
          <div style={{ position: 'absolute', bottom: 12, right: 16, zIndex: 10 }}>
            <button
              onClick={() => setTerminalOpen(!terminalOpen)}
              style={{
                background: terminalOpen ? '#ff453a' : '#0a84ff',
                color: 'white', border: 'none', borderRadius: 8,
                padding: '8px 16px', fontSize: 11, fontWeight: 600,
                cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              }}
            >
              {terminalOpen ? '▼ Hide Console' : '▲ Console'}
            </button>
          </div>
        </div>
      </div>

      {/* Terminal */}
      {terminalOpen && (
        <div style={{
          height: 180,
          display: 'flex',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ flex: 1 }}>
            <TerminalPanel output={terminalOutput} />
          </div>
          <div style={{
            width: 120, display: 'flex', flexDirection: 'column', gap: 6,
            padding: 12, borderLeft: '1px solid rgba(255,255,255,0.06)',
            justifyContent: 'center',
          }}>
            <button
              onClick={sendReset}
              style={{
                height: 36, background: 'transparent', color: 'rgba(255,255,255,0.5)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
                cursor: 'pointer', fontSize: 11,
              }}
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
