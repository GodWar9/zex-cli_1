# Zex: The AI Agent Architecture Overview

This document highlights the newly added components, structural patterns, and tools that make `zex` significantly more resilient, token-efficient, and capable compared to standard CLI models. 

Below are the elite features running in the machine right now:

---

## ⚙️ Core Flow Architecture

### 1. The Pruner (`src/agent/pruner.ts`)
The Pruner intercepts conversations and calculates **exactly how much of the System Prompt** actually needs to be sent based on the active turn type. 
- **The Problem:** Sending the 2000-token system prompt on every single tool execution turn completely depletes API quotas / user token budgets on complex tasks.
- **The Solution:** The Pruner distinguishes between `first_user` turns (send everything), `continuation` turns (drop project instructions), and `tool_loopback` turns (drop almost all instructions, saving ~700+ tokens per loop). It forces an incredibly tight context window when the agent natively loops.

### 2. The Garbage Collector (GC) (`src/agent/gc.ts`)
The "Safe" Garbage collector. 
- **The Problem:** If the agent reads a massive 2000-line database dump or runs a massive tree listing, those thousands of characters linger in the model's chat history for the rest of the session causing extreme lag and token bleeding.
- **The Solution:** `compressHistory` runs seamlessly in the background stream. It scans for any tool outputs larger than 800 characters. If the result is older than 2 conversation turns, it physically replaces the heavy text payload with a lightweight tombstone message (e.g. `[Heavy payload compressed]`), preserving the timeline integrity while reclaiming thousands of tokens!

### 3. Persistent Working Memory (`src/agent/prompt.ts`)
This acts as the agent's long-term memory bridge preventing session-to-session hallucination.
- **The Feature:** Rather than guessing what the user project is, `workingMemorySegment()` intercepts the system builder. It auto-detects the project root, reads `project.md` (the living project ledger), and injects it verbatim directly into a `# Persistent Working Memory` segment. No matter how much history is pruned or compressed, `zex` always has an up-to-date, holistic brain of the software it is currently building.

---

## 🛠️ The Elite Tool Arsenal

### The Tool Registry (`src/tools/index.ts`)
The universal registry array `availableTools` dictates the exact execution prioritization order for the LLM. 
The agent has access to these specific superpowers:

### `list_directory`
- **Purpose:** Auto-Orientation. 
- Instead of ever asking the user "what folder are you in?", the model explores natively, visualizing the recursive file tree of the running project so it instantly understands the architecture it is dealing with. 

### `search_files`
- **Purpose:** Contextual Locating. 
- Acts effectively as a built-in search/grep engine. The model is trained to search for component names or exported functions before assuming they exist, allowing it to navigate thousands of files correctly without getting lost.

### `patch_semantic` (NEW!)
- **Purpose:** 100% Bug-Free File Rewriting.
- **Why it matters:** Older models use line numbers to patch files (i.e. "replace lines 4 to 8"). This breaks instantly if the model miscounts. The `patch_semantic` tool uses block-level fuzzy diffs. It finds the exact `search_content` inside the file and flawlessly substitutes it. It completely disables the single greatest vector for agent hallucinations: code drift.

### `update_project_status`
- **Purpose:** Documentation auto-sync.
- After a major branch or feature completes, the assistant organically fires this tool to update the physical `project.md` ledger. It ensures that the Persistent Working Memory stays perfectly up-to-date.

### `run_shell_command`
- **Purpose:** Action Execution.
- Executes safe `bash -c` shell commands strictly within user-granted permission boundaries. Uses it to invoke tests, run npm/bun dev scripts, git commands, and anything else the user requires.
