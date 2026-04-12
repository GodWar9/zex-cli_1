import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { validateWorkspaceBoundary, isBinaryFile } from '../utils/fs-guard.ts';
import type { ToolDefinition, ToolResult } from './types.ts';
import { scanCode } from '../security/scanner.ts'; // zex: added for security-layer
import { logSecurityEvent, getCurrentTurn } from '../security/eventLog.ts'; // zex: added for security-layer

// zex: added for security-layer — max retries before surfacing to user instead of looping
const MAX_SECURITY_RETRIES = new Map<string, number>();
const MAX_RETRY_COUNT = 2;

export const patchFileTool: ToolDefinition = {
  name: 'patch_file',
  description: `Modifies an existing file by replacing a specific range of lines.
Use this instead of write_file for small edits to save tokens and prevent accidentally breaking unrelated code.
You MUST provide the exact start and end lines (1-indexed, inclusive) to replace.
To insert without deleting, provide the same start and end line.`,
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the file to modify' },
      start_line: { type: 'number', description: 'Line number to start replacing (1-indexed, inclusive)' },
      end_line: { type: 'number', description: 'Line number to stop replacing (1-indexed, inclusive)' },
      new_content: { type: 'string', description: 'The new content to insert in place of the removed lines' },
    },
    required: ['path', 'start_line', 'end_line', 'new_content'],
  },
  execute: async ({
    path,
    start_line,
    end_line,
    new_content,
  }: {
    path: string;
    start_line: number;
    end_line: number;
    new_content: string;
  }): Promise<ToolResult> => {
    try {
      const realPath = await validateWorkspaceBoundary(path);

      if (!existsSync(realPath)) {
        return { content: `Error: File not found at ${path}`, isError: true };
      }

      if (await isBinaryFile(realPath)) {
        return { content: `Error: Cannot patch binary file.`, isError: true };
      }

      if (start_line < 1 || end_line < start_line) {
        return { content: `Error: Invalid line range (${start_line} to ${end_line}). Must be 1-indexed and start <= end.`, isError: true };
      }

      const content = readFileSync(realPath, 'utf-8');
      const lines = content.split('\n');

      if (start_line > lines.length) {
        return { content: `Error: start_line (${start_line}) is beyond end of file (total lines: ${lines.length})`, isError: true };
      }

      // Convert 1-indexed inclusive range to 0-indexed slice bounds
      const startIdx = start_line - 1;
      const endIdx = Math.min(lines.length, end_line);

      const before = lines.slice(0, startIdx);
      const after = lines.slice(endIdx);

      const newLines = new_content.split('\n');
      const finalContent = [...before, ...newLines, ...after].join('\n');

      // zex: added for security-layer — scan the new content before writing
      const findings = scanCode(new_content);
      const criticals = findings.filter((f) => f.severity === 'critical');
      const highs = findings.filter((f) => f.severity === 'high');
      const mediums = findings.filter((f) => f.severity === 'medium');

      if (criticals.length > 0) {
        const retryKey = `${path}:${start_line}-${end_line}`;
        const retries = MAX_SECURITY_RETRIES.get(retryKey) ?? 0;
        if (retries >= MAX_RETRY_COUNT) {
          MAX_SECURITY_RETRIES.delete(retryKey);
          const detail = criticals.map((f) => `  • ${f.label} at line ${f.lineNumber}`).join('\n');
          return {
            content: `[Security Block — Max Retries Exceeded]: Patching ${path} L${start_line}-${end_line} has been blocked ${MAX_RETRY_COUNT} times. Manual intervention required:\n${detail}`,
            isError: true,
          };
        }
        MAX_SECURITY_RETRIES.set(retryKey, retries + 1);

        const first = criticals[0]!;
        logSecurityEvent({
          turn: getCurrentTurn(),
          tool: 'patch_file',
          file: path,
          finding: first,
          action: 'blocked',
          timestamp: new Date(),
        });
        return {
          content: `[Security Block]: Writing was blocked due to critical vulnerability detected: ${first.label} at line ${first.lineNumber}. You must fix this before writing.`,
          isError: true,
        };
      }

      MAX_SECURITY_RETRIES.delete(`${path}:${start_line}-${end_line}`);

      let warningPrefix = '';
      if (highs.length > 0) {
        const first = highs[0]!;
        logSecurityEvent({
          turn: getCurrentTurn(),
          tool: 'patch_file',
          file: path,
          finding: first,
          action: 'warned',
          timestamp: new Date(),
        });
        warningPrefix = `[Security Warning]: ${first.label} detected at line ${first.lineNumber}. Consider reviewing.\n`;
      }

      for (const med of mediums) {
        logSecurityEvent({
          turn: getCurrentTurn(),
          tool: 'patch_file',
          file: path,
          finding: med,
          action: 'logged',
          timestamp: new Date(),
        });
      }

      writeFileSync(realPath, finalContent, 'utf-8');

      return {
        content: `${warningPrefix}Successfully patched ${path} (replaced lines ${start_line}-${end_line}).`,
      };
    } catch (e: any) {
      return { content: `Error patching file: ${e.message}`, isError: true };
    }
  },
};
