import React from 'react';
import { useGame } from '../../context/GameContext';

export function BriefingScreen() {
  const { gameState, scenario, startGame } = useGame();

  if (gameState !== 'BRIEFING' || !scenario) return null;

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 10000,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontFamily: 'system-ui'
    }}>
      <div style={{
        background: '#1a1a1a', border: '1px solid #333', padding: '40px', borderRadius: '12px',
        maxWidth: '600px', width: '100%'
      }}>
        <div style={{ fontSize: '13px', background: '#ff3b30', color: '#fff', padding: '4px 8px', borderRadius: '4px', display: 'inline-block', marginBottom: '16px', fontWeight: 'bold' }}>
          {scenario.type.toUpperCase().replace('_', ' ')}
        </div>
        <h1 style={{ margin: '0 0 16px', fontSize: '28px' }}>{scenario.company}</h1>
        <p style={{ fontSize: '16px', color: '#ccc', lineHeight: '1.6', marginBottom: '16px' }}>
          {scenario.briefing}
        </p>
        <div style={{ background: '#222', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
          <strong style={{ color: '#ffcc00' }}>Stakes:</strong> {scenario.stakes}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            Time Limit: <strong>{Math.floor(scenario.time_limit_seconds / 60)}:{(scenario.time_limit_seconds % 60).toString().padStart(2, '0')}</strong>
          </div>
          <button onClick={startGame} style={{
            background: '#ff3b30', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px',
            fontSize: '16px', fontWeight: 'bold', cursor: 'pointer'
          }}>
            Start Mission
          </button>
        </div>
      </div>
    </div>
  );
}
