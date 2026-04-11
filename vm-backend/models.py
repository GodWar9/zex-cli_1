from pydantic import BaseModel
from typing import Optional


class ExecutionEventModel(BaseModel):
    instruction_index: int
    pc: int
    opcode_name: str
    operand: Optional[int] = None
    stack: list[int]
    registers: list[int]
    output: Optional[str] = None
    error: Optional[str] = None
    halted: bool


class NarrationEvent(BaseModel):
    instruction_index: int
    narration_type: str   # "intent" | "step" | "prediction" | "warning" | "error"
    text: str

    def to_dict(self):
        return {
            "instruction_index": self.instruction_index,
            "narration_type": self.narration_type,
            "text": self.text,
        }


class ProgramInfo(BaseModel):
    name: str
    filename: str
    description: str


class RunRequest(BaseModel):
    program: Optional[str] = None
    bytecode: Optional[list[int]] = None