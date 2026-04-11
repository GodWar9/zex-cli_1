import { TopBar } from './TopBar';
import { Dock } from './Dock';
import { Window } from './Window';
import { useWindowManager, type WindowConfig } from './WindowManager';
import { VMApp } from '../apps/VMApp';
import { EC2App } from '../apps/EC2App';
import { S3App } from '../apps/S3App';
import { SecurityGroupsApp } from '../apps/SecurityGroupsApp';
import { IAMApp } from '../apps/IAMApp';
import { CloudWatchApp } from '../apps/CloudWatchApp';
import { BriefingScreen } from './BriefingScreen';
import { DebriefScreen } from './DebriefScreen';
import { ThreatFeed } from './ThreatFeed';
import { useGame } from '../../context/GameContext';
import { Cpu, Server, HardDrive, Shield, Users, Activity } from 'lucide-react';

const DOCK_APPS = [
  { id: 'vm', title: 'CortexVM', icon: <Cpu size={24} color="#fff" />, color: '#0a84ff' },
  { id: 'ec2', title: 'EC2 Dashboard', icon: <Server size={24} color="#fff" />, color: '#ffcc00' },
  { id: 's3', title: 'S3 Browser', icon: <HardDrive size={24} color="#fff" />, color: '#ff453a' },
  { id: 'sg', title: 'Security Groups', icon: <Shield size={24} color="#fff" />, color: '#30d158' },
  { id: 'iam', title: 'IAM Manager', icon: <Users size={24} color="#fff" />, color: '#bf5af2' },
  { id: 'cloudwatch', title: 'CloudWatch', icon: <Activity size={24} color="#fff" />, color: '#0a84ff' },
];

const WINDOW_CONFIGS: Record<string, WindowConfig> = {
  vm: { id: 'vm', title: 'CortexVM — Simulator', icon: '⚡', defaultWidth: 1000, defaultHeight: 650, minWidth: 700, minHeight: 450 },
  ec2: { id: 'ec2', title: 'EC2 Dashboard', icon: '🖥️', defaultWidth: 800, defaultHeight: 500, minWidth: 600, minHeight: 400 },
  s3: { id: 's3', title: 'S3 Browser', icon: '🪣', defaultWidth: 900, defaultHeight: 600, minWidth: 700, minHeight: 450 },
  sg: { id: 'sg', title: 'Security Groups', icon: '🔒', defaultWidth: 850, defaultHeight: 550, minWidth: 600, minHeight: 450 },
  iam: { id: 'iam', title: 'IAM Manager', icon: '👤', defaultWidth: 800, defaultHeight: 500, minWidth: 600, minHeight: 400 },
  cloudwatch: { id: 'cloudwatch', title: 'CloudWatch Live', icon: '📊', defaultWidth: 800, defaultHeight: 600, minWidth: 600, minHeight: 450 },
};

function getAppContent(id: string) {
  switch (id) {
    case 'vm': return <VMApp />;
    case 'ec2': return <EC2App />;
    case 's3': return <S3App />;
    case 'sg': return <SecurityGroupsApp />;
    case 'iam': return <IAMApp />;
    case 'cloudwatch': return <CloudWatchApp />;
    default: return null;
  }
}

export function Desktop() {
  const { gameState, generateScenario, timeRemaining } = useGame();
  const {
    windows, openWindow, closeWindow, minimizeWindow, maximizeWindow,
    focusWindow, updateWindowPosition, updateWindowSize, isWindowOpen,
  } = useWindowManager();

  const handleLaunch = (id: string) => {
    if (gameState === 'IDLE' && id !== 'vm') {
       generateScenario();
       return;
    }
    if (gameState === 'LOADING' || gameState === 'BRIEFING') {
       return; // Prevent opening apps while generating or reading briefing
    }
    const config = WINDOW_CONFIGS[id];
    if (config) openWindow(config);
  };

  // Find the topmost focused window for the TopBar label
  const topWindow = windows
    .filter(w => w.isOpen && !w.isMinimized)
    .sort((a, b) => b.zIndex - a.zIndex)[0];

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      position: 'relative',
      background: 'linear-gradient(120deg, #184391 0%, #3172e8 25%, #da9052 50%, #f4ca74 75%, #f9e2b1 100%)',
    }}>
      {/* Soft overlay */}
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'linear-gradient(to bottom, rgba(255,255,255,0.05), transparent)',
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

      {gameState === 'IDLE' && (
        <div style={{
          position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%, -50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 100
        }}>
          <h1 style={{ color: 'white', fontSize: '3rem', margin: '0 0 20px', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>CortexOS</h1>
          <button onClick={generateScenario} style={{
             background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', color: 'white',
             border: '1px solid rgba(255,255,255,0.5)', padding: '16px 32px', borderRadius: '12px',
             fontSize: '20px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
          }}>
             Generate New Threat Scenario
          </button>
        </div>
      )}

      {gameState === 'LOADING' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontFamily: 'system-ui'
        }}>
          <h2 style={{ fontSize: '28px', marginBottom: '16px', color: '#0a84ff', animation: 'pulse 1.5s infinite' }}>AI is Mapping the Environment...</h2>
          <p style={{ color: '#aaa', fontSize: '16px' }}>Generating vulnerabilities and attacker sequence via Gemini...</p>
        </div>
      )}

      {/* Overlays */}
      <BriefingScreen />
      <DebriefScreen />
      <ThreatFeed />

      {gameState === 'PLAYING' && (
        <div style={{
          position: 'fixed', top: 40, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.8)', color: timeRemaining < 120 ? '#ff453a' : '#30d158',
          padding: '8px 16px', borderRadius: '20px', fontSize: '24px', fontWeight: 'bold', zIndex: 8999,
          border: `1px solid ${timeRemaining < 120 ? '#ff453a' : '#30d158'}`,
          fontFamily: 'monospace'
        }}>
          {formatTime(timeRemaining)}
        </div>
      )}

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
