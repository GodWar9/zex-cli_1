"""
scheduler_sim.py — Discrete-tick CPU + bandwidth resource simulator.

Each tick:
  1. Advance IO-blocked processes (decrement io_wait → ready when 0)
  2. Ask the agent for a decision
  3. Apply the decision: run selected process, allocate bandwidth
  4. Update metrics
  5. Emit a SchedulerEvent

FR-S1: ≥ 8 concurrent processes with randomised burst times
FR-S2: Discrete ticks, SchedulerEvent after each tick
FR-S3: SchedulerEvent with full state snapshot
FR-S4: pause / resume / reset / speed (tps)
"""

from __future__ import annotations

import asyncio
import math
import random
import time
from collections import deque
from typing import Callable, Coroutine, List, Optional

from models import (
    AgentAction,
    AgentMode,
    ProcessInfo,
    ProcessState,
    SchedulerEvent,
    SchedulerMetrics,
)

# ---------------------------------------------------------------------------
# Internal mutable process state (not exposed directly — converted to
# ProcessInfo for the event snapshot)
# ---------------------------------------------------------------------------

class _Process:
    _id_counter = 0

    def __init__(
        self,
        name: str,
        priority: int,
        cpu_burst: int,
        io_wait: int = 0,
        network_demand: int = 0,
    ) -> None:
        _Process._id_counter += 1
        self.pid             = _Process._id_counter
        self.name            = name
        self.priority        = priority           # 1–10
        self.cpu_burst       = cpu_burst          # total ticks needed
        self.remaining_burst = cpu_burst
        self.io_wait         = io_wait            # ticks blocked on IO
        self.network_demand  = network_demand     # BW units / tick
        self.state: ProcessState = (
            ProcessState.WAITING if io_wait > 0 else ProcessState.READY
        )
        self.wait_ticks      = 0                  # ticks spent in READY state
        self.base_priority   = priority           # for aging resets

    def to_info(self) -> ProcessInfo:
        return ProcessInfo(
            pid=self.pid,
            name=self.name,
            priority=self.priority,
            state=self.state,
            remaining_burst=self.remaining_burst,
            wait_ticks=self.wait_ticks,
            network_demand=self.network_demand,
            io_wait=self.io_wait,
        )


# ---------------------------------------------------------------------------
# Process factory — 8 diverse processes for a compelling demo
# ---------------------------------------------------------------------------

# Process name pool for respawning waves
_PROC_NAMES = [
    "proc_A", "proc_B", "proc_C", "proc_D",
    "proc_E", "proc_F", "proc_G", "proc_H",
    "proc_I", "proc_J", "proc_K", "proc_L",
]


def _create_demo_processes() -> List[_Process]:
    """Initial 8 processes — fixed layout for predictable demo start."""
    _Process._id_counter = 0
    return [
        _Process("proc_A",  priority=8,  cpu_burst=12, io_wait=0,  network_demand=30),
        _Process("proc_B",  priority=5,  cpu_burst=8,  io_wait=2,  network_demand=15),
        _Process("proc_C",  priority=3,  cpu_burst=20, io_wait=0,  network_demand=5),
        _Process("proc_D",  priority=7,  cpu_burst=6,  io_wait=0,  network_demand=25),
        _Process("proc_E",  priority=4,  cpu_burst=15, io_wait=4,  network_demand=10),
        _Process("proc_F",  priority=9,  cpu_burst=4,  io_wait=0,  network_demand=20),
        _Process("proc_G",  priority=2,  cpu_burst=30, io_wait=0,  network_demand=8),
        _Process("proc_H",  priority=6,  cpu_burst=10, io_wait=1,  network_demand=18),
    ]


def _spawn_new_process(wave: int) -> _Process:
    """Spawn a randomised process for subsequent waves."""
    name = _PROC_NAMES[wave % len(_PROC_NAMES)] + f"_w{wave // len(_PROC_NAMES) + 1}"
    return _Process(
        name           = name,
        priority       = random.randint(1, 10),
        cpu_burst      = random.randint(4, 25),
        io_wait        = random.choice([0, 0, 0, 1, 2, 3]),
        network_demand = random.randint(5, 35),
    )


