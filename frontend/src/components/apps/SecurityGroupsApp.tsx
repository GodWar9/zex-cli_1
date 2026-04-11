import React from 'react';
import { useGame } from '../../context/GameContext';

export function SecurityGroupsApp() {
  const { scenario, fixVuln, logAction, unfixedVulns } = useGame();

  if (!scenario) return <div>No active scenario.</div>;

  const sgs = scenario.environment.security_groups || [];

  const handleDeleteRule = (sg: any, rule: any) => {
    // If fixing a vulnerability mapped to this rule
    const vuln = scenario.vulnerabilities.find(v => v.resource === sg.name || v.resource === sg.id);
    if (vuln && unfixedVulns.has(vuln.id)) {
      fixVuln(vuln.id);
      logAction('delete_sg_rule', sg.name, vuln.id);
    } else {
      logAction('delete_sg_rule', sg.name);
    }
  };

  const DANGEROUS_PORTS = [22, 3306, 5432, 27017, 6379, 8080, 9200, 2375];
  const ALWAYS_SAFE_PORTS = [80, 443];

  const isDangerousRule = (rule: any) => {
    if (ALWAYS_SAFE_PORTS.includes(Number(rule.port))) return false;
    if (rule.source === '0.0.0.0/0' && DANGEROUS_PORTS.includes(Number(rule.port))) return true;
    return rule.dangerous; // fallback to AI generated flag
  };

  return (
    <div style={{ padding: '24px', height: '100%', color: '#fff', background: '#1e1e1e', fontFamily: 'system-ui', overflowY: 'auto' }}>
      <h2 style={{ margin: '0 0 24px', fontSize: '20px' }}>Security Groups</h2>
      {sgs.map((sg: any, i: number) => (
        <div key={i} style={{ marginBottom: '32px', background: '#252526', borderRadius: '8px', border: '1px solid #333', overflow: 'hidden' }}>
          <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid #333', display: 'flex', gap: '24px' }}>
            <div><strong>Name:</strong> {sg.name}</div>
            <div><strong style={{ color: '#888' }}>ID:</strong> {sg.id}</div>
            <div><strong style={{ color: '#888' }}>VPC:</strong> {sg.vpc}</div>
          </div>
          <div style={{ padding: '16px' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: '14px', color: '#aaa' }}>Inbound Rules</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#1a1a1a' }}>
                  <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #333' }}>Protocol</th>
                  <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #333' }}>Port Range</th>
                  <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #333' }}>Source</th>
                  <th style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid #333' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {sg.inbound_rules?.map((rule: any, ri: number) => {
                  const isVuln = scenario.vulnerabilities.find(v => v.resource === sg.name || v.resource === sg.id);
                  const isRuleActive = isVuln ? unfixedVulns.has(isVuln.id) : true; // In simulation, if fixed, pretend deleted
                  
                  if (!isRuleActive && isDangerousRule(rule)) return null;

                  const dangerous = isDangerousRule(rule);

                  return (
                    <tr key={ri} style={{ background: dangerous ? 'rgba(255,69,58,0.1)' : 'transparent' }}>
                      <td style={{ padding: '12px 8px', borderBottom: '1px solid #333' }}>{rule.protocol}</td>
                      <td style={{ padding: '12px 8px', borderBottom: '1px solid #333' }}>{rule.port}</td>
                      <td style={{ padding: '12px 8px', borderBottom: '1px solid #333', color: dangerous ? '#ff453a' : '#fff' }}>
                        {rule.source} {dangerous && '⚠️ EXPOSED TO INTERNET'}
                      </td>
                      <td style={{ padding: '12px 8px', borderBottom: '1px solid #333', textAlign: 'right' }}>
                        <button onClick={() => handleDeleteRule(sg, rule)} style={{
                          background: '#ff453a', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px'
                        }}>
                          Delete Rule
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
