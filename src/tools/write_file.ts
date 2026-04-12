import { Buffer } from 'node:buffer';
import { validateWorkspaceBoundary, MAX_WRITE_SIZE } from '../utils/fs-guard.ts';
import type { ToolDefinition } from './types.ts';

export const writeFileTool: ToolDefinition = {
  name: 'write_file',
  description: 'Writes all content to a file, completely replacing its existing content. Enforces workspace boundaries.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the file to write' },
      content: { type: 'string', description: 'The raw text content to write into the file' }
    },
    required: ['path', 'content']
  },
  execute: async ({ path, content }: { path: string, content: string }) => {
    try {
      if (Buffer.byteLength(content) > MAX_WRITE_SIZE) {
        return { content: `Error: Content is too large (${Buffer.byteLength(content)} bytes, max ${MAX_WRITE_SIZE} bytes)`, isError: true };
      }

      const realPath = await validateWorkspaceBoundary(path);
      const file = Bun.file(realPath);
      
      const isUpdate = await file.exists();
      
      await Bun.write(realPath, content);
      
      const resultObj = {
        type: isUpdate ? 'update' : 'create',
        filePath: realPath,
        linesWritten: content.split('\n').length
      };

      return { content: JSON.stringify(resultObj, null, 2) };
    } catch (e: any) {
      return { content: `Error writing file: ${e.message}`, isError: true };
    }
  }
};
