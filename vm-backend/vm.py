from dataclasses import dataclass, field
from typing import Optional


# ── Opcodes ────────────────────────────────────────────────────────────────────

OPCODE_MAP = {
    0x01: "PUSH",
    0x02: "POP",
    0x03: "ADD",
    0x04: "SUB",
    0x05: "MUL",
    0x06: "DIV",
    0x07: "STORE",
    0x08: "LOAD",
    0x09: "JMP",
    0x0A: "JZ",
    0x0B: "HALT",
    0x0C: "PRINT",
}


# ── ExecutionEvent ──────────────────────────────────────────────────────────────

@dataclass
class ExecutionEvent:
    instruction_index: int
    pc: int
    opcode_name: str
    operand: Optional[int]
    stack: list[int]
    registers: list[int]
    output: Optional[str]   # set only on PRINT
    error: Optional[str]    # set on any runtime error
    halted: bool

    def to_dict(self) -> dict:
        return {
            "instruction_index": self.instruction_index,
            "pc": self.pc,
            "opcode_name": self.opcode_name,
            "operand": self.operand,
            "stack": self.stack,
            "registers": self.registers,
            "output": self.output,
            "error": self.error,
            "halted": self.halted,
        }


# ── CortexVM ────────────────────────────────────────────────────────────────────

