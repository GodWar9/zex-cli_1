# zex

![zex](image.png)

<br>

intended folder structure (claw-code)

---

CLI-based AI coding assistant. Context-aware, token-efficient, open source.

## What it does

Vibe coding tools often go off in the wrong direction because they pass too much, too little, or the wrong context to the model. zex fixes that by managing context deliberately — collecting only what's relevant to the current prompt, pruning stale data between turns, and keeping a strict token budget.

## Stack

- [Bun](https://bun.com) — runtime
- TypeScript
- [Ink](https://github.com/vadimdemedes/ink) — React for terminals (TUI)

## Setup

```bash
bun install
```

## Run

```bash
bun start
# or with watch mode
bun dev
```

## Folder structure

```
src/
├── index.tsx              # entrypoint, mounts the TUI
│
├── tui/                   # everything on screen
│   ├── App.tsx            # root component, screen routing
│   ├── theme.ts           # colors and symbols
│   ├── screens/           # full-page views
│   │   └── ChatScreen.tsx # main chat interface
│   ├── components/        # reusable widgets
│   │   ├── Banner.tsx     # zex logo at top
│   │   ├── MessageList.tsx
│   │   ├── InputBox.tsx
│   │   └── StatusBar.tsx
│   └── hooks/             # TUI-scoped state logic
│
├── agent/                 # LLM turn execution
│   ├── runner.ts          # agent loop
│   ├── stream.ts          # streaming response handler
│   └── providers/         # anthropic, openai, etc.
│
├── context/               # core feature — context management
│   ├── collector.ts       # gather relevant files/snippets for a prompt
│   ├── pruner.ts          # remove stale/irrelevant context between turns
│   ├── ranker.ts          # score context chunks by relevance
│   └── window.ts          # token budget manager
│
├── tools/                 # tool implementations (bash, file read/write, search)
├── session/               # conversation persistence
├── config/                # user and project-level config
└── utils/                 # shared helpers
```
