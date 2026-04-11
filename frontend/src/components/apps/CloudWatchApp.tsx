import React, { useEffect, useState, useRef } from 'react';
import { useGame } from '../../context/GameContext';

export function CloudWatchApp() {
  const { gameState, scenario, timeElapsed } = useGame();
  const [logs, setLogs] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (gameState !== 'PLAYING' || !scenario) return;

    // Simulate logs trailing a bit from time elapsed (or random generic logs)
    const newLogs: any[] = [];
    
    // Add fake ambient logs periodically
    if (timeElapsed % 5 === 0) {
      newLogs.push({ time: timeElapsed, level: 'INFO', msg: `Connection tracking table update - flush_count=12` });
    }

    // Add attacker logs slightly before threat feed if desired
    scenario.attacker_sequence.forEach((attack: any) => {
      if (attack.at_second === timeElapsed) {
        newLogs.push({ time: timeElapsed, level: 'WARN', msg: `Unusual activity detected: ${attack.action}` });
      }
    });

    if (newLogs.length > 0) {
      setLogs(prev => [...prev, ...newLogs]);
    }
  }, [timeElapsed, gameState, scenario]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: '#fff', background: '#000', fontFamily: 'monospace' }}>
      <div style={{ padding: '16px', background: '#111', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: '16px', color: '#0a84ff' }}>CloudWatch Live Logs</h2>
        <div style={{ fontSize: '13px', color: '#aaa' }}>Region: us-east-1</div>
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', fontSize: '13px', lineHeight: '1.6' }}>
        <div style={{ color: '#666', marginBottom: '8px' }}>[SYSTEM] Tail starting...</div>
        {logs.map((log, i) => {
          let color = '#ccc';
          if (log.level === 'WARN') color = '#ffcc00';
          if (log.level === 'ERROR') color = '#ff453a';
          if (log.level === 'CRITICAL') color = '#ff453a';

          return (
            <div key={i} style={{ marginBottom: '4px' }}>
              <span style={{ color: '#888' }}>[{Math.floor(log.time / 60)}:{(log.time % 60).toString().padStart(2, '0')}]</span>{' '}
              <span style={{ color, fontWeight: log.level === 'CRITICAL' ? 'bold' : 'normal' }}>{log.level}</span>{' '}
              <span style={{ color: '#eee' }}>— {log.msg}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
