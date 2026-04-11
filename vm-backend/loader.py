import os
from pathlib import Path

PROGRAMS_DIR = Path(__file__).parent / "programs"

PROGRAM_REGISTRY = {
    "bubble_sort": {
        "filename": "bubble_sort.cvm",
        "description": "Sorts a 5-element array using bubble sort. LLM narrates comparisons and swaps.",
    },
    "fibonacci": {
        "filename": "fibonacci.cvm",
        "description": "Computes fib(8) iteratively. LLM explains the unrolling.",
    },
    "infinite_loop_bug": {
        "filename": "infinite_loop_bug.cvm",
        "description": "Intentional bug: loop counter never decrements. LLM flags it.",
    },
}


def list_programs() -> list[dict]:
    """Return all registered programs as a list of dicts."""
    return [
        {
            "name": name,
            "filename": meta["filename"],
            "description": meta["description"],
        }
        for name, meta in PROGRAM_REGISTRY.items()
    ]


def load_program(name: str) -> list[int]:
    """Load a .cvm file by program name. Returns bytecode as list of ints."""
    if name not in PROGRAM_REGISTRY:
        raise ValueError(f"Unknown program '{name}'. Available: {list(PROGRAM_REGISTRY.keys())}")

    filepath = PROGRAMS_DIR / PROGRAM_REGISTRY[name]["filename"]

    if not filepath.exists():
        raise FileNotFoundError(f"Bytecode file not found: {filepath}")

    with open(filepath, "rb") as f:
        data = f.read()

    return list(data)


def load_bytecode_direct(raw: list[int]) -> list[int]:
    """Pass-through for raw bytecode sent directly from client."""
    if not raw:
        raise ValueError("Empty bytecode")
    return raw


# ── Bytecode assembler (used to generate .cvm files) ───────────────────────────
# This is only used by the script that writes the .cvm files.
# Not called at runtime.

import struct

def push(val: int) -> bytes:
    return bytes([0x01]) + struct.pack("<q", val)   # 8-byte signed LE

def pop() -> bytes:
    return bytes([0x02])

def add() -> bytes:
    return bytes([0x03])

def sub() -> bytes:
    return bytes([0x04])

def mul() -> bytes:
    return bytes([0x05])

def div() -> bytes:
    return bytes([0x06])

def store(reg: int) -> bytes:
    return bytes([0x07, reg])

def load(reg: int) -> bytes:
    return bytes([0x08, reg])

def jmp(addr: int) -> bytes:
    return bytes([0x09]) + struct.pack("<I", addr)  # 4-byte unsigned LE

def jz(addr: int) -> bytes:
    return bytes([0x0A]) + struct.pack("<I", addr)

def halt() -> bytes:
    return bytes([0x0B])

def print_op() -> bytes:
    return bytes([0x0C])