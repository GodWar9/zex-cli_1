import React from 'react';
import { useGame } from '../../context/GameContext';

export function DebriefScreen() {
  const { gameState, scenario, score, debriefText, actionLog, resetGame, generateScenario } = useGame();

  if (gameState !== 'DEBRIEF' || !scenario) return null;

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 10000,
      background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(20px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontFamily: 'system-ui', overflowY: 'auto', padding: '40px'
    }}>
      <div style={{
        background: '#1a1a1a', border: '1px solid #333', padding: '40px', borderRadius: '12px',
        maxWidth: '800px', width: '100%'
      }}>
        <h1 style={{ margin: '0 0 8px', fontSize: '32px', color: '#30d158' }}>Mission Complete</h1>
        <p style={{ fontSize: '20px', color: '#ccc', marginBottom: '32px' }}>Score: {score}</p>
        
        <h3 style={{ borderBottom: '1px solid #333', paddingBottom: '8px', marginBottom: '16px' }}>AI Debrief</h3>
        <p style={{ fontSize: '16px', color: '#eee', lineHeight: '1.6', marginBottom: '32px', whiteSpace: 'pre-wrap' }}>
          {debriefText ? debriefText : 'Analyzing log...'}
        </p>

        <h3 style={{ borderBottom: '1px solid #333', paddingBottom: '8px', marginBottom: '16px' }}>Action Log</h3>
        <ul style={{ listStyle: 'none', padding: 0, marginBottom: '32px', maxHeight: '200px', overflowY: 'auto' }}>
          {actionLog.map((log, i) => (
            <li key={i} style={{ borderBottom: '1px solid #222', padding: '8px 0', fontSize: '14px', color: '#aaa' }}>
              <span style={{ color: '#fff', width: '50px', display: 'inline-block' }}>{log.time_elapsed}s</span>
              <span style={{ color: log.action.includes('ATTACK') ? '#ff453a' : '#30d158' }}>{log.action}</span> - {log.resource}
            </li>
          ))}
        </ul>

        <div style={{ display: 'flex', gap: '16px' }}>
          <button onClick={generateScenario} style={{
            background: '#0a84ff', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px',
            fontSize: '16px', fontWeight: 'bold', cursor: 'pointer'
          }}>
            Play Next Scenario
          </button>
          <button onClick={resetGame} style={{
            background: '#333', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px',
            fontSize: '16px', cursor: 'pointer'
          }}>
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
