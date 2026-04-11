import { useState } from 'react';
import type { ExecState, Program } from '../types';

interface Props {
  program: Program;
  onProgramChange: (p: Program) => void;
  execState: ExecState;
  connectionStatus: string;
  onRun: () => void;
  onStep: () => void;
  onReset: () => void;
  lastEventTime: number | null;
}

const PROGRAMS: { value: Program; label: string }[] = [
  { value: 'fibonacci',         label: 'fibonacci'         },
  { value: 'bubble_sort',       label: 'bubble_sort'       },
  { value: 'infinite_loop_bug', label: 'infinite_loop_bug' },
];

export function Controls({
  program, onProgramChange, execState, connectionStatus,
  onRun, onStep, onReset, lastEventTime,
}: Props) {
  const isRunning   = execState === 'running';
  const isConnected = connectionStatus === 'connected';
  const msSince     = lastEventTime != null ? Date.now() - lastEventTime : null;

  return (
    <footer style={{
      height: 56,
      background: 'var(--bg-surface)',
      borderTop: '1px solid var(--border)',
      padding: '0 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      flexShrink: 0,
      position: 'relative',
      zIndex: 10,
      boxShadow: 'inset 0 -1px 0 rgba(14,165,233,0.06)',
    }}>

      {/* Program selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: 8,
          letterSpacing: '0.2em',
          color: 'var(--text-2)',
        }}>PROGRAM</span>
        <div style={{ position: 'relative' }}>
          <select
            className="program-select"
            value={program}
            onChange={e => {
              onProgramChange(e.target.value as Program);
              onReset();
            }}
          >
            {PROGRAMS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          {/* Chevron */}
          <svg
            style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            width="9" height="5" viewBox="0 0 9 5" fill="none"
          >
            <path d="M1 1L4.5 4.5L8 1" stroke="var(--blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 26, background: 'var(--border-mid)' }} />

      {/* Buttons */}
      <button
        className="btn btn-run"
        onClick={onRun}
        disabled={!isConnected}
      >
        {isRunning ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--teal)',
              display: 'inline-block',
              animation: 'pulseRingTeal 1.4s ease-out infinite',
            }} />
            RUNNING
          </span>
        ) : '▶  RUN'}
      </button>

      <button
        className="btn btn-step"
        onClick={onStep}
        disabled={!isConnected || isRunning}
      >
        ⏭  STEP
      </button>

      <button
        className="btn btn-reset"
        onClick={onReset}
        disabled={!isConnected}
      >
        ↺  RESET
      </button>

      {/* Right side — latency + status */}
      <div style={{
        marginLeft: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: 20,
      }}>
        {msSince != null && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 7, letterSpacing: '0.18em', color: 'var(--text-3)' }}>LAST EVENT</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>{msSince}ms</span>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 7, letterSpacing: '0.18em', color: 'var(--text-3)' }}>STATUS</span>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 9,
            letterSpacing: '0.15em',
            color: isConnected ? 'var(--teal)' : 'var(--text-2)',
          }}>
            {connectionStatus.toUpperCase()}
          </span>
        </div>
      </div>
    </footer>
  );
}

// suppress unused warning
const _s = useState; void _s;
