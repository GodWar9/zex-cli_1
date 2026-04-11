import { useRef, useState, useEffect } from 'react';
import type { StackFrame } from '../types';

interface Props { stack: StackFrame[] }

const MAX_DEPTH = 16;

const TYPE_STYLE: Record<StackFrame['type'], {
  border: string; bg: string; color: string; glow: string;
}> = {
  int:  { border: 'var(--blue-border)',   bg: 'var(--blue-dim)',   color: 'var(--blue)',   glow: 'rgba(14,165,233,0.3)'  },
  str:  { border: 'var(--teal-border)',   bg: 'var(--teal-dim)',   color: 'var(--teal)',   glow: 'rgba(20,184,166,0.3)'  },
  ref:  { border: 'var(--purple-border)', bg: 'var(--purple-dim)', color: 'var(--purple)', glow: 'rgba(167,139,250,0.3)' },
  bool: { border: 'var(--amber-border)',  bg: 'var(--amber-dim)',  color: 'var(--amber)',  glow: 'rgba(245,158,11,0.3)'  },
};

export function StackVisualiser({ stack }: Props) {
  const fillPct   = Math.min((stack.length / MAX_DEPTH) * 100, 100);
  const prevStack = useRef<StackFrame[]>([]);

  // Track IDs to detect newly added frames
  const prevIds   = new Set(prevStack.current.map(f => f.id));
  useEffect(() => { prevStack.current = stack; }, [stack]);

  return (
    <div style={{
      height: 280,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-panel)',
      borderTop: '1px solid var(--border)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div className="panel-header">
        <span className="panel-label">Stack</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 48,
            height: 4,
            background: 'var(--bg-elevated)',
            borderRadius: 2,
            overflow: 'hidden',
            border: '1px solid var(--border)',
          }}>
            <div style={{
              height: '100%',
              width: `${fillPct}%`,
              background: fillPct > 75
                ? 'var(--red)'
                : fillPct > 50
                  ? 'var(--amber)'
                  : 'var(--teal)',
              borderRadius: 2,
              transition: 'width 0.3s ease, background 0.3s ease',
              boxShadow: '0 0 4px currentColor',
            }} />
          </div>
          <span className="panel-badge">DEPTH: {stack.length}</span>
        </div>
      </div>

      {/* Frame area — grows upward */}
      <div style={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column-reverse',
        alignItems: 'center',
        gap: 5,
        padding: '8px 40px 8px 16px',
        position: 'relative',
      }}>
        {stack.length === 0 ? (
          <EmptyStack />
        ) : (
          [...stack].reverse().map((frame, reverseIdx) => {
            const stackIdx = stack.length - 1 - reverseIdx;
            const isNew    = !prevIds.has(frame.id);
            return (
              <FrameBlock
                key={frame.id}
                frame={frame}
                index={stackIdx}
                isNew={isNew}
                isTop={stackIdx === stack.length - 1}
              />
            );
          })
        )}
      </div>

      {/* Right depth meter bar */}
      <div style={{
        position: 'absolute',
        right: 0,
        top: 38,    /* below header */
        bottom: 0,
        width: 8,
        background: 'rgba(14,165,233,0.04)',
        borderLeft: '1px solid var(--border)',
      }}>
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: `${fillPct}%`,
          background: fillPct > 75
            ? 'linear-gradient(0deg, var(--red), rgba(239,68,68,0.4))'
            : fillPct > 50
              ? 'linear-gradient(0deg, var(--amber), rgba(245,158,11,0.4))'
              : 'linear-gradient(0deg, var(--teal), rgba(20,184,166,0.4))',
          transition: 'height 0.35s ease, background 0.3s ease',
          borderRadius: '2px 2px 0 0',
        }} />
      </div>
    </div>
  );
}

function FrameBlock({
  frame, index, isNew, isTop
}: { frame: StackFrame; index: number; isNew: boolean; isTop: boolean }) {
  const s = TYPE_STYLE[frame.type];

  return (
    <div
      className={isNew ? 'stack-frame' : ''}
      style={{
        width: '100%',
        height: 38,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 10,
        paddingRight: 10,
        border: `1px solid ${s.border}`,
        background: s.bg,
        borderRadius: 3,
        position: 'relative',
        boxShadow: isTop ? `0 0 12px ${s.glow}, inset 0 0 8px ${s.glow}` : 'none',
        transition: 'box-shadow 0.3s ease',
      }}
    >
      {/* Index badge */}
      <span style={{
        position: 'absolute',
        top: 2,
        left: 5,
        fontFamily: 'var(--font-mono)',
        fontSize: 8,
        color: 'var(--text-3)',
        letterSpacing: '0.04em',
      }}>[{index}]</span>

      {/* Label */}
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        color: 'var(--text-2)',
        flex: 1,
        marginTop: 6,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>{frame.label}</span>

      {/* Type tag */}
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: 7,
        letterSpacing: '0.12em',
        color: s.color,
        marginRight: 8,
        marginTop: 6,
        flexShrink: 0,
        opacity: 0.75,
      }}>{frame.type.toUpperCase()}</span>

      {/* Value */}
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        fontWeight: 700,
        color: s.color,
        marginTop: 6,
        flexShrink: 0,
        textShadow: `0 0 8px ${s.glow}`,
      }}>{String(frame.value)}</span>
    </div>
  );
}

function EmptyStack() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      animation: 'dimBreath 3s ease-in-out infinite',
    }}>
      {/* Mini stack diagram */}
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 80,
          height: 14,
          border: '1px dashed rgba(14,165,233,0.12)',
          borderRadius: 2,
          opacity: 1 - i * 0.25,
        }} />
      ))}
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: 8,
        letterSpacing: '0.2em',
        color: 'var(--text-3)',
        marginTop: 4,
      }}>STACK EMPTY</span>
    </div>
  );
}

// need useState, useEffect import — already imported above via useRef
const _unused = useState; void _unused;
const _unused2 = useEffect; void _unused2;
