import os
import json
import httpx
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL   = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:streamGenerateContent?alt=sse&key={GEMINI_API_KEY}"
)

def _gemini_payload(system: str, user: str) -> dict:
    return {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 2048},
    }

async def stream_simulation(system: str, code: str):
    """
    Calls Gemini streaming and parses JSON-lines out of the raw text buffer.
    Yields parsed dicts representing steps.
    """
    payload = _gemini_payload(system, f"Code to simulate:\n\n{code}")

    async with httpx.AsyncClient(timeout=60) as client:
        async with client.stream("POST", GEMINI_URL, json=payload) as resp:
            if resp.status_code != 200:
                raw_err = await resp.aread()
                yield {"error": f"Gemini error {resp.status_code}: {raw_err.decode()}"}
                return

            buffer = ""
            async for line in resp.aiter_lines():
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if not data or data == "[DONE]":
                    continue
                try:
                    obj = json.loads(data)
                    chunk = (
                        obj.get("candidates", [{}])[0]
                           .get("content", {})
                           .get("parts", [{}])[0]
                           .get("text", "")
                    )
                    if chunk:
                        buffer += chunk
                        
                        # We try to extract full JSON lines from the buffer
                        while "\n" in buffer:
                            newline_idx = buffer.index("\n")
                            line_str = buffer[:newline_idx].strip()
                            buffer = buffer[newline_idx+1:]
                            
                            if not line_str:
                                continue
                            
                            try:
                                parsed = json.loads(line_str)
                                yield {"parsed": parsed}
                            except json.JSONDecodeError:
                                # Put it back, wait for remainder
                                buffer = line_str + "\n" + buffer
                                break
                except Exception:
                    pass
            
            # process remainder
            if buffer.strip():
                try:
                    parsed = json.loads(buffer.strip())
                    yield {"parsed": parsed}
                except json.JSONDecodeError:
                    pass