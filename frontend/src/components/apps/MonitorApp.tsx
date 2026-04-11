import { useSentinel } from '../../hooks/useSentinel';

export function MonitorApp() {
  const { alerts, metrics, isPolling } = useSentinel();

  const cpu = metrics?.cpu_utilisation ?? 0;
  const fairness = metrics?.fairness_index ?? 1.0;
  const latency = metrics?.avg_latency ?? 0;
  const throughput = metrics?.throughput ?? 0;
  const bw = metrics?.bandwidth_usage ?? 0;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#ff453a';
      case 'warning': return '#ff9f0a';
      default: return '#30d158';
    }
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#0a0a0f',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 11,
        color: 'rgba(255,255,255,0.4)',
        background: 'rgba(0,0,0,0.3)',
      }}>
        <span style={{ letterSpacing: '0.1em' }}>CORTEX SENTINEL</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: isPolling ? '#30d158' : '#ff453a',
            animation: isPolling ? 'sentinelPulse 2s ease-in-out infinite' : 'none',
          }} />
          <span>{isPolling ? 'MONITORING' : 'OFFLINE'}</span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8,
        padding: 12,
      }}>
        <MetricCard label="CPU UTIL" value={`${cpu.toFixed(1)}%`} color="#0a84ff" />
        <MetricCard label="FAIRNESS" value={fairness.toFixed(3)} color="#bf5af2" />
        <MetricCard label="LATENCY" value={`${latency.toFixed(1)}t`} color="#ff9f0a" />
        <MetricCard label="THROUGHPUT" value={`${throughput}/10t`} color="#30d158" />
        <MetricCard label="BANDWIDTH" value={`${bw.toFixed(0)} u`} color="#ff453a" />
        <MetricCard label="ALERTS" value={`${alerts.length}`} color={alerts.length > 0 ? '#ff453a' : '#30d158'} />
      </div>

      {/* Alerts Feed */}
      <div style={{
        flex: 1,
        padding: '0 12px 12px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', marginBottom: 4 }}>
          ALERT FEED ({alerts.length})
        </div>

        {alerts.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: 30,
            color: 'rgba(255,255,255,0.2)',
            fontSize: 13,
          }}>
            🛡️ No alerts — system healthy
          </div>
        ) : (
          [...alerts].reverse().map((alert: any, i: number) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 8,
              padding: '10px 12px',
              borderLeft: `3px solid ${getSeverityColor(alert.severity || 'warning')}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: getSeverityColor(alert.severity || 'warning'),
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  {alert.severity || 'WARNING'}
                </span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>
                  {alert.timestamp ? new Date(alert.timestamp * 1000).toLocaleTimeString() : ''}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#e0e0e0', marginBottom: 6, fontWeight: 500 }}>
                {alert.alert}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
                {alert.reason}
              </div>
              {alert.action && (
                <div style={{
                  fontSize: 11,
                  color: '#ff9f0a',
                  marginTop: 6,
                  padding: '3px 8px',
                  background: 'rgba(255,159,10,0.08)',
                  borderRadius: 4,
                  display: 'inline-block',
                }}>
                  ⚡ {alert.action}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: 8,
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
        {label}
      </span>
      <span style={{ fontSize: 18, fontWeight: 700, color, fontFamily: '"SF Mono", monospace' }}>
        {value}
      </span>
    </div>
  );
}
