import { useEffect, useRef } from 'react';
import type { NarrationToken } from '../types';

interface Props { narrationTokens: NarrationToken[] }

const TAG_STYLE: Record<string, React.CSSProperties> = {
  intent:  { color: '#60a5fa', textShadow: '0 0 8px rgba(96,165,250,0.45)' },
  step:    { color: 'var(--text-1)' },
  warning: { color: 'var(--amber)', textShadow: '0 0 8px rgba(245,158,11,0.4)' },
  error:   { color: 'var(--red)',   textShadow: '0 0 8px rgba(239,68,68,0.4)'  },
  plain:   { color: 'var(--text-0)' },
};

const LEGEND = [
  { tag: 'intent',  label: 'INTENT',  color: '#60a5fa'       },
  { tag: 'step',    label: 'STEP',    color: 'var(--text-1)' },
  { tag: 'warning', label: 'WARNING', color: 'var(--amber)'  },
  { tag: 'error',   label: 'ERROR',   color: 'var(--red)'    },
];

export function NarrationPanel({ narrationTokens }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new tokens
  useEffect(() => {
    if (bodyRef.current)
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [narrationTokens.length]);

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-panel)',
    }}>
      {/* Header */}
      <div className="panel-header">
        <span className="panel-label">AI Narration</span>
        <span className="panel-badge">{narrationTokens.length} TOKENS</span>
      </div>

      {/* Tag legend */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        padding: '6px 14px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        background: 'rgba(5,14,26,0.6)',
      }}>
        {LEGEND.map(({ tag, label, color }) => (
          <div key={tag} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              width: 5, height: 5,
              borderRadius: '50%',
              background: color,
              display: 'block',
              flexShrink: 0,
              boxShadow: `0 0 5px ${color}`,
            }} />
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: 7,
              letterSpacing: '0.18em',
              color,
              opacity: 0.8,
            }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Token body */}
      <div
        ref={bodyRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 18px',
          lineHeight: 2,
          fontFamily: 'var(--font-mono)',
          fontSize: 11.5,
          letterSpacing: '0.02em',
        }}
      >
        {narrationTokens.length === 0 ? (
          <EmptyNarration />
        ) : (
          <>
            {narrationTokens.map(token => (
              <span
                key={token.id}
                className="nar-token"
                style={TAG_STYLE[token.tag] ?? TAG_STYLE.plain}
              >
                {token.text}
              </span>
            ))}
            {/* Blinking block cursor */}
            <span style={{
              display: 'inline-block',
              width: 7,
              height: 13,
              background: 'var(--text-2)',
              verticalAlign: 'middle',
              marginLeft: 2,
              borderRadius: 1,
              animation: 'blink 1s step-end infinite',
            }} />
          </>
        )}
      </div>
    </div>
  );
}

function EmptyNarration() {
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      animation: 'dimBreath 3s ease-in-out infinite',
    }}>
      {/* Waveform placeholder */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 28 }}>
        {[0.3, 0.6, 1, 0.75, 0.45, 0.85, 0.5, 0.35, 0.9, 0.6].map((h, i) => (
          <div
            key={i}
            style={{
              width: 3,
              height: `${h * 28}px`,
              background: 'var(--text-3)',
              borderRadius: 2,
              opacity: 0.4 + h * 0.3,
            }}
          />
        ))}
      </div>
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: 8,
        letterSpacing: '0.22em',
        color: 'var(--text-3)',
      }}>AWAITING NARRATION FEED</span>
    </div>
  );
}
