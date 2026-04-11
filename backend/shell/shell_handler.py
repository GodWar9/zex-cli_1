"""
shell/shell_handler.py — CortexShell endpoint logic.

Accepts natural language commands, queries system state, sends to LLM,
returns structured analysis + action + response.
"""

from __future__ import annotations

import json
from typing import Dict, Any

import httpx
from dotenv import load_dotenv
import os

load_dotenv()

from .prompts import build_shell_prompt

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"


async def handle_shell_command(
    command: str,
    scheduler_state: Dict[str, Any] | None = None,
    vm_steps: list | None = None,
) -> Dict[str, str]:
    """
    Process a natural language shell command.
    Returns { "analysis": ..., "action": ..., "response": ... }
    """
    prompt = build_shell_prompt(command, scheduler_state, vm_steps)

    try:
        url = f"{GEMINI_BASE_URL}/models/{GEMINI_MODEL}:generateContent"
        params = {"key": GEMINI_API_KEY}
        body = {
            "contents": [{"parts": [{"text": prompt}], "role": "user"}],
            "generationConfig": {"temperature": 0.3, "maxOutputTokens": 512},
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, params=params, json=body)
            resp.raise_for_status()
            data = resp.json()

        text = (
            data.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "")
        )

        # Extract JSON from response
        parsed = _extract_json(text)
        if parsed:
            return {
                "analysis": parsed.get("analysis", ""),
                "action": parsed.get("action", "none"),
                "response": parsed.get("response", text),
            }

        return {
            "analysis": "Processed command",
            "action": "none",
            "response": text.strip(),
        }

    except Exception as e:
        return {
            "analysis": "Error processing command",
            "action": "none",
            "response": f"Shell error: {str(e)}",
        }


def _extract_json(text: str) -> dict | None:
    text = text.strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        return None
    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return None
