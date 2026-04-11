import React from 'react';
import { useGame } from '../../context/GameContext';

export function EC2App() {
  const { scenario, fixVuln, logAction, unfixedVulns } = useGame();

  if (!scenario) return <div>No active scenario.</div>;

  const instances = scenario.environment.ec2_instances || [];

  const handleToggleMonitoring = (inst: any) => {
    // Currently purely visual or you can map a vuln for unmonitored instances
    logAction('toggle_monitoring', inst.id);
  };

  return (
    <div style={{ padding: '24px', height: '100%', color: '#fff', background: '#1e1e1e', fontFamily: 'system-ui', overflowY: 'auto' }}>
      <h2 style={{ margin: '0 0 24px', fontSize: '20px' }}>EC2 Instances</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', background: '#252526', borderRadius: '8px', overflow: 'hidden' }}>
        <thead>
          <tr style={{ background: '#1a1a1a', textAlign: 'left' }}>
            <th style={{ padding: '12px', borderBottom: '1px solid #333' }}>Instance ID</th>
            <th style={{ padding: '12px', borderBottom: '1px solid #333' }}>Name</th>
            <th style={{ padding: '12px', borderBottom: '1px solid #333' }}>Type</th>
            <th style={{ padding: '12px', borderBottom: '1px solid #333' }}>State</th>
            <th style={{ padding: '12px', borderBottom: '1px solid #333' }}>Region</th>
            <th style={{ padding: '12px', borderBottom: '1px solid #333' }}>Monitoring</th>
          </tr>
        </thead>
        <tbody>
          {instances.map((inst: any, i: number) => (
            <tr key={i} style={{ borderBottom: '1px solid #333' }}>
              <td style={{ padding: '12px', fontFamily: 'monospace', color: '#0a84ff' }}>{inst.id}</td>
              <td style={{ padding: '12px' }}>{inst.name}</td>
              <td style={{ padding: '12px', color: '#aaa' }}>{inst.type}</td>
              <td style={{ padding: '12px', color: '#30d158' }}>{inst.state}</td>
              <td style={{ padding: '12px', color: '#aaa' }}>{inst.region}</td>
              <td style={{ padding: '12px' }}>
                 <button onClick={() => handleToggleMonitoring(inst)} style={{
                   background: inst.monitoring ? '#30d158' : '#ffcc00', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', color: '#000', fontWeight: 'bold'
                 }}>
                   {inst.monitoring ? 'Enabled' : 'Disabled ⚠️'}
                 </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
