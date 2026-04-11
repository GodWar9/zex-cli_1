"""
models.py — Pydantic data models for CortexScheduler.
Defines all shared data structures: ProcessInfo, SchedulerMetrics,
AgentAction, SchedulerEvent, NarrationEvent.
"""

from __future__ import annotations

from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class ProcessState(str, Enum):
    READY   = "ready"
    RUNNING = "running"
    WAITING = "waiting"
    DONE    = "done"


class AgentMode(str, Enum):
    HEURISTIC = "heuristic"
    PPO       = "ppo"


# ---------------------------------------------------------------------------
# Per-process snapshot (sent inside SchedulerEvent)
# ---------------------------------------------------------------------------

class ProcessInfo(BaseModel):
    pid:              int
    name:             str
    priority:         int = Field(ge=1, le=10)
    state:            ProcessState
    remaining_burst:  int
    wait_ticks:       int
    network_demand:   int          # bandwidth units requested per tick
    io_wait:          int = 0      # ticks remaining blocked on IO


# ---------------------------------------------------------------------------
# Metrics snapshot
# ---------------------------------------------------------------------------

class SchedulerMetrics(BaseModel):
    cpu_utilisation:  float   # %
    avg_latency:      float   # mean ticks ready→done
    throughput:       int     # processes completed per last 10 ticks
    fairness_index:   float   # Jain's fairness index, 0–1
    bandwidth_usage:  float   # total BW consumed this tick (units)


# ---------------------------------------------------------------------------
# Agent action taken this tick
# ---------------------------------------------------------------------------

class AgentAction(BaseModel):
    scheduled_pid:   Optional[int]             # None if CPU idle
    bandwidth_alloc: Dict[str, int]            # { "pid": bw_units }


# ---------------------------------------------------------------------------
# Full tick event emitted after every scheduler tick
# ---------------------------------------------------------------------------

class SchedulerEvent(BaseModel):
    tick:         int
    processes:    List[ProcessInfo]
    metrics:      SchedulerMetrics
    agent_action: AgentAction
    agent_mode:   AgentMode


# ---------------------------------------------------------------------------
# LLM narration event (identical structure to VM side)
# ---------------------------------------------------------------------------

class NarrationEvent(BaseModel):
    tick:            int
    narration_type:  str   # "intent" | "step" | "prediction" | "warning"
    text:            str


# ---------------------------------------------------------------------------
# WebSocket client → server command
# ---------------------------------------------------------------------------

class ClientCommand(BaseModel):
    type:  str                    # start | pause | resume | reset | speed
    mode:  Optional[AgentMode] = None
    tps:   Optional[float]     = None
