import { TopBar } from './TopBar';
import { Dock } from './Dock';
import { Window } from './Window';
import { useWindowManager, type WindowConfig } from './WindowManager';
import { VMApp } from '../apps/VMApp';
import { SchedulerApp } from '../apps/SchedulerApp';
import { ShellApp } from '../apps/ShellApp';
import { MonitorApp } from '../apps/MonitorApp';

const DOCK_APPS = [
  { id: 'vm', title: 'CortexVM', icon: '⚡', color: '#0a84ff' },
  { id: 'scheduler', title: 'Scheduler', icon: '📊', color: '#bf5af2' },
  { id: 'shell', title: 'CortexShell', icon: '💬', color: '#30d158' },
  { id: 'monitor', title: 'Sentinel', icon: '🛡️', color: '#ff453a' },
];

const WINDOW_CONFIGS: Record<string, WindowConfig> = {
  vm: { id: 'vm', title: 'CortexVM — Simulator', icon: '⚡', defaultWidth: 1000, defaultHeight: 650, minWidth: 700, minHeight: 450 },
  scheduler: { id: 'scheduler', title: 'CortexScheduler', icon: '📊', defaultWidth: 1000, defaultHeight: 650, minWidth: 700, minHeight: 450 },
  shell: { id: 'shell', title: 'CortexShell', icon: '💬', defaultWidth: 600, defaultHeight: 500, minWidth: 400, minHeight: 350 },
  monitor: { id: 'monitor', title: 'CortexSentinel — Monitor', icon: '🛡️', defaultWidth: 700, defaultHeight: 500, minWidth: 500, minHeight: 350 },
};

function getAppContent(id: string) {
  switch (id) {
    case 'vm': return <VMApp />;
    case 'scheduler': return <SchedulerApp />;
    case 'shell': return <ShellApp />;
    case 'monitor': return <MonitorApp />;
    default: return null;
  }
}

export function Desktop() {
  const {
    windows, openWindow, closeWindow, minimizeWindow, maximizeWindow,
    focusWindow, updateWindowPosition, updateWindowSize, isWindowOpen,
  } = useWindowManager();

  const handleLaunch = (id: string) => {
    const config = WINDOW_CONFIGS[id];
    if (config) openWindow(config);
  };

  // Find the topmost focused window for the TopBar label
  const topWindow = windows
    .filter(w => w.isOpen && !w.isMinimized)
    .sort((a, b) => b.zIndex - a.zIndex)[0];

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      position: 'relative',
      background: 'linear-gradient(135deg, #0a0a0f 0%, #0d1117 30%, #161b22 60%, #0d1117 100%)',
    }}>
      {/* Subtle grid pattern */}
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.015) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* Ambient glow */}
      <div style={{
        position: 'fixed',
        top: '30%',
        left: '50%',
        width: 600,
        height: 600,
        transform: 'translate(-50%, -50%)',
        background: 'radial-gradient(circle, rgba(10,132,255,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* TopBar */}
      <TopBar activeApp={topWindow?.title || ''} />

      {/* Windows */}
      {windows.map(w => (
        <Window
          key={w.id}
          state={w}
          onClose={closeWindow}
          onMinimize={minimizeWindow}
          onMaximize={maximizeWindow}
          onFocus={focusWindow}
          onMove={updateWindowPosition}
          onResize={updateWindowSize}
        >
          {getAppContent(w.id)}
        </Window>
      ))}

      {/* Dock */}
      <Dock
        apps={DOCK_APPS}
        onLaunch={handleLaunch}
        isOpen={isWindowOpen}
      />
    </div>
  );
}