class CortexVM:
    MAX_STACK = 256

    def __init__(self, bytecode: list[int]):
        self.bytecode = bytecode
        self.stack: list[int] = []
        self.registers: list[int] = [0] * 8
        self.pc: int = 0
        self.instruction_index: int = 0
        self.halted: bool = False

    def is_halted(self) -> bool:
        return self.halted

    # ── public API ──────────────────────────────────────────────────────────────

    def step_once(self) -> ExecutionEvent:
        """Advance exactly one instruction and return its ExecutionEvent."""
        if self.halted:
            return self._make_event("HALT", None, None, None, True)

        bc = self.bytecode
        pc = self.pc

        if pc >= len(bc):
            return self._finalize("EOF", None, None, "Unexpected end of bytecode")

        op = bc[pc]

        if op == 0x01:   # PUSH  <8-byte i64 LE>
            return self._op_push(bc, pc)
        elif op == 0x02: # POP
            return self._op_pop(pc)
        elif op == 0x03: # ADD
            return self._op_binary("ADD", pc, lambda a, b: a + b)
        elif op == 0x04: # SUB
            return self._op_binary("SUB", pc, lambda a, b: a - b)
        elif op == 0x05: # MUL
            return self._op_binary("MUL", pc, lambda a, b: a * b)
        elif op == 0x06: # DIV
            return self._op_div(pc)
        elif op == 0x07: # STORE <reg>
            return self._op_store(bc, pc)
        elif op == 0x08: # LOAD  <reg>
            return self._op_load(bc, pc)
        elif op == 0x09: # JMP   <4-byte addr LE>
            return self._op_jmp(bc, pc)
        elif op == 0x0A: # JZ    <4-byte addr LE>
            return self._op_jz(bc, pc)
        elif op == 0x0B: # HALT
            return self._op_halt(pc)
        elif op == 0x0C: # PRINT
            return self._op_print(pc)
        else:
            return self._finalize(
                f"INVALID(0x{op:02X})", None, None,
                f"Unknown opcode 0x{op:02X} at pc={pc}"
            )

    def run_program(self) -> list[ExecutionEvent]:
        """Run until HALT or error. Returns all ExecutionEvents."""
        events = []
        while not self.halted:
            event = self.step_once()
            events.append(event)
            if event.halted:
                break
        return events

    # ── opcode handlers ─────────────────────────────────────────────────────────

    def _op_push(self, bc, pc) -> ExecutionEvent:
        if pc + 9 > len(bc):
            return self._finalize("PUSH", None, None, "Truncated PUSH operand")
        val = int.from_bytes(bc[pc+1:pc+9], "little", signed=True)
        if len(self.stack) >= self.MAX_STACK:
            return self._finalize("PUSH", val, None, "Stack overflow")
        self.stack.append(val)
        self.pc = pc + 9
        return self._make_event("PUSH", val, None, None, False)

    def _op_pop(self, pc) -> ExecutionEvent:
        if not self.stack:
            return self._finalize("POP", None, None, "Stack underflow on POP")
        self.stack.pop()
        self.pc = pc + 1
        return self._make_event("POP", None, None, None, False)

    def _op_binary(self, name, pc, fn) -> ExecutionEvent:
        if len(self.stack) < 2:
            return self._finalize(name, None, None, f"Stack underflow on {name}")
        b = self.stack.pop()
        a = self.stack.pop()
        self.stack.append(fn(a, b))
        self.pc = pc + 1
        return self._make_event(name, None, None, None, False)

    def _op_div(self, pc) -> ExecutionEvent:
        if len(self.stack) < 2:
            return self._finalize("DIV", None, None, "Stack underflow on DIV")
        b = self.stack.pop()
        a = self.stack.pop()
        if b == 0:
            return self._finalize("DIV", None, None, "Division by zero")
        self.stack.append(a // b)
        self.pc = pc + 1
        return self._make_event("DIV", None, None, None, False)

    def _op_store(self, bc, pc) -> ExecutionEvent:
        if pc + 2 > len(bc):
            return self._finalize("STORE", None, None, "Truncated STORE operand")
        reg = bc[pc + 1]
        if reg > 7:
            return self._finalize("STORE", reg, None, f"Invalid register {reg}")
        if not self.stack:
            return self._finalize("STORE", reg, None, "Stack underflow on STORE")
        self.registers[reg] = self.stack.pop()
        self.pc = pc + 2
        return self._make_event("STORE", reg, None, None, False)

    def _op_load(self, bc, pc) -> ExecutionEvent:
        if pc + 2 > len(bc):
            return self._finalize("LOAD", None, None, "Truncated LOAD operand")
        reg = bc[pc + 1]
        if reg > 7:
            return self._finalize("LOAD", reg, None, f"Invalid register {reg}")
        if len(self.stack) >= self.MAX_STACK:
            return self._finalize("LOAD", reg, None, "Stack overflow on LOAD")
        self.stack.append(self.registers[reg])
        self.pc = pc + 2
        return self._make_event("LOAD", reg, None, None, False)

    def _op_jmp(self, bc, pc) -> ExecutionEvent:
        if pc + 5 > len(bc):
            return self._finalize("JMP", None, None, "Truncated JMP operand")
        addr = int.from_bytes(bc[pc+1:pc+5], "little")
        self.pc = addr
        return self._make_event("JMP", addr, None, None, False)

    def _op_jz(self, bc, pc) -> ExecutionEvent:
        if pc + 5 > len(bc):
            return self._finalize("JZ", None, None, "Truncated JZ operand")
        addr = int.from_bytes(bc[pc+1:pc+5], "little")
        if not self.stack:
            return self._finalize("JZ", addr, None, "Stack underflow on JZ")
        top = self.stack[-1]
        self.pc = addr if top == 0 else pc + 5
        return self._make_event("JZ", addr, None, None, False)

    def _op_halt(self, pc) -> ExecutionEvent:
        self.pc = pc + 1
        self.halted = True
        return self._make_event("HALT", None, None, None, True)

    def _op_print(self, pc) -> ExecutionEvent:
        if not self.stack:
            return self._finalize("PRINT", None, None, "Stack underflow on PRINT")
        val = self.stack.pop()
        self.pc = pc + 1
        return self._make_event("PRINT", None, str(val), None, False)

    # ── helpers ─────────────────────────────────────────────────────────────────

    def _make_event(
        self,
        opcode_name: str,
        operand: Optional[int],
        output: Optional[str],
        error: Optional[str],
        halted: bool,
    ) -> ExecutionEvent:
        event = ExecutionEvent(
            instruction_index=self.instruction_index,
            pc=self.pc,
            opcode_name=opcode_name,
            operand=operand,
            stack=self.stack.copy(),
            registers=self.registers.copy(),
            output=output,
            error=error,
            halted=halted,
        )
        self.instruction_index += 1
        return event

    def _finalize(
        self,
        opcode_name: str,
        operand: Optional[int],
        output: Optional[str],
        error: str,
    ) -> ExecutionEvent:
        """Used for all error paths — always halts the VM."""
        self.halted = True
        return self._make_event(opcode_name, operand, output, error, True)