# ---------------------------------------------------------------------------
# Metrics helpers
# ---------------------------------------------------------------------------

TOTAL_BANDWIDTH = 100   # total BW units available per tick


def _jain_fairness(wait_times: List[int]) -> float:
    """Jain's fairness index over wait times (higher = fairer)."""
    n = len(wait_times)
    if n == 0:
        return 1.0
    s  = sum(wait_times)
    sq = sum(w * w for w in wait_times)
    return (s * s) / (n * sq) if sq > 0 else 1.0


# ---------------------------------------------------------------------------
# Scheduler Simulator
# ---------------------------------------------------------------------------

class SchedulerSim:
    """
    Discrete-tick CPU + bandwidth simulator.

    Usage:
        sim = SchedulerSim(agent, on_event_callback)
        await sim.start("heuristic")
        # pauses, resumes, resets via public methods
    """

    def __init__(
        self,
        agent: "SchedulerAgent",           # noqa: F821  (forward ref)
        on_event: Callable[[SchedulerEvent], Coroutine],
    ) -> None:
        self._agent    = agent
        self._on_event = on_event

        # simulation state
        self._processes: List[_Process] = []
        self._tick                = 0
        self._tps: float          = 2.0      # ticks per second
        self._mode: AgentMode     = AgentMode.HEURISTIC

        # control flags
        self._running    = False
        self._paused     = False
        self._task: Optional[asyncio.Task] = None

        # metrics history
        self._completed_history: deque[int] = deque(maxlen=10)  # ticks when procs finished
        self._cpu_busy_ticks   = 0
        self._latencies: List[float] = []
        self._spawn_wave       = 0          # counter for respawned process waves

    # ------------------------------------------------------------------
    # Public control API
    # ------------------------------------------------------------------

    async def start(self, mode: AgentMode = AgentMode.HEURISTIC, tps: float = 2.0) -> None:
        await self.reset()
        self._mode    = mode
        self._tps     = tps
        self._running = True
        self._paused  = False
        self._task    = asyncio.create_task(self._run_loop())

    def pause(self) -> None:
        self._paused = True

    def resume(self) -> None:
        self._paused = False

    async def reset(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._processes            = _create_demo_processes()
        self._tick                 = 0
        self._running              = False
        self._paused               = False
        self._cpu_busy_ticks       = 0
        self._latencies            = []
        self._spawn_wave           = 0
        self._completed_history.clear()

    def set_tps(self, tps: float) -> None:
        self._tps = max(0.1, min(tps, 20.0))

    def is_running(self) -> bool:
        return self._running and not self._paused

    def snapshot(self) -> Optional[SchedulerEvent]:
        """Return current state without advancing a tick."""
        if not self._processes:
            return None
        return self._build_event(
            AgentAction(scheduled_pid=None, bandwidth_alloc={})
        )

    # ------------------------------------------------------------------
    # Main simulation loop
    # ------------------------------------------------------------------

    async def _run_loop(self) -> None:
        while self._running:
            if self._paused:
                await asyncio.sleep(0.05)
                continue

            event = self._tick_once()
            await self._on_event(event)

            # Respawn processes when < 3 active remain so demo runs indefinitely.
            # Prune DONE procs older than 5 ticks to keep process list manageable.
            active = [p for p in self._processes if p.state != ProcessState.DONE]
            if len(active) < 3:
                # Trim long-done processes first (keep last-done ones for metrics)
                self._processes = [
                    p for p in self._processes
                    if p.state != ProcessState.DONE
                ] + [
                    p for p in self._processes
                    if p.state == ProcessState.DONE
                ][-4:]  # keep at most 4 done for history

                # Spawn fresh processes up to 8 active
                while len(active) < 8:
                    new_p = _spawn_new_process(self._spawn_wave)
                    self._spawn_wave += 1
                    self._processes.append(new_p)
                    active.append(new_p)

            await asyncio.sleep(1.0 / self._tps)

    # ------------------------------------------------------------------
    # Core tick logic
    # ------------------------------------------------------------------

    def _tick_once(self) -> SchedulerEvent:
        self._tick += 1

        # 1. Advance IO-blocked processes
        for p in self._processes:
            if p.state == ProcessState.WAITING and p.io_wait > 0:
                p.io_wait -= 1
                if p.io_wait == 0:
                    p.state = ProcessState.READY

        # 2. Age waiting processes (+1 priority every 5 ticks, max 10)
        for p in self._processes:
            if p.state == ProcessState.READY:
                p.wait_ticks += 1
                if p.wait_ticks % 5 == 0:
                    p.priority = min(10, p.priority + 1)

        # 3. Preempt currently-running process first so agent sees correct READY states
        for p in self._processes:
            if p.state == ProcessState.RUNNING:
                p.state = ProcessState.READY

        # 4. Ask agent for decision (after preemption — all eligible procs are READY)
        action = self._agent.decide(self._tick, self._processes, self._mode)

        # 5. Apply CPU decision
        running_proc: Optional[_Process] = None

        if action.scheduled_pid is not None:
            chosen = next(
                (p for p in self._processes if p.pid == action.scheduled_pid), None
            )
            if chosen and chosen.state == ProcessState.READY:
                chosen.state = ProcessState.RUNNING
                chosen.remaining_burst -= 1
                chosen.wait_ticks = 0  # reset wait counter on run
                running_proc = chosen
                self._cpu_busy_ticks += 1

                # Randomly trigger IO on long-burst processes (5% chance)
                if chosen.remaining_burst > 0 and random.random() < 0.05:
                    chosen.state = ProcessState.WAITING
                    chosen.io_wait = random.randint(1, 3)
                elif chosen.remaining_burst <= 0:
                    chosen.state = ProcessState.DONE
                    self._completed_history.append(self._tick)

        # 6. Bandwidth allocation already captured in action.bandwidth_alloc

        # 7. Build and return event
        return self._build_event(action)

    # ------------------------------------------------------------------
    # Metrics computation
    # ------------------------------------------------------------------

    def _compute_metrics(self) -> SchedulerMetrics:
        total_ticks = max(self._tick, 1)

        cpu_util = (self._cpu_busy_ticks / total_ticks) * 100.0

        done_procs = [p for p in self._processes if p.state == ProcessState.DONE]
        avg_lat = (
            sum(p.cpu_burst for p in done_procs) / len(done_procs)
            if done_procs else 0.0
        )

        # throughput = completions in last 10 ticks
        window_start = self._tick - 10
        throughput = sum(1 for t in self._completed_history if t > window_start)

        all_waits = [p.wait_ticks for p in self._processes if p.state != ProcessState.DONE]
        fairness  = _jain_fairness(all_waits) if all_waits else 1.0

        bw_used = sum(
            int(v) for k, v in
            # agent already set bandwidth_alloc; we re-calc from process demand
            [(p.pid, p.network_demand) for p in self._processes if p.state == ProcessState.RUNNING]
        )

        return SchedulerMetrics(
            cpu_utilisation = round(cpu_util, 2),
            avg_latency     = round(avg_lat, 2),
            throughput      = throughput,
            fairness_index  = round(fairness, 4),
            bandwidth_usage = float(min(bw_used, TOTAL_BANDWIDTH)),
        )

    # ------------------------------------------------------------------
    # Event builder
    # ------------------------------------------------------------------

    def _build_event(self, action: AgentAction) -> SchedulerEvent:
        return SchedulerEvent(
            tick         = self._tick,
            processes    = [p.to_info() for p in self._processes],
            metrics      = self._compute_metrics(),
            agent_action = action,
            agent_mode   = self._mode,
        )
