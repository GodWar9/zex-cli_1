import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { validateWorkspaceBoundary, isBinaryFile } from '../utils/fs-guard.ts';
import type { ToolDefinition, ToolResult } from './types.ts';
import { scanCode } from '../security/scanner.ts'; // zex: added for security-layer
import { logSecurityEvent, getCurrentTurn } from '../security/eventLog.ts'; // zex: added for security-layer

// zex: added for security-layer — max retries before surfacing to user instead of looping
const MAX_SECURITY_RETRIES = new Map<string, number>();
const MAX_RETRY_COUNT = 2;

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

      // zex: added for security-layer — scan the replacement content before writing
      const findings = scanCode(replacement_content);
      const criticals = findings.filter((f) => f.severity === 'critical');
      const highs = findings.filter((f) => f.severity === 'high');
      const mediums = findings.filter((f) => f.severity === 'medium');

      if (criticals.length > 0) {
        const retryKey = `${path}:semantic`;
        const retries = MAX_SECURITY_RETRIES.get(retryKey) ?? 0;
        if (retries >= MAX_RETRY_COUNT) {
          MAX_SECURITY_RETRIES.delete(retryKey);
          const detail = criticals.map((f) => `  • ${f.label} at line ${f.lineNumber}`).join('\n');
          return {
            content: `[Security Block — Max Retries Exceeded]: Semantic patch to ${path} has been blocked ${MAX_RETRY_COUNT} times. Manual intervention required:\n${detail}`,
            isError: true,
          };
        }
        MAX_SECURITY_RETRIES.set(retryKey, retries + 1);

        const first = criticals[0]!;
        logSecurityEvent({
          turn: getCurrentTurn(),
          tool: 'patch_semantic',
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

      // Clear retry counter on a clean pass
      MAX_SECURITY_RETRIES.delete(`${path}:semantic`);

      let warningPrefix = '';
      if (highs.length > 0) {
        const first = highs[0]!;
        logSecurityEvent({
          turn: getCurrentTurn(),
          tool: 'patch_semantic',
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
          tool: 'patch_semantic',
          file: path,
          finding: med,
          action: 'logged',
          timestamp: new Date(),
        });
      }

      const finalContent = parts[0] + normalizedReplacement + parts[1];
      writeFileSync(realPath, finalContent, 'utf-8');

      return {
        content: `${warningPrefix}Successfully semantically patched ${path}.`,
      };
    } catch (e: any) {
      return { content: `Error patching file: ${e.message}`, isError: true };
    }
  },
};
