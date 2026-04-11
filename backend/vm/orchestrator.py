from typing import AsyncGenerator
from .models import SimulatedStep
from .prompts import SYSTEM_PROMPT
from .llm import stream_simulation

class SimulatorOrchestrator:
    async def simulate(self, code: str) -> AsyncGenerator[SimulatedStep, None]:
        async for payload in stream_simulation(SYSTEM_PROMPT, code):
            if "error" in payload:
                yield SimulatedStep(
                    step_index=-1,
                    warning=payload["error"]
                )
            elif "parsed" in payload:
                p = payload["parsed"]
                yield SimulatedStep(
                    step_index=p.get("step_index", 0),
                    line_number=p.get("line_number"),
                    source_line=p.get("source_line"),
                    variables=p.get("variables", {}),
                    output=p.get("output"),
                    intent=p.get("intent"),
                    warning=p.get("warning")
                )
