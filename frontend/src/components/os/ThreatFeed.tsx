import React, { useEffect, useState } from 'react';
import { useGame } from '../../context/GameContext';

export function ThreatFeed() {
  const { gameState, scenario, timeElapsed, markAttacked } = useGame();
  const [feedItems, setFeedItems] = useState<any[]>([]);

  useEffect(() => {
    if (gameState !== 'PLAYING' || !scenario) return;

    scenario.attacker_sequence.forEach(attack => {
      if (attack.at_second === timeElapsed) {
        // Fire attack event visually
        setFeedItems(prev => [...prev, { time: timeElapsed, action: attack.action, vuln_target: attack.targets_vuln }]);
        // Record it logically
        if(attack.targets_vuln) {
           markAttacked(attack.targets_vuln);
        }
      }
    });
  }, [timeElapsed, gameState, scenario, markAttacked]);

  if (gameState === 'IDLE') return null;

  return (
    <div style={{
      position: 'fixed', right: 0, top: 28, bottom: 0, width: '320px',
      background: 'rgba(20,20,20,0.85)', backdropFilter: 'blur(20px)',
      borderLeft: '1px solid rgba(255,255,255,0.1)', zIndex: 9000,
      display: 'flex', flexDirection: 'column', color: 'white', fontFamily: 'system-ui'
    }}>
      <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.5)' }}>
        <h3 style={{ margin: 0, color: '#ff453a', fontSize: '14px', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ display: 'inline-block', width: '8px', height: '8px', background: '#ff453a', borderRadius: '50%' }}></span>
          LIVE THREAT FEED
        </h3>
      </div>
      <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {feedItems.map((item, idx) => (
          <div key={idx} style={{ 
            background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px',
            borderLeft: '3px solid #ff453a', fontSize: '13px', lineHeight: '1.5'
          }}>
            <div style={{ color: '#aaa', marginBottom: '4px', fontSize: '11px' }}>
              {Math.floor(item.time / 60)}:{(item.time % 60).toString().padStart(2, '0')}
            </div>
            {item.action}
          </div>
        ))}
        {feedItems.length === 0 && (
          <div style={{ color: '#666', fontSize: '13px', fontStyle: 'italic' }}>Waiting for threat activity...</div>
        )}
      </div>
    </div>
  );
}
