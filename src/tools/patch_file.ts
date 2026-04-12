import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { validateWorkspaceBoundary, isBinaryFile } from '../utils/fs-guard.ts';
import type { ToolDefinition, ToolResult } from './types.ts';

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

      writeFileSync(realPath, finalContent, 'utf-8');

      return {
        content: `Successfully patched ${path} (replaced lines ${start_line}-${end_line}).`,
      };
    } catch (e: any) {
      return { content: `Error patching file: ${e.message}`, isError: true };
    }
  },
};
