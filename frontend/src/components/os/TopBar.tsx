import { useState, useEffect } from 'react';

export function TopBar({ activeApp }: { activeApp: string }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (d: Date) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`;
  };

  const formatTime = (d: Date) => {
    let h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: 28,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 14px',
      background: 'rgba(255, 255, 255, 0.2)',
      backdropFilter: 'blur(40px) saturate(200%)',
      WebkitBackdropFilter: 'blur(40px) saturate(200%)',
      borderBottom: '1px solid rgba(0,0,0,0.1)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
      fontSize: 13,
      color: '#fff',
      textShadow: '0 1px 2px rgba(0,0,0,0.2)',
      userSelect: 'none',
    }}>
      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* CortexOS Logo */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '2px 6px', borderRadius: 4, cursor: 'default',
        }}
        className="topbar-item"
        >
          <span style={{ fontSize: 14 }}>🧠</span>
          <span style={{ fontWeight: 600, letterSpacing: '0.02em' }}>CortexOS</span>
        </div>

        {/* Active app name */}
        <span style={{
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: 4,
        }}
        className="topbar-item"
        >
          {activeApp || 'Desktop'}
        </span>
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Connection indicator */}
        <div className="topbar-item" style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '2px 6px', borderRadius: 4,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#30d158',
            boxShadow: '0 0 6px rgba(48,209,88,0.5)',
          }} />
          <span style={{ fontSize: 11 }}>System Active</span>
        </div>

        {/* Date & Time */}
        <div className="topbar-item" style={{
          display: 'flex', gap: 8,
          padding: '2px 6px', borderRadius: 4,
        }}>
          <span>{formatDate(time)}</span>
          <span style={{ fontWeight: 500 }}>{formatTime(time)}</span>
        </div>
      </div>
    </div>
  );
}
