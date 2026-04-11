import { useEffect, useRef } from 'react';
import type { ExecutionEvent, Instruction } from '../types';

interface Props { execState: ExecutionEvent | null }

export function BytecodePanel({ execState }: Props) {
  const instructions  = execState?.instructions  ?? [];
  const currentIndex  = execState?.currentIndex  ?? -1;
  const activeRef     = useRef<HTMLDivElement | null>(null);

  // Auto-scroll active row to center
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [currentIndex]);

  return (
    <div style={{
      flex: 1,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-panel)',
    }}>
      {/* Header */}
      <div className="panel-header">
        <span className="panel-label">Bytecode</span>
        <span className="panel-badge">{instructions.length} OPS</span>
      </div>

      {/* Instruction list */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {instructions.length === 0 ? (
          <EmptyBytecode />
        ) : (
          instructions.map((instr, idx) => (
            <InstrRow
              key={instr.index}
              instr={instr}
              isActive={instr.index === currentIndex}
              showDivider={idx > 0 && idx % 5 === 0}
              ref={instr.index === currentIndex ? activeRef : null}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface RowProps {
  instr: Instruction;
  isActive: boolean;
  showDivider: boolean;
  ref: React.Ref<HTMLDivElement>;
}

import { forwardRef } from 'react';

const InstrRow = forwardRef<HTMLDivElement, Omit<RowProps,'ref'>>(
  ({ instr, isActive, showDivider }, ref) => {
    return (
      <div
        ref={ref}
        className={isActive ? 'instr-row-active' : ''}
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 34,
          borderLeft: isActive
            ? '2px solid var(--amber)'
            : '2px solid transparent',
          background: isActive
            ? 'linear-gradient(90deg, rgba(245,158,11,0.08) 0%, transparent 60%)'
            : 'transparent',
          borderBottom: showDivider
            ? '1px dashed rgba(14,165,233,0.08)'
            : 'none',
          transition: 'background 0.2s ease, border-color 0.2s ease',
          cursor: 'default',
        }}
      >
        {/* Offset */}
        <div style={{
          width: 56,
          flexShrink: 0,
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: isActive ? 'rgba(245,158,11,0.5)' : 'var(--text-3)',
          textAlign: 'right',
          paddingRight: 10,
          letterSpacing: '0.02em',
        }}>
          {`0x${instr.offset.toString(16).padStart(4, '0').toUpperCase()}`}
        </div>

        {/* Thin gutter bar */}
        <div style={{
          width: 1,
          height: 18,
          background: isActive ? 'var(--amber)' : 'var(--border)',
          flexShrink: 0,
          borderRadius: 1,
          marginRight: 10,
          transition: 'background 0.2s ease',
          boxShadow: isActive ? '0 0 6px rgba(245,158,11,0.5)' : 'none',
        }} />

        {/* Index pill */}
        <div style={{
          width: 26,
          flexShrink: 0,
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: isActive ? 'var(--amber)' : 'var(--text-3)',
          paddingRight: 8,
          textAlign: 'right',
          transition: 'color 0.2s ease',
        }}>
          {instr.index}
        </div>

        {/* Opcode */}
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          fontWeight: isActive ? 700 : 400,
          color: isActive ? 'var(--amber)' : 'var(--text-1)',
          letterSpacing: '0.03em',
          textShadow: isActive ? '0 0 10px rgba(245,158,11,0.55)' : 'none',
          transition: 'all 0.2s ease',
          flexShrink: 0,
        }}>
          {instr.opcode}
        </span>

        {/* Operand */}
        {instr.operand !== undefined && (
          <span style={{
            marginLeft: 10,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: isActive ? 'rgba(245,158,11,0.65)' : 'var(--text-2)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            transition: 'color 0.2s ease',
          }}>
            {String(instr.operand)}
          </span>
        )}

        {/* Active arrow */}
        {isActive && (
          <span style={{
            marginLeft: 'auto',
            paddingRight: 12,
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            color: 'var(--amber)',
            textShadow: '0 0 10px rgba(245,158,11,0.8)',
            animation: 'breatheGlow 1.2s ease-in-out infinite',
            flexShrink: 0,
          }}>▶</span>
        )}
      </div>
    );
  }
);

function EmptyBytecode() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      gap: 12,
      animation: 'dimBreath 3s ease-in-out infinite',
    }}>
      {/* ASCII art brackets */}
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--text-3)',
        lineHeight: 1.5,
        textAlign: 'center',
        letterSpacing: '0.1em',
      }}>
        <div>┌ ─ ─ ─ ─ ─ ─ ─ ┐</div>
        <div style={{ letterSpacing: '0.06em', margin: '4px 0', color: 'var(--text-2)' }}>  NO PROGRAM  </div>
        <div>└ ─ ─ ─ ─ ─ ─ ─ ┘</div>
      </div>
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: 8,
        letterSpacing: '0.2em',
        color: 'var(--text-3)',
      }}>CONNECT TO LOAD</span>
    </div>
  );
}
