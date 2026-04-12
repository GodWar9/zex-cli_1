import { validateWorkspaceBoundary, isBinaryFile, MAX_READ_SIZE } from '../utils/fs-guard.ts';
import type { ToolDefinition } from './types.ts';

export const readFileTool: ToolDefinition = {
  name: 'read_file',
  description: 'Reads contents of a file at a specific path with workspace boundary enforcement.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the file to read' },
      offset: { type: 'number', description: '0-indexed start line to read from (optional)' },
      limit: { type: 'number', description: 'Maximum number of lines to read (optional)' }
    },
    required: ['path']
  },
  execute: async ({ path, offset = 0, limit }: { path: string, offset?: number, limit?: number }) => {
    try {
      const realPath = await validateWorkspaceBoundary(path);
      const file = Bun.file(realPath);
      
      if (!(await file.exists())) {
        return { content: `Error: File not found at ${path}`, isError: true };
      }

      if (file.size > MAX_READ_SIZE) {
        return { content: `Error: File is too large (${file.size} bytes, max ${MAX_READ_SIZE} bytes)`, isError: true };
      }

      if (await isBinaryFile(realPath)) {
        return { content: `Error: File appears to be binary or contains null bytes.`, isError: true };
      }

      const content = await file.text();
      const lines = content.split('\n');
      
      const startIdx = Math.max(0, offset);
      const endIdx = limit !== undefined ? Math.min(lines.length, startIdx + limit) : lines.length;
      
      const selected = lines.slice(startIdx, endIdx);
      
      const resultObj = {
        type: 'text',
        file: {
          filePath: realPath,
          content: selected.join('\n'),
          numLines: selected.length,
          startLine: startIdx + 1,
          totalLines: lines.length
        }
      };
      
      return { content: JSON.stringify(resultObj, null, 2) };
    } catch (e: any) {
      return { content: `Error reading file: ${e.message}`, isError: true };
    }
  }
};
