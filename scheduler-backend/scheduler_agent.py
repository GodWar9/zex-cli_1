"""
scheduler_agent.py — Scheduling decision engine.

Two pluggable modes:
  Mode 1 — Heuristic (always works, no extra deps)
    • Priority scheduling with aging
    • Proportional-priority bandwidth allocation
    • Preemption if higher-priority process enters ready queue

  Mode 2 — PPO RL (stretch goal, requires stable-baselines3/gymnasium)
    Falls back to heuristic if the library is not installed.
"""

from __future__ import annotations

import os
from typing import TYPE_CHECKING, Dict, List, Optional

from models import AgentAction, AgentMode, ProcessState

if TYPE_CHECKING:
    from scheduler_sim import _Process

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

TOTAL_BANDWIDTH = 100


# ---------------------------------------------------------------------------
# Heuristic Agent
# ---------------------------------------------------------------------------

class HeuristicAgent:
    """
    Priority scheduler with aging and proportional bandwidth split.

    Decision logic:
    1. Select the READY process with the highest (effective) priority.
    2. If a RUNNING process is preempted by a new higher-priority READY
       process, switch immediately.
    3. Bandwidth split: proportional to priority among READY/RUNNING procs.
    """

    def decide(
        self,
        tick: int,
        processes: List["_Process"],
    ) -> AgentAction:
        ready = [p for p in processes if p.state == ProcessState.READY]
        currently_running = next(
            (p for p in processes if p.state == ProcessState.RUNNING), None
        )

        # Pick highest-priority ready process (ties broken by pid)
        chosen: Optional["_Process"] = None
        if ready:
            chosen = max(ready, key=lambda p: (p.priority, -p.pid))

        # Preemption check: only switch if strictly higher priority
        if currently_running and chosen:
            if currently_running.priority >= chosen.priority:
                chosen = currently_running   # keep current

        scheduled_pid = chosen.pid if chosen else None

        # Bandwidth allocation: proportional to priority for ALL non-done procs
        active = [p for p in processes if p.state != ProcessState.DONE]
        total_priority = sum(p.priority for p in active) or 1
        bw_alloc: Dict[str, int] = {}
        allocated = 0
        for i, p in enumerate(active):
            if i == len(active) - 1:
                bw_alloc[str(p.pid)] = TOTAL_BANDWIDTH - allocated
            else:
                share = int((p.priority / total_priority) * TOTAL_BANDWIDTH)
                bw_alloc[str(p.pid)] = share
                allocated += share

        return AgentAction(
            scheduled_pid   = scheduled_pid,
            bandwidth_alloc = bw_alloc,
        )


# ---------------------------------------------------------------------------
# PPO RL Agent (stretch goal)
# ---------------------------------------------------------------------------

try:
    import numpy as np
    import gymnasium as gym
    from gymnasium import spaces
    from stable_baselines3 import PPO as SB3_PPO

    class SchedulerEnv(gym.Env):
        """
        Custom Gymnasium environment for the scheduler.

        Observation space:
          Per process (up to 8): [priority, remaining_burst, wait_ticks, network_demand]
          Global: [cpu_load, bw_used]
          Total: 8*4 + 2 = 34 floats

        Action space:
          Discrete(9) — 0 = idle, 1–8 = select process index
        """

        MAX_PROCS  = 8
        OBS_DIM    = MAX_PROCS * 4 + 2

        def __init__(self) -> None:
            super().__init__()
            self.observation_space = spaces.Box(
                low=0.0, high=1.0, shape=(self.OBS_DIM,), dtype=np.float32
            )
            self.action_space = spaces.Discrete(self.MAX_PROCS + 1)
            self._processes: List["_Process"] = []
            self._tick = 0

        def _obs(self) -> np.ndarray:
            vec = []
            for i in range(self.MAX_PROCS):
                if i < len(self._processes):
                    p = self._processes[i]
                    vec += [
                        p.priority / 10.0,
                        p.remaining_burst / 50.0,
                        min(p.wait_ticks, 50) / 50.0,
                        p.network_demand / TOTAL_BANDWIDTH,
                    ]
                else:
                    vec += [0.0, 0.0, 0.0, 0.0]
            running = [p for p in self._processes if p.state == ProcessState.RUNNING]
            cpu_load = 1.0 if running else 0.0
            bw_used  = sum(p.network_demand for p in running) / TOTAL_BANDWIDTH
            vec += [cpu_load, min(bw_used, 1.0)]
            return np.array(vec, dtype=np.float32)

        def reset(self, *, seed=None, options=None):
            super().reset(seed=seed)
            self._processes = []
            self._tick = 0
            return self._obs(), {}

        def step(self, action):
            # Minimal step for training — not used in live sim
            self._tick += 1
            reward = 0.0
            done   = self._tick > 200
            return self._obs(), reward, done, False, {}

    class PPOAgent:
        MODEL_PATH = os.path.join(os.path.dirname(__file__), "ppo_scheduler.zip")

        def __init__(self) -> None:
            self._env   = SchedulerEnv()
            self._model = None
            if os.path.exists(self.MODEL_PATH):
                self._model = SB3_PPO.load(self.MODEL_PATH, env=self._env)

        def decide(
            self,
            tick: int,
            processes: List["_Process"],
        ) -> AgentAction:
            if self._model is None:
                # Fall back to heuristic if no trained model
                return HeuristicAgent().decide(tick, processes)

            self._env._processes = processes
            obs = self._env._obs()
            action, _ = self._model.predict(obs, deterministic=True)
            action = int(action)

            # Map action index to pid
            ready = [p for p in processes if p.state == ProcessState.READY]
            scheduled_pid = None
            if action > 0 and action <= len(ready):
                scheduled_pid = ready[action - 1].pid

            # Bandwidth: uniform split for PPO (simple for now)
            active = [p for p in processes if p.state != ProcessState.DONE]
            per   = TOTAL_BANDWIDTH // (len(active) or 1)
            bw    = {str(p.pid): per for p in active}

            return AgentAction(scheduled_pid=scheduled_pid, bandwidth_alloc=bw)

    _PPO_AVAILABLE = True

except ImportError:
    _PPO_AVAILABLE = False


# ---------------------------------------------------------------------------
# Public facade
# ---------------------------------------------------------------------------

class SchedulerAgent:
    """
    Unified agent that delegates to HeuristicAgent or PPOAgent depending
    on the selected mode. PPO falls back to heuristic if unavailable.
    """

    def __init__(self) -> None:
        self._heuristic = HeuristicAgent()
        self._ppo       = PPOAgent() if _PPO_AVAILABLE else None

    def decide(
        self,
        tick: int,
        processes: List["_Process"],
        mode: AgentMode,
    ) -> AgentAction:
        if mode == AgentMode.PPO and self._ppo is not None:
            return self._ppo.decide(tick, processes)
        return self._heuristic.decide(tick, processes)

    @staticmethod
    def ppo_available() -> bool:
        return _PPO_AVAILABLE
