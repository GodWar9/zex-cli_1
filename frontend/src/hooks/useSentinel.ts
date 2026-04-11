import { useState, useEffect, useCallback, useRef } from 'react';

interface SentinelAlert {
  timestamp: number;
  alert: string;
  action: string;
  reason: string;
  severity: string;
}

interface SystemMetrics {
  cpu_utilisation: number;
  avg_latency: number;
  throughput: number;
  fairness_index: number;
  bandwidth_usage: number;
}

interface UseSentinelReturn {
  alerts: SentinelAlert[];
  metrics: SystemMetrics | null;
  isPolling: boolean;
}

export function useSentinel(): UseSentinelReturn {
  const [alerts, setAlerts] = useState<SentinelAlert[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    try {
      const [alertsResp, metricsResp] = await Promise.all([
        fetch('http://localhost:8000/system/alerts'),
        fetch('http://localhost:8000/system/metrics'),
      ]);

      if (alertsResp.ok) {
        const data = await alertsResp.json();
        setAlerts(data.alerts || []);
      }

      if (metricsResp.ok) {
        const data = await metricsResp.json();
        setMetrics(data);
      }

      setIsPolling(true);
    } catch {
      setIsPolling(false);
    }
  }, []);

  useEffect(() => {
    poll(); // immediate
    intervalRef.current = setInterval(poll, 2000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [poll]);

  return { alerts, metrics, isPolling };
}
