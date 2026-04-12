// ─── Project Status Tool ──────────────────────────────────────────────────────
// Maintains a project.md file in the detected (or specified) project root.
//
// Project root detection priority:
//   1. Explicit project_directory passed by zex (from context — which folder it's working in)
//   2. Walk up from the hint_path (or cwd) looking for project markers
//      (package.json, .git, requirements.txt, Cargo.toml, go.mod, etc.)
//   3. Fall back to cwd if no marker found

import { writeFileSync, existsSync } from 'node:fs';
import { join, isAbsolute, resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import type { ToolDefinition, ToolResult } from './types.ts';

// Files/dirs that indicate the root of a project
const PROJECT_MARKERS = [
  'package.json',
  '.git',
  'requirements.txt',
  'Pipfile',
  'pyproject.toml',
  'Cargo.toml',
  'go.mod',
  'pom.xml',
  'build.gradle',
  'Makefile',
  'composer.json',
  '.gitignore',
];

function expandPath(p: string): string {
  return p.startsWith('~/') || p === '~' ? p.replace(/^~/, homedir()) : p;
}

/**
 * Walk up from startDir looking for any project marker.
 * Returns the first directory that contains one, or cwd as fallback.
 */
export function detectProjectRoot(startDir: string): string {
  let dir = startDir;
  // Walk up at most 6 levels — don't escape to /
  for (let i = 0; i < 6; i++) {
    for (const marker of PROJECT_MARKERS) {
      if (existsSync(join(dir, marker))) {
        return dir;
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }
  return startDir; // fallback — use what was provided
}

function buildProjectStatusMarkdown(input: {
  what_we_are_building: string;
  current_status: string;
  current_level: string;
  what_is_working: string;
  what_went_wrong: string;
  what_was_done: string;
  next_steps: string;
  project_root: string;
}): string {
  const now = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return `# Project Status

> Maintained automatically by zex · Last updated: **${now}**
> Project root: \`${input.project_root}\`

---

## 🏗 What We Are Building

${input.what_we_are_building}

---

## 📍 Current Level / Stage

${input.current_level}

---

## ✅ Current Status

${input.current_status}

---

## 🟢 What Is Working

${input.what_is_working || '_Nothing confirmed working yet._'}

---

## 🔴 What Went Wrong / Issues

${input.what_went_wrong || '_No issues recorded._'}

---

## 🔨 What Was Done

${input.what_was_done || '_Nothing done yet._'}

---

## 🔜 Next Steps

${input.next_steps || '_Not planned yet._'}
`;
}

export const projectStatusTool: ToolDefinition = {
  name: 'update_project_status',
  description: `Writes or updates project.md in the project root.

Do NOT ask the user where to put it — figure it out from context:
- If you just ran a command inside a folder (e.g. "npx create-react-app react_project"), pass that folder as project_directory.
- If you are editing files inside a subfolder, pass that subfolder as project_directory.
- If you are unsure, omit project_directory and the tool will auto-detect from common markers (package.json, .git, etc).

Call this tool:
- When starting to work on a new project or feature
- After completing a meaningful piece of work
- When something breaks or an error is discovered
- When the plan changes or a bug is fixed
Do NOT call it for trivial questions.`,

  inputSchema: {
    type: 'object',
    properties: {
      project_directory: {
        type: 'string',
        description:
          'The folder you are actively working in (e.g. "react_project", "~/Developer/my-app/frontend"). ' +
          'Use an absolute path or a path relative to cwd. Omit to auto-detect from cwd.',
      },
      what_we_are_building: {
        type: 'string',
        description: 'What project or feature is being built. Be specific.',
      },
      current_level: {
        type: 'string',
        description: 'Stage of the project. E.g. "Scaffolding", "Core logic done, UI pending", "MVP complete", "Debugging".',
      },
      current_status: {
        type: 'string',
        description: 'One-paragraph summary of the current state.',
      },
      what_is_working: {
        type: 'string',
        description: 'Bullet list of things confirmed working.',
      },
      what_went_wrong: {
        type: 'string',
        description: 'Bullet list of problems/errors and how they were resolved (or if still open).',
      },
      what_was_done: {
        type: 'string',
        description: 'Bullet list of concrete actions completed (files created, commands run, bugs fixed).',
      },
      next_steps: {
        type: 'string',
        description: 'Bullet list of what still needs to be done.',
      },
    },
    required: ['what_we_are_building', 'current_status', 'current_level'],
  },

  async execute(input: {
    project_directory?: string;
    what_we_are_building: string;
    current_status: string;
    current_level: string;
    what_is_working?: string;
    what_went_wrong?: string;
    what_was_done?: string;
    next_steps?: string;
  }): Promise<ToolResult> {
    try {
      // Resolve the starting point for detection
      let startDir = process.cwd();
      if (input.project_directory) {
        const raw = expandPath(input.project_directory.trim());
        startDir = isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
      }

      if (!existsSync(startDir)) {
        return {
          content: `Error: Directory does not exist: ${startDir}. Check the path and try again.`,
          isError: true,
        };
      }

      // Walk up to find the real project root (or stay at startDir if it IS the root)
      const projectRoot = detectProjectRoot(startDir);
      const filePath    = join(projectRoot, 'project.md');

      const content = buildProjectStatusMarkdown({
        what_we_are_building: input.what_we_are_building,
        current_status: input.current_status,
        current_level: input.current_level,
        what_is_working: input.what_is_working ?? '',
        what_went_wrong: input.what_went_wrong ?? '',
        what_was_done: input.what_was_done ?? '',
        next_steps: input.next_steps ?? '',
        project_root: projectRoot,
      });

      writeFileSync(filePath, content, 'utf-8');

      return {
        content: `project.md written at: ${filePath} (project root: ${projectRoot})`,
        isError: false,
      };
    } catch (err: any) {
      return {
        content: `Failed to write project.md: ${err.message}`,
        isError: true,
      };
    }
  },
};
