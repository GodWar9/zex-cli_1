"""
orchestrator.py — LLM narration orchestrator for CortexScheduler.

Follows the shared architecture from requirements.md:
  SchedulerEvent → sliding window (last 10) → every 5 ticks → prompt → LLM → NarrationEvent

Also handles:
  - FR-S5: LLM narrates every 5 ticks
  - FR-S6: Warning if starvation (process waiting > 20 ticks)
  - FR-S7: Warning if bandwidth consistently at 100%
  - NFR-4: LLM calls are fully async, never block the simulator
"""

from __future__ import annotations

import asyncio
import json
import os
from collections import deque
from typing import AsyncGenerator, Callable, Coroutine, List

from dotenv import load_dotenv

from .llm import stream_narration
from .models import NarrationEvent, SchedulerEvent
from .prompts import build_scheduler_prompt

load_dotenv()

LLM_WINDOW_SIZE   = int(os.getenv("LLM_WINDOW_SIZE",   "10"))
LLM_TRIGGER_EVERY = int(os.getenv("LLM_TRIGGER_EVERY", "5"))

# Starvation threshold (FR-S6)
STARVATION_TICKS = 20
# Bandwidth near-full threshold for 3+ consecutive ticks (FR-S7)
BW_CONGESTION_THRESHOLD = 95.0
BW_CONGESTION_RUNS      = 3


class SchedulerOrchestrator:
    """
    Sits between the simulator and the WebSocket sender.
    Receives SchedulerEvents, maintains the sliding window, and
    fires async LLM narration tasks every LLM_TRIGGER_EVERY ticks.

    on_narration is an async callback:  async def on_narration(event: NarrationEvent)
    """

    def __init__(
        self,
        on_narration: Callable[[NarrationEvent], Coroutine],
    ) -> None:
        self._on_narration  = on_narration
        self._window: deque[SchedulerEvent] = deque(maxlen=LLM_WINDOW_SIZE)
        self._bw_high_runs  = 0            # consecutive ticks with BW >= threshold
        self._narration_lock = asyncio.Lock()

    def reset(self) -> None:
        self._window.clear()
        self._bw_high_runs = 0

    async def ingest(self, event: SchedulerEvent) -> None:
        """
        Called for every SchedulerEvent produced by the simulator.
        Handles immediate starvation/congestion checks and periodic LLM narration.
        """
        self._window.append(event)

        # Track consecutive high-bandwidth ticks
        if event.metrics.bandwidth_usage >= BW_CONGESTION_THRESHOLD:
            self._bw_high_runs += 1
        else:
            self._bw_high_runs = 0

        tasks = []

        # --- FR-S6: Immediate starvation warning ---
        starving = [
            p for p in event.processes if p.wait_ticks > STARVATION_TICKS
        ]
        if starving:
            names = ", ".join(p.name for p in starving)
            warning_text = (
                f"{names} {'have' if len(starving) > 1 else 'has'} been waiting "
                f"{max(p.wait_ticks for p in starving)} ticks — starvation risk detected."
            )
            tasks.append(
                self._emit_narration(event.tick, "warning", warning_text)
            )

        # --- FR-S7: Bandwidth congestion warning ---
        if self._bw_high_runs >= BW_CONGESTION_RUNS:
            congestion_text = (
                f"Bandwidth has been at or above {BW_CONGESTION_THRESHOLD:.0f}% "
                f"for {self._bw_high_runs} consecutive ticks — congestion risk."
            )
            tasks.append(
                self._emit_narration(event.tick, "warning", congestion_text)
            )

        # --- FR-S5: Periodic full LLM narration every N ticks ---
        if event.tick % LLM_TRIGGER_EVERY == 0 and len(self._window) > 0:
            tasks.append(self._run_llm_narration(event.tick))

        # Fire all pending tasks concurrently, non-blocking.
        # asyncio.gather() returns a Future (not a coroutine), so we use
        # ensure_future() which accepts both coroutines and futures.
        if tasks:
            asyncio.ensure_future(asyncio.gather(*tasks, return_exceptions=True))

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _emit_narration(
        self, tick: int, narration_type: str, text: str
    ) -> None:
        n = NarrationEvent(tick=tick, narration_type=narration_type, text=text)
        await self._on_narration(n)

    async def _run_llm_narration(self, tick: int) -> None:
        """
        Ask the LLM to narrate the current window. Streams each parsed
        field (intent, step, prediction, warning) as separate NarrationEvents
        so the frontend token-streams in real time.
        """
        async with self._narration_lock:
            prompt  = build_scheduler_prompt(list(self._window), LLM_WINDOW_SIZE)
            buffer  = ""

            try:
                async for chunk in stream_narration(prompt):
                    buffer += chunk

                # Parse full JSON response
                parsed = _extract_json(buffer)
                if parsed is None:
                    # Raw fallback
                    await self._emit_narration(tick, "step", buffer.strip())
                    return

                for field, ntype in [
                    ("intent",     "intent"),
                    ("step",       "step"),
                    ("prediction", "prediction"),
                    ("warning",    "warning"),
                ]:
                    value = parsed.get(field)
                    if value:
                        await self._emit_narration(tick, ntype, str(value))

            except Exception as e:
                await self._emit_narration(
                    tick, "warning", f"LLM narration error: {e}"
                )


def _extract_json(text: str) -> dict | None:
    """
    Extract the first JSON object found in text.
    Returns None if no valid JSON found.
    """
    text = text.strip()
    start = text.find("{")
    end   = text.rfind("}")
    if start == -1 or end == -1:
        return None
    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return None
