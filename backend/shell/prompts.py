"""
shell/prompts.py — Prompt templates for CortexShell.
"""

import json
from typing import Dict, Any, Optional


SHELL_SYSTEM_PROMPT = """\
You are CortexShell, the AI command interface of CortexOS — an AI-native operating system.
You can analyze system state, explain what's happening, and suggest actions.
You speak concisely and authoritatively, like an OS kernel responding to a sysadmin.
Always respond in the exact JSON format requested. No markdown fences."""


def build_shell_prompt(
    user_command: str,
    scheduler_state: Optional[Dict[str, Any]] = None,
    vm_steps: Optional[list] = None,
) -> str:
    context_parts = []

    if scheduler_state:
        context_parts.append(f"Current scheduler state:\n{json.dumps(scheduler_state, indent=2)}")

    if vm_steps:
        last_steps = vm_steps[-5:]  # Last 5 steps
        context_parts.append(f"Recent VM execution steps:\n{json.dumps(last_steps, indent=2)}")

    context = "\n\n".join(context_parts) if context_parts else "No active system state available."

    return f"""\
{SHELL_SYSTEM_PROMPT}

System context:
{context}

User command: "{user_command}"

Respond with exactly this JSON (no markdown, no extra keys):
{{
  "analysis": "brief analysis of what the user is asking about, given system state",
  "action": "what action should be taken, or 'none' if just informational",
  "response": "natural language response to show the user"
}}
"""
