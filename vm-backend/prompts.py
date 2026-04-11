import json


SYSTEM_PROMPT = """You are the reasoning layer of a virtual machine called CortexVM.
You observe bytecode execution state and provide real-time understanding.
Always respond with valid JSON only. No markdown, no explanation outside the JSON."""


def build_prompt(window: list[dict], window_size: int) -> str:
    return f"""Current execution window (last {window_size} instructions):
{json.dumps(window, indent=2)}

Respond with exactly this JSON object:
{{
  "intent": "one sentence — what is this program trying to do overall",
  "step": "one sentence — what just happened in the last instruction",
  "prediction": "one sentence — what will happen next, or null",
  "warning": "one sentence — any anomaly, bug, or infinite loop risk, or null"
}}

Be concise. Use plain English. Do not explain opcodes — explain program behavior.
If you detect a loop where the counter never changes, set warning immediately."""