"""
sentinel/sentinel.py — CortexSentinel monitoring agent.

Runs periodic checks on system state and generates alerts for:
- Process starvation (wait_ticks > threshold)
- High CPU usage sustained
- Fairness imbalance
"""

from __future__ import annotations

import time
from typing import Dict, Any, List

from .models import SentinelAlert

STARVATION_THRESHOLD = 15
FAIRNESS_THRESHOLD = 0.5
HIGH_CPU_THRESHOLD = 90.0


def analyze_system(snapshot: Dict[str, Any] | None) -> List[SentinelAlert]:
    """
    Analyze a scheduler snapshot and return any alerts detected.
    """
    if snapshot is None:
        return []

    alerts: List[SentinelAlert] = []
    now = time.time()

    processes = snapshot.get("processes", [])
    metrics = snapshot.get("metrics", {})

    # Check for starvation
    starving = [
        p for p in processes
        if p.get("state") == "ready" and p.get("wait_ticks", 0) > STARVATION_THRESHOLD
    ]
    if starving:
        names = ", ".join(p["name"] for p in starving)
        max_wait = max(p["wait_ticks"] for p in starving)
        alerts.append(SentinelAlert(
            timestamp=now,
            alert=f"Process starvation detected",
            action=f"Consider priority boost for {names}",
            reason=f"{names} waiting {max_wait} ticks — exceeds threshold of {STARVATION_THRESHOLD}",
            severity="critical" if max_wait > 25 else "warning",
        ))

    # Check CPU utilisation
    cpu_util = metrics.get("cpu_utilisation", 0)
    if cpu_util > HIGH_CPU_THRESHOLD:
        alerts.append(SentinelAlert(
            timestamp=now,
            alert=f"High CPU utilisation: {cpu_util:.1f}%",
            action="Monitor for sustained load — consider load balancing",
            reason=f"CPU usage at {cpu_util:.1f}% exceeds {HIGH_CPU_THRESHOLD}% threshold",
            severity="warning",
        ))

    # Check fairness
    fairness = metrics.get("fairness_index", 1.0)
    if fairness < FAIRNESS_THRESHOLD:
        alerts.append(SentinelAlert(
            timestamp=now,
            alert=f"Fairness imbalance: {fairness:.3f}",
            action="Rebalance scheduling priorities",
            reason=f"Jain's fairness index {fairness:.3f} below threshold {FAIRNESS_THRESHOLD}",
            severity="warning",
        ))

    # Check bandwidth
    bw = metrics.get("bandwidth_usage", 0)
    if bw >= 95:
        alerts.append(SentinelAlert(
            timestamp=now,
            alert=f"Bandwidth congestion: {bw:.0f} units",
            action="Throttle low-priority network requests",
            reason=f"Bandwidth usage at {bw:.0f}/100 — near saturation",
            severity="critical",
        ))

    return alerts
