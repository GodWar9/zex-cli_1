// ─── Bash Tool ────────────────────────────────────────────────────────────────
// Executes shell commands in a subshell.
//
// Features:
//  - Configurable timeout (default 30s, max 120s)
//  - Custom working directory (defaults to cwd)
//  - Captures both stdout and stderr separately
//  - Reports exit code
//  - Truncates excessively long output instead of flooding context
//  - Never inherits SHELL injection via arg splitting — always uses bash -c
//
// IMPORTANT: The runner.ts permission gate (Y/n prompt) fires BEFORE this
// executes. The user must approve every single command.

import type { ToolDefinition, ToolResult } from './types.ts';

const DEFAULT_TIMEOUT_MS = 30_000;   // 30 seconds
const MAX_TIMEOUT_MS     = 120_000;  // 2 minutes hard cap
const MAX_OUTPUT_CHARS   = 20_000;   // truncate output beyond this
const MAX_OUTPUT_LINES   = 500;      // also cap by line count

function truncate(text: string, label: string): string {
  const lines = text.split('\n');
  if (lines.length > MAX_OUTPUT_LINES) {
    const kept = lines.slice(0, MAX_OUTPUT_LINES);
    return kept.join('\n') + `\n… [${label} truncated: ${lines.length - MAX_OUTPUT_LINES} more lines]`;
  }
  if (text.length > MAX_OUTPUT_CHARS) {
    return text.slice(0, MAX_OUTPUT_CHARS) + `\n… [${label} truncated: ${text.length - MAX_OUTPUT_CHARS} more chars]`;
  }
  return text;
}

export const bashTool: ToolDefinition = {
  name: 'run_shell_command',
  description: `Executes a shell command via bash and returns the output.
Use for: running scripts, installing packages, building projects, running tests, checking git status, listing files, etc.
Always prefer targeted, safe commands. Avoid destructive commands (rm -rf, format, etc.) unless explicitly instructed.
The user will be shown the exact command and asked to approve it before it runs.`,

  inputSchema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description:
          'The shell command to execute. Runs via `bash -c`. Multi-line commands are supported.',
      },
      working_directory: {
        type: 'string',
        description:
          'Directory to run the command in. Defaults to the current working directory.',
      },
      timeout_seconds: {
        type: 'number',
        description:
          'Maximum time to wait in seconds (1–120). Defaults to 30. The process is killed after this.',
      },
      description: {
        type: 'string',
        description:
          'A short human-readable description of what this command does (shown to user in the approval prompt).',
      },
    },
    required: ['command'],
  },

  async execute({
    command,
    working_directory,
    timeout_seconds,
    description: _description,
  }: {
    command: string;
    working_directory?: string;
    timeout_seconds?: number;
    description?: string;
  }): Promise<ToolResult> {
    const cwd = working_directory ?? process.cwd();
    const timeoutMs = Math.min(
      Math.max((timeout_seconds ?? 30) * 1000, 1000),
      MAX_TIMEOUT_MS,
    );

    let stdout = '';
    let stderr = '';
    let exitCode: number | null = null;
    let timedOut = false;

    try {
      const proc = Bun.spawn(['bash', '-c', command], {
        cwd,
        stdout: 'pipe',
        stderr: 'pipe',
        env: Object.fromEntries(
          Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined)
        ),
      });

      // Race: either the process finishes or we kill it after timeout
      const timeoutHandle = setTimeout(() => {
        timedOut = true;
        proc.kill();
      }, timeoutMs);

      const [stdoutText, stderrText] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);

      await proc.exited;
      clearTimeout(timeoutHandle);

      stdout  = truncate(stdoutText.trimEnd(), 'stdout');
      stderr  = truncate(stderrText.trimEnd(), 'stderr');
      exitCode = proc.exitCode;
    } catch (err: any) {
      return {
        content: JSON.stringify({
          success: false,
          error: `Failed to spawn process: ${err.message}`,
          command,
          working_directory: cwd,
        }, null, 2),
        isError: true,
      };
    }

    const success = !timedOut && exitCode === 0;

    const result = {
      success,
      exit_code: timedOut ? 'killed (timeout)' : exitCode,
      working_directory: cwd,
      command,
      stdout: stdout || '(no output)',
      stderr: stderr || '(none)',
      ...(timedOut ? { timed_out: true, timeout_seconds: timeoutMs / 1000 } : {}),
    };

    return {
      content: JSON.stringify(result, null, 2),
      isError: !success,
    };
  },
};
