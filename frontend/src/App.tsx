import { useState, useCallback, useRef, useEffect } from 'react';
import { useVM } from './hooks/useVM';
import { StatusBar } from './components/StatusBar';
import { BytecodePanel } from './components/BytecodePanel';
import { StackVisualiser } from './components/StackVisualiser';
import { NarrationPanel } from './components/NarrationPanel';
import { Controls } from './components/Controls';
import type { Program } from './types';

export default function App() {
  const [program, setProgram] = useState<Program>('fibonacci');
  const { execState, narrationTokens, connectionStatus, sendStep, sendRun, sendReset } = useVM(program);

  // Last event time for latency display — update on every execState change
  const [lastEventTime, setLastEventTime] = useState<number | null>(null);
  useEffect(() => {
    if (execState) setLastEventTime(Date.now());
  }, [execState]);

  const handleProgramChange = useCallback((p: Program) => {
    setProgram(p);
    setLastEventTime(null);
  }, []);

  const handleReset = useCallback(() => {
    setLastEventTime(null);
    sendReset();
  }, [sendReset]);

  const stack      = execState?.stack ?? [];
  const execSt     = execState?.state ?? 'idle';

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
    }}>
      {/* ── Status bar ── */}
      <StatusBar execState={execState} connectionStatus={connectionStatus} />

      {/* ── Main ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        minHeight: 0,
        position: 'relative',
      }}>
        {/* ── Left 50% ── */}
        <div style={{
          width: '50%',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          position: 'relative',
        }}>
          <BytecodePanel execState={execState} />
          <StackVisualiser stack={stack} />

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

        {/* ── Right 50% ── */}
        <div style={{
          width: '50%',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflowY: 'auto',
        }}>
          <NarrationPanel narrationTokens={narrationTokens} />
        </div>
      </div>

      {/* ── Controls ── */}
      <Controls
        program={program}
        onProgramChange={handleProgramChange}
        execState={execSt}
        connectionStatus={connectionStatus}
        onRun={sendRun}
        onStep={sendStep}
        onReset={handleReset}
        lastEventTime={lastEventTime}
      />
    </div>
  );
}

const _unused = useRef; void _unused;
