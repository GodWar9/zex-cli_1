import { useState, useRef, useCallback } from 'react';

interface DockApp {
  id: string;
  title: string;
  icon: string;
  color: string;
}

interface DockProps {
  apps: DockApp[];
  onLaunch: (id: string) => void;
  isOpen: (id: string) => boolean;
}

export function Dock({ apps, onLaunch, isOpen }: DockProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const dockRef = useRef<HTMLDivElement>(null);

  const getScale = useCallback((index: number): number => {
    if (hoveredIndex === null) return 1;
    const distance = Math.abs(index - hoveredIndex);
    if (distance === 0) return 1.45;
    if (distance === 1) return 1.25;
    if (distance === 2) return 1.1;
    return 1;
  }, [hoveredIndex]);

  const getTranslateY = useCallback((index: number): number => {
    if (hoveredIndex === null) return 0;
    const distance = Math.abs(index - hoveredIndex);
    if (distance === 0) return -14;
    if (distance === 1) return -8;
    if (distance === 2) return -3;
    return 0;
  }, [hoveredIndex]);

  return (
    <div style={{
      position: 'fixed',
      bottom: 6,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
    }}>
      <div
        ref={dockRef}
        onMouseLeave={() => setHoveredIndex(null)}
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 32,
          padding: '12px 100px 10px',
          background: 'rgba(255, 255, 255, 0.25)',
          backdropFilter: 'blur(50px) saturate(200%)',
          WebkitBackdropFilter: 'blur(40px) saturate(200%)',
          borderRadius: 22,
          border: '1px solid rgba(255,255,255,0.3)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.4)',
        }}
      >
        {apps.map((app, index) => {
          const scale = getScale(index);
          const translateY = getTranslateY(index);
          const open = isOpen(app.id);

          return (
            <div
              key={app.id}
              onMouseEnter={() => setHoveredIndex(index)}
              onClick={() => onLaunch(app.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              {/* Tooltip */}
              <div
                className="dock-tooltip"
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  marginBottom: 6 + Math.abs(translateY),
                  padding: '4px 10px',
                  background: 'rgba(30,30,30,0.9)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.9)',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  opacity: hoveredIndex === index ? 1 : 0,
                  transform: `translateY(${hoveredIndex === index ? 0 : 4}px)`,
                  transition: 'opacity 0.15s, transform 0.15s',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                {app.title}
              </div>

              {/* Icon */}
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 26,
                  background: `linear-gradient(145deg, ${app.color}dd, ${app.color}88)`,
                  boxShadow: `0 4px 12px ${app.color}33, inset 0 1px 0 rgba(255,255,255,0.2)`,
                  transform: `scale(${scale}) translateY(${translateY}px)`,
                  transition: 'transform 0.2s cubic-bezier(0.4,0,0.2,1)',
                  userSelect: 'none',
                }}
              >
                {app.icon}
              </div>

              {/* Active dot */}
              <div style={{
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: open ? 'rgba(255,255,255,0.8)' : 'transparent',
                marginTop: 3,
                transition: 'background 0.2s',
              }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
