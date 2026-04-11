import React from 'react';
import { useGame } from '../../context/GameContext';

export function IAMApp() {
  const { scenario, fixVuln, logAction, unfixedVulns } = useGame();

  if (!scenario) return <div>No active scenario.</div>;

  const roles = scenario.environment.iam?.roles || [];

  const handleApplySafer = (role: any, policy: any) => {
    const vuln = scenario.vulnerabilities.find(v => v.resource === role.name);
    if (vuln && unfixedVulns.has(vuln.id)) {
      fixVuln(vuln.id);
      logAction('apply_safer_policy', role.name, vuln.id);
    } else {
      logAction('apply_safer_policy', role.name);
    }
  };

  return (
    <div style={{ padding: '24px', height: '100%', color: '#fff', background: '#1e1e1e', fontFamily: 'system-ui', overflowY: 'auto' }}>
      <h2 style={{ margin: '0 0 24px', fontSize: '20px' }}>IAM Roles</h2>
      
      {roles.map((role: any, i: number) => {
        const isVuln = scenario.vulnerabilities.find(v => v.resource === role.name);
        const isActiveVuln = isVuln ? unfixedVulns.has(isVuln.id) : false;
        
        return (
          <div key={i} style={{ marginBottom: '24px', background: '#252526', borderRadius: '8px', border: '1px solid #333', padding: '16px' }}>
             <h3 style={{ margin: '0 0 16px', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                👤 {role.name}
             </h3>
             <div style={{ marginBottom: '16px', fontSize: '13px', color: '#aaa' }}>
                Used by: {role.used_by?.join(', ')}
             </div>
             
             <h4 style={{ margin: '0 0 8px', fontSize: '14px' }}>Attached Policies</h4>
             <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
               {role.policies?.map((pol: any, pi: number) => {
                  const isDangerous = isActiveVuln && (pol.is_overpermissioned || role.dangerous);
                  
                  if(!isDangerous && !isActiveVuln) {
                     return <li key={pi} style={{ padding: '8px', borderBottom: '1px solid #333' }}>{pol.policy_name || pol.name || pol}</li>;
                  }

                  // Fixed state
                  if (!isActiveVuln && isDangerous) {
                      return (
                          <li key={pi} style={{ padding: '12px', background: 'rgba(48, 209, 88, 0.1)', borderBottom: '1px solid #333', borderLeft: '3px solid #30d158' }}>
                             <span style={{ color: '#30d158', fontWeight: 'bold' }}>✅ Fixed: applied safer alternative policy</span>
                          </li>
                      )
                  }
                  
                  return (
                    <li key={pi} style={{ padding: '16px', background: 'rgba(255,69,58,0.05)', borderBottom: '1px solid #333', borderLeft: '3px solid #ff453a', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                       <div style={{ fontSize: '15px', color: '#ff453a', fontWeight: 'bold' }}>⚠️ {pol.policy_name}</div>
                       <div style={{ fontSize: '13px', color: '#ddd' }}><strong>WHY DANGEROUS:</strong> {pol.why_dangerous}</div>
                       
                       <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                           <div style={{ flex: 1, background: '#111', padding: '12px', borderRadius: '6px', border: '1px solid #333' }}>
                               <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px', textTransform: 'uppercase' }}>Current Policy JSON</div>
                               <pre style={{ margin: 0, fontSize: '11px', color: '#ff453a', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                   {pol.actual_json}
                               </pre>
                           </div>
                           <div style={{ flex: 1, background: '#111', padding: '12px', borderRadius: '6px', border: '1px solid #333' }}>
                               <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px', textTransform: 'uppercase' }}>✅ Safer Alternative</div>
                               <pre style={{ margin: 0, fontSize: '11px', color: '#30d158', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                   {pol.safer_alternative_json}
                               </pre>
                           </div>
                       </div>
                       
                       <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                           <button onClick={() => handleApplySafer(role, pol)} style={{
                             background: '#30d158', color: '#111', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
                           }}>
                             Apply Safer Policy
                           </button>
                       </div>
                    </li>
                  )
               })}
             </ul>
          </div>
        )
      })}
    </div>
  );
}
