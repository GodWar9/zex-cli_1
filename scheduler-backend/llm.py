"""
llm.py — LLM client for CortexScheduler.

Primary:  Gemini Flash (GEMINI_API_KEY)
Fallback: Gemini Flash with a second key (GEMINI_API_KEY_2)

Both use the same Gemini streaming API — the only difference is the key.
Fully async; never blocks the WebSocket or simulator loop.
"""

from __future__ import annotations

import asyncio
import json
import os
from typing import AsyncGenerator

import httpx
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY        = os.getenv("GEMINI_API_KEY", "")
GEMINI_API_KEY_2      = os.getenv("GEMINI_API_KEY_2", "")
GEMINI_MODEL          = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
GEMINI_FALLBACK_MODEL = os.getenv("GEMINI_FALLBACK_MODEL", "gemini-2.0-flash")

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
TIMEOUT         = httpx.Timeout(30.0, connect=10.0)


# ---------------------------------------------------------------------------
# Gemini streaming (shared implementation — parameterised by key + model)
# ---------------------------------------------------------------------------

async def _stream_gemini(
    prompt: str,
    api_key: str,
    model: str,
) -> AsyncGenerator[str, None]:
    url    = f"{GEMINI_BASE_URL}/models/{model}:streamGenerateContent"
    params = {"key": api_key, "alt": "sse"}
    body   = {
        "contents":       [{"parts": [{"text": prompt}], "role": "user"}],
        "generationConfig": {"temperature": 0.4, "maxOutputTokens": 512},
    }

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        async with client.stream("POST", url, params=params, json=body) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if line.startswith("data: "):
                    raw = line[6:].strip()
                    if raw in ("", "[DONE]"):
                        continue
                    try:
                        obj  = json.loads(raw)
                        text = (
                            obj.get("candidates", [{}])[0]
                            .get("content", {})
                            .get("parts", [{}])[0]
                            .get("text", "")
                        )
                        if text:
                            yield text
                    except (json.JSONDecodeError, IndexError, KeyError):
                        continue


# ---------------------------------------------------------------------------
# Public interface — primary then fallback key
# ---------------------------------------------------------------------------

async def stream_narration(prompt: str) -> AsyncGenerator[str, None]:
    """
    Stream LLM tokens.
    - Tries GEMINI_API_KEY + GEMINI_MODEL first.
    - On any error, retries with GEMINI_API_KEY_2 + GEMINI_FALLBACK_MODEL.
    - If both fail, yields a JSON error placeholder so the frontend never hangs.
    """
    # --- Primary ---
    try:
        async for chunk in _stream_gemini(prompt, GEMINI_API_KEY, GEMINI_MODEL):
            yield chunk
        return
    except Exception as e:
        print(f"[llm] Primary Gemini key failed ({e}), trying fallback key…")

    # --- Fallback (second Gemini key) ---
    if GEMINI_API_KEY_2:
        try:
            async for chunk in _stream_gemini(prompt, GEMINI_API_KEY_2, GEMINI_FALLBACK_MODEL):
                yield chunk
            return
        except Exception as e:
            print(f"[llm] Fallback Gemini key also failed: {e}")
    else:
        print("[llm] GEMINI_API_KEY_2 not set — no fallback available.")

    # --- Both failed ---
    yield json.dumps({
        "intent":     "LLM unavailable",
        "step":       "Both Gemini keys failed. Check GEMINI_API_KEY and GEMINI_API_KEY_2 in .env.",
        "prediction": None,
        "warning":    "LLM narration offline",
    })


async def complete_narration(prompt: str) -> str:
    """
    Collect the full streamed response into one string.
    Used for non-streaming REST fallback.
    """
    parts: list[str] = []
    async for chunk in stream_narration(prompt):
        parts.append(chunk)
    return "".join(parts)
