import { type ReactElement } from 'react';
import type { SchedulerMetrics } from '../types';

interface MetricsPanelProps {
  metrics?: SchedulerMetrics;
  tick?: number;
}

export function MetricsPanel({ metrics, tick }: MetricsPanelProps): ReactElement {
  
  const m = metrics || {
    cpu_utilisation: 0,
    avg_latency: 0,
    throughput: 0,
    fairness_index: 0,
    bandwidth_usage: 0
  };

  return (
    <div style={{
      height: '35%',
      display: 'flex',
      flexDirection: 'column',
      padding: '16px',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '0.875rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            System Metrics
          </h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--fg-dim)' }}>Live Aggregation Panel</span>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--fg-dim)', fontWeight: 'bold' }}>
          TICK: <span style={{ color: 'var(--accent)', fontSize: '16px' }}>{tick ?? 0}</span>
        </div>
      </div>
      
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '12px',
        alignContent: 'start',
        overflowY: 'auto',
        paddingBottom: '4px'
      }}>
        <MetricBox label="CPU UTILISATION" value={`${(m.cpu_utilisation * 100).toFixed(1)}%`} color="#38bdf8" />
        <MetricBox label="AVG LATENCY" value={`${m.avg_latency.toFixed(1)}t`} color="#facc15" />
        <MetricBox label="THROUGHPUT" value={`${m.throughput} / 10t`} color="#10b981" />
        <MetricBox label="JAIN FAIRNESS" value={m.fairness_index.toFixed(2)} color="#c084fc" />
        <div style={{ gridColumn: '1 / -1' }}>
          <MetricBox label="TOTAL BANDWIDTH" value={`${m.bandwidth_usage.toFixed(1)} mbps`} color="#f87171" />
        </div>
      </div>
    </div>
  );
}

function MetricBox({ label, value, color }: { label: string, value: string, color: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid var(--border-dim)',
      borderLeft: `3px solid ${color}`,
      borderRadius: '6px',
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
    }}>
      <span style={{ color: 'var(--fg-dim)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
        {label}
      </span>
      <span style={{ color, fontSize: '1.25rem', fontWeight: 'bold' }}>
        {value}
      </span>
    </div>
  );
}
