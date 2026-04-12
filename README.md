# zex - AI Coding Assistant

<p align="center">
  <img src="image.png" alt="zex banner">
</p>

<p align="center">
  <strong>Context-Aware · Security-First · Token-Efficient</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Bun-1.1-black?logo=bun&logoColor=white" alt="Bun">
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" alt="React">
  <img src="https://img.shields.io/badge/Gemini-2.0_Flash-4285F4?logo=google-gemini&logoColor=white" alt="Gemini">
  <img src="https://img.shields.io/badge/Ink-React_TUI-CC3333?logo=react&logoColor=white" alt="Ink">
</p>

`zex` is a CLI-based AI coding assistant designed to solve the "context pollution" problem. Most assistants either send too much or too little context. `zex` manages context deliberately, pruning stale data between turns and keeping a strict token budget while enforcing military-grade security guardrails.

---

### Security Guardrails

Security is not an afterthought. Every interaction is gated by a multi-tier security layer:

- **In-Process Scanner**: Real-time scanning for 7 critical vulnerability patterns (XSS, SQLi, Command Injection) before any file write occurs.
- **Automated Project Audit**: Scans your codebase on launch to detect your tech stack (Next.js, Express, etc.) and identify pre-existing security gaps.
- **Vulnerability Blocking**: Gated write tools (`write_file`, `patch_file`) that prevent the agent from introducing insecure code.
- **Security Dashboard**: The `/security` command provides a detailed audit log of all blocks, warnings, and findings in your session.

### Advanced Context Hygiene

- **Relevance-Aware GC**: Prunes history intelligently. Tool results are only compressed if they are old, large, and **not referenced** in the recent conversation.
- **TOON Encoding**: Integrated compact encoding for directory listings and search results, providing up to **50% token reduction** for large datasets.
- **Intent Clarifier**: A high-speed intent parser pre-analyzes every request to disambiguate vague commands and flag security risks early.

### Core Features

- **Multi-Key Rotation**: Automatically cycles through your Gemini API key pool to bypass rate limits and ensure uninterrupted workflow.
- **Slash Commands**:
  - `/security`: View the full security audit and event history.
  - `/undo`: Instant revert of the last file change.
  - `/plan`: Toggle mode to force the agent to propose a plan before touching code.
  - `/keys`: Check the health and cooldown status of your API keys.
- **Streaming TUI**: A beautiful, reactive terminal interface built with React (Ink).

### Advantages

- **Extreme Token Efficiency**: Do more with less context.
- **Safe Vibe Coding**: Focus on building while `zex` handles context management and security.
- **Smart Pruning**: Keeps your context window fresh and free of repetitive tool logs.

---

### 🏁 Getting Started

#### Prerequisites
- Node.js 18+ or Bun
- One or more Gemini API Keys

#### Installation
```bash
bun install
```

#### Run
```bash
bun dev 
```
