from pydantic import BaseModel
from typing import Optional, Any, Dict

class SimulatedStep(BaseModel):
    step_index: int
    line_number: Optional[int] = None
    source_line: Optional[str] = None
    variables: Dict[str, Any] = {}
    output: Optional[str] = None
    intent: Optional[str] = None
    warning: Optional[str] = None

class SimulationRequest(BaseModel):
    code: str