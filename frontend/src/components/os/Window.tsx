import { useCallback, useRef, type ReactNode } from 'react';
import type { WindowState } from './WindowManager';

interface WindowProps {
  state: WindowState;
  onClose: (id: string) => void;
  onMinimize: (id: string) => void;
  onMaximize: (id: string) => void;
  onFocus: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onResize: (id: string, w: number, h: number) => void;
  children: ReactNode;
}

export function Window({
  state, onClose, onMinimize, onMaximize, onFocus, onMove, onResize, children,
}: WindowProps) {
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number; origX: number; origY: number } | null>(null);
  const windowRef = useRef<HTMLDivElement>(null);

  const handleMouseDownDrag = useCallback((e: React.MouseEvent) => {
    if (state.isMaximized) return;
    e.preventDefault();
    onFocus(state.id);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: state.x,
      origY: state.y,
    };

    const handleMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      onMove(state.id, dragRef.current.origX + dx, dragRef.current.origY + dy);
    };

    const handleUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [state.id, state.x, state.y, state.isMaximized, onFocus, onMove]);

  const handleMouseDownResize = useCallback((e: React.MouseEvent) => {
    if (state.isMaximized) return;
    e.preventDefault();
    e.stopPropagation();
    onFocus(state.id);
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origW: state.width,
      origH: state.height,
      origX: state.x,
      origY: state.y,
    };

    const handleMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const dx = ev.clientX - resizeRef.current.startX;
      const dy = ev.clientY - resizeRef.current.startY;
      const newW = Math.max(state.minWidth, resizeRef.current.origW + dx);
      const newH = Math.max(state.minHeight, resizeRef.current.origH + dy);
      onResize(state.id, newW, newH);
    };

    const handleUp = () => {
      resizeRef.current = null;
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [state.id, state.width, state.height, state.minWidth, state.minHeight, state.isMaximized, onFocus, onResize]);

  if (!state.isOpen) return null;

  const isMax = state.isMaximized;
  const x = isMax ? 0 : state.x;
  const y = isMax ? 28 : state.y;  // 28 = topbar height
  const w = isMax ? window.innerWidth : state.width;
  const h = isMax ? window.innerHeight - 28 - 72 : state.height;  // 72 = dock area

  return (
    <div
      ref={windowRef}
      onMouseDown={() => onFocus(state.id)}
      className={`window-container ${state.isMinimized ? 'window-minimized' : 'window-open'}`}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        width: w,
        height: h,
        zIndex: state.zIndex,
        display: state.isMinimized ? 'none' : 'flex',
        flexDirection: 'column',
        borderRadius: isMax ? 0 : 10,
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 1px rgba(255,255,255,0.1)',
        border: isMax ? 'none' : '1px solid rgba(255,255,255,0.08)',
        transition: isMax ? 'all 0.25s cubic-bezier(0.4,0,0.2,1)' : 'box-shadow 0.2s',
      }}
    >
      {/* ── Title Bar ── */}
      <div
        onMouseDown={handleMouseDownDrag}
        onDoubleClick={() => onMaximize(state.id)}
        style={{
          height: 32,
          minHeight: 32,
          background: 'rgba(30, 30, 30, 0.4)',
          backdropFilter: 'blur(20px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          cursor: isMax ? 'default' : 'grab',
          userSelect: 'none',
          borderBottom: '1px solid rgba(0,0,0,0.3)',
        }}
      >
        <div className="traffic-lights" style={{
          position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
          display: 'flex', gap: 7,
        }}>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(state.id); }}
            className="traffic-btn traffic-close"
            title="Close"
          >
            <svg width="6" height="6" viewBox="0 0 6 6" className="traffic-icon">
              <path d="M0 0L6 6M6 0L0 6" stroke="rgba(0,0,0,0.6)" strokeWidth="1.2" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onMinimize(state.id); }}
            className="traffic-btn traffic-minimize"
            title="Minimize"
          >
            <svg width="6" height="1" viewBox="0 0 6 1" className="traffic-icon">
              <path d="M0 0.5H6" stroke="rgba(0,0,0,0.6)" strokeWidth="1.2" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onMaximize(state.id); }}
            className="traffic-btn traffic-maximize"
            title="Full Screen"
          >
            <svg width="6" height="6" viewBox="0 0 6 6" className="traffic-icon">
              <path d="M1 1H5V5H1V1Z" fill="rgba(0,0,0,0.6)" />
              <path d="M5.5 0.5L0.5 5.5" stroke="rgba(0,0,0,0.6)" strokeWidth="1" />
            </svg>
          </button>
        </div>

        {/* Title */}
        <span style={{
          fontSize: 12,
          fontWeight: 500,
          color: 'rgba(255,255,255,0.7)',
          letterSpacing: '0.02em',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
        }}>
          {state.title}
        </span>
      </div>

      {/* ── Content ── */}
      <div style={{
        flex: 1,
        overflow: 'hidden',
        background: '#1c1c1e',
        position: 'relative',
      }}>
        {children}
      </div>

      {/* ── Resize Handle ── */}
      {!isMax && (
        <div
          onMouseDown={handleMouseDownResize}
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: 16,
            height: 16,
            cursor: 'se-resize',
            zIndex: 10,
          }}
        />
      )}
    </div>
  );
}
