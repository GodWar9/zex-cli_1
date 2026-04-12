import { realpath } from 'node:fs/promises';
import { resolve, join } from 'node:path';

// 10 MB limits
export const MAX_READ_SIZE = 10 * 1024 * 1024;
export const MAX_WRITE_SIZE = 10 * 1024 * 1024;

export async function validateWorkspaceBoundary(targetPath: string): Promise<string> {
  const cwd = process.cwd();
  const absoluteTarget = resolve(cwd, targetPath);
  
  let realTarget;
  try {
    realTarget = await realpath(absoluteTarget);
  } catch (e: any) {
    // If the file doesn't exist yet, we check the parent directory
    if (e.code === 'ENOENT') {
      const parentDir = resolve(absoluteTarget, '..');
      const realParent = await realpath(parentDir);
      realTarget = join(realParent, absoluteTarget.split('/').pop()!);
    } else {
      throw e;
    }
  }

  const realCwd = await realpath(cwd);

  if (!realTarget.startsWith(realCwd)) {
    throw new Error(`Path ${targetPath} escapes the workspace boundary (${realCwd}).`);
  }

  return realTarget;
}

export async function isBinaryFile(filePath: string): Promise<boolean> {
  const file = Bun.file(filePath);
  if (!(await file.exists())) return false;
  
  const buffer = await file.slice(0, 8192).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  return bytes.includes(0);
}
