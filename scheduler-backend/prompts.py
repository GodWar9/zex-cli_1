"""
prompts.py — Prompt construction for CortexScheduler LLM narration.

Builds the Scheduler Prompt Template defined in requirements.md:

  You are the reasoning layer of CortexOS — watching the OS scheduler operate.
  Current scheduler window (last {window_size} ticks):
  {scheduler_window_json}
  Respond with exactly this JSON: ...
"""

from __future__ import annotations

import json
from typing import List

from models import SchedulerEvent

SCHEDULER_SYSTEM_PROMPT = """\
You are the reasoning layer of CortexOS — watching the OS scheduler operate.
You have deep knowledge of CPU scheduling, bandwidth allocation, and OS resource management.
Always respond with exactly the JSON format requested. Plain English only — no jargon about
opcodes, implementation details, or code. Focus on scheduling behavior.
"""


def build_scheduler_prompt(
    window: List[SchedulerEvent],
    window_size: int = 10,
) -> str:
    """
    Build the full prompt sent to Gemini / OpenRouter for scheduler narration.
    """
    # Serialise the event window (Pydantic → dict → JSON string)
    window_data = [e.model_dump(mode="json") for e in window]
    window_json = json.dumps(window_data, indent=2)

    prompt = f"""\
You are the reasoning layer of CortexOS — watching the OS scheduler operate.
Current scheduler window (last {window_size} ticks):
{window_json}

Respond with exactly this JSON (no markdown fences, no extra keys):
{{
  "intent":     "what is the scheduler trying to achieve right now",
  "step":       "what decision was just made and why",
  "prediction": "what will likely happen in the next few ticks, or null",
  "warning":    "any starvation, congestion, or fairness risk detected, or null"
}}

Rules:
- Be concise. Plain English. Explain scheduling behavior, not implementation.
- Flag process starvation immediately if any process has waited more than 20 ticks.
- Flag congestion risk if bandwidth_usage is consistently at or above 95 for 3+ ticks.
- warning must be a non-null string if any risk is detected.
"""
    return prompt
