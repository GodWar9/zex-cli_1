import { Buffer } from 'node:buffer';
import { validateWorkspaceBoundary, MAX_WRITE_SIZE } from '../utils/fs-guard.ts';
import type { ToolDefinition } from './types.ts';
import { scanCode } from '../security/scanner.ts'; // zex: added for security-layer
import { logSecurityEvent, getCurrentTurn } from '../security/eventLog.ts'; // zex: added for security-layer

// zex: added for security-layer — max retries before surfacing to user instead of looping
const MAX_SECURITY_RETRIES = new Map<string, number>();
const MAX_RETRY_COUNT = 2;

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

      // zex: added for security-layer — scan before writing
      const findings = scanCode(content);
      const criticals = findings.filter((f) => f.severity === 'critical');
      const highs = findings.filter((f) => f.severity === 'high');
      const mediums = findings.filter((f) => f.severity === 'medium');

      // Track retries per file path to prevent infinite self-correction loops
      if (criticals.length > 0) {
        const retryKey = path;
        const retries = MAX_SECURITY_RETRIES.get(retryKey) ?? 0;
        if (retries >= MAX_RETRY_COUNT) {
          MAX_SECURITY_RETRIES.delete(retryKey);
          const detail = criticals.map((f) => `  • ${f.label} at line ${f.lineNumber}`).join('\n');
          return {
            content: `[Security Block — Max Retries Exceeded]: Writing to ${path} has been blocked ${MAX_RETRY_COUNT} times due to critical vulnerabilities. Manual intervention required:\n${detail}`,
            isError: true,
          };
        }
        MAX_SECURITY_RETRIES.set(retryKey, retries + 1);

        const first = criticals[0]!;
        logSecurityEvent({
          turn: getCurrentTurn(),
          tool: 'write_file',
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
      MAX_SECURITY_RETRIES.delete(path);

      const realPath = await validateWorkspaceBoundary(path);
      const file = Bun.file(realPath);

      const isUpdate = await file.exists();

      // Log high findings as warnings (non-blocking)
      let warningPrefix = '';
      if (highs.length > 0) {
        const first = highs[0]!;
        logSecurityEvent({
          turn: getCurrentTurn(),
          tool: 'write_file',
          file: path,
          finding: first,
          action: 'warned',
          timestamp: new Date(),
        });
        warningPrefix = `[Security Warning]: ${first.label} detected at line ${first.lineNumber}. Consider reviewing.\n`;
      }

      // Log medium findings silently
      for (const med of mediums) {
        logSecurityEvent({
          turn: getCurrentTurn(),
          tool: 'write_file',
          file: path,
          finding: med,
          action: 'logged',
          timestamp: new Date(),
        });
      }

      await Bun.write(realPath, content);

      const resultObj = {
        type: isUpdate ? 'update' : 'create',
        filePath: realPath,
        linesWritten: content.split('\n').length
      };

      return { content: warningPrefix + JSON.stringify(resultObj, null, 2) };
    } catch (e: any) {
      return { content: `Error writing file: ${e.message}`, isError: true };
    }
  }
};
