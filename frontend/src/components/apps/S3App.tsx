import React from 'react';
import { useGame } from '../../context/GameContext';

export function S3App() {
  const { scenario, fixVuln, logAction, unfixedVulns } = useGame();

  if (!scenario) return <div>No active scenario.</div>;

  const buckets = scenario.environment.s3_buckets || [];

  const handleToggleAccess = (bucket: any) => {
    // Check if this was a vulnerability
    const vuln = scenario.vulnerabilities.find(v => v.resource === bucket.name && v.type === 's3_public_bucket');
    if (vuln && unfixedVulns.has(vuln.id)) {
      fixVuln(vuln.id);
      logAction('set_bucket_private', bucket.name, vuln.id);
    } else {
      logAction('set_bucket_private', bucket.name);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', color: '#fff', background: '#1e1e1e', fontFamily: 'system-ui' }}>
      <div style={{ width: '250px', borderRight: '1px solid #333', overflowY: 'auto' }}>
        <div style={{ padding: '12px', background: '#252526', borderBottom: '1px solid #333', fontSize: '12px', fontWeight: 'bold' }}>BUCKETS</div>
        {buckets.map((b: any, i: number) => {
          const isVulnUnfixed = scenario.vulnerabilities.some(v => v.resource === b.name && unfixedVulns.has(v.id));
          return (
            <div key={i} style={{ padding: '12px', borderBottom: '1px solid #333', cursor: 'pointer', background: isVulnUnfixed ? 'rgba(255,69,58,0.1)' : 'transparent' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🪣</span> <span style={{ fontSize: '14px', wordBreak: 'break-all' }}>{b.name}</span>
              </div>
              <div style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>{b.region}</div>
            </div>
          );
        })}
      </div>
      <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
        <h2 style={{ margin: '0 0 24px', fontSize: '20px' }}>Bucket Details</h2>
        {buckets.map((b: any, i: number) => {
          const isVuln = scenario.vulnerabilities.find(v => v.resource === b.name && v.type === 's3_public_bucket');
          const isPublic = isVuln ? unfixedVulns.has(isVuln.id) : b.is_public;

          return (
            <div key={i} style={{ marginBottom: '32px', padding: '16px', background: '#252526', borderRadius: '8px', border: '1px solid #333' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '18px', display: 'flex', justifyContent: 'space-between' }}>
                {b.name}
                <button onClick={() => handleToggleAccess(b)} style={{
                  background: isPublic ? '#ff453a' : '#30d158', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer'
                }}>
                  {isPublic ? 'PUBLIC ⚠️ (Make Private)' : 'PRIVATE ✓'}
                </button>
              </h3>
              <div style={{ display: 'flex', gap: '24px', marginBottom: '16px', fontSize: '13px', color: '#aaa' }}>
                <div><strong>Encryption:</strong> {b.encryption}</div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#1a1a1a' }}>
                    <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #333' }}>Filename</th>
                    <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #333' }}>Size</th>
                  </tr>
                </thead>
                <tbody>
                  {b.files?.map((f: any, fi: number) => (
                    <tr key={fi}>
                      <td style={{ padding: '8px', borderBottom: '1px solid #333' }}>
                        📄 {f.name} {f.sensitive && <span style={{ color: '#ff453a', background: 'rgba(255,69,58,0.1)', padding: '2px 4px', borderRadius: '4px', fontSize: '10px', marginLeft: '8px' }}>SENSITIVE</span>}
                      </td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #333', color: '#888' }}>{f.size}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}
