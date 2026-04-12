import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { validateWorkspaceBoundary, isBinaryFile } from '../utils/fs-guard.ts';
import type { ToolDefinition, ToolResult } from './types.ts';

export const patchSemanticTool: ToolDefinition = {
  name: 'patch_semantic',
  description: `Modifies a file by finding a specific block of text and replacing it.
This is highly PREFERRED over 'patch_file' (line numbers) because it avoids corrupting files when line numbers drift.
Provide a unique 'search_content' that EXACTLY matches a block of code currently in the file (including indentation), and 'replacement_content' to insert.`,
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the file to modify' },
      search_content: { type: 'string', description: 'The exact text block to find in the file. Must be unique.' },
      replacement_content: { type: 'string', description: 'The text to substitute in place of the search_content.' },
    },
    required: ['path', 'search_content', 'replacement_content'],
  },
  execute: async ({ path, search_content, replacement_content }: { path: string, search_content: string, replacement_content: string }): Promise<ToolResult> => {
    try {
      const realPath = await validateWorkspaceBoundary(path);

      if (!existsSync(realPath)) {
        return { content: `Error: File not found at ${path}`, isError: true };
      }

      if (await isBinaryFile(realPath)) {
        return { content: `Error: Cannot patch binary file.`, isError: true };
      }

      const content = readFileSync(realPath, 'utf-8');

      // Normalize newlines in case of Windows/Unix edge cases
      const normalizedContent = content.replace(/\r\n/g, '\n');
      const normalizedSearch = search_content.replace(/\r\n/g, '\n');
      const normalizedReplacement = replacement_content.replace(/\r\n/g, '\n');

      const parts = normalizedContent.split(normalizedSearch);

      if (parts.length === 1) {
        // Fallback checks for better error reporting
        const trimmedSearch = normalizedSearch.trim();
        if (normalizedContent.includes(trimmedSearch)) {
           return { content: `Error: search_content matched after trimming, but your input failed because of leading/trailing whitespace. Copy the exact indentation from the file.`, isError: true };
        }
        return { content: `Error: search_content not found in file. Make sure you copied it exactly from the file, including leading spaces.`, isError: true };
      }

      if (parts.length > 2) {
        return { content: `Error: search_content matched ${parts.length - 1} times. It must be unique to avoid patching the wrong location. Provide more surrounding context lines in your search_content.`, isError: true };
      }

      const finalContent = parts[0] + normalizedReplacement + parts[1];
      writeFileSync(realPath, finalContent, 'utf-8');

      return {
        content: `Successfully semantically patched ${path}.`,
      };
    } catch (e: any) {
      return { content: `Error patching file: ${e.message}`, isError: true };
    }
  },
};
