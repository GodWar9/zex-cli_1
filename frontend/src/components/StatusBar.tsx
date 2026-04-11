import { useState, useEffect, useRef } from 'react';
import type { ExecutionEvent } from '../types';
import type { ConnectionStatus } from '../hooks/useVM';

interface Props {
  execState: ExecutionEvent | null;
  connectionStatus: ConnectionStatus;
}

const STATE_CONFIG = {
  idle:     { label: 'IDLE',     color: 'var(--text-2)',  glow: 'none'  },
  running:  { label: 'RUNNING',  color: 'var(--teal)',    glow: 'var(--glow-teal)', pulse: true },
  stepping: { label: 'STEPPING', color: 'var(--amber)',   glow: 'var(--glow-amber)' },
  paused:   { label: 'PAUSED',   color: 'var(--amber)',   glow: 'var(--glow-amber)' },
  error:    { label: 'ERROR',    color: 'var(--red)',     glow: 'var(--glow-red)'  },
  done:     { label: 'DONE',     color: 'var(--blue)',    glow: 'var(--glow-blue)' },
} as const;

const CONN_CONFIG = {
  connecting:   { label: 'CONNECTING',   color: 'var(--amber)', anim: true,  dotAnim: 'pulseRingAmber' },
  connected:    { label: 'CONNECTED',    color: 'var(--teal)',  anim: true,  dotAnim: 'pulseRingTeal'  },
  disconnected: { label: 'DISCONNECTED', color: 'var(--text-3)',anim: false, dotAnim: 'none'           },
  error:        { label: 'ERROR',        color: 'var(--red)',   anim: false, dotAnim: 'none'           },
} as const;

// Animated counter — plays a quick translateY when value changes
function AnimatedMetric({ label, value }: { label: string; value: string }) {
  const [key, setKey] = useState(0);
  const prev = useRef(value);
  useEffect(() => {
    if (value !== prev.current) { setKey(k => k + 1); prev.current = value; }
  }, [value]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 64 }}>
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: 8,
        letterSpacing: '0.2em',
        color: 'var(--text-2)',
        textTransform: 'uppercase',
      }}>{label}</span>
      <span
        key={key}
        className="metric-val"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--text-0)',
          letterSpacing: '0.04em',
        }}
      >{value}</span>
    </div>
  );
}

export function StatusBar({ execState, connectionStatus }: Props) {
  const state  = execState?.state ?? 'idle';
  const stConf = STATE_CONFIG[state];
  const cnConf = CONN_CONFIG[connectionStatus];

  const opcode  = execState?.opcode           ?? '—';
  const current = execState?.currentIndex     ?? 0;
  const total   = execState?.instructionCount ?? 0;
  const depth   = execState?.stack.length     ?? 0;

  return (
    <header style={{
      height: 52,
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: 24,
      flexShrink: 0,
      position: 'relative',
      zIndex: 10,
      /* top inner glow */
      boxShadow: 'inset 0 1px 0 rgba(14,165,233,0.15), 0 1px 0 var(--border)',
    }}>

      {/* ── Brand ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {/* Hex icon */}
        <HexIcon />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: '0.25em',
            color: 'var(--text-0)',
          }}>CORTEX</span>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 7,
            letterSpacing: '0.2em',
            color: 'var(--text-2)',
          }}>VM DEBUGGER</span>
        </div>
      </div>

      {/* thin separator */}
      <div style={{ width: 1, height: 28, background: 'var(--border-mid)', flexShrink: 0 }} />

      {/* ── Metrics ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 28, flex: 1 }}>
        <AnimatedMetric label="OPCODE"      value={opcode} />
        <AnimatedMetric label="INSTRUCTION" value={`${current} / ${total}`} />
        <AnimatedMetric label="STACK DEPTH" value={String(depth)} />

        {/* State badge */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 8,
            letterSpacing: '0.2em',
            color: 'var(--text-2)',
            textTransform: 'uppercase',
          }}>STATE</span>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: stConf.color,
            animation: 'breatheGlow 2.5s ease-in-out infinite',
            textShadow: stConf.glow !== 'none' ? `0 0 10px ${stConf.color}` : 'none',
          }}>{stConf.label}</span>
        </div>
      </div>

      {/* ── Connection ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{
          width: 7, height: 7,
          borderRadius: '50%',
          background: cnConf.color,
          display: 'block',
          animation: cnConf.anim
            ? `${cnConf.dotAnim} 1.6s ease-out infinite`
            : 'none',
          flexShrink: 0,
        }} />
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          letterSpacing: '0.12em',
          color: cnConf.color,
        }}>{cnConf.label}</span>
      </div>
    </header>
  );
}

function HexIcon() {
  return (
    <svg width="28" height="26" viewBox="0 0 28 26" fill="none">
      <polygon
        points="14,1 26,7.5 26,18.5 14,25 2,18.5 2,7.5"
        stroke="rgba(14,165,233,0.5)"
        strokeWidth="1"
        fill="rgba(14,165,233,0.06)"
      />
      <polygon
        points="14,5 22,9.5 22,16.5 14,21 6,16.5 6,9.5"
        stroke="rgba(14,165,233,0.25)"
        strokeWidth="1"
        fill="none"
      />
      <circle cx="14" cy="13" r="2.5" fill="var(--blue)" opacity="0.8" style={{ filter: 'drop-shadow(0 0 4px var(--blue))' }} />
    </svg>
  );
}
