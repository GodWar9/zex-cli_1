"""
shared/state.py — Global state store for CortexOS unified backend.
Holds references to the active scheduler sim so other modules (shell, sentinel)
can query live system state.
"""

from __future__ import annotations
from typing import Optional, List, Dict, Any


class SystemState:
    """Singleton-style global state container."""

    def __init__(self):
        self._scheduler_sim = None
        self._alerts: List[Dict[str, Any]] = []
        self._vm_last_steps: List[Dict[str, Any]] = []

    def set_scheduler_sim(self, sim):
        self._scheduler_sim = sim

    def get_scheduler_sim(self):
        return self._scheduler_sim

    def get_scheduler_snapshot(self) -> Optional[Dict[str, Any]]:
        if self._scheduler_sim is None:
            return None
        event = self._scheduler_sim.snapshot()
        if event is None:
            return None
        return event.model_dump(mode="json")

    def add_alert(self, alert: Dict[str, Any]):
        self._alerts.append(alert)
        # Keep last 50 alerts
        if len(self._alerts) > 50:
            self._alerts = self._alerts[-50:]

    def get_alerts(self) -> List[Dict[str, Any]]:
        return list(self._alerts)

    def clear_alerts(self):
        self._alerts.clear()

    def set_vm_steps(self, steps: List[Dict[str, Any]]):
        self._vm_last_steps = steps

    def get_vm_steps(self) -> List[Dict[str, Any]]:
        return self._vm_last_steps

    def get_system_metrics(self) -> Dict[str, Any]:
        snapshot = self.get_scheduler_snapshot()
        if snapshot and "metrics" in snapshot:
            return snapshot["metrics"]
        return {
            "cpu_utilisation": 0,
            "avg_latency": 0,
            "throughput": 0,
            "fairness_index": 1.0,
            "bandwidth_usage": 0,
        }


# Global instance
system_state = SystemState()